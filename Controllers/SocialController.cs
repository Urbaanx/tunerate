using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using tunerate_api.Data;
using tunerate_api.Models;
using Microsoft.EntityFrameworkCore;
using tunerate_api.Interfaces;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SocialController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IFriendshipService _friendshipService;
        private readonly IAlbumShareService _albumShareService;
        private readonly IPresenceService _presence;

        public SocialController(AppDbContext context, IFriendshipService friendshipService, IAlbumShareService albumShareService, IPresenceService presence)
        {
            _context = context;
            _friendshipService = friendshipService;
            _albumShareService = albumShareService;
            _presence = presence;
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
            return await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Auth0Id == auth0);
        }

        [HttpGet("requests/outgoing")]
        public async Task<IActionResult> GetOutgoingRequests()
        {
            var auth0 = GetAuth0Id();
            var outgoing = await _friendshipService.GetOutgoingRequestsAsync(auth0);
            if (outgoing == null) return Unauthorized();
            return Ok(outgoing);
        }

        [HttpPost("friends/request/{toUserId:guid}")]
        public async Task<IActionResult> SendFriendRequest(Guid toUserId)
        {
            var auth0 = GetAuth0Id();
            var (success, error, payload) = await _friendshipService.SendFriendRequestAsync(auth0, toUserId);
            if (!success) return error == "Unauthorized" ? Unauthorized() : error != null && error.StartsWith("BadRequest") ? BadRequest(error.Substring(11)) : Conflict(error);
            return Ok(payload);
        }

        [HttpPost("friends/accept/{friendshipId:guid}")]
        public async Task<IActionResult> AcceptFriendRequest(Guid friendshipId)
        {
            var auth0 = GetAuth0Id();
            var (success, error, payload) = await _friendshipService.AcceptFriendRequestAsync(auth0, friendshipId);
            if (!success)
            {
                if (error == "Unauthorized") return Unauthorized();
                if (error == "NotFound") return NotFound();
                if (error == "Forbid") return Forbid("Tylko adresat może zaakceptować zaproszenie.");
            }
            return Ok(payload);
        }

        [HttpPost("friends/decline/{friendshipId:guid}")]
        public async Task<IActionResult> DeclineFriendRequest(Guid friendshipId)
        {
            var auth0 = GetAuth0Id();
            var (success, error, payload) = await _friendshipService.DeclineFriendRequestAsync(auth0, friendshipId);
            if (!success)
            {
                if (error == "Unauthorized") return Unauthorized();
                if (error == "NotFound") return NotFound();
                if (error == "Forbid") return Forbid();
            }
            return Ok(payload);
        }

        [HttpGet("friends")]
        public async Task<IActionResult> GetFriends()
        {
            var auth0 = GetAuth0Id();
            var users = await _friendshipService.GetFriendsAsync(auth0, _presence);
            if (users == null) return Unauthorized();
            return Ok(users);
        }

        [HttpGet("requests")]
        public async Task<IActionResult> GetIncomingRequests()
        {
            var auth0 = GetAuth0Id();
            var requests = await _friendshipService.GetIncomingRequestsAsync(auth0);
            if (requests == null) return Unauthorized();
            return Ok(requests);
        }

        [HttpPost("share/{toUserId:guid}/{albumId:guid}")]
        public async Task<IActionResult> ShareAlbum(Guid toUserId, Guid albumId)
        {
            var auth0 = GetAuth0Id();
            var (success, error, payload) = await _albumShareService.ShareAlbumAsync(auth0, toUserId, albumId);
            if (!success) return error == "Unauthorized" ? Unauthorized() : NotFound(error);
            return Ok(payload);
        }

        [HttpGet("shares")]
        public async Task<IActionResult> GetReceivedShares()
        {
            var auth0 = GetAuth0Id();
            var shares = await _albumShareService.GetReceivedSharesAsync(auth0);
            if (shares == null) return Unauthorized();
            return Ok(shares);
        }

        [HttpPost("shares/mark-read/{shareId:guid}")]
        public async Task<IActionResult> MarkShareRead(Guid shareId)
        {
            var auth0 = GetAuth0Id();
            var (success, error, result) = await _albumShareService.MarkShareReadAsync(auth0, shareId);
            if (!success)
            {
                if (error == "Unauthorized") return Unauthorized();
                if (error == "NotFound") return NotFound();
                if (error == "Forbid") return Forbid();
            }
            return Ok(result);
        }

        // Pozostałe metody (profile, search, remove friend, withdraw request) delegują do serwisów lub używają kontekstu
        [HttpGet("profile/{userId:guid}")]
        public async Task<IActionResult> GetUserProfile(Guid userId)
        {
            var user = await _context.Users
                .AsNoTracking()
                .Where(u => u.Id == userId)
                .AsSplitQuery()
                .Select(u => new
                {
                    id = u.Id,
                    nickname = u.Nickname,
                    auth0Id = u.Auth0Id,
                    status = _presence.IsOnline(u.Auth0Id) ? "Online" : "Offline",
                    reviews = _context.Reviews
                        .Where(r => r.UserId == userId)
                        .OrderByDescending(r => r.CreatedAt)
                        .Take(20)
                        .Select(r => new
                        {
                            id = r.Id,
                            score = r.Score,
                            content = r.Content,
                            albumId = r.Album.Id,
                            albumTitle = r.Album.Title,
                            albumArtist = r.Album.Artist.Name,
                            albumCoverUrl = r.Album.CoverUrl,
                            createdAt = r.CreatedAt
                        })
                        .ToList(),
                    albums = _context.UserAlbums
                        .Where(ua => ua.UserId == userId)
                        .OrderByDescending(ua => ua.CreatedAt)
                        .Select(ua => new
                        {
                            id = ua.Album.Id,
                            title = ua.Album.Title,
                            artist = ua.Album.Artist.Name,
                            coverUrl = ua.Album.CoverUrl,
                            status = ua.Status,
                            createdAt = ua.CreatedAt
                        })
                        .ToList()
                })
                .FirstOrDefaultAsync();

            if (user == null) return NotFound();
            return Ok(user);
        }

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

        [HttpDelete("friends/{friendId:guid}")]
        public async Task<IActionResult> RemoveFriend(Guid friendId)
        {
            var auth0 = GetAuth0Id();
            var (success, error) = await _friendshipService.RemoveFriendAsync(auth0, friendId);
            if (!success)
            {
                if (error == "Unauthorized") return Unauthorized();
                if (error == "NotFound") return NotFound();
                if (error != null && error.StartsWith("BadRequest")) return BadRequest(error.Substring(11));
            }
            return NoContent();
        }

        [HttpDelete("requests/{friendshipId:guid}")]
        public async Task<IActionResult> WithdrawOutgoingRequest(Guid friendshipId)
        {
            var auth0 = GetAuth0Id();
            var (success, error) = await _friendshipService.WithdrawOutgoingRequestAsync(auth0, friendshipId);
            if (!success)
            {
                if (error == "Unauthorized") return Unauthorized();
                if (error == "NotFound") return NotFound();
                if (error == "Forbid") return Forbid("Tylko nadawca może wycofać wysłane zaproszenie.");
                if (error != null && error.StartsWith("BadRequest")) return BadRequest(error.Substring(11));
            }
            return NoContent();
        }
    }
}
