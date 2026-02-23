using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO.Compression;
using System.Text.Json;
using FileLink.Common;
using FileLink.Plugin;
using FileLink.Repos;
using FileLink.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using static FileLink.Constants;

namespace FileLink.Controllers;
[Authorize]
[ApiController]
[Route("api/file")]
public class FileController : ControllerBase
{
    private readonly ILogger<FileController> _logger;


    private readonly UploadService _uploadService;
    private readonly UploadItemRepo _uploadItemRepo;
    private readonly UploadGroupRepo _uploadGroupRepo;
    private readonly UserResolverService _userResolverService;
    private readonly BackgroundTaskQueue _backgroundTaskQueue;

    private readonly PreSignUrlService _preSignUrlService;

    private readonly LocalFileCache _localFileCache;
    private readonly AuditLogService _auditLogService;


    public FileController(ILogger<FileController> logger,
        UploadGroupRepo uploadGroupRepo,
        UploadItemRepo uploadItemRepo,
        UserResolverService userResolverService,
        BackgroundTaskQueue backgroundTaskQueue,
        PreSignUrlService preSignUrlService,
        LocalFileCache localFileCache,
        UploadService uploadService,
        AuditLogService auditLogService)
    {
        _logger = logger;
        _uploadGroupRepo = uploadGroupRepo;
        _uploadItemRepo = uploadItemRepo;
        _userResolverService = userResolverService;
        _backgroundTaskQueue = backgroundTaskQueue;
        _preSignUrlService = preSignUrlService;
        _localFileCache = localFileCache;
        _uploadService = uploadService;
        _auditLogService = auditLogService;
    }

