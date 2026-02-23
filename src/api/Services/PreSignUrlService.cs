using System.Security.Cryptography;
using System.Text;
using FileLink.Common.Jwt;

namespace FileLink.Services;

public class PreSignUrlService
{
    readonly string _secretKey;
    public PreSignUrlService(AuthSettings jwtAuth)
    {
        _secretKey = jwtAuth.SecurityKey!;
        if (string.IsNullOrEmpty(jwtAuth.SecurityKey))
        {
            throw new Exception("PreSignUrlSecret is not configured");
        }
    }
    public bool ValidatePreSignedUrl(Guid itemId, long expires, string signature)
    {



        if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expires)
        {
            return false; // URL has expired
        }

        var dataToSign = $"{itemId}{expires}";
        var expectedSignature = GenerateSignature(dataToSign, _secretKey);

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(signature),
            Encoding.UTF8.GetBytes(expectedSignature));
    }
    public string GeneratePreSignedUrl(Guid itemId, TimeSpan duration)
    {

        var expirationTime = DateTimeOffset.UtcNow.Add(duration).ToUnixTimeSeconds();
        var dataToSign = $"{itemId}{expirationTime}";
        var signature = GenerateSignature(dataToSign, _secretKey);


        return $"?expires={expirationTime}&signature={Uri.EscapeDataString(signature)}";
    }
    public string GenerateSignature(string data, string secretKey)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secretKey)))
        {
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
            return Convert.ToBase64String(hash);
        }
    }
}
