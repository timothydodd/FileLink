using System.Diagnostics;
using System.Text.Json;
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


    private readonly UploadService _uploadService;
    private readonly UploadItemRepo _uploadItemRepo;
    private readonly UploadGroupRepo _uploadGroupRepo;
    private readonly UserResolverService _userResolverService;
    private readonly BackgroundTaskQueue _backgroundTaskQueue;

    private readonly PreSignUrlService _preSignUrlService;

    private readonly LocalFileCache _localFileCache;


    public FileController(ILogger<FileController> logger,
        UploadGroupRepo uploadGroupRepo,
        UploadItemRepo uploadItemRepo,
        UserResolverService userResolverService,
        BackgroundTaskQueue backgroundTaskQueue,
        PreSignUrlService preSignUrlService,
        LocalFileCache localFileCache,
        UploadService uploadService)
    {
        _logger = logger;
        _uploadGroupRepo = uploadGroupRepo;
        _uploadItemRepo = uploadItemRepo;
        _userResolverService = userResolverService;
        _backgroundTaskQueue = backgroundTaskQueue;
        _preSignUrlService = preSignUrlService;
        _localFileCache = localFileCache;
        _uploadService = uploadService;
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
    public IActionResult StartUpload(Guid groupId, [FromBody] ChunkUploadStartRequest request)
    {
        if (request == null || request.TotalFileSize <= 0)
        {
            return BadRequest("No chunk data provided");
        }
        var r = _uploadService.StartUpload(groupId, request.FileName, request.TotalFileSize, request.TotalChunks);
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
            var fileInfo = new FileInfo(fullPath);

            if (fileInfo.Exists)
            {
                _logger.LogInformation($"CheckPath end: {item.Path} - {stopwatch.Elapsed.TotalMilliseconds - time1}");
                var uploadItem = new UploadItem()
                {
                    ItemId = Guid.NewGuid(),
                    FileName = fileInfo.Name,
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
            }
            else
            {
                _logger.LogInformation("CheckPath end: {item.Path} - " + (stopwatch.Elapsed.TotalMilliseconds - time1).ToString());
            }
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
public class ChunkUploadStartRequest
{
    public string FileName { get; set; } = string.Empty;
    public int TotalChunks { get; set; }
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
