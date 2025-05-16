using System.Security.Claims;
using FileLink.Common.Jwt;
using Microsoft.AspNetCore.Authentication;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
namespace FileLink.Common;

public static class AuthExtensions
{
    public static AuthenticationBuilder UseFileLinkJwtAuth(this AuthenticationBuilder builder,
                                                          JwtAuthSettings jwtSettings,
                                                          bool isDevelopment = false
    )
    {
        return builder.AddJwtBearer("LLJwtAuth",
                                    options =>
                                    {
                                        options.ClaimsIssuer = jwtSettings.ValidIssuer;
                                        if (isDevelopment)
                                        {
                                            options.IncludeErrorDetails = true;
                                        }

                                        options.RequireHttpsMetadata = true;

                                        options.TokenValidationParameters = new TokenValidationParameters
                                        {
                                            ValidateActor = false,
                                            ValidateIssuer = true,
                                            ValidateAudience = true,
                                            ValidateLifetime = true,
                                            ValidateIssuerSigningKey = true,
                                            ValidIssuer = jwtSettings.ValidIssuer,
                                            ValidAudience = jwtSettings.ValidAudience,
                                            IssuerSigningKey = jwtSettings.SymmetricSecurityKey,
                                            NameClaimType = ClaimTypes.NameIdentifier,
                                            LifetimeValidator =
                                                (notBefore, expires, securityToken, validationParameters) =>
                                                {
                                                    return notBefore <= DateTime.UtcNow &&
                                                           expires >= DateTime.UtcNow;
                                                }
                                        };
                                    });
    }
}
public class SystemClaimUtil
{
    public static ClaimsIdentity GetSystemClaim(Guid groupId, string issuer)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, Constants.SystemGuids.SystemUserId.ToString(), null, issuer),
            new(JwtRegisteredClaimNames.NameId, "System", null, issuer),
            new(JwtRegisteredClaimNames.Email, "duper@FileLink.com", null, issuer),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString(), null, issuer),
            new(ClaimTypes.Role, Constants.AuthRoleTypes.System, null, issuer),
            new(Constants.CustomClaims.GroupId, groupId.ToString(), null, issuer),
            new(Constants.CustomClaims.AppUserId, Constants.SystemGuids.SystemUserId.ToString(), null, issuer)
        };

        // generate claimsIdentity on the name of the class
        var claimsIdentity = new ClaimsIdentity(claims);
        return claimsIdentity;
    }
}
