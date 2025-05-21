using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FileLink.Common.Jwt;
using FileLink.Repos;
using Microsoft.IdentityModel.Tokens;

namespace FileLink.Services;

public class JwtService
{
    private readonly AuthSettings _authSettings;
    private readonly RefreshTokenRepo _refreshTokenRepo;

    public JwtService(AuthSettings jwtAuthSettings, RefreshTokenRepo refreshTokenRepo)
    {
        _authSettings = jwtAuthSettings;
        _refreshTokenRepo = refreshTokenRepo;
    }



    public async Task<string> AuthToken(string name, Guid? groupId, Guid appUserId, string role, TimeSpan expires, IEnumerable<Claim>? customClaims = null)
    {


        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,appUserId.ToString()),
            new(JwtRegisteredClaimNames.Name, name),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.Role, role),
            new(Constants.CustomClaims.AppUserId, appUserId.ToString())
        };
        if (groupId != null)
        {
            claims.Add(new Claim(Constants.CustomClaims.GroupId, groupId.ToString()!));
        }
        if (customClaims != null)
        {
            foreach (Claim claim in customClaims)
            {
                claims.Add(claim);
            }
        }

        var token = new JwtSecurityToken(
                                         _authSettings.Issuer,
                                         _authSettings.Audience,
                                         claims,
                                         expires: DateTime.UtcNow.Add(expires),
                                         notBefore: DateTime.UtcNow,
                                         signingCredentials: _authSettings.SigningCredentials);

        return await Task.FromResult(new JwtSecurityTokenHandler().WriteToken(token));
    }

    /// <summary>
    ///     Not for passwords (no salt used) , only randomly generated codes
    /// </summary>
    public string GetCodeHash(string code)
    {
        using (var macleish1 = new HMACSHA1(Convert.FromBase64String(_authSettings.SecurityKey)))
        {
            var byteArray = Encoding.ASCII.GetBytes(code);
            var hashBytes = macleish1.ComputeHash(byteArray);

            var hash = Convert.ToBase64String(hashBytes);

            return hash;
        }
    }
    public async Task<string> GenerateRefreshToken(Guid appUserId)
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        var refreshToken = Convert.ToBase64String(randomBytes);

        var refreshTokenEntity = new RefreshToken
        {
            Token = refreshToken,
            AppUserId = appUserId,
            ExpiryDate = DateTime.UtcNow.AddDays(_authSettings.RefreshTokenExpiryInDays),
            CreatedDate = DateTime.UtcNow,
            IsRevoked = false
        };

        // Save to database
        await _refreshTokenRepo.Create(refreshTokenEntity);


        return refreshToken;
    }
    public async Task<(string accessToken, string refreshToken, double expiresIn)> RefreshToken(string expiredAccessToken, string refreshToken)
    {
        // Get the principal from the expired token without validating lifetime
        var principal = GetPrincipalFromExpiredToken(expiredAccessToken);
        var appUserId = Guid.Parse(principal.FindFirst(Constants.CustomClaims.AppUserId)?.Value);
        var username = principal.FindFirst(JwtRegisteredClaimNames.Name)?.Value;
        var role = principal.FindFirst(ClaimTypes.Role)?.Value;
        var groupIdClaim = principal.FindFirst(Constants.CustomClaims.GroupId)?.Value;
        Guid? groupId = groupIdClaim != null ? Guid.Parse(groupIdClaim) : null;

        // Validate refresh token from the database
        var storedToken = await _refreshTokenRepo.Get(refreshToken, appUserId);

        if (storedToken == null)
            throw new SecurityTokenException("Invalid refresh token");

        if (storedToken.ExpiryDate < DateTime.UtcNow)
            throw new SecurityTokenException("Refresh token expired");

        if (storedToken.IsRevoked)
            throw new SecurityTokenException("Refresh token revoked");

        // Create new access token
        var accessTokenExpiry = TimeSpan.FromMinutes(_authSettings.AccessTokenExpiryInMinutes);
        var newAccessToken = await AuthToken(username, groupId, appUserId, role, accessTokenExpiry);

        // Optional: Replace refresh token (rotate tokens for better security)
        // First, revoke the current refresh token
        storedToken.IsRevoked = true;
        await _refreshTokenRepo.Update(storedToken);

        // Generate a new refresh token
        var newRefreshToken = await GenerateRefreshToken(appUserId);


        return (newAccessToken, newRefreshToken, accessTokenExpiry.TotalSeconds);
    }
    public async Task RevokeRefreshToken(string refreshToken)
    {
        var storedToken = await _refreshTokenRepo.GetByToken(refreshToken);

        if (storedToken != null)
        {
            storedToken.IsRevoked = true;
            await _refreshTokenRepo.Update(storedToken);
        }
    }
    private ClaimsPrincipal GetPrincipalFromExpiredToken(string token)
    {
        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = true,
            ValidateIssuer = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = _authSettings.SymmetricSecurityKey,
            ValidIssuer = _authSettings.Issuer,
            ValidAudience = _authSettings.Audience,
            ValidateLifetime = false // We don't care about the token's expiration date
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out var securityToken);

        if (!(securityToken is JwtSecurityToken jwtSecurityToken) ||
            !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256,
            StringComparison.InvariantCultureIgnoreCase))
        {
            throw new SecurityTokenException("Invalid token");
        }

        return principal;
    }

}
