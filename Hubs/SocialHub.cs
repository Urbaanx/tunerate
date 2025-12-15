using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using System.Security.Claims;
using tunerate_api.Data;
using tunerate_api.Models;

namespace tunerate_api.Hubs;

[Authorize]
public class SocialHub : Hub
{
    private readonly AppDbContext _db;
    private readonly ILogger<SocialHub> _logger;

    public SocialHub(AppDbContext db, ILogger<SocialHub> logger)
    {
        _db = db;
        _logger = logger;
    }

    // Helper: zwraca Auth0Id (NameIdentifier / sub) lub null
    private string? GetAuth0Id()
    {
        var v = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(v)) return v;
        v = Context.User?.FindFirst("sub")?.Value;
        if (!string.IsNullOrEmpty(v)) return v;
        v = Context.User?.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
        return string.IsNullOrEmpty(v) ? null : v;
    }

    public override async Task OnConnectedAsync()
    {
        var auth0Id = GetAuth0Id();
        _logger.LogInformation("OnConnectedAsync connectionId={cid} auth0Id={aid}", Context.ConnectionId, auth0Id);
        if (!string.IsNullOrEmpty(auth0Id))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, auth0Id);
            _logger.LogInformation("Added connection {cid} to group {aid}", Context.ConnectionId, auth0Id);
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var auth0Id = GetAuth0Id();
        _logger.LogInformation("OnDisconnectedAsync connectionId={cid} auth0Id={aid}", Context.ConnectionId, auth0Id);
        if (!string.IsNullOrEmpty(auth0Id))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, auth0Id);
        }
        await base.OnDisconnectedAsync(exception);
    }

    // explicit register — klient wywołuje po starcie połączenia, hub potwierdzi
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
        await Clients.Caller.SendAsync("Registered", auth0Id);
    }

    // Wywołania z klienta (opcjonalne) — klient może poprosić o wysłanie zaproszenia przez hub:
    public async Task SendFriendRequest(string targetAuth0Id, Guid friendshipId)
    {
        // Wyślij powiadomienie do targetu (grupy targetAuth0Id)
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
