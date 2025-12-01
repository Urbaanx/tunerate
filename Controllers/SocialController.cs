using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using tunerate_api.Data;
using tunerate_api.Hubs;
using tunerate_api.Models;
using Microsoft.EntityFrameworkCore;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SocialController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<SocialHub> _hub;

        public SocialController(AppDbContext context, IHubContext<SocialHub> hub)
        {
            _context = context;
            _hub = hub;
        }

        private string GetAuth0Id()
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) throw new UnauthorizedAccessException("Brak Auth0 ID w tokenie.");
            return auth0Id;
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var auth0 = GetAuth0Id();
            return await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0);
        }
        
        [HttpGet("requests/outgoing")]
        public async Task<IActionResult> GetOutgoingRequests()
        {
            var current = await GetCurrentUserAsync();
            if (current == null) return Unauthorized();

            var outgoing = await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Pending &&
                            f.RequesterId == current.Id)
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

            return Ok(outgoing);
        }

        // POST: api/social/friends/request/{toUserId}
        [HttpPost("friends/request/{toUserId:guid}")]
        public async Task<IActionResult> SendFriendRequest(Guid toUserId)
        {
            var from = await GetCurrentUserAsync();
            if (from == null) return Unauthorized();

            if (from.Id == toUserId) return BadRequest("Nie można wysłać zaproszenia do samego siebie.");

            var exists = await _context.Friendships.AnyAsync(f =>
                (f.RequesterId == from.Id && f.AddresseeId == toUserId) ||
                (f.RequesterId == toUserId && f.AddresseeId == from.Id));

            if (exists) return Conflict("Już istnieje zaproszenie / relacja.");

            var friendship = new Friendship
            {
                RequesterId = from.Id,
                AddresseeId = toUserId,
                Status = FriendshipStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            _context.Friendships.Add(friendship);
            await _context.SaveChangesAsync();

            // powiadomienie przez SignalR: wyślij auth0Id docelowego użytkownika
            var target = await _context.Users.FindAsync(toUserId);
            if (target != null)
            {
                await _hub.Clients.Group(target.Auth0Id).SendAsync("FriendRequestReceived", new
                {
                    FriendshipId = friendship.Id,
                    FromUser = new { from.Id, from.Nickname, from.Auth0Id },
                    CreatedAt = friendship.CreatedAt
                });
            }

            return Ok(friendship);
        }

        // POST: api/social/friends/accept/{friendshipId}
        [HttpPost("friends/accept/{friendshipId:guid}")]
        public async Task<IActionResult> AcceptFriendRequest(Guid friendshipId)
        {
            var current = await GetCurrentUserAsync();
            if (current == null) return Unauthorized();

            var f = await _context.Friendships.FindAsync(friendshipId);
            if (f == null) return NotFound();

            if (f.AddresseeId != current.Id) return Forbid("Tylko adresat może zaakceptować zaproszenie.");

            f.Status = FriendshipStatus.Accepted;
            await _context.SaveChangesAsync();

            // powiadomienie do requestera
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

            return Ok(f);
        }

        // POST: api/social/friends/decline/{friendshipId}
        [HttpPost("friends/decline/{friendshipId:guid}")]
        public async Task<IActionResult> DeclineFriendRequest(Guid friendshipId)
        {
            var current = await GetCurrentUserAsync();
            if (current == null) return Unauthorized();

            var f = await _context.Friendships.FindAsync(friendshipId);
            if (f == null) return NotFound();

            if (f.AddresseeId != current.Id && f.RequesterId != current.Id) return Forbid();

            f.Status = FriendshipStatus.Declined;
            await _context.SaveChangesAsync();

            return Ok(f);
        }

        // GET: api/social/friends — lista znajomych (accepted)
        [HttpGet("friends")]
        public async Task<IActionResult> GetFriends()
        {
            var current = await GetCurrentUserAsync();
            if (current == null) return Unauthorized();

            var friends = await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Accepted &&
                       (f.RequesterId == current.Id || f.AddresseeId == current.Id))
                .Select(f => f.RequesterId == current.Id ? f.AddresseeId : f.RequesterId)
                .ToListAsync();

            var users = await _context.Users.Where(u => friends.Contains(u.Id))
                .Select(u => new { u.Id, u.Nickname, u.Auth0Id })
                .ToListAsync();

            return Ok(users);
        }

        // GET: api/social/requests — zaproszenia (pending) adresowane do mnie
        [HttpGet("requests")]
        public async Task<IActionResult> GetIncomingRequests()
        {
            var current = await GetCurrentUserAsync();
            if (current == null) return Unauthorized();

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

            return Ok(requests);
        }

        // POST: api/social/share/{toUserId}/{albumId}
        [HttpPost("share/{toUserId:guid}/{albumId:guid}")]
        public async Task<IActionResult> ShareAlbum(Guid toUserId, Guid albumId)
        {
            var from = await GetCurrentUserAsync();
            if (from == null) return Unauthorized();

            var target = await _context.Users.FindAsync(toUserId);
            if (target == null) return NotFound("Użytkownik docelowy nie znaleziony.");

            var album = await _context.Albums
                .Include(a => a.Artist)
                .FirstOrDefaultAsync(a => a.Id == albumId);

            if (album == null) return NotFound("Album nie znaleziony.");

            var share = new AlbumShare
            {
                FromUserId = from.Id,
                ToUserId = toUserId,
                AlbumId = albumId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.AlbumShares.Add(share);
            await _context.SaveChangesAsync();

            // przygotuj bezpieczny DTO/payload (tylko skalarne pola, brak referencji do encji EF)
            var payload = new
            {
                Id = share.Id,
                IsRead = share.IsRead,
                CreatedAt = share.CreatedAt,
                FromUser = new { Id = from.Id, Nickname = from.Nickname, Auth0Id = from.Auth0Id },
                Album = new
                {
                    Id = album.Id,
                    Title = album.Title,
                    CoverUrl = album.CoverUrl,
                    ExternalId = album.ExternalId,
                    // tylko nazwa artysty, nie cały obiekt Artist
                    Name = album.Artist != null ? album.Artist.Name : null,
                    ReleaseDate = album.ReleaseDate
                }
            };

            // push via SignalR - wysyłamy tylko payload (bez cykli)
            if (target != null)
            {
                await _hub.Clients.Group(target.Auth0Id).SendAsync("AlbumShareReceived", payload);
            }

            // zwróć DTO zamiast encji EF
            return Ok(payload);
        }

        // GET: api/social/shares — wszystkie otrzymane polecenia dla użytkownika
        [HttpGet("shares")]
        public async Task<IActionResult> GetReceivedShares()
        {
            var current = await GetCurrentUserAsync();
            if (current == null) return Unauthorized();

            var shares = await _context.AlbumShares
                .Where(s => s.ToUserId == current.Id)
                .Include(s => s.FromUser)
                .Include(s => s.Album)
                    .ThenInclude(a => a.Artist)
                .OrderByDescending(s => s.CreatedAt)
                .Select(s => new
                {
                    s.Id,
                    s.IsRead,
                    s.CreatedAt,
                    FromUser = new { s.FromUser.Id, s.FromUser.Nickname, s.FromUser.Auth0Id },
                    Album = new
                    {
                        s.Album.Id,
                        s.Album.Title,
                        s.Album.CoverUrl,
                        s.Album.ExternalId,
                        s.Album.Artist.Name,
                        ReleaseDate = s.Album.ReleaseDate
                    }
                })
                .ToListAsync();

            return Ok(shares);
        }

        // POST: api/social/shares/mark-read/{shareId}
        [HttpPost("shares/mark-read/{shareId:guid}")]
        public async Task<IActionResult> MarkShareRead(Guid shareId)
        {
            var current = await GetCurrentUserAsync();
            if (current == null) return Unauthorized();

            var s = await _context.AlbumShares.FindAsync(shareId);
            if (s == null) return NotFound();
            if (s.ToUserId != current.Id) return Forbid();

            s.IsRead = true;
            await _context.SaveChangesAsync();

            // zwracamy minimalny DTO, nie encję EF
            var result = new
            {
                Id = s.Id,
                IsRead = s.IsRead,
                CreatedAt = s.CreatedAt,
                AlbumId = s.AlbumId
            };

            return Ok(result);
        }
        
        // GET: api/social/profile/{userId}
        [HttpGet("profile/{userId:guid}")]
        public async Task<IActionResult> GetUserProfile(Guid userId)
        {
            var user = await _context.Users
                .Where(u => u.Id == userId)
                .Select(u => new
                {
                    u.Id,
                    u.Nickname,
                    u.Auth0Id,

                    Reviews = _context.Reviews
                        .Where(r => r.UserId == userId)
                        .OrderByDescending(r => r.CreatedAt)
                        .Take(20)
                        .Select(r => new
                        {
                            r.Id,
                            r.Score,
                            r.Content,
                            AlbumTitle = r.Album.Title,
                            r.CreatedAt
                        })
                        .ToList(),

                    Albums = _context.UserAlbums
                        .Where(ua => ua.UserId == userId)
                        .Select(ua => new
                        {
                            ua.Album.Id,
                            ua.Album.Title,
                            Artist = ua.Album.Artist.Name,
                            ua.Album.CoverUrl,
                            ua.Status,
                            ua.CreatedAt
                        })
                        .ToList()
                })
                .FirstOrDefaultAsync();

            if (user == null) return NotFound();
            return Ok(user);
        }
        

        // GET: api/social/search?query=...&limit=20
        [HttpGet("search")]
        public async Task<IActionResult> SearchUsers([FromQuery] string query = "", [FromQuery] int limit = 20)
        {
            var current = await GetCurrentUserAsync();
            if (current == null) return Unauthorized();

            if (string.IsNullOrWhiteSpace(query))
                return BadRequest("Brak parametru 'query'.");

            query = query.Trim();

            var results = await _context.Users
                .Where(u => u.Id != current.Id && EF.Functions.Like(u.Nickname, $"%{query}%"))
                .OrderBy(u => u.Nickname)
                .Select(u => new { u.Id, u.Nickname })
                .Take(limit)
                .ToListAsync();

            return Ok(results);
        }

        // DELETE: api/social/friends/{friendId}
        [HttpDelete("friends/{friendId:guid}")]
        public async Task<IActionResult> RemoveFriend(Guid friendId)
        {
            var current = await GetCurrentUserAsync();
            if (current == null) return Unauthorized();

            var friendship = await _context.Friendships.FirstOrDefaultAsync(f =>
                (f.RequesterId == current.Id && f.AddresseeId == friendId) ||
                (f.RequesterId == friendId && f.AddresseeId == current.Id));

            if (friendship == null) return NotFound();

            if (friendship.Status != FriendshipStatus.Accepted)
                return BadRequest("Relacja nie jest zaakceptowaną znajomością.");

            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();

            // opcjonalne powiadomienie drugiej strony
            var other = await _context.Users.FindAsync(friendId);
            if (other != null)
            {
                await _hub.Clients.Group(other.Auth0Id).SendAsync("FriendRemoved", new
                {
                    By = new { current.Id, current.Nickname },
                    Timestamp = DateTime.UtcNow
                });
            }

            return NoContent();
        }

        // DELETE: api/social/requests/{friendshipId} - wycofanie wysłanego zaproszenia (requester)
        [HttpDelete("requests/{friendshipId:guid}")]
        public async Task<IActionResult> WithdrawOutgoingRequest(Guid friendshipId)
        {
            var current = await GetCurrentUserAsync();
            if (current == null) return Unauthorized();

            var f = await _context.Friendships.FindAsync(friendshipId);
            if (f == null) return NotFound();

            // tylko requester może wycofać swoje wysłane zaproszenie
            if (f.RequesterId != current.Id) return Forbid("Tylko nadawca może wycofać wysłane zaproszenie.");

            // tylko oczekujące zaproszenia można wycofać
            if (f.Status != FriendshipStatus.Pending) 
                return BadRequest("Można wycofać tylko oczekujące zaproszenie.");

            // Usuwamy wpis zamiast ustawiać status
            _context.Friendships.Remove(f);
            await _context.SaveChangesAsync();

            // opcjonalne powiadomienie adresata o wycofaniu (jeśli istnieje)
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

            return NoContent();
        }


    }
}
