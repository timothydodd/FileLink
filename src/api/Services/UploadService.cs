using System.Collections.Concurrent;
using FileLink.Common;
using FileLink.Controllers;
using FileLink.Repos;

namespace FileLink.Services;

public class UploadService
{
    private readonly string _uploadPath;
    readonly ILogger<UploadService> _logger;
    // In-memory store for tracking ongoing uploads (use Redis in production)
    private static readonly ConcurrentDictionary<string, UploadSession> _activeSessions = new();
    private readonly UploadItemRepo _uploadItemRepo;
    private readonly BackgroundTaskQueue _backgroundTaskQueue;
    public UploadService(ILogger<UploadService> logger,
        StorageSettings storageSettings,
        BackgroundTaskQueue backgroundTaskQueue,
        UploadItemRepo uploadItemRepo)
    {
        _logger = logger;

        _uploadPath = StorageSettings.ResolvePath(storageSettings.SharedFilesPath);
        _backgroundTaskQueue = backgroundTaskQueue;
        _uploadItemRepo = uploadItemRepo;
    }
    public CreateUploadItemResponse StartUpload(Guid groupId, string fileName, long totalFileSize, int totalChunks)
    {
        var itemId = Guid.NewGuid();
        var session = new UploadSession
        {
            ItemId = itemId,
            FileName = fileName,
            GroupId = groupId,
            TotalChunks = totalChunks,
            TotalFileSize = totalFileSize,
            ChunksReceived = new HashSet<int>(),
            CreatedAt = DateTime.UtcNow
        };
        _activeSessions[itemId.ToString()] = session;
        _logger.LogInformation("Created new upload session {ItemId} for file {FileName}",
            itemId, fileName);
        return new CreateUploadItemResponse(itemId);
    }

    public async Task<ChunkUploadResponse> UploadFile(Guid groupId, ChunkUploadRequest request)
    {
        UploadSession session;


        // Subsequent chunks - find existing session
        if (!string.IsNullOrEmpty(request.ItemId) &&
                 _activeSessions.TryGetValue(request.ItemId, out session))
        {
            // Validate session
            if (session.FileName != request.FileName ||
                session.GroupId != groupId ||
                session.TotalChunks != request.TotalChunks)
            {
                throw new UploadBadRequestException("Chunk data doesn't match session");
            }
        }
        else
        {
            throw new UploadBadRequestException("Invalid upload session");
        }

        // Create temp directory for chunks
        var tempDir = Path.Combine(_uploadPath, "temp", session.ItemId.ToString());
        Directory.CreateDirectory(tempDir);

        // Save the chunk
        var chunkFileName = $"chunk.{request.ChunkNumber:D4}";
        var chunkPath = Path.Combine(tempDir, chunkFileName);

        await using var fileStream = new FileStream(chunkPath, FileMode.Create,
            FileAccess.Write, FileShare.None, 81920, useAsync: true);
        {
            await request.Chunk.CopyToAsync(fileStream);
        }

        fileStream.Close();
        fileStream.Dispose();
        // Mark chunk as received
        session.ChunksReceived.Add(request.ChunkNumber);
        _logger.LogInformation("Saved chunk {ChunkNumber}/{TotalChunks} for session {ItemId}",
            request.ChunkNumber + 1, request.TotalChunks, session.ItemId);

        // Check if all chunks received
        if (session.ChunksReceived.Count == session.TotalChunks)
        {
            // All chunks received, combine them
            var finalPath = await CombineChunksAsync(tempDir, session);

            // Create the upload item record
            var uploadItem = new UploadItem()
            {
                ItemId = session.ItemId,
                FileName = session.FileName,
                GroupId = session.GroupId,
                PhysicalPath = finalPath,
                Size = session.TotalFileSize,
                CreatedDate = DateTime.UtcNow,
            };

            await _uploadItemRepo.Create(uploadItem);
            await _backgroundTaskQueue.QueueFileProcessAsync(uploadItem);

            // Remove session from memory
            _activeSessions.TryRemove(session.ItemId.ToString(), out _);

            _logger.LogInformation("File upload completed: {FileName}, Size: {Size}, ItemId: {ItemId}",
                session.FileName, session.TotalFileSize, session.ItemId);

            return new ChunkUploadResponse
            {
                ItemId = session.ItemId,
                IsComplete = true
            };
        }
        return new ChunkUploadResponse
        {
            ItemId = session.ItemId,
            ChunkReceived = request.ChunkNumber + 1,
            TotalChunks = session.TotalChunks,
            IsComplete = false
        };

    }

    public async Task<CreateUploadItemResponse> UploadFile(Guid groupId, RegularUploadRequest request)
    {
        if (string.IsNullOrEmpty(request.FileName))
        {
            request.FileName = request.File.FileName;
        }

        var itemId = Guid.NewGuid();
        var directory = Path.Combine(_uploadPath, groupId.ToString());
        Directory.CreateDirectory(directory);

        var filePath = Path.Combine(directory, itemId.ToString() + Path.GetExtension(request.FileName));

        // Stream the file directly to disk
        await using var fileStream = new FileStream(filePath, FileMode.Create,
            FileAccess.Write, FileShare.None, 81920, useAsync: true);
        {
            await request.File.CopyToAsync(fileStream);

        }
        var uploadItem = new UploadItem()
        {
            ItemId = itemId,
            FileName = request.FileName,
            GroupId = groupId,
            PhysicalPath = filePath,
            Size = request.File.Length,
            CreatedDate = DateTime.UtcNow,
        };

        await _uploadItemRepo.Create(uploadItem);
        await _backgroundTaskQueue.QueueFileProcessAsync(uploadItem);

        _logger.LogInformation("Regular upload completed: {FileName}, Size: {Size}, ItemId: {ItemId}",
            request.FileName, request.File.Length, itemId);
        return new CreateUploadItemResponse(itemId);
    }
    private async Task<string> CombineChunksAsync(string tempDir, UploadSession session)
    {
        var finalDir = Path.Combine(_uploadPath, session.GroupId.ToString());
        Directory.CreateDirectory(finalDir);

        var finalPath = Path.Combine(finalDir, session.ItemId.ToString() + Path.GetExtension(session.FileName));

        await using var outputStream = new FileStream(finalPath, FileMode.Create,
            FileAccess.Write, FileShare.None, 81920, useAsync: true);
        {
            // Combine chunks in order
            for (int i = 0; i < session.TotalChunks; i++)
            {
                var chunkFileName = $"chunk.{i:D4}";
                var chunkPath = Path.Combine(tempDir, chunkFileName);

                if (!System.IO.File.Exists(chunkPath))
                {
                    throw new FileNotFoundException($"Chunk {i} not found for session {session.ItemId}");
                }

                await using var chunkStream = new FileStream(chunkPath, FileMode.Open,
                    FileAccess.Read, FileShare.Read, 81920, useAsync: true);

                await chunkStream.CopyToAsync(outputStream);

                chunkStream.Close();
                chunkStream.Dispose();

                // Delete chunk after combining
                System.IO.File.Delete(chunkPath);
            }
        }

        // Clean up temp directory
        try
        {
            Directory.Delete(tempDir);
        }
        catch
        {
            // Ignore if directory not empty
        }

        return finalPath;
    }
}

public class UploadBadRequestException : Exception
{
    public UploadBadRequestException(string message) : base(message)
    {
    }
}
