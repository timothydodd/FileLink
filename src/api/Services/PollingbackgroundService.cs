namespace FileLink.Services;

public class PollingBackgroundService : BackgroundService
{
    private readonly BackgroundTaskQueue _taskQueue;
    private readonly ILogger<PollingBackgroundService> _logger;
    private readonly SemaphoreSlim _concurrencyLimiter;
    private readonly int _maxConcurrency;

    public PollingBackgroundService(BackgroundTaskQueue taskQueue, ILogger<PollingBackgroundService> logger)
    {
        _taskQueue = taskQueue;
        _logger = logger;
        _maxConcurrency = Environment.ProcessorCount * 2; // Adjust as needed
        _concurrencyLimiter = new SemaphoreSlim(_maxConcurrency, _maxConcurrency);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Polling Background Service started with max concurrency: {MaxConcurrency}", _maxConcurrency);

        var activeTasks = new List<Task>();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Clean up completed tasks
                activeTasks.RemoveAll(t => t.IsCompleted);

                // Try to start new tasks up to our concurrency limit
                while (activeTasks.Count < _maxConcurrency && _taskQueue.TryDequeue(out var workItem))
                {
                    var task = ProcessWorkItemAsync(workItem!, stoppingToken);
                    activeTasks.Add(task);
                }

                if (activeTasks.Count == 0)
                {
                    // No work available and no active tasks, wait a bit before polling again
                    await Task.Delay(1000, stoppingToken);
                }
                else
                {
                    // Wait for at least one task to complete before checking for more work
                    await Task.WhenAny(activeTasks);
                }
            }
            catch (OperationCanceledException)
            {
                // Expected when cancellation is requested
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred in background service loop");
            }
        }

        // Wait for all active tasks to complete before shutting down
        if (activeTasks.Count > 0)
        {
            _logger.LogInformation("Waiting for {ActiveTaskCount} active tasks to complete", activeTasks.Count);
            await Task.WhenAll(activeTasks);
        }

        _logger.LogInformation("Polling Background Service stopped");
    }

    private async Task ProcessWorkItemAsync(WorkItem workItem, CancellationToken stoppingToken)
    {
        await _concurrencyLimiter.WaitAsync(stoppingToken);
        try
        {
            await workItem.Action(stoppingToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred executing background task");
        }
        finally
        {
            _concurrencyLimiter.Release();
        }
    }

    public override void Dispose()
    {
        _concurrencyLimiter?.Dispose();
        base.Dispose();
    }
}