    [HttpGet("storage/usage")]
    [Authorize(Policy = Constants.AuthPolicy.RequireOwner)]
    public async Task<StorageUsageResponse> GetStorageUsage(
        [FromServices] StorageUsageRepo storageUsageRepo,
        [FromServices] StorageSettings storageSettings)
    {
        var summary = await storageUsageRepo.GetSummary();
        return new StorageUsageResponse
        {
            TotalItems = summary.TotalItems,
            TotalSize = summary.TotalSize,
            GroupCount = summary.GroupCount,
            QuotaBytes = storageSettings.StorageQuotaBytes,
            Groups = summary.Groups.Select(g => new GroupStorageUsageResponse
            {
                GroupId = g.GroupId,
                ItemCount = g.ItemCount,
                TotalSize = g.TotalSize,
                LastUpload = g.LastUpload
            }).ToList()
        };
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
    public async Task<IActionResult> UploadAsync(
    Guid groupId,
    [FromForm] RegularUploadRequest request)
    {
        try
        {


            if (request.File == null || request.File.Length == 0)
            {
                return BadRequest("Upload a file.");
            }
            var result = await _uploadService.UploadFile(groupId, request);
            _ = _auditLogService.LogAsync(AuditActions.FileUploaded, groupId: groupId, detail: request.FileName ?? request.File.FileName);
            return Ok(result);
        }
        catch (UploadBadRequestException ex)
        {
            _logger.LogError(ex, "Bad request during upload");
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during regular upload");
            return StatusCode(500, "Internal server error during upload");
        }
    }
    [HttpPost("group/{groupId}/upload-chunk/start")]
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    public IActionResult StartUpload(Guid groupId, [FromBody] ChunkUploadStartRequest request)
    {
        if (request == null || request.TotalFileSize <= 0)
        {
            return BadRequest("No chunk data provided");
        }
        var r = _uploadService.StartUpload(groupId, request.FileName, request.TotalFileSize, request.TotalChunks, request.RelativePath);
        return Ok(r);
    }

    [HttpPost("group/{groupId}/upload-chunk")]
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    [RequestSizeLimit(55_000_000)] // 50MB limit per chunk
    [RequestFormLimits(MultipartBodyLengthLimit = 55_000_000)]
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
            var result = await _uploadService.UploadFile(groupId, request);

            return Ok(result);

        }
        catch (UploadBadRequestException ex)
        {
            _logger.LogError(ex, "Bad request during upload");
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading chunk {ChunkNumber}", request.ChunkNumber);
            return StatusCode(500, "Internal server error during chunk upload");
        }
    }


    [HttpPut("group/{groupId}/local")]
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    public async Task<List<CreateUploadItemResponse>> LinkLocalAsync(Guid groupId, [FromBody] List<AddLocalPath> items)
    {
        var totalProcessingTime = 0;
        var stopwatch = Stopwatch.StartNew();
        _logger.LogInformation("Linking local files to group {GroupId}", groupId);
        List<CreateUploadItemResponse> result = new List<CreateUploadItemResponse>();
        for (int i = 0; i < items.Count; i++)
        {
            stopwatch.Restart();
            AddLocalPath? item = items[i];
            var time1 = stopwatch.Elapsed.TotalMilliseconds;
            _logger.LogInformation($"CheckPath start: {item.Path} - {time1}");
            var fullPath = _localFileCache.GetLocalFullPath(item.LocalPathIndex, item.Path);
            var fileInfo = _localFileCache.GetByPath(fullPath);
            if (fileInfo == null)
            {
                _logger.LogWarning($"File not found: {item.Path}");
                continue; // Skip if file does not exist
            }

            _logger.LogInformation($"CheckPath end: {item.Path} - {stopwatch.Elapsed.TotalMilliseconds - time1}");
            var uploadItem = new UploadItem()
            {
                ItemId = Guid.NewGuid(),
                FileName = Path.GetFileName(fullPath),
                GroupId = groupId,
                PhysicalPath = fullPath,
                Size = fileInfo.Length,
                CreatedDate = DateTime.UtcNow,
            };
            var time2 = stopwatch.Elapsed.TotalMilliseconds;
            _logger.LogInformation($"CreateUploadItem start: {item.Path}");
            await _uploadItemRepo.Create(uploadItem);
            _logger.LogInformation($"CreateUploadItem end: {item.Path} -  {stopwatch.Elapsed.TotalMilliseconds - time2}");
            var time3 = stopwatch.Elapsed.TotalMilliseconds;
            _logger.LogInformation($"QueueFileProcessAsync start:  {item.Path}");
            _backgroundTaskQueue.QueueFileProcessAsync(uploadItem);
            _logger.LogInformation($"QueueFileProcessAsync end: {item.Path} - {stopwatch.Elapsed.TotalMilliseconds - time3}");
            result.Add(new CreateUploadItemResponse(uploadItem.ItemId));

            _logger.LogInformation("total time: {item.Path} - " + stopwatch.Elapsed.TotalMilliseconds.ToString());
            totalProcessingTime += (int)stopwatch.Elapsed.TotalMilliseconds;


        }
        _logger.LogInformation("Total processing time: {GroupId} - " + totalProcessingTime.ToString());
        return result;
    }

    [HttpGet("local")]
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    public FileIndexResponse GetLocalFiles()
    {
        return _localFileCache.GetFiles();
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
        _ = _auditLogService.LogAsync(AuditActions.GroupCreated, appUserId, groupId);

        return new CreateGroupResponse(groupId);
    }
    [HttpDelete("group/{groupId}")]
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    public async Task DeleteLink(Guid groupId)
    {
        await _uploadGroupRepo.Delete(groupId);
        _ = _auditLogService.LogAsync(AuditActions.GroupDeleted, _userResolverService.GetAppUserId(), groupId);
    }

    [AllowAnonymous]
    [EnableRateLimiting("download")]
    [HttpGet("{itemId}")]
    public async Task<IActionResult> Download(Guid itemId, [FromQuery] int expires, [FromQuery] string signature, [FromQuery] bool view = false)
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
            // Fire-and-forget download count increment
            _ = Task.Run(async () =>
            {
                try
                { await _uploadItemRepo.IncrementDownloadCount(itemId); }
                catch (Exception ex) { _logger.LogError(ex, "Failed to increment download count for {ItemId}", itemId); }
            });
            _ = _auditLogService.LogAsync(AuditActions.FileDownload, itemId: itemId, detail: item.FileName);

            var stream = System.IO.File.OpenRead(item.PhysicalPath);
            var fileName = item.FileName;

            // Get content type by file extension
            var extension = Path.GetExtension(fileName).ToLowerInvariant();

            var contentType = GetContentType(extension);

            if (view && IsPreviewable(extension))
            {
                return new FileStreamResult(stream, contentType);
            }

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

    private static string GetContentType(string extension) => extension switch
    {
        ".txt" => "text/plain",
        ".csv" => "text/csv",
        ".json" => "application/json",
        ".xml" => "text/xml",
        ".html" or ".htm" => "text/html",
        ".css" => "text/css",
        ".js" => "application/javascript",
        ".ts" => "text/plain",
        ".cs" => "text/plain",
        ".py" => "text/plain",
        ".java" => "text/plain",
        ".c" or ".cpp" or ".h" => "text/plain",
        ".rb" => "text/plain",
        ".go" => "text/plain",
        ".rs" => "text/plain",
        ".sh" or ".bash" => "text/plain",
        ".yaml" or ".yml" => "text/plain",
        ".md" => "text/plain",
        ".log" => "text/plain",
        ".ini" or ".cfg" or ".conf" => "text/plain",
        ".sql" => "text/plain",
        ".pdf" => "application/pdf",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".gif" => "image/gif",
        ".webp" => "image/webp",
        ".svg" => "image/svg+xml",
        ".mp4" => "video/mp4",
        ".webm" => "video/webm",
        ".mov" => "video/quicktime",
        ".avi" => "video/x-msvideo",
        ".mkv" => "video/x-matroska",
        ".mp3" => "audio/mpeg",
        ".wav" => "audio/wav",
        ".ogg" => "audio/ogg",
        ".flac" => "audio/flac",
        ".aac" => "audio/aac",
        ".doc" => "application/msword",
        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls" => "application/vnd.ms-excel",
        ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".zip" => "application/zip",
        ".rar" => "application/x-rar-compressed",
        _ => "application/octet-stream"
    };

    private static bool IsPreviewable(string extension) => extension switch
    {
        ".txt" or ".csv" or ".json" or ".xml" or ".css" or ".js" or ".ts" or ".cs" or ".py"
        or ".java" or ".c" or ".cpp" or ".h" or ".rb" or ".go" or ".rs" or ".sh" or ".bash"
        or ".yaml" or ".yml" or ".md" or ".log" or ".ini" or ".cfg" or ".conf" or ".sql"
        or ".html" or ".htm" => true,
        ".pdf" => true,
        ".jpg" or ".jpeg" or ".png" or ".gif" or ".webp" or ".svg" => true,
        ".mp4" or ".webm" or ".mov" => true,
        ".mp3" or ".wav" or ".ogg" or ".flac" or ".aac" => true,
        _ => false
    };
    [HttpPut("item/{itemId}/rename")]
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    public async Task<IActionResult> RenameItem(Guid itemId, [FromBody] RenameItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewName))
        {
            return BadRequest("Name cannot be empty.");
        }

        var item = await _uploadItemRepo.Get(itemId);
        if (item == null)
        {
            return NotFound("File not found.");
        }

        var originalExtension = Path.GetExtension(item.FileName);
        var newNameWithoutExt = Path.GetFileNameWithoutExtension(request.NewName.Trim());
        item.FileName = newNameWithoutExt + originalExtension;

        await _uploadItemRepo.UpdateAsync(item);

        return Ok(UploadItemResponse.FromUploadItem(_preSignUrlService, item));
    }

    [AllowAnonymous]
    [HttpGet("group/{groupId}/download-all")]
    public async Task<IActionResult> DownloadAll(Guid groupId, [FromQuery] int expires, [FromQuery] string signature)
    {
        if (!_preSignUrlService.ValidatePreSignedUrl(groupId, expires, signature))
        {
            return Unauthorized("Invalid signature.");
        }

        var uploadItems = await _uploadItemRepo.GetByGroupId(groupId);
        var validItems = uploadItems.Where(i =>
        {
            var file = new FileInfo(i.PhysicalPath);
            if (!file.Exists)
                return false;
            var ext = Path.GetExtension(i.FileName).ToLowerInvariant();
            return !IsVideoFile(ext);
        }).ToList();

        if (validItems.Count == 0)
        {
            return NotFound("No downloadable files found.");
        }

        Response.ContentType = "application/zip";
        Response.Headers.ContentDisposition = "attachment; filename=\"files.zip\"";

        var usedNames = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        using var archive = new ZipArchive(Response.BodyWriter.AsStream(), ZipArchiveMode.Create, leaveOpen: true);
        foreach (var item in validItems)
        {
            var entryName = GetUniqueFileName(item.FileName, usedNames);
            var entry = archive.CreateEntry(entryName, CompressionLevel.Fastest);
            await using var entryStream = entry.Open();
            await using var fileStream = System.IO.File.OpenRead(item.PhysicalPath);
            await fileStream.CopyToAsync(entryStream);
        }

        return new EmptyResult();
    }

    private static string GetUniqueFileName(string fileName, Dictionary<string, int> usedNames)
    {
        if (!usedNames.TryGetValue(fileName, out var count))
        {
            usedNames[fileName] = 1;
            return fileName;
        }
        usedNames[fileName] = count + 1;
        var nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
        var ext = Path.GetExtension(fileName);
        return $"{nameWithoutExt} ({count + 1}){ext}";
    }

    private static bool IsVideoFile(string extension) => extension switch
    {
        ".mp4" or ".webm" or ".mov" or ".avi" or ".mkv" or ".wmv" or ".flv" or ".m4v" => true,
        _ => false
    };

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

        // Only include download-all URL when there are 2+ non-video files
        string? downloadAllUrl = null;
        var zippableCount = result.Count(r => !IsVideoFile(Path.GetExtension(r.Name).ToLowerInvariant()));
        if (zippableCount >= 2)
        {
            downloadAllUrl = $"/api/file/group/{groupId}/download-all{_preSignUrlService.GeneratePreSignedUrl(groupId, new TimeSpan(24, 0, 0))}";
        }

        return Ok(new GroupResponse
        {
            Items = result,
            DownloadAllUrl = downloadAllUrl
        });
    }
}

