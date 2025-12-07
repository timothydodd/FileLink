using Dapper;
using RoboDodd.OrmLite;

namespace FileLink.Repos;

public class UploadGroupRepo
{
    private readonly IDbConnectionFactory _dbFactory;

    public UploadGroupRepo(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }
    public async Task<UploadGroup?> Get(Guid id)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        return await db.SingleByIdAsync<UploadGroup>(id);
    }
    public async Task<UploadGroup> Create(UploadGroup UploadGroup)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
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
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        await db.ExecuteAsync(sql, new { groupId });
    }
}
public class UploadGroup
{
    [PrimaryKey]
    public Guid GroupId { get; set; }
    [Default(typeof(DateTime), "CURRENT_TIMESTAMP")]
    public DateTime CreatedDate { get; set; }
}
