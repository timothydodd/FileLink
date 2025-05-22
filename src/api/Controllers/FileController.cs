using System.Collections.Concurrent;
using System.Text.Json;
using FileLink.Common;
using FileLink.Plugin;
using FileLink.Repos;
using FileLink.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FileLink.Controllers;
[Authorize]
[ApiController]
[Route("api/file")]
public class FileController : ControllerBase
{
    private readonly ILogger<FileController> _logger;



    private readonly UploadItemRepo _uploadItemRepo;
    private readonly UploadGroupRepo _uploadGroupRepo;
    private readonly UserResolverService _userResolverService;
    private readonly BackgroundTaskQueue _backgroundTaskQueue;

    private readonly PreSignUrlService _preSignUrlService;

    private readonly LocalFileCache _localFileCache;
    private readonly string _uploadPath;
    // In-memory store for tracking ongoing uploads (use Redis in production)
    private static readonly ConcurrentDictionary<string, UploadSession> _activeSessions = new();

    public FileController(ILogger<FileController> logger,
        UploadGroupRepo uploadGroupRepo,
        UploadItemRepo uploadItemRepo,
        UserResolverService userResolverService,
        BackgroundTaskQueue backgroundTaskQueue,
        PreSignUrlService preSignUrlService,
        LocalFileCache localFileCache,
        StorageSettings storageSettings)
    {
        _logger = logger;
        _uploadGroupRepo = uploadGroupRepo;
        _uploadItemRepo = uploadItemRepo;
        _userResolverService = userResolverService;
        _backgroundTaskQueue = backgroundTaskQueue;
        _preSignUrlService = preSignUrlService;
        _localFileCache = localFileCache;
        _uploadPath = StorageSettings.ResolvePath(storageSettings.SharedFilesPath);
    }

    [HttpGet("local/info")]
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    public LocalInfo GetLocalInfo()
    {
        return _localFileCache.GetInfo();
    }
    [HttpPost("group/{groupId}/upload")]
    [RequestSizeLimit(60_000_000)] // 60MB limit for regular uploads
    [RequestFormLimits(MultipartBodyLengthLimit = 60_000_000)]
    public async Task<IActionResult> Upload(
    Guid groupId,
    [FromForm] RegularUploadRequest request)
    {
        try
        {


            if (request.File == null || request.File.Length == 0)
            {
                return BadRequest("Upload a file.");
            }

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
            await request.File.CopyToAsync(fileStream);

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

            return Ok(new CreateUploadItemResponse(itemId));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during regular upload");
            return StatusCode(500, "Internal server error during upload");
        }
    }

