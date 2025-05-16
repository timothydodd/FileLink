using FileLink.Common;
using FileLink.Repos;
using ServiceStack.Data;
using ServiceStack.OrmLite;

namespace LogSummaryService
{
    public class FileCleanUpBackgroundService : BackgroundService
    {
        private readonly ILogger<FileCleanUpBackgroundService> _logger;
        private readonly IDbConnectionFactory _dbFactory;
        private readonly StorageSettings _storageSettings;

        private readonly TimeSpan _executionTime;

        public FileCleanUpBackgroundService(IDbConnectionFactory dbFactory,
            ILogger<FileCleanUpBackgroundService> logger,
            StorageSettings storageSettings)
        {
            _dbFactory = dbFactory;
            _logger = logger;
            // Default to running at 1:00 AM
            _executionTime = TimeSpan.FromHours(1);
            _storageSettings = storageSettings;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Log Summary Background Service is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                // Calculate time until next execution
                var now = DateTime.UtcNow;
                var nextRun = CalculateNextRunTime(now);
                var delay = nextRun - now;

                _logger.LogInformation($"Next log summary update scheduled for {nextRun:yyyy-MM-dd HH:mm:ss}");

                // Wait until the scheduled time
                await Task.Delay(delay, stoppingToken);

                // If cancellation was requested during the delay, exit
                if (stoppingToken.IsCancellationRequested)
                    break;

                try
                {
                    await CleanUpExpiredFiles();
                    _logger.LogInformation("Log summary update completed successfully.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error updating log summary table.");
                }
            }

            _logger.LogInformation("Log Summary Background Service is stopping.");
        }

        private DateTime CalculateNextRunTime(DateTime now)
        {
            // Create a DateTime for today at the specified execution time
            var todayExecutionTime = new DateTime(
                now.Year, now.Month, now.Day,
                _executionTime.Hours, _executionTime.Minutes, _executionTime.Seconds);

            // If that time has already passed today, schedule for tomorrow
            if (now > todayExecutionTime)
            {
                return todayExecutionTime.AddDays(1);
            }

            // Otherwise, schedule for today
            return todayExecutionTime;
        }

        private async Task CleanUpUploadGroups()
        {
            // get all UploadGroup's without a linkcode and are atleast 24hours old or the linkcode has been expired for 24hours

            using (var db = _dbFactory.OpenDbConnection())
            {
                var sql = @"

SELECT ug.*
FROM UploadGroup ug
LEFT JOIN LinkCode lc ON lc.GroupId = ug.GroupId
WHERE
  (lc.Code IS NULL OR
   lc.ExpireDate < datetime('now', '-24 hours'))
  AND ug.CreatedDate < datetime('now', '-24 hours');
";
                var uploadGroups = db.Select<UploadGroup>(sql);
                foreach (var uploadGroup in uploadGroups)
                {
                    _logger.LogInformation($"Deleting UploadGroup {uploadGroup.GroupId} with no linkcode or expired linkcode");
                    // delete the linkcode
                    await db.DeleteAsync<LinkCode>(x => x.GroupId == uploadGroup.GroupId);
                    // delete the upload items
                    await db.DeleteAsync<UploadItem>(x => x.GroupId == uploadGroup.GroupId);
                    // delete the upload group
                    await db.DeleteAsync<UploadGroup>(x => x.GroupId == uploadGroup.GroupId);
                    // delete the upload group
                }
            }

        }
        private async Task CleanUpExpiredFiles()
        {
            await CleanUpUploadGroups();
            var validFileNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var path = StorageSettings.ResolvePath(_storageSettings.SharedFilesPath);
            using (var db = _dbFactory.OpenDbConnection())
            {
                var allUploadItems = await db.SelectAsync<UploadItem>();
                foreach (var uploadItem in allUploadItems)
                {
                    validFileNames.Add(Path.GetFileName(uploadItem.PhysicalPath));
                }
            }
            var files = Directory.GetFiles(path, "*.*", SearchOption.AllDirectories);
            foreach (var file in files)
            {
                var fileName = Path.GetFileName(file);
                if (!validFileNames.Contains(fileName))
                {
                    try
                    {
                        File.Delete(file);
                        _logger.LogInformation($"Deleted file: {file}");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Error deleting file: {file}");
                    }
                }
            }
            //find empty directorys
            var directories = Directory.GetDirectories(path, "*.*", SearchOption.AllDirectories);
            foreach (var directory in directories)
            {
                try
                {
                    if (Directory.GetFiles(directory).Length == 0 && Directory.GetDirectories(directory).Length == 0)
                    {
                        Directory.Delete(directory);
                        _logger.LogInformation($"Deleted empty directory: {directory}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error deleting directory: {directory}");
                }
            }

        }
    }
}

