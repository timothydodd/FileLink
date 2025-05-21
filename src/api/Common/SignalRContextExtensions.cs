using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace FileLink.Common;

public static class SignalRContextExtensions
{

    public static Guid GetGroupId(this HubCallerContext context)
    {

        var tenantId = context.GetGroupIdOrNull();

        if (tenantId is null)
        {
            throw new Exception("GroupId is null!");
        }

        return tenantId.Value;
    }
    public static Guid? GetGroupIdOrNull(this HubCallerContext context)
    {

        if (context?.User == null)
        {
            return null;
        }

        var groupId = context.User.FindFirst(Constants.CustomClaims.GroupId);

        if (string.IsNullOrEmpty(groupId?.Value))
        {
            return null;
        }

        return Guid.Parse(groupId.Value);
    }

    /// <summary>
    /// Gets person id or null
    /// </summary>
    public static Guid? GetAppUserIdOrNull(this HubCallerContext context)
    {

        if (context?.User == null)
        {
            return null;
        }

        var appUserId = context.User.FindFirst(Constants.CustomClaims.AppUserId);

        if (string.IsNullOrEmpty(appUserId?.Value))
        {
            return null;
        }

        if (!Guid.TryParse(appUserId.Value, out var personId))
        {
            return null;
        }

        return personId;
    }

    /// <summary>
    /// Gets person id
    /// </summary>
    public static Guid GetAppUserId(this HubCallerContext context)
    {
        var appUserId = context.GetAppUserIdOrNull();

        if (appUserId is null)
        {
            throw new Exception("User Id is null! User is probably not logged in.");
        }

        return appUserId.Value;
    }

    /// <summary>
    /// Gets role
    /// </summary>
    public static string? GetRole(this HubCallerContext context)
    {
        var roleClaim = context.User.FindFirst(ClaimTypes.Role);

        if (string.IsNullOrEmpty(roleClaim?.Value))
        {
            return null;
        }

        return roleClaim.Value;
    }
}
