using ServiceStack.Data;
using ServiceStack.DataAnnotations;
using ServiceStack.OrmLite;
using ServiceStack.OrmLite.Dapper;

namespace FileLink.Repos;

public class AppUserRepo
{
    private readonly IDbConnectionFactory _dbFactory;

    public AppUserRepo(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }
    public async Task<AppUser> GetByUserName(string userName)
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.QueryFirstOrDefaultAsync<AppUser>("select * from AppUser where UserName = @userName", new { userName });
    }
    public async Task<AppUser> Get(Guid appUserId)
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.QuerySingleAsync<AppUser>("select * from AppUser where AppUserId = @AppUserId", new { AppUserId = appUserId });
    }
    public async Task UpdatePassword(Guid appUserId, string password)
    {
        using var db = _dbFactory.OpenDbConnection();
        await db.ExecuteAsync("update AppUser set PasswordHash = @PasswordHash where AppUserId = @AppUserId", new { PasswordHash = password, AppUserId = appUserId });
    }
    public async Task<IEnumerable<AppUser>> GetAll()
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.QueryAsync<AppUser>("select * from AppUser");
    }
    public async Task<AppUser> Create(AppUser AppUser)
    {
        using var db = _dbFactory.OpenDbConnection();
        await db.InsertAsync(AppUser);
        return AppUser;
    }
}
public class AppUser
{
    [PrimaryKey]

    public required Guid AppUserId { get; set; }
    [Index]
    public required string UserName { get; set; }
    [StringLength(255)]
    public required string PasswordHash { get; set; }

    public required DateTime TimeStamp { get; set; }
}
