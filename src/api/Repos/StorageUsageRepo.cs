using Dapper;
using RoboDodd.OrmLite;

namespace FileLink.Repos;

public class StorageUsageRepo
{
    private readonly IDbConnectionFactory _dbFactory;

    public StorageUsageRepo(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<StorageUsageSummary> GetSummary()
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();

        var total = await db.QuerySingleAsync<StorageTotalResult>(
            "SELECT COUNT(*) as TotalItems, COALESCE(SUM(Size), 0) as TotalSize FROM UploadItem");

        var groups = (await db.QueryAsync<GroupStorageUsage>(
            @"SELECT ug.GroupId, COUNT(ui.ItemId) as ItemCount, COALESCE(SUM(ui.Size), 0) as TotalSize, MAX(ui.CreatedDate) as LastUpload
              FROM UploadGroup ug
              LEFT JOIN UploadItem ui ON ug.GroupId = ui.GroupId
              GROUP BY ug.GroupId
              ORDER BY TotalSize DESC")).ToList();

        return new StorageUsageSummary
        {
            TotalItems = total.TotalItems,
            TotalSize = total.TotalSize,
            GroupCount = groups.Count,
            Groups = groups
        };
    }
}

public class StorageTotalResult
{
    public int TotalItems { get; set; }
    public long TotalSize { get; set; }
}

public class GroupStorageUsage
{
    public Guid GroupId { get; set; }
    public int ItemCount { get; set; }
    public long TotalSize { get; set; }
    public DateTime? LastUpload { get; set; }
}

public class StorageUsageSummary
{
    public int TotalItems { get; set; }
    public long TotalSize { get; set; }
    public int GroupCount { get; set; }
    public List<GroupStorageUsage> Groups { get; set; } = new();
}
