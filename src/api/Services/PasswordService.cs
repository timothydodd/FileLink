using FileLink.Repos;
using Microsoft.AspNetCore.Identity;

namespace LogMkApi.Services;

public class PasswordService
{
    private readonly PasswordHasher<AppUser> _passwordHasher;
    private readonly PasswordHasher<object> _genericHasher;

    public PasswordService()
    {
        _passwordHasher = new PasswordHasher<AppUser>();
        _genericHasher = new PasswordHasher<object>();
    }

    public string HashPassword(AppUser user, string password)
    {
        return _passwordHasher.HashPassword(user, password);
    }

    public bool VerifyPassword(AppUser user, string password)
    {
        var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
        return result == PasswordVerificationResult.Success;
    }

    public string HashLinkPassword(string password)
    {
        return _genericHasher.HashPassword(new object(), password);
    }

    public bool VerifyLinkPassword(string password, string hash)
    {
        var result = _genericHasher.VerifyHashedPassword(new object(), hash, password);
        return result == PasswordVerificationResult.Success;
    }
}
