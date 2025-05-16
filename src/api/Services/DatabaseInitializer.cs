using FileLink.Repos;
using LogMkApi.Services;
using ServiceStack.Data;
using ServiceStack.OrmLite;

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
        using (var db = _dbFactory.OpenDbConnection())
        {
            db.CreateTableIfNotExists<UploadItem>();
            db.CreateTableIfNotExists<UploadGroup>();
            db.CreateTableIfNotExists<LinkCode>();
            if (db.CreateTableIfNotExists<AppUser>())
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
}
