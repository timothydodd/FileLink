using System.Threading.Channels;
using FileLink.Plugin;
using FileLink.Repos;

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
public class BackgroundTaskQueue
{
    private readonly Channel<WorkItem> _queue;
    private readonly MoviePlugin _moviePlugin;
    private readonly ILogger<BackgroundTaskQueue> _logger;
    public BackgroundTaskQueue(MoviePlugin moviePlugin, ILogger<BackgroundTaskQueue> logger)
    {
        _queue = Channel.CreateUnbounded<WorkItem>();
        _moviePlugin = moviePlugin;
        _logger = logger;
    }

    public ValueTask QueueFileProcessAsync(UploadItem item)
    {
        if (_moviePlugin.HasFileType(Path.GetExtension(item.FileName)))
        {
            var workItem = new WorkItem
            {
                Action = async token =>
                {
                    _logger.LogInformation("Processing file: {FileName}", item.FileName);
                    await _moviePlugin.Process(item);
                    _logger.LogInformation("Finished processing file: {FileName}", item.FileName);
                }
            };
            return _queue.Writer.WriteAsync(workItem);
        }
        else
        {
            _logger.LogInformation("Skipping file: {FileName}", item.FileName);
        }
        return new ValueTask();
    }

    public Channel<WorkItem> GetChannel() => _queue;
}
public class WorkItem
{
    public required Func<CancellationToken, Task> Action { get; set; }
}
