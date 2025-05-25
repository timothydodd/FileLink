using System.Text.Json;
using System.Threading.Channels;
using FileLink.Controllers;
using FileLink.Hubs;
using FileLink.Plugin;
using FileLink.Repos;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;

namespace FileLink.Services;

public class QueuedBackgroundService : BackgroundService
{
    private readonly Channel<WorkItem> _queue;

    public QueuedBackgroundService(Channel<WorkItem> queue)
    {
        _queue = queue;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var workItem in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await workItem.Action(stoppingToken);
            }
            catch (Exception)
            {
                // Log or handle error
            }
        }
    }
}

public class BackgroundTaskQueue : IBackgroundTaskQueue
{
    private readonly IHubContext<UploadItemHub> _hubContext;
    private readonly Channel<WorkItem> _queue;
    private readonly IEnumerable<IFilePlugin> _filePlugins;
    private readonly ILogger<BackgroundTaskQueue> _logger;
    private readonly PreSignUrlService _preSignUrlService;
    private readonly JsonSerializerOptions _options;
    public BackgroundTaskQueue(IEnumerable<IFilePlugin> filePlugins, ILogger<BackgroundTaskQueue> logger, IHubContext<UploadItemHub> hubContext, PreSignUrlService preSignUrlService, IOptions<JsonOptions> jsonOptions)
    {
        _queue = Channel.CreateUnbounded<WorkItem>();
        _filePlugins = filePlugins;
        _logger = logger;
        _hubContext = hubContext;
        _preSignUrlService = preSignUrlService;
        _options = jsonOptions.Value.SerializerOptions;
    }
    public async ValueTask QueueWork(WorkItem workItem)
    {
        await _queue.Writer.WriteAsync(workItem);
    }

    public ValueTask QueueFileProcessAsync(UploadItem item)
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

                // Fire and forget - don't await this
                _ = _queue.Writer.WriteAsync(workItem);
            }
            else
            {
                _logger.LogInformation("Skipping file: {FileName}", item.FileName);
            }
        }

        return ValueTask.CompletedTask;
    }

    public Channel<WorkItem> GetChannel() => _queue;
}
public class WorkItem
{
    public required Func<CancellationToken, Task> Action { get; set; }
}
public class GroupItemChanged : UploadItemResponse
{
    public Guid GroupId { get; set; }
}
