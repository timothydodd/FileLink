using Dapper;
using RoboDodd.OrmLite;

namespace FileLink.Repos;

public class AuditLogRepo
{
    private readonly IDbConnectionFactory _dbFactory;

    public AuditLogRepo(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task Create(AuditLog entry)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        await db.InsertAsync(entry);
    }

    public async Task<IEnumerable<AuditLog>> GetRecent(int limit, int offset)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        return await db.QueryAsync<AuditLog>(
            "SELECT * FROM AuditLog ORDER BY CreatedDate DESC LIMIT @Limit OFFSET @Offset",
            new { Limit = limit, Offset = offset });
    }

    public async Task<int> GetCount()
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        return await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM AuditLog");
    }

    public async Task DeleteOlderThan(DateTime cutoff)
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        await db.ExecuteAsync("DELETE FROM AuditLog WHERE CreatedDate < @Cutoff", new { Cutoff = cutoff });
    }
}

public class AuditLog
{
    [AutoIncrement]
    [PrimaryKey]
    public long Id { get; set; }
    [Index]
    public required string Action { get; set; }
    public Guid? AppUserId { get; set; }
    public Guid? GroupId { get; set; }
    public Guid? ItemId { get; set; }
    public string? Detail { get; set; }
    public string? IpAddress { get; set; }
    [Default(typeof(DateTime), "CURRENT_TIMESTAMP")]
    public DateTime CreatedDate { get; set; }
}
