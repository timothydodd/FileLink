using ServiceStack.Data;
using ServiceStack.DataAnnotations;
using ServiceStack.OrmLite;

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
        using var db = _dbFactory.OpenDbConnection();
        await db.UpdateAsync(uploadItem);
    }
    public async Task<UploadItem> Get(Guid id)
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.SingleByIdAsync<UploadItem>(id);
    }
    public async Task<List<UploadItem>> GetByGroupId(Guid groupId)
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.SelectAsync<UploadItem>(x => x.GroupId == groupId);
    }
    public async Task<UploadItem> Create(UploadItem uploadItem)
    {
        using var db = _dbFactory.OpenDbConnection();
        await db.InsertAsync(uploadItem);
        return uploadItem;
    }
    public async Task<List<UploadItem>> GetAllItemsWithOutMetadata()
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.SelectAsync<UploadItem>("SELECT * FROM UploadItem WHERE Metadata IS NULL");



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
    [Default(typeof(DateTime), "CURRENT_TIMESTAMP")] // Set default timestamp
    public DateTime CreatedDate { get; set; }
    [CustomField("JSON")]
    public string? Metadata { get; set; }
    public long Size { get; set; }

}
