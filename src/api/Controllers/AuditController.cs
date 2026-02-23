using FileLink.Repos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FileLink.Controllers;

[Authorize(Policy = Constants.AuthPolicy.RequireOwner)]
[ApiController]
[Route("api/audit")]
public class AuditController : ControllerBase
{
    private readonly AuditLogRepo _auditLogRepo;

    public AuditController(AuditLogRepo auditLogRepo)
    {
        _auditLogRepo = auditLogRepo;
    }

    [HttpGet]
    public async Task<IActionResult> GetLogs([FromQuery] int limit = 50, [FromQuery] int offset = 0)
    {
        var items = await _auditLogRepo.GetRecent(limit, offset);
        var totalCount = await _auditLogRepo.GetCount();

        return Ok(new AuditLogResponse
        {
            Items = items.Select(x => new AuditLogItem
            {
                Id = x.Id,
                Action = x.Action,
                AppUserId = x.AppUserId,
                GroupId = x.GroupId,
                ItemId = x.ItemId,
                Detail = x.Detail,
                IpAddress = x.IpAddress,
                CreatedDate = DateTime.SpecifyKind(x.CreatedDate, DateTimeKind.Utc)
            }).ToList(),
            TotalCount = totalCount
        });
    }
}

public class AuditLogResponse
{
    public List<AuditLogItem> Items { get; set; } = new();
    public int TotalCount { get; set; }
}

public class AuditLogItem
{
    public long Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public Guid? AppUserId { get; set; }
    public Guid? GroupId { get; set; }
    public Guid? ItemId { get; set; }
    public string? Detail { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedDate { get; set; }
}
