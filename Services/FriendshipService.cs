using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using tunerate_api.Data;
using tunerate_api.Hubs;
using tunerate_api.Models;
using tunerate_api.Interfaces;

namespace tunerate_api.Services
{
    public class FriendshipService : IFriendshipService
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<SocialHub> _hub;

        public FriendshipService(AppDbContext context, IHubContext<SocialHub> hub)
        {
            _context = context;
            _hub = hub;
        }

        private async Task<User?> GetUserByAuth0IdAsync(string auth0Id)
        {
            return await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
        }

        public async Task<IEnumerable<object>?> GetOutgoingRequestsAsync(string auth0Id)
        {
            var current = await GetUserByAuth0IdAsync(auth0Id);
            if (current == null) return null;

            var outgoing = await _context.Friendships
                .AsNoTracking()
                .Where(f => f.Status == FriendshipStatus.Pending && f.RequesterId == current.Id)
                .Include(f => f.Addressee)
                .Select(f => new
                {
                    f.Id,
                    f.CreatedAt,
                    Receiver = new
                    {
                        f.Addressee.Id,
                        f.Addressee.Nickname,
                        f.Addressee.Auth0Id
                    }
                })
                .ToListAsync();

            return outgoing;
        }

        public async Task<(bool Success, string? Error, object? Payload)> SendFriendRequestAsync(string auth0Id, Guid toUserId)
        {
            var from = await GetUserByAuth0IdAsync(auth0Id);
            if (from == null) return (false, "Unauthorized", null);

            if (from.Id == toUserId) return (false, "Nie można wysłać zaproszenia do samego siebie.", null);

            var exists = await _context.Friendships.AnyAsync(f =>
                (f.RequesterId == from.Id && f.AddresseeId == toUserId) ||
                (f.RequesterId == toUserId && f.AddresseeId == from.Id));

            if (exists) return (false, "Już istnieje zaproszenie / relacja.", null);

            var friendship = new Friendship
            {
                RequesterId = from.Id,
                AddresseeId = toUserId,
                Status = FriendshipStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            _context.Friendships.Add(friendship);
            await _context.SaveChangesAsync();

            var target = await _context.Users.FindAsync(toUserId);

            var toUserDto = target != null
                ? new { Id = target.Id, Nickname = target.Nickname, Auth0Id = target.Auth0Id }
                : new { Id = toUserId, Nickname = (string?)null, Auth0Id = (string?)null };

            if (target != null)
            {
                await _hub.Clients.Group(target.Auth0Id).SendAsync("FriendRequestReceived", new
                {
                    FriendshipId = friendship.Id,
                    FromUser = new { from.Id, from.Nickname, from.Auth0Id },
                    ToUser = toUserDto,
                    Status = friendship.Status,
                    CreatedAt = friendship.CreatedAt
                });
            }

            var payload = new
            {
                FriendshipId = friendship.Id,
                FromUser = new { from.Id, from.Nickname, from.Auth0Id },
                ToUser = toUserDto,
                Status = friendship.Status,
                CreatedAt = friendship.CreatedAt
            };
            return (true, null, payload);
        }

        public async Task<(bool Success, string? Error, object? Payload)> AcceptFriendRequestAsync(string auth0Id, Guid friendshipId)
        {
            var current = await GetUserByAuth0IdAsync(auth0Id);
            if (current == null) return (false, "Unauthorized", null);

            var f = await _context.Friendships.FindAsync(friendshipId);
            if (f == null) return (false, "NotFound", null);

            if (f.AddresseeId != current.Id) return (false, "Forbid", null);

            f.Status = FriendshipStatus.Accepted;
            await _context.SaveChangesAsync();

            var requester = await _context.Users.FindAsync(f.RequesterId);
            if (requester != null)
            {
                await _hub.Clients.Group(requester.Auth0Id).SendAsync("FriendRequestAccepted", new
                {
                    FriendshipId = f.Id,
                    ByUser = new { current.Id, current.Nickname, current.Auth0Id },
                    CreatedAt = DateTime.UtcNow
                });
            }

            var payload = new
            {
                FriendshipId = f.Id,
                ByUser = new { current.Id, current.Nickname, current.Auth0Id },
                Status = f.Status,
                CreatedAt = f.CreatedAt
            };
            return (true, null, payload);
        }

        public async Task<(bool Success, string? Error, object? Payload)> DeclineFriendRequestAsync(string auth0Id, Guid friendshipId)
        {
            var current = await GetUserByAuth0IdAsync(auth0Id);
            if (current == null) return (false, "Unauthorized", null);

            var f = await _context.Friendships.FindAsync(friendshipId);
            if (f == null) return (false, "NotFound", null);

            if (f.AddresseeId != current.Id && f.RequesterId != current.Id) return (false, "Forbid", null);

            f.Status = FriendshipStatus.Declined;
            await _context.SaveChangesAsync();

            var payload = new
            {
                FriendshipId = f.Id,
                Status = f.Status,
                UpdatedAt = DateTime.UtcNow
            };
            return (true, null, payload);
        }

        public async Task<IEnumerable<object>?> GetFriendsAsync(string auth0Id, IPresenceService presence)
        {
            var current = await GetUserByAuth0IdAsync(auth0Id);
            if (current == null) return null;

            var friends = await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Accepted &&
                       (f.RequesterId == current.Id || f.AddresseeId == current.Id))
                .Select(f => f.RequesterId == current.Id ? f.AddresseeId : f.RequesterId)
                .ToListAsync();

            var users = await _context.Users.Where(u => friends.Contains(u.Id))
                .Select(u => new
                {
                    u.Id,
                    u.Nickname,
                    u.Auth0Id
                })
                .ToListAsync();

            var result = users.Select(u => new
            {
                u.Id,
                u.Nickname,
                u.Auth0Id,
                Status = presence.IsOnline(u.Auth0Id) ? "Online" : "Offline"
            }).ToList();

            return result;
        }

