using FileLink.Common;
using Microsoft.Extensions.Caching.Memory;

namespace FileLink.Services;

public class LocalFileCache
{
    public required StorageSettings _storageSettings;
    private readonly IMemoryCache _memoryCache;
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
    public LocalFileCache(StorageSettings storageSettings, IMemoryCache memoryCache)
    {
        _storageSettings = storageSettings;
        _memoryCache = memoryCache;
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
    public List<LocalFile> GetFiles()
    {
        if (_memoryCache.TryGetValue("local-files", out List<LocalFile>? files))
        {
            if (files != null)
                return files;
        }
        return RefreshLocalFiles();

    }
    public List<LocalFile> RefreshLocalFiles()
    {
        var files = new List<LocalFile>();
        if (_storageSettings.LocalSharedPaths == null)
            return files;
        for (int i = 0; i < _storageSettings.LocalSharedPaths.Count; i++)
        {
            string? localPath = _storageSettings.LocalSharedPaths[i];
            if (Directory.Exists(localPath))
            {

                var fileInfos = Directory.GetFiles(localPath, "*", SearchOption.AllDirectories);
                foreach (var f in fileInfos)
                {
                    var ext = Path.GetExtension(f);
                    if (!AllowedExtensions.Contains(ext))
                        continue;
                    files.Add(new LocalFile
                    {
                        LocalPathIndex = i,
                        Path = f.Substring(localPath.Length)
                    });
                }
            }
        }

        _memoryCache.Set("local-files", files, TimeSpan.FromMinutes(5));
        return files;
    }
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
