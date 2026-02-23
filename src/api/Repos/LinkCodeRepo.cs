using Dapper;
using RoboDodd.OrmLite;

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
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        return await db.QuerySingleAsync<LinkCode>("select * from LinkCode where Code = @code", new { code });
    }
    public async Task<LinkCode> Get(Guid groupId, Guid appUserId)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        return await db.QuerySingleAsync<LinkCode>("select * from LinkCode where GroupId = @GroupId AND AppUserId = @AppUserId", new { GroupId = groupId, AppUserId = appUserId });
    }
    public async Task<LinkCode?> GetReaderByGroupId(Guid groupId)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        return await db.QuerySingleOrDefaultAsync<LinkCode>(
            "select * from LinkCode where GroupId = @GroupId AND Role = 'Reader'", new { GroupId = groupId });
    }
    public async Task<IEnumerable<LinkCodeWithItemCount>> GetAll()
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        return await db.QueryAsync<LinkCodeWithItemCount>(
            @"
select lc.*, count(ui.ItemId) as ItemCount, SUM(ui.Size) as Size
from LinkCode lc
left join UploadItem ui on lc.GroupId = ui.GroupId
group by lc.Code, lc.GroupId, lc.Role, lc.ExpireDate, lc.AppUserId, lc.MaxUses, lc.Uses, lc.CreatedDate, lc.LastAccess, lc.PasswordHash, lc.BandwidthLimitKBps");
    }
    public async Task<IEnumerable<LinkCode>> GetAll(Guid groupId)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        return await db.QueryAsync<LinkCode>("select * from LinkCode where GroupId = @GroupId ", new { GroupId = groupId });
    }
    public async Task<LinkCode> Create(LinkCode UploadGroup)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        await db.InsertAsync(UploadGroup);
        return UploadGroup;
    }

    internal async Task DeleteShared(Guid groupId)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        await db.ExecuteAsync("DELETE FROM LinkCode WHERE GroupId = @GroupId AND Role = 'Reader'", new { GroupId = groupId });
    }

    internal async Task UpdateAsync(LinkCode lc)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        await db.UpdateAsync(lc);
    }

    internal async Task DeleteAsync(LinkCode lc)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        await db.DeleteAsync(lc);
    }

    public async Task DeleteByCodes(IEnumerable<string> codes)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        var codeList = codes.ToList();
        var inClause = string.Join(",", codeList.Select((_, i) => $"@Code{i}"));
        var parameters = new DynamicParameters();
        for (int i = 0; i < codeList.Count; i++)
            parameters.Add($"Code{i}", codeList[i]);
        await db.ExecuteAsync($"DELETE FROM LinkCode WHERE Code IN ({inClause})", parameters);
    }

    public async Task ExpireByCodes(IEnumerable<string> codes)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        var codeList = codes.ToList();
        var inClause = string.Join(",", codeList.Select((_, i) => $"@Code{i}"));
        var parameters = new DynamicParameters();
        parameters.Add("Now", DateTime.UtcNow.ToString("o"));
        for (int i = 0; i < codeList.Count; i++)
            parameters.Add($"Code{i}", codeList[i]);
        await db.ExecuteAsync($"UPDATE LinkCode SET ExpireDate = @Now WHERE Code IN ({inClause})", parameters);
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
    [Default(typeof(DateTime), "CURRENT_TIMESTAMP")]
    public DateTime CreatedDate { get; set; }
    public DateTime? LastAccess { get; set; }
    public string? PasswordHash { get; set; }
    public int? BandwidthLimitKBps { get; set; }
}

public class LinkCodeWithItemCount : LinkCode
{
    public int ItemCount { get; set; }
    public long Size { get; set; }
}
