using Microsoft.IdentityModel.Tokens;

namespace FileLink.Common.Jwt;

public class JwtAuthSettings
{
    public string? SecurityKey { get; set; }
    public string? ValidIssuer { get; set; }
    public string? ValidAudience { get; set; }
    public string? ClientId { get; set; }
    public int AccessTokenLifetime { get; set; } = 900; //15 minutes
    public int RefreshTokenLifetime { get; set; } = 86400; //24 hours

    public SymmetricSecurityKey SymmetricSecurityKey => new(Convert.FromBase64String(SecurityKey));

    public SigningCredentials SigningCredentials => new(SymmetricSecurityKey, SecurityAlgorithms.HmacSha256);
}
