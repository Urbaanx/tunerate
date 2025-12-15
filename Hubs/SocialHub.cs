using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using tunerate_api.Data;
using tunerate_api.Models;
using tunerate_api.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace tunerate_api.Hubs;

[Authorize]
public class SocialHub : Hub
{
    private readonly AppDbContext _db;
    private readonly ILogger<SocialHub> _logger;
    private readonly IPresenceService _presence;

    public SocialHub(AppDbContext db, ILogger<SocialHub> logger, IPresenceService presence)
    {
        _db = db;
        _logger = logger;
        _presence = presence;
    }
    
    private string? GetAuth0Id()
    {
        var v = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(v)) return v;
        v = Context.User?.FindFirst("sub")?.Value;
        if (!string.IsNullOrEmpty(v)) return v;
        v = Context.User?.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
        return string.IsNullOrEmpty(v) ? null : v;
    }

    private async Task NotifyFriendsPresenceAsync(string auth0Id, Guid userId, bool isOnline)
    {
        var friendsAuth0 = await _db.Friendships
            .Where(f => f.Status == FriendshipStatus.Accepted &&
                        (f.RequesterId == userId || f.AddresseeId == userId))
            .Select(f => f.RequesterId == userId ? f.Addressee.Auth0Id : f.Requester.Auth0Id)
            .Where(a => !string.IsNullOrEmpty(a))
            .ToListAsync();

        var payload = new
        {
            UserId = userId,
            Auth0Id = auth0Id,
            IsOnline = isOnline,
            Timestamp = DateTime.UtcNow
        };

        foreach (var friendAuth0 in friendsAuth0.Distinct())
        {
            try
            {
                await Clients.Group(friendAuth0).SendAsync("FriendPresenceChanged", payload);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send presence change to {friend}", friendAuth0);
            }
        }
    }

    public override async Task OnConnectedAsync()
    {
        var auth0Id = GetAuth0Id();
        _logger.LogInformation("OnConnectedAsync connectionId={cid} auth0Id={aid}", Context.ConnectionId, auth0Id);
        if (!string.IsNullOrEmpty(auth0Id))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, auth0Id);
            _logger.LogInformation("Added connection {cid} to group {aid}", Context.ConnectionId, auth0Id);

            var wasOnlineBefore = _presence.IsOnline(auth0Id);
            _presence.AddConnection(auth0Id, Context.ConnectionId);

            if (!wasOnlineBefore)
            {
                var user = await _db.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
                if (user != null)
                {
                    await NotifyFriendsPresenceAsync(auth0Id, user.Id, true);
                }
            }
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var auth0Id = GetAuth0Id();
        _logger.LogInformation("OnDisconnectedAsync connectionId={cid} auth0Id={aid}", Context.ConnectionId, auth0Id);
        if (!string.IsNullOrEmpty(auth0Id))
        {
            var becameOffline = _presence.RemoveConnection(auth0Id, Context.ConnectionId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, auth0Id);

            if (becameOffline)
            {
                var user = await _db.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
                if (user != null)
                {
                    await NotifyFriendsPresenceAsync(auth0Id, user.Id, false);
                }
            }
        }
        await base.OnDisconnectedAsync(exception);
    }
    
    public async Task RegisterConnection()
    {
        var auth0Id = GetAuth0Id();
        if (string.IsNullOrEmpty(auth0Id))
        {
            _logger.LogWarning("RegisterConnection: no auth0Id for connection {cid}", Context.ConnectionId);
            await Clients.Caller.SendAsync("RegisterFailed");
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, auth0Id);
        _logger.LogInformation("RegisterConnection: added connection {cid} to group {aid}", Context.ConnectionId, auth0Id);

        var wasOnlineBefore = _presence.IsOnline(auth0Id);
        _presence.AddConnection(auth0Id, Context.ConnectionId);

        if (!wasOnlineBefore)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user != null)
            {
                await NotifyFriendsPresenceAsync(auth0Id, user.Id, true);
            }
        }

        await Clients.Caller.SendAsync("Registered", auth0Id);
    }
    
    public async Task SendFriendRequest(string targetAuth0Id, Guid friendshipId)
    {
        await Clients.Group(targetAuth0Id).SendAsync("FriendRequestReceived", new
        {
            FriendshipId = friendshipId,
            FromAuth0Id = GetAuth0Id(),
            Timestamp = DateTime.UtcNow
        });
    }

    public async Task FriendRequestAccepted(string targetAuth0Id, Guid friendshipId)
    {
        await Clients.Group(targetAuth0Id).SendAsync("FriendRequestAccepted", new
        {
            FriendshipId = friendshipId,
            ByAuth0Id = GetAuth0Id(),
            Timestamp = DateTime.UtcNow
        });
    }

    public async Task SendAlbumShare(string toAuth0Id, object sharePayload)
    {
        await Clients.Group(toAuth0Id).SendAsync("AlbumShareReceived", sharePayload);
    }

    public async Task SendMessage(string toAuth0Id, object messagePayload)
    {
        await Clients.Group(toAuth0Id).SendAsync("ChatMessageReceived", messagePayload);
    }
}
