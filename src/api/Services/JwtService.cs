using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FileLink.Common.Jwt;

namespace FileLink.Services;

public class JwtService
{
    private readonly JwtAuthSettings _jwtAuthSettings;


    public JwtService(JwtAuthSettings jwtAuthSettings)
    {
        _jwtAuthSettings = jwtAuthSettings;
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
                                         _jwtAuthSettings.ValidIssuer,
                                         _jwtAuthSettings.ValidAudience,
                                         claims,
                                         expires: DateTime.UtcNow.Add(expires),
                                         notBefore: DateTime.UtcNow,
                                         signingCredentials: _jwtAuthSettings.SigningCredentials);

        return await Task.FromResult(new JwtSecurityTokenHandler().WriteToken(token));
    }

    /// <summary>
    ///     Not for passwords (no salt used) , only randomly generated codes
    /// </summary>
    public string GetCodeHash(string code)
    {
        using (var macleish1 = new HMACSHA1(Convert.FromBase64String(_jwtAuthSettings.SecurityKey)))
        {
            var byteArray = Encoding.ASCII.GetBytes(code);
            var hashBytes = macleish1.ComputeHash(byteArray);

            var hash = Convert.ToBase64String(hashBytes);

            return hash;
        }
    }


}
