namespace FileLink.Common;

public class StorageSettings
{
    public required string SharedFilesPath { get; set; }
    public required string DatabaseFilesPath { get; set; }

    public static string ResolvePath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
            throw new ArgumentException("Path is not specified.");
        var basePath = AppContext.BaseDirectory;
        var combined = Path.IsPathRooted(path)
            ? path
            : Path.Combine(basePath, path);

        return Path.GetFullPath(combined); // This cleans up any mixed slashes
    }
    public List<String>? LocalSharedPaths { get; set; }
}

