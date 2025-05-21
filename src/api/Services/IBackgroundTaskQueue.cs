using System.Threading.Channels;
using FileLink.Repos;

namespace FileLink.Services;
public interface IBackgroundTaskQueue
{
    Channel<WorkItem> GetChannel();
    ValueTask QueueFileProcessAsync(UploadItem item);
}