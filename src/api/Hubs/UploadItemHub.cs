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
        await Groups.AddToGroupAsync(Context.ConnectionId, "UploadItemChanges");
    }



}
