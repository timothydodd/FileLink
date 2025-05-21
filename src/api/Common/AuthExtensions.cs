using System.Security.Claims;
using FileLink.Common.Jwt;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
namespace FileLink.Common;

public static class AuthExtensions
{
    public static AuthenticationBuilder UseFileLinkJwtAuth(this AuthenticationBuilder builder,
                                                          AuthSettings authSettings,
                                                          bool isDevelopment = false
    )
    {
        return builder.AddJwtBearer("LLJwtAuth",
                                    options =>
                                    {
                                        options.ClaimsIssuer = authSettings.Issuer;
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
                                            ValidIssuer = authSettings.Issuer,
                                            ValidAudience = authSettings.Audience,
                                            IssuerSigningKey = authSettings.SymmetricSecurityKey,
                                            NameClaimType = ClaimTypes.NameIdentifier,
                                            LifetimeValidator =
                                                (notBefore, expires, securityToken, validationParameters) =>
                                                {
                                                    return notBefore <= DateTime.UtcNow &&
                                                           expires >= DateTime.UtcNow;
                                                }
                                        };
                                        options.Events = new JwtBearerEvents
                                        {
                                            OnMessageReceived = context =>
                                            {
                                                var accessToken = context.Request.Query["access_token"];

                                                // If the request is for our hub...
                                                var path = context.HttpContext.Request.Path;
                                                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hub/"))
                                                {
                                                    // Read the token out of the query string
                                                    context.Token = accessToken;
                                                }
                                                return Task.CompletedTask;
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
