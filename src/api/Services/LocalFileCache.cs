using FileLink.Common;
using Microsoft.Extensions.Caching.Memory;

namespace FileLink.Services;

public class LocalFileCache
{
    public required StorageSettings _storageSettings;
    private readonly IMemoryCache _memoryCache;
    private readonly BackgroundTaskQueue _backgroundTaskQueue;
    private readonly ILogger<LocalFileCache> _logger;
    // Define allowed extensions
    private static readonly HashSet<string> AllowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        // Documents
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".odt", ".csv", ".md",
        // Images
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".tiff", ".heic",
        // Videos
        ".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv",
        // Audio
        ".mp3", ".wav", ".aac", ".ogg", ".flac", ".m4a",
        // Archives
        ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"
        // Note: intentionally excluding executables/scripts for safety
    };
    public LocalFileCache(StorageSettings storageSettings, IMemoryCache memoryCache, ILogger<LocalFileCache> logger, BackgroundTaskQueue backgroundTaskQueue)
    {
        _storageSettings = storageSettings;
        _memoryCache = memoryCache;
        _logger = logger;
        _backgroundTaskQueue = backgroundTaskQueue;
    }
    public string GetLocalFullPath(int id, string path)
    {
        if (_storageSettings.LocalSharedPaths == null || id < 0 || id >= _storageSettings.LocalSharedPaths.Count)
            throw new ArgumentOutOfRangeException(nameof(id), "Invalid local path index.");
        var fullPath = Path.Combine(_storageSettings.LocalSharedPaths[id], path);

        return fullPath;
    }
    public LocalInfo GetInfo()
    {
        return new LocalInfo
        {
            HasLocalPaths = _storageSettings.LocalSharedPaths != null && _storageSettings.LocalSharedPaths.Count > 0
        };
    }
    public async Task QueueIndexing()
    {
        var indexingKey = $"indexing_local-files";
        if (!_memoryCache.TryGetValue(indexingKey, out _))
        {

            // Set indexing flag in cache
            _memoryCache.Set(indexingKey, true, TimeSpan.FromMinutes(30)); // Timeout after 30 minutes

            await _backgroundTaskQueue.QueueWork(new WorkItem
            {
                Action = async (token) =>
                {
                    await Task.Run(() =>
                    {
                        RefreshLocalFiles();
                        _memoryCache.Remove(indexingKey);
                    }, token);
                }
            });
        }
    }
    public async Task<FileIndexResponse> GetFiles()
    {

        if (_memoryCache.TryGetValue("local-files", out List<LocalFile>? files))
        {
            if (files != null)
                return new FileIndexResponse
                {
                    Indexing = false,
                    Files = files
                };
        }

        await QueueIndexing();



        return new FileIndexResponse()
        {
            Indexing = true,
            Files = null
        };
    }
    public List<LocalFile> RefreshLocalFiles()
    {
        var response = new List<LocalFile>();
        if (_storageSettings.LocalSharedPaths == null)
            return response;
        var startTime = DateTime.UtcNow;
        _logger.LogInformation("Refreshing local files cache");
        for (int i = 0; i < _storageSettings.LocalSharedPaths.Count; i++)
        {
            string? localPath = _storageSettings.LocalSharedPaths[i];
            if (Directory.Exists(localPath))
            {

                var dFiles = Directory.GetFiles(localPath, "*", SearchOption.AllDirectories);
                foreach (var f in dFiles)
                {
                    var ext = Path.GetExtension(f);
                    if (!AllowedExtensions.Contains(ext))
                        continue;
                    response.Add(new LocalFile
                    {
                        LocalPathIndex = i,
                        Path = f.Substring(localPath.Length)
                    });
                }
            }
        }
        _logger.LogInformation("Found {count} local files in {time} seconds", response.Count, (DateTime.UtcNow - startTime).TotalSeconds);
        _memoryCache.Set("local-files", response);
        return response;
    }
}
public class FileIndexResponse
{
    public bool Indexing { get; set; }
    public List<LocalFile>? Files { get; set; }
}
public class LocalFile
{
    public required int LocalPathIndex { get; set; }
    public required string Path { get; set; }

}

public class LocalInfo
{
    public bool HasLocalPaths { get; set; }
}
