using System.Collections.Concurrent;
using System.Text.Json;
using FileLink.Controllers;
using FileLink.Hubs;
using FileLink.Plugin;
using FileLink.Repos;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;

namespace FileLink.Services;


public class BackgroundTaskQueue
{
    private readonly IHubContext<UploadItemHub> _hubContext;
    private readonly ConcurrentQueue<WorkItem> _queue;
    private readonly IEnumerable<IFilePlugin> _filePlugins;
    private readonly ILogger<BackgroundTaskQueue> _logger;
    private readonly PreSignUrlService _preSignUrlService;
    private readonly JsonSerializerOptions _options;
    public BackgroundTaskQueue(IEnumerable<IFilePlugin> filePlugins, ILogger<BackgroundTaskQueue> logger, IHubContext<UploadItemHub> hubContext, PreSignUrlService preSignUrlService, IOptions<JsonOptions> jsonOptions)
    {
        _queue = new ConcurrentQueue<WorkItem>();
        _filePlugins = filePlugins;
        _logger = logger;
        _hubContext = hubContext;
        _preSignUrlService = preSignUrlService;
        _options = jsonOptions.Value.SerializerOptions;
    }

    public void QueueFileProcessAsync(UploadItem item)
    {
        foreach (var plugin in _filePlugins)
        {
            if (plugin.HasFileType(Path.GetExtension(item.FileName)))
            {
                var workItem = new WorkItem
                {
                    Action = async token =>
                    {
                        _logger.LogInformation("Processing with plugin: {PluginName}", plugin.GetType().Name);
                        _logger.LogInformation("Processing file: {FileName}", item.FileName);

                        await plugin.Process(item);

                        var uploadItemResponse = UploadItemResponse.FromUploadItem(_preSignUrlService, item);
                        var groupItemChanged = new GroupItemChanged()
                        {
                            GroupId = item.GroupId,
                            Id = uploadItemResponse.Id,
                            Name = uploadItemResponse.Name,
                            Size = uploadItemResponse.Size,
                            Url = uploadItemResponse.Url,
                            Metadata = uploadItemResponse.Metadata
                        };
                        await _hubContext.Clients.Group("UploadItemChanges").SendAsync("UploadItemChanged", JsonSerializer.Serialize(groupItemChanged, _options));
                        _logger.LogInformation("Finished processing file: {FileName}", item.FileName);
                    }
                };

                _queue.Enqueue(workItem);
                _logger.LogDebug("Queued work item for file: {FileName}", item.FileName);
            }
            else
            {
                _logger.LogInformation("Skipping file: {FileName}", item.FileName);
            }
        }
    }
    public bool TryDequeue(out WorkItem? workItem)
    {
        return _queue.TryDequeue(out workItem);
    }
    public void QueueWork(WorkItem workItem)
    {
        _queue.Enqueue(workItem);
    }
    public int QueueCount => _queue.Count;
}
public class WorkItem
{
    public required Func<CancellationToken, Task> Action { get; set; }
}
public class GroupItemChanged : UploadItemResponse
{
    public Guid GroupId { get; set; }
}
