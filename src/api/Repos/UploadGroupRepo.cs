using ServiceStack.Data;
using ServiceStack.DataAnnotations;
using ServiceStack.OrmLite;

namespace FileLink.Repos;

public class UploadGroupRepo
{
    private readonly IDbConnectionFactory _dbFactory;

    public UploadGroupRepo(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }
    public async Task<UploadGroup> Get(Guid id)
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.SingleByIdAsync<UploadGroup>(id);
    }
    public async Task<UploadGroup> Create(UploadGroup UploadGroup)
    {
        using var db = _dbFactory.OpenDbConnection();
        await db.InsertAsync(UploadGroup);
        return UploadGroup;
    }
    public async Task Delete(Guid groupId)
    {
        var sql = @"
DELETE FROM LinkCode Where GroupId = @groupId;
DELETE FROM UploadItem Where GroupId = @groupId;
DELETE FROM UploadGroup Where GroupId = @groupId;
";
        using var db = _dbFactory.OpenDbConnection();
        await db.ExecuteSqlAsync(sql, new { groupId });
    }
}
public class UploadGroup
{
    [PrimaryKey]
    public Guid GroupId { get; set; }
    [Default(typeof(DateTime), "CURRENT_TIMESTAMP")] // Set default timestamp
    public DateTime CreatedDate { get; set; }
}

