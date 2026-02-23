using Dapper;
using RoboDodd.OrmLite;

namespace FileLink.Repos;

public class UploadItemRepo
{
    private readonly IDbConnectionFactory _dbFactory;

    public UploadItemRepo(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }
    public async Task UpdateAsync(UploadItem uploadItem)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        await db.UpdateAsync(uploadItem);
    }
    public async Task<UploadItem?> Get(Guid id)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        return await db.SingleByIdAsync<UploadItem>(id);
    }
    public async Task<List<UploadItem>> GetByGroupId(Guid groupId)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        return await db.SelectAsync<UploadItem>(x => x.GroupId == groupId);
    }
    public async Task<UploadItem> Create(UploadItem uploadItem)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        await db.InsertAsync(uploadItem);
        return uploadItem;
    }
    public async Task<List<UploadItem>> GetAllItemsWithOutMetadata()
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        var result = await db.QueryAsync<UploadItem>("SELECT * FROM UploadItem WHERE Metadata IS NULL");
        return result.ToList();
    }
    public async Task IncrementDownloadCount(Guid itemId)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        await db.ExecuteAsync(
            "UPDATE UploadItem SET DownloadCount = DownloadCount + 1, LastDownload = @Now WHERE ItemId = @ItemId",
            new { ItemId = itemId.ToString(), Now = DateTime.UtcNow.ToString("o") });
    }
}
public class UploadItem
{
    [PrimaryKey]
    public Guid ItemId { get; set; }
    [Index]
    public Guid GroupId { get; set; }
    public required string FileName { get; set; }
    public required string PhysicalPath { get; set; }
    [Default(typeof(DateTime), "CURRENT_TIMESTAMP")]
    public DateTime CreatedDate { get; set; }
    [CustomField("JSON")]
    public string? Metadata { get; set; }
    public string? RelativePath { get; set; }
    public long Size { get; set; }
    [Default(typeof(int), "0")]
    public int DownloadCount { get; set; }
    public DateTime? LastDownload { get; set; }
}
