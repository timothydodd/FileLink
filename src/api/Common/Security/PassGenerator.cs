using System.Security.Cryptography;
using System.Text;

namespace FileLink.Common.Security;

public class PassGenerator
{
    private const string possibleChars = "ABCDEFGHJKLMNOPQRSTUVWXYZ0123456789abcdefghijkmnopqrstuvwxyz";
    private const string possibleCharsUpperOnly = "ABCDEFGHJKLMNOPQRSTUVWXYZ0123456789";
    public static string GetCode(int len, bool upperOnly = false)
    {
        string charSet = possibleChars;
        if (upperOnly)
        {
            charSet = possibleCharsUpperOnly;
        }

        using (RandomGenerator r = new())
        {
            StringBuilder builder = new();
            for (int i = 0; i < len; i++)
            {
                int nextInt = r.Next(0, charSet.Length);
                char c = charSet[nextInt];
                builder.Append(c);
            }

            return builder.ToString();
        }
    }
}

public class RandomGenerator : IDisposable
{
    private readonly RandomNumberGenerator _csp = RandomNumberGenerator.Create();

    /// <summary>
    /// Output format for unique IDs
    /// </summary>
    public enum OutputFormat
    {
        /// <summary>
        /// URL-safe Base64
        /// </summary>
        Base64Url,
        /// <summary>
        /// Base64
        /// </summary>
        Base64,
        /// <summary>
        /// Hex
        /// </summary>
        Hex
    }

    public RandomGenerator() { }

    public void Dispose()
    {
        GC.SuppressFinalize(this);
        _csp?.Dispose();
    }

    private uint GetRandomUInt()
    {
        var randomBytes = GenerateRandomBytes(sizeof(uint));
        return BitConverter.ToUInt32(randomBytes, 0);
    }

    public int Next(int minValue, int maxExclusiveValue)
    {
        if (minValue >= maxExclusiveValue)
        {
            throw new ArgumentOutOfRangeException("minValue must be lower than maxExclusiveValue");
        }

        var diff = (long)maxExclusiveValue - minValue;
        var upperBound = uint.MaxValue / diff * diff;

        uint ui;
        do
        {
            ui = GetRandomUInt();
        } while (ui >= upperBound);

        return (int)(minValue + (ui % diff));
    }

    public string CreateUniqueId(int length = 32, OutputFormat format = OutputFormat.Base64Url)
    {
        var bytes = GenerateRandomBytes(length);

        return format switch
        {
            OutputFormat.Base64Url => Base64Url.Encode(bytes),
            OutputFormat.Base64 => Convert.ToBase64String(bytes),
            OutputFormat.Hex => BitConverter.ToString(bytes).Replace("-", ""),
            _ => throw new ArgumentException("Invalid output format", nameof(format)),
        };
    }

    /// <summary>
    /// Creates a random key byte array.
    /// </summary>
    /// <param name="length">The length.</param>
    /// <returns></returns>
    public byte[] GenerateRandomBytes(int length)
    {
        var bytes = new byte[length];
        _csp.GetBytes(bytes);

        return bytes;
    }
}
public static class Base64Url
{
    /// <summary>
    /// Encodes the specified byte array.
    /// </summary>
    /// <param name="arg">The argument.</param>
    /// <returns></returns>
    public static string Encode(byte[] arg)
    {
        var s = Convert.ToBase64String(arg); // Standard base64 encoder

        s = s.Split('=')[0]; // Remove any trailing '='s
        s = s.Replace('+', '-'); // 62nd char of encoding
        s = s.Replace('/', '_'); // 63rd char of encoding

        return s;
    }

    /// <summary>
    /// Decodes the specified string.
    /// </summary>
    /// <param name="arg">The argument.</param>
    /// <returns></returns>
    /// <exception cref="System.Exception">Illegal base64url string!</exception>
    public static byte[] Decode(string arg)
    {
        var s = arg;
        s = s.Replace('-', '+'); // 62nd char of encoding
        s = s.Replace('_', '/'); // 63rd char of encoding

        switch (s.Length % 4) // Pad with trailing '='s
        {
            case 0:
                break; // No pad chars in this case
            case 2:
                s += "==";
                break; // Two pad chars
            case 3:
                s += "=";
                break; // One pad char
            default:
                throw new Exception("Illegal base64url string!");
        }

        return Convert.FromBase64String(s); // Standard base64 decoder
    }
}