public class UploadItemResponse
{
    public required string Name { get; set; }
    public required Guid Id { get; set; }
    public long? Size { get; set; }
    public object? Metadata { get; set; }
    public string? Url { get; set; }
    public string? RelativePath { get; set; }
    public int DownloadCount { get; set; }
    public DateTime? LastDownload { get; set; }
    public DateTime CreatedDate { get; set; }

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
            Url = url,
            RelativePath = item.RelativePath,
            DownloadCount = item.DownloadCount,
            LastDownload = item.LastDownload,
            CreatedDate = item.CreatedDate
        };
    }
}
public class StorageUsageResponse
{
    public int TotalItems { get; set; }
    public long TotalSize { get; set; }
    public int GroupCount { get; set; }
    public long? QuotaBytes { get; set; }
    public List<GroupStorageUsageResponse> Groups { get; set; } = new();
}
public class GroupStorageUsageResponse
{
    public Guid GroupId { get; set; }
    public int ItemCount { get; set; }
    public long TotalSize { get; set; }
    public DateTime? LastUpload { get; set; }
}
public class GroupResponse
{
    public List<UploadItemResponse> Items { get; set; } = new();
    public string? DownloadAllUrl { get; set; }
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
    public string? RelativePath { get; set; }
    public ConcurrentDictionary<int, bool> ChunksReceived { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}
public class RegularUploadRequest
{
    public IFormFile File { get; set; } = null!;
    public string? FileName { get; set; }
    public string? RelativePath { get; set; }
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
public class RenameItemRequest
{
    public string NewName { get; set; } = string.Empty;
}
public class ChunkUploadStartRequest
{
    public string FileName { get; set; } = string.Empty;
    public int TotalChunks { get; set; }
    public long TotalFileSize { get; set; }
    public string? RelativePath { get; set; }
}
// Response Models
public class ChunkUploadResponse
{
    public Guid ItemId { get; set; }
    public int ChunkReceived { get; set; }
    public int TotalChunks { get; set; }
    public bool IsComplete { get; set; }
}
