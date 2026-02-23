using Dapper;
using FileLink.Common;
using FileLink.Repos;
using FileLink.Services;
using RoboDodd.OrmLite;

namespace LogSummaryService
{
    public class FileCleanUpBackgroundService : BackgroundService
    {
        private readonly ILogger<FileCleanUpBackgroundService> _logger;
        private readonly IDbConnectionFactory _dbFactory;
        private readonly StorageSettings _storageSettings;
        private readonly AuditLogRepo _auditLogRepo;

        private readonly TimeSpan _executionTime;

        public FileCleanUpBackgroundService(IDbConnectionFactory dbFactory,
            ILogger<FileCleanUpBackgroundService> logger,
            StorageSettings storageSettings,
            AuditLogRepo auditLogRepo)
        {
            _dbFactory = dbFactory;
            _logger = logger;
            // Default to running at 1:00 AM
            _executionTime = TimeSpan.FromHours(1);
            _storageSettings = storageSettings;
            _auditLogRepo = auditLogRepo;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("File Cleanup Background Service is starting.");

            // Run immediately on startup
            await RunCleanup();

            while (!stoppingToken.IsCancellationRequested)
            {
                var now = DateTime.UtcNow;
                var nextRun = CalculateNextRunTime(now);
                var delay = nextRun - now;

                _logger.LogInformation($"Next file cleanup scheduled for {nextRun:yyyy-MM-dd HH:mm:ss}");

                await Task.Delay(delay, stoppingToken);

                if (stoppingToken.IsCancellationRequested)
                    break;

                await RunCleanup();
            }

            _logger.LogInformation("File Cleanup Background Service is stopping.");
        }

        private async Task RunCleanup()
        {
            try
            {
                await CleanUpExpiredFiles();
                await CleanUpAuditLogs();
                _logger.LogInformation("File cleanup completed successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during file cleanup.");
            }
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

        private async Task CleanUpAuditLogs()
        {
            var cutoff = DateTime.UtcNow.AddDays(-90);
            await _auditLogRepo.DeleteOlderThan(cutoff);
            _logger.LogInformation("Deleted audit log entries older than 90 days.");
        }
        private async Task CleanUpUploadGroups()
        {
            var expireCutoff = DateTime.UtcNow.AddDays(-_storageSettings.ExpiredLinkRetentionDays);
            var orphanCutoff = DateTime.UtcNow.AddHours(-24);

            using var db = _dbFactory.CreateDbConnection();
            db.Open();
            var sql = @"
SELECT ug.*
FROM UploadGroup ug
LEFT JOIN LinkCode lc ON lc.GroupId = ug.GroupId
WHERE
  (lc.Code IS NULL OR lc.ExpireDate < @expireCutoff)
  AND ug.CreatedDate < @orphanCutoff;
";
            var uploadGroups = await db.QueryAsync<UploadGroup>(sql, new { expireCutoff, orphanCutoff });
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
        private async Task CleanUpExpiredFiles()
        {
            await CleanUpUploadGroups();
            var validFileNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var path = StorageSettings.ResolvePath(_storageSettings.SharedFilesPath);
            using var db = _dbFactory.CreateDbConnection();
            db.Open();
            var allUploadItems = await db.SelectAsync<UploadItem>();
            foreach (var uploadItem in allUploadItems)
            {
                validFileNames.Add(Path.GetFileName(uploadItem.PhysicalPath));
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
