using FileLink.Repos;

namespace FileLink.Services;

public class AuditLogService
{
    private readonly AuditLogRepo _repo;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuditLogService(AuditLogRepo repo, IHttpContextAccessor httpContextAccessor)
    {
        _repo = repo;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task LogAsync(string action, Guid? appUserId = null, Guid? groupId = null, Guid? itemId = null, string? detail = null)
    {
        var ip = _httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
        var entry = new AuditLog
        {
            Action = action,
            AppUserId = appUserId,
            GroupId = groupId,
            ItemId = itemId,
            Detail = detail,
            IpAddress = ip,
            CreatedDate = DateTime.UtcNow
        };
        await _repo.Create(entry);
    }
}
