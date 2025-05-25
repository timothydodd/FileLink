using FileLink.Repos;

namespace FileLink.Services;

public class QueueTester
{
    private readonly UploadItemRepo _uploadItemRepo;
    private readonly BackgroundTaskQueue _backgroundTaskQueue;

    public QueueTester(BackgroundTaskQueue backgroundTaskQueue, UploadItemRepo uploadItemRepo)
    {
        _backgroundTaskQueue = backgroundTaskQueue;
        _uploadItemRepo = uploadItemRepo;
    }

    public async Task ProcessFileAsync()
    {

        var uploadItem = await _uploadItemRepo.Get(Guid.Parse("5148e36a-c997-4f05-b301-c38897b602e7"));

        _backgroundTaskQueue.QueueFileProcessAsync(uploadItem);
    }
}
