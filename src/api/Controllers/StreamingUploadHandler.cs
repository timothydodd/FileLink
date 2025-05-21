using System.Security.Claims;
using System.Text.Json;
using FileLink.Common;
using FileLink.Repos;
using FileLink.Services;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Net.Http.Headers;

namespace FileLink.Controllers;

public class StreamingUploadMiddleware
{
    private readonly RequestDelegate _next;
    private readonly string _uploadPath;
    private readonly UploadItemRepo _uploadItemRepo;
    private readonly BackgroundTaskQueue _backgroundTaskQueue;


    public StreamingUploadMiddleware(
        RequestDelegate next,
        UploadItemRepo uploadItemRepo,
        BackgroundTaskQueue backgroundTaskQueue,
        StorageSettings storageSettings)
    {
        _next = next;
        _uploadPath = StorageSettings.ResolvePath(storageSettings.SharedFilesPath);
        _uploadItemRepo = uploadItemRepo;
        _backgroundTaskQueue = backgroundTaskQueue;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Only intercept specific upload paths
        if (context.Request.Path.StartsWithSegments("/api/file/group") &&
            context.Request.Path.Value.EndsWith("/upload") &&
            context.Request.Method == "POST")
        {
            await HandleStreamingUploadAsync(context);
            return;
        }

        // For all other paths, continue the pipeline
        await _next(context);
    }

    private async Task HandleStreamingUploadAsync(HttpContext context)
    {
        if (context.User?.Identity?.IsAuthenticated != true)
            throw new UnauthorizedAccessException("User is not authenticated.");
        // Extract groupId from path
        var pathSegments = context.Request.Path.Value.Split('/');
        if (!Guid.TryParse(pathSegments[4], out Guid groupId))
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync("Invalid group ID");
            return;
        }
        if (!IsEditor(context))
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsync("Unauthorized");
            return;
        }

        if (!context.Request.HasFormContentType)
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync("Not a multipart request");
            return;
        }

        var boundary = HeaderUtilities.RemoveQuotes(
            MediaTypeHeaderValue.Parse(context.Request.ContentType).Boundary).Value;
        var reader = new MultipartReader(boundary, context.Request.Body);
        var section = await reader.ReadNextSectionAsync();

        Guid itemId = Guid.NewGuid();
        string? fileName = null;
        long fileSize = 0;
        string? uploadPath = null;
        var directory = Path.Combine(_uploadPath, groupId.ToString());
        Directory.CreateDirectory(directory);

        while (section != null)
        {
            var hasContentDisposition = ContentDispositionHeaderValue.TryParse(
                section.ContentDisposition, out var contentDisposition);

            if (hasContentDisposition && contentDisposition.DispositionType.Equals("form-data"))
            {
                if (contentDisposition.Name.Value.Equals("fileName"))
                {
                    using var streamReader = new StreamReader(section.Body);
                    fileName = await streamReader.ReadToEndAsync();
                    uploadPath = Path.Combine(directory, itemId.ToString() + fileName);
                }
                else if (contentDisposition.Name.Value.Equals("file"))
                {
                    if (string.IsNullOrEmpty(fileName))
                    {
                        fileName = contentDisposition.FileName.Value;
                        uploadPath = Path.Combine(directory, itemId.ToString() + fileName);
                    }

                    using var fileStream = new FileStream(uploadPath, FileMode.Create,
                        FileAccess.Write, FileShare.None, 81920, useAsync: true);

                    // THIS IS THE KEY PART - direct streaming happens here
                    await section.Body.CopyToAsync(fileStream, 81920);
                    await fileStream.FlushAsync();
                    fileSize = fileStream.Length;
                }
            }

            section = await reader.ReadNextSectionAsync();
        }

        if (string.IsNullOrEmpty(fileName) || fileSize == 0)
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync("Upload a file.");
            return;
        }

        var uploadItem = new UploadItem()
        {
            ItemId = itemId,
            FileName = fileName,
            GroupId = groupId,
            PhysicalPath = uploadPath,
            Size = fileSize,
            CreatedDate = DateTime.UtcNow,
        };

        await _uploadItemRepo.Create(uploadItem);
        await _backgroundTaskQueue.QueueFileProcessAsync(uploadItem);

        context.Response.StatusCode = 200;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(JsonSerializer.Serialize(new CreateUploadItemResponse(itemId)));
    }
    private bool IsEditor(HttpContext context)
    {
        var claimsIdentity = context.User.Identity as ClaimsIdentity;
        var role = claimsIdentity
            .FindFirst(x => x.Type == claimsIdentity.RoleClaimType)
            .Value;
        return role == "Owner" || role == "Editor";
    }
}

// Extension method to make it easier to add the middleware
public static class StreamingUploadMiddlewareExtensions
{
    public static IApplicationBuilder UseStreamingUpload(
        this IApplicationBuilder builder,
        UploadItemRepo uploadItemRepo,
        BackgroundTaskQueue backgroundTaskQueue,
        StorageSettings storageSettings)
    {
        return builder.UseMiddleware<StreamingUploadMiddleware>(
            uploadItemRepo, backgroundTaskQueue, storageSettings);
    }
}
