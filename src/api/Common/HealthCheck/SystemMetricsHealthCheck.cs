using System.Diagnostics;
using Microsoft.Extensions.Diagnostics.HealthChecks;

public class SystemMetricsHealthCheck : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var process = Process.GetCurrentProcess();

        var data = new Dictionary<string, object>
        {
            ["memory"] = new
            {
                workingSet = process.WorkingSet64,
                privateMemory = process.PrivateMemorySize64,
                gcMemory = GC.GetTotalMemory(false),
                gen0Collections = GC.CollectionCount(0),
                gen1Collections = GC.CollectionCount(1),
                gen2Collections = GC.CollectionCount(2)
            },
            ["threads"] = new
            {
                processThreads = process.Threads.Count,
                threadPoolWorkerThreads = GetThreadPoolInfo().workerThreads,
                threadPoolCompletionPortThreads = GetThreadPoolInfo().completionPortThreads,
                threadPoolBusyWorkerThreads = GetThreadPoolInfo().busyWorkerThreads
            },
            ["timestamp"] = DateTime.UtcNow
        };

        return Task.FromResult(HealthCheckResult.Healthy("System metrics collected", data));
    }

    private (int workerThreads, int completionPortThreads, int busyWorkerThreads) GetThreadPoolInfo()
    {
        ThreadPool.GetAvailableThreads(out int availableWorkerThreads, out int availableCompletionPortThreads);
        ThreadPool.GetMaxThreads(out int maxWorkerThreads, out int maxCompletionPortThreads);

        return (
            workerThreads: maxWorkerThreads,
            completionPortThreads: maxCompletionPortThreads,
            busyWorkerThreads: maxWorkerThreads - availableWorkerThreads
        );
    }
}
