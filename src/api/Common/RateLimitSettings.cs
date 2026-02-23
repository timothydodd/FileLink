namespace FileLink.Common;

public class RateLimitSettings
{
    public int DownloadPermitLimit { get; set; } = 30;
    public int DownloadWindowSeconds { get; set; } = 60;
    public int LoginPermitLimit { get; set; } = 5;
    public int LoginWindowSeconds { get; set; } = 60;
}
