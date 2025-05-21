using Microsoft.IdentityModel.Tokens;

namespace FileLink.Common.Jwt;

public class AuthSettings
{
    public string? SecurityKey { get; set; }
    public string? Issuer { get; set; }
    public string? Audience { get; set; }
    public string? ClientId { get; set; }
    // Add these for refresh tokens
    public int RefreshTokenExpiryInDays { get; set; } = 10; // Default 7 days
    public int AccessTokenExpiryInMinutes { get; set; } = 15; // Default 15 minutes
    public SymmetricSecurityKey SymmetricSecurityKey => new(Convert.FromBase64String(SecurityKey));

    public SigningCredentials SigningCredentials => new(SymmetricSecurityKey, SecurityAlgorithms.HmacSha256);
}
