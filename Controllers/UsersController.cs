using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using tunerate_api.Data;
using System.Text.Json;
using tunerate_api.DTOs;
using tunerate_api.Interfaces;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IUserService _userService;

        public UsersController(AppDbContext context, IUserService userService)
        {
            _context = context;
            _userService = userService;
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _userService.GetAllUsersAsync();
            return Ok(users);
        }

        [HttpGet("by-auth0id/{auth0Id}")]
        [Authorize]
        public async Task<IActionResult> GetUserByAuth0Id(string auth0Id)
        {
            var user = await _userService.GetUserByAuth0IdAsync(auth0Id);
            if (user == null) return NotFound("Użytkownik nie znaleziony.");
            return Ok(user);
        }

        [HttpGet("getAuth0User")]
        public async Task<IActionResult> GetUser()
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized("Brak Auth0 ID.");

            var json = await _userService.GetAuth0UserFromAuth0ApiAsync(auth0Id);
            if (json == null) return BadRequest();
            return Ok(json);
        }

        [HttpPost("sync")]
        public async Task<IActionResult> SyncUser()
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized("Brak Auth0 ID.");

            var (user, error) = await _userService.SyncUserAsync(auth0Id);
            if (error != null) return BadRequest(error);
            return Ok(user);
        }

        [HttpPut("nickname")]
        [Authorize]
        public async Task<IActionResult> ChangeNickname([FromBody] ChangeNicknameRequest? request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Nickname))
                return BadRequest("Nowa nazwa użytkownika jest wymagana.");

            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized("Brak Auth0 ID.");

            var (user, error) = await _userService.ChangeNicknameAsync(auth0Id, request.Nickname);
            if (error != null) return BadRequest(error);
            return Ok(user);
        }

        [HttpGet("stats")]
        [Authorize]
        public async Task<IActionResult> GetMyStats()
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized("Brak Auth0 ID.");

            var stats = await _userService.GetMyStatsAsync(auth0Id);
            if (stats is JsonElement je && je.ValueKind == JsonValueKind.Object && je.TryGetProperty("Error", out _))
                return NotFound("Użytkownik nie znaleziony.");

            return Ok(stats);
        }

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
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized();

            if (string.IsNullOrWhiteSpace(query))
                return BadRequest("Brak parametru 'query'.");

            query = query.Trim();

            var current = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (current == null) return Unauthorized();

            var results = await _context.Users
                .Where(u => u.Id != current.Id && EF.Functions.Like(u.Nickname, $"%{query}%"))
                .OrderBy(u => u.Nickname)
                .Select(u => new { u.Id, u.Nickname })
                .Take(limit)
                .ToListAsync();

            return Ok(results);
        }
    }

    public class Auth0UserResponse
    {
        public string? Nickname { get; set; }
        public string? Name { get; set; }
        public string? Username { get; set; }
        public string? Email { get; set; }
        public List<Auth0Identity>? Identities { get; set; }

        [System.Text.Json.Serialization.JsonIgnore]
        public string? Provider => Identities?.FirstOrDefault()?.Provider;
    }

    public class Auth0Identity
    {
        [System.Text.Json.Serialization.JsonPropertyName("user_id")]
        public string? UserId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("provider")]
        public string? Provider { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("connection")]
        public string? Connection { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("isSocial")]
        public bool? IsSocial { get; set; }
    }
}