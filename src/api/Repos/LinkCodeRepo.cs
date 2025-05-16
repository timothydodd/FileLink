using ServiceStack.Data;
using ServiceStack.DataAnnotations;
using ServiceStack.OrmLite;
using ServiceStack.OrmLite.Dapper;

namespace FileLink.Repos;

public class LinkCodeRepo
{
    private readonly IDbConnectionFactory _dbFactory;

    public LinkCodeRepo(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }
    public async Task<LinkCode> GetByCode(string code)
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.QuerySingleAsync<LinkCode>("select * from LinkCode where Code = @code", new { code });
    }
    public async Task<LinkCode> Get(Guid groupId, Guid appUserId)
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.QuerySingleAsync<LinkCode>("select * from LinkCode where GroupId = @GroupId AND AppUserId = @AppUserId", new { GroupId = groupId, AppUserId = appUserId });
    }
    public async Task<IEnumerable<LinkCodeWithItemCount>> GetAll()
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.SelectAsync<LinkCodeWithItemCount>(
            @"
select lc.*, count(ui.ItemId) as ItemCount, SUM(ui.Size) as Size
from LinkCode lc
left join UploadItem ui on lc.GroupId = ui.GroupId
group by lc.Code, lc.GroupId, lc.Role, lc.ExpireDate, lc.AppUserId, lc.MaxUses, lc.Uses, lc.CreatedDate, lc.LastAccess");
    }
    public async Task<IEnumerable<LinkCode>> GetAll(Guid groupId)
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.QueryAsync<LinkCode>("select * from LinkCode where GroupId = @GroupId ", new { GroupId = groupId });
    }
    public async Task<LinkCode> Create(LinkCode UploadGroup)
    {
        using var db = _dbFactory.OpenDbConnection();
        await db.InsertAsync(UploadGroup);
        return UploadGroup;
    }

    internal async Task DeleteShared(Guid groupId)
    {
        using var db = _dbFactory.OpenDbConnection();
        await db.ExecuteAsync("DELETE FROM LinkCode WHERE GroupId = @GroupId AND Role = 'Reader'", new { GroupId = groupId });
    }

    internal void Update(LinkCode lc)
    {
        using var db = _dbFactory.OpenDbConnection();
        db.Update(lc);
    }

    internal void Delete(LinkCode lc)
    {
        using var db = _dbFactory.OpenDbConnection();
        db.Delete(lc);
    }
}
public class LinkCode
{
    [PrimaryKey]
    public required string Code { get; set; }
    [Index]
    public required Guid GroupId { get; set; }
    public required string Role { get; set; }
    public DateTime ExpireDate { get; set; }
    public required Guid AppUserId { get; set; }
    public int? MaxUses { get; set; }
    public int? Uses { get; set; }
    [Default(typeof(DateTime), "CURRENT_TIMESTAMP")] // Set default timestamp
    public DateTime CreatedDate { get; set; }
    public DateTime? LastAccess { get; set; }
}

public class LinkCodeWithItemCount : LinkCode
{
    public int ItemCount { get; set; }
    public long Size { get; set; }
}
