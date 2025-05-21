using FileLink.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace FileLink.Hubs;

[Authorize]
public class UploadItemHub : Hub
{


    public override async Task OnConnectedAsync()
    {
        // Get user info
        var userId = Context.GetAppUserIdOrNull();

        if (userId == null)
        {
            Context.Abort(); // Disconnect if no valid user ID
            return;
        }

        await base.OnConnectedAsync();
    }

    // Method for clients to join a specific job group
    public async Task JoinGroup(Guid groupId)
    {
        var role = Context.GetRole();
        if (Constants.AuthRoleTypes.Owner != role)
        {

            Guid? myGroupId = Context.GetGroupIdOrNull();
            if (myGroupId is null || myGroupId != groupId)
            {
                throw new Exception("You do not have permission to access this group.");
            }

        }
        await Groups.AddToGroupAsync(Context.ConnectionId, groupId.ToString());
    }

    // Method for clients to leave a specific job group
    public async Task LeaveGroup(string groupName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    }


}
