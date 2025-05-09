using FileLink.Repos;
using Microsoft.AspNetCore.Identity;

namespace LogMkApi.Services;

public class PasswordService
{
    private readonly PasswordHasher<AppUser> _passwordHasher;

    public PasswordService()
    {
        _passwordHasher = new PasswordHasher<AppUser>();
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
}
