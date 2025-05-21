using ServiceStack.Data;
using ServiceStack.DataAnnotations;
using ServiceStack.OrmLite;

namespace FileLink.Repos;


public class RefreshTokenRepo
{
    private readonly IDbConnectionFactory _dbFactory;

    public RefreshTokenRepo(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }
    public async Task<RefreshToken?> GetByToken(string token)
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.SingleAsync<RefreshToken?>(x => x.Token == token);
    }
    public async Task<RefreshToken?> Get(string token, Guid appUserId)
    {
        using var db = _dbFactory.OpenDbConnection();
        return await db.SingleAsync<RefreshToken?>(x => x.AppUserId == appUserId && x.Token == token);
    }
    public async Task<RefreshToken> Create(RefreshToken UploadGroup)
    {
        using var db = _dbFactory.OpenDbConnection();
        await db.InsertAsync(UploadGroup);
        return UploadGroup;
    }
    public async Task Update(RefreshToken refreshToken)
    {
        using var db = _dbFactory.OpenDbConnection();
        await db.UpdateAsync(refreshToken);
    }

}
[CompositeIndex(nameof(Token), nameof(AppUserId))]
public class RefreshToken
{
    [AutoIncrement]
    [PrimaryKey]
    public int Id { get; set; } // Primary key
    [Index]
    public required string Token { get; set; }
    public required Guid AppUserId { get; set; }
    public DateTime ExpiryDate { get; set; }
    public bool IsRevoked { get; set; }
    [Default(typeof(DateTime), "CURRENT_TIMESTAMP")] // Set default timestamp
    public DateTime CreatedDate { get; set; }


}