    [HttpPost("group/{groupId}/upload-chunk")]
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    [RequestSizeLimit(30_000_000)] // 15MB limit per chunk
    [RequestFormLimits(MultipartBodyLengthLimit = 30_000_000)]
    public async Task<IActionResult> UploadChunk(
         Guid groupId,
         [FromForm] ChunkUploadRequest request)
    {
        try
        {


            if (request.Chunk == null || request.Chunk.Length == 0)
            {
                return BadRequest("No chunk data provided");
            }

            if (string.IsNullOrEmpty(request.FileName))
            {
                return BadRequest("FileName is required");
            }

            UploadSession session;

            // First chunk - create new session and generate itemId
            if (request.ChunkNumber == 0 && string.IsNullOrEmpty(request.ItemId))
            {
                var itemId = Guid.NewGuid();
                session = new UploadSession
                {
                    ItemId = itemId,
                    FileName = request.FileName,
                    GroupId = groupId,
                    TotalChunks = request.TotalChunks,
                    TotalFileSize = request.TotalFileSize,
                    ChunksReceived = new HashSet<int>(),
                    CreatedAt = DateTime.UtcNow
                };

                _activeSessions[itemId.ToString()] = session;

                _logger.LogInformation("Created new upload session {ItemId} for file {FileName}",
                    itemId, request.FileName);
            }
            // Subsequent chunks - find existing session
            else if (!string.IsNullOrEmpty(request.ItemId) &&
                     _activeSessions.TryGetValue(request.ItemId, out session))
            {
                // Validate session
                if (session.FileName != request.FileName ||
                    session.GroupId != groupId ||
                    session.TotalChunks != request.TotalChunks)
                {
                    return BadRequest("Chunk data doesn't match session");
                }
            }
            else
            {
                return BadRequest("Invalid upload session");
            }

            // Create temp directory for chunks
            var tempDir = Path.Combine(_uploadPath, "temp", session.ItemId.ToString());
            Directory.CreateDirectory(tempDir);

            // Save the chunk
            var chunkFileName = $"chunk.{request.ChunkNumber:D4}";
            var chunkPath = Path.Combine(tempDir, chunkFileName);

            await using var fileStream = new FileStream(chunkPath, FileMode.Create,
                FileAccess.Write, FileShare.None, 81920, useAsync: true);

            await request.Chunk.CopyToAsync(fileStream);

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

                return Ok(new CreateUploadItemResponse(session.ItemId));
            }

            // Return chunk received confirmation with itemId
            return Ok(new ChunkUploadResponse
            {
                ItemId = session.ItemId,
                ChunkReceived = request.ChunkNumber + 1,
                TotalChunks = session.TotalChunks,
                IsComplete = false
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading chunk {ChunkNumber}", request.ChunkNumber);
            return StatusCode(500, "Internal server error during chunk upload");
        }
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
    [HttpPut("group/{groupId}/local")]
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    public async Task<List<CreateUploadItemResponse>> LinkLocalAsync(Guid groupId, [FromBody] List<AddLocalPath> items)
    {
        List<CreateUploadItemResponse> result = new List<CreateUploadItemResponse>();
        foreach (var item in items)
        {
            var fullPath = _localFileCache.GetLocalFullPath(item.LocalPathIndex, item.Path);
            var fileInfo = new FileInfo(fullPath);
            if (fileInfo.Exists)
            {
                var uploadItem = new UploadItem()
                {
                    ItemId = Guid.NewGuid(),
                    FileName = fileInfo.Name,
                    GroupId = groupId,
                    PhysicalPath = fullPath,
                    Size = fileInfo.Length,
                    CreatedDate = DateTime.UtcNow,
                };

                await _uploadItemRepo.Create(uploadItem);
                await _backgroundTaskQueue.QueueFileProcessAsync(uploadItem);
                result.Add(new CreateUploadItemResponse(uploadItem.ItemId));
            }
        }
        return result;
    }

    [HttpGet("local")]
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    public async Task<FileIndexResponse> GetLocalFiles()
    {
        return await _localFileCache.GetFiles();
    }

    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    [HttpGet("group")]
    public async Task<CreateGroupResponse> CreateGroup()
    {
        var groupId = Guid.NewGuid();
        var appUserId = _userResolverService.GetAppUserId();
        var uploadGroup = new UploadGroup()
        {
            GroupId = groupId
        };
        await _uploadGroupRepo.Create(uploadGroup);

        return new CreateGroupResponse(groupId);
    }
    [HttpDelete("group/{groupId}")]
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    public async Task DeleteLink(Guid groupId)
    {
        await _uploadGroupRepo.Delete(groupId);
    }

    [AllowAnonymous]
    [HttpGet("{itemId}")]
    public async Task<IActionResult> Download(Guid itemId, [FromQuery] int expires, [FromQuery] string signature)
    {

        if (_preSignUrlService.ValidatePreSignedUrl(itemId, expires, signature))
        {

            var item = await _uploadItemRepo.Get(itemId);

            if (item == null)
            {
                return NotFound("File not found.");
            }
            var file = new FileInfo(item.PhysicalPath);
            if (!file.Exists)
            {
                return NotFound("File not found.");
            }
            var stream = System.IO.File.OpenRead(item.PhysicalPath);
            var fileName = item.FileName;

            // Get content type by file extension
            var extension = Path.GetExtension(fileName).ToLowerInvariant();


            var contentType = extension switch
            {
                ".txt" => "text/plain",
                ".pdf" => "application/pdf",
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".gif" => "image/gif",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls" => "application/vnd.ms-excel",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".zip" => "application/zip",
                ".rar" => "application/x-rar-compressed",
                ".mp4" => "video/mp4",
                ".mp3" => "audio/mpeg",
                _ => "application/octet-stream" // Default content type
            };

            return new FileStreamResult(stream, contentType)
            {
                FileDownloadName = fileName
            };

        }
        else
        {
            return Unauthorized("Invalid signature.");
        }

    }
    [HttpGet("group/{groupId}")]
    public async Task<IActionResult> GetGroup(Guid groupId)
    {
        var role = _userResolverService.GetAuthRole();
        if (Constants.AuthRoleTypes.Owner != role)
        {

            Guid myGroupId = _userResolverService.GetGroupId();
            if (myGroupId != groupId)
            {
                return Unauthorized("You are not authorized to access this group.");
            }

        }

        var uploadGroup = await _uploadGroupRepo.Get(groupId);
        if (uploadGroup == null)
        {
            return NotFound("Upload group not found.");
        }
        var uploadItems = await _uploadItemRepo.GetByGroupId(groupId);


        List<UploadItemResponse> result = new List<UploadItemResponse>();
        foreach (var item in uploadItems)
        {
            var file = new FileInfo(item.PhysicalPath);
            if (!file.Exists)
            {
                continue;
            }


            result.Add(UploadItemResponse.FromUploadItem(_preSignUrlService, item));


        }
        return Ok(result);
    }
}

public class UploadItemResponse
{
    public required string Name { get; set; }
    public required Guid Id { get; set; }
    public long? Size { get; set; }
    public object? Metadata { get; set; }
    public string? Url { get; set; }

    public static UploadItemResponse FromUploadItem(PreSignUrlService preSignUrlService, UploadItem item)
    {
        object? metadata = null;

        if (item.Metadata != null)
        {


            metadata = JsonSerializer.Deserialize<Metadata>(item.Metadata);
        }
        var url = $"/api/file/{item.ItemId}{preSignUrlService.GeneratePreSignedUrl(item.ItemId, new TimeSpan(24, 0, 0))}";
        //check if FileName is an image
        var extension = Path.GetExtension(item.FileName).ToLowerInvariant();
        if (extension == ".jpg" || extension == ".jpeg" || extension == ".png" || extension == ".gif")
        {
            if (metadata == null)
            {
                metadata = new Metadata()
                {
                    MediaType = "image",
                    Poster = url.TrimStart('/')
                };
            }
            else
            {
                var m = (Metadata)metadata;
                m.Poster = url;
                m.MediaType = "image";
                metadata = m;
            }

        }

        return new UploadItemResponse()
        {
            Name = item.FileName,
            Id = item.ItemId,
            Size = item.Size,
            Metadata = metadata,
            Url = url
        };
    }
}
public record CreateUploadItem(IFormFile File, string FileName, DateTime Expiration);
public record CreateUploadItemResponse(Guid ItemId);
public record CreateGroupResponse(Guid GroupId);

public record GetShareLink(string Url, DateTime Expiration);


public class AddLocalPath
{
    public required int LocalPathIndex { get; set; }
    public required string Path { get; set; }
}
public class UploadSession
{
    public Guid ItemId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public Guid GroupId { get; set; }
    public int TotalChunks { get; set; }
    public long TotalFileSize { get; set; }
    public HashSet<int> ChunksReceived { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}
public class RegularUploadRequest
{
    public IFormFile File { get; set; } = null!;
    public string? FileName { get; set; }
}
public class ChunkUploadRequest
{
    public IFormFile Chunk { get; set; } = null!;
    public string FileName { get; set; } = string.Empty;
    public string? ItemId { get; set; } // Optional - only present after first chunk
    public int ChunkNumber { get; set; }
    public int TotalChunks { get; set; }
    public long Position { get; set; }
    public long Length { get; set; }
    public long TotalFileSize { get; set; }
}
// Response Models
public class ChunkUploadResponse
{
    public Guid ItemId { get; set; }
    public int ChunkReceived { get; set; }
    public int TotalChunks { get; set; }
    public bool IsComplete { get; set; }
}
