using FileLink.Repos;
using LogMkApi.Services;
using RoboDodd.OrmLite;

namespace FileLink.Services;

public class DatabaseInitializer
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly PasswordService _passwordService;
    public DatabaseInitializer(IDbConnectionFactory dbFactory, PasswordService passwordService)
    {
        _dbFactory = dbFactory;
        _passwordService = passwordService;
    }

    public void CreateTable()
    {
        using var db = _dbFactory.CreateDbConnection();
        db.Open();
        db.CreateTableIfNotExists<UploadItem>(migrateSchema: true);
        db.CreateTableIfNotExists<UploadGroup>(migrateSchema: true);
        db.CreateTableIfNotExists<LinkCode>(migrateSchema: true);
        db.CreateTableIfNotExists<RefreshToken>(migrateSchema: true);
        db.CreateTableIfNotExists<AuditLog>(migrateSchema: true);
        if (db.CreateTableIfNotExists<AppUser>(migrateSchema: true))
        {
            var user = new AppUser
            {
                AppUserId = Guid.NewGuid(),
                UserName = "admin",
                PasswordHash = "",
                TimeStamp = DateTime.UtcNow
            };
            user.PasswordHash = _passwordService.HashPassword(user, "admin");
            db.Insert(user);
        }
    }
}