        public async Task<IEnumerable<object>?> GetIncomingRequestsAsync(string auth0Id)
        {
            var current = await GetUserByAuth0IdAsync(auth0Id);
            if (current == null) return null;

            var requests = await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Pending && f.AddresseeId == current.Id)
                .Include(f => f.Requester)
                .Select(f => new
                {
                    f.Id,
                    f.CreatedAt,
                    Requester = new { f.Requester.Id, f.Requester.Nickname, f.Requester.Auth0Id }
                })
                .ToListAsync();

            return requests;
        }

        public async Task<(bool Success, string? Error)> RemoveFriendAsync(string auth0Id, Guid friendId)
        {
            var current = await GetUserByAuth0IdAsync(auth0Id);
            if (current == null) return (false, "Unauthorized");

            var friendship = await _context.Friendships.FirstOrDefaultAsync(f =>
                (f.RequesterId == current.Id && f.AddresseeId == friendId) ||
                (f.RequesterId == friendId && f.AddresseeId == current.Id));

            if (friendship == null) return (false, "NotFound");

            if (friendship.Status != FriendshipStatus.Accepted)
                return (false, "BadRequest: Relacja nie jest zaakceptowaną znajomością.");

            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();

            var other = await _context.Users.FindAsync(friendId);
            if (other != null)
            {
                await _hub.Clients.Group(other.Auth0Id).SendAsync("FriendRemoved", new
                {
                    By = new { current.Id, current.Nickname },
                    Timestamp = DateTime.UtcNow
                });
            }

            return (true, null);
        }

        public async Task<(bool Success, string? Error)> WithdrawOutgoingRequestAsync(string auth0Id, Guid friendshipId)
        {
            var current = await GetUserByAuth0IdAsync(auth0Id);
            if (current == null) return (false, "Unauthorized");

            var f = await _context.Friendships.FindAsync(friendshipId);
            if (f == null) return (false, "NotFound");

            if (f.RequesterId != current.Id) return (false, "Forbid");

            if (f.Status != FriendshipStatus.Pending)
                return (false, "BadRequest: Można wycofać tylko oczekujące zaproszenie.");

            _context.Friendships.Remove(f);
            await _context.SaveChangesAsync();

            var other = await _context.Users.FindAsync(f.AddresseeId);
            if (other != null)
            {
                await _hub.Clients.Group(other.Auth0Id).SendAsync("FriendRequestWithdrawn", new
                {
                    FriendshipId = f.Id,
                    By = new { current.Id, current.Nickname },
                    Timestamp = DateTime.UtcNow
                });
            }

            return (true, null);
        }
    }
}