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
    private readonly AuthLinkGenerator _authLinkGenerator;
    private readonly BackgroundTaskQueue _backgroundTaskQueue;
    private readonly JwtService _jwtService;
    private readonly PreSignUrlService _preSignUrlService;
    private readonly string RootUploadPath;

    public FileController(ILogger<FileController> logger, StorageSettings storageSettings, UploadGroupRepo uploadGroupRepo, UploadItemRepo uploadItemRepo, UserResolverService userResolverService, AuthLinkGenerator authLinkGenerator, JwtService jwtService, BackgroundTaskQueue backgroundTaskQueue, PreSignUrlService preSignUrlService)
    {
        _logger = logger;
        _uploadGroupRepo = uploadGroupRepo;
        _uploadItemRepo = uploadItemRepo;
        _userResolverService = userResolverService;
        RootUploadPath = StorageSettings.ResolvePath(storageSettings.SharedFilesPath);
        _authLinkGenerator = authLinkGenerator;
        _jwtService = jwtService;
        _backgroundTaskQueue = backgroundTaskQueue;
        _preSignUrlService = preSignUrlService;
    }

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
    [DisableRequestSizeLimit]
    [RequestFormLimits(MultipartBodyLengthLimit = long.MaxValue)]
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    [HttpPost("group/{groupId}/upload")]
    public async Task<IActionResult> Upload(Guid groupId)
    {
        var form = await Request.ReadFormAsync();

        var file = form.Files["file"];
        var fileName = form["fileName"].ToString();

        if (file == null || file.Length == 0)
            return BadRequest("Upload a file.");



        Guid itemId = Guid.NewGuid();

        var jobId = Guid.NewGuid();
        //var job = new JobEntity(documentId, jobId)
        //{
        //    JobType = Constants.JobTypes.PdfToImage
        //};

        //await _documentJobService.CreateOrUpdate(job);

        var directory = Path.Combine(RootUploadPath, groupId.ToString());
        var uploadPath = Path.Combine(directory, itemId.ToString() + fileName);
        var uploadItem = new UploadItem()
        {
            ItemId = itemId,
            FileName = fileName,
            GroupId = groupId,
            PhysicalPath = uploadPath,
            Size = file.Length,
            CreatedDate = DateTime.UtcNow,
        };



        using var rstream = file.OpenReadStream();
        Directory.CreateDirectory(directory);
        using var fs = new FileStream(uploadPath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true);
        await rstream.CopyToAsync(fs, 81920).ConfigureAwait(false);
        await fs.FlushAsync().ConfigureAwait(false);
        await _uploadItemRepo.Create(uploadItem);

        await _backgroundTaskQueue.QueueFileProcessAsync(uploadItem);

        return Ok(new CreateUploadItemResponse(itemId));

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
            object? metadata = null;

            if (item.Metadata != null)
            {


                metadata = JsonSerializer.Deserialize<Metadata>(item.Metadata);
            }
            var url = $"/api/file/{item.ItemId}{_preSignUrlService.GeneratePreSignedUrl(item.ItemId, new TimeSpan(24, 0, 0))}";
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


            result.Add(new UploadItemResponse()
            {
                Name = item.FileName,
                Id = item.ItemId,
                Size = item.Size,
                Metadata = metadata,
                Url = url
            });


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
}
public record CreateUploadItem(IFormFile File, string FileName, DateTime Expiration);
public record CreateUploadItemResponse(Guid ItemId);
public record CreateGroupResponse(Guid GroupId);

public record GetShareLink(string Url, DateTime Expiration);
