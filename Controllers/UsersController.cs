using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using tunerate_api.Data;
using tunerate_api.Models;
using RestSharp;
using System.Text.Json;
using System.Text.Json.Serialization;
using tunerate_api.DTOs;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _conf;
        private readonly Auth0TokenSettings? _tokenSettings;

        public UsersController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _conf = config;
            _tokenSettings = _conf.GetSection("Auth0ManagementToken").Get<Auth0TokenSettings>();
        }
        
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _context.Users.ToListAsync();
            return Ok(users);
        }
        
        [HttpGet("by-auth0id/{auth0Id}")]
        [Authorize]
        public async Task<IActionResult> GetUserByAuth0Id(string auth0Id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return NotFound("Użytkownik nie znaleziony.");
            return Ok(user);
        }
        
        [HttpGet("getAuth0User")]
        public async Task<IActionResult> GetUser()
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized("Brak Auth0 ID.");
            
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return NotFound("Użytkownik nie znaleziony.");
            
            var client = new RestClient($"https://{_conf["Auth0:Domain"]}/api/v2/users/{auth0Id}");
            var token = GetAuth0ManagementToken();
            var request = new RestRequest
            {
                Method = Method.Get
            };
            request.AddHeader("authorization", $"Bearer {token}");
            var response = client.Execute(request);
            if (response.Content == null) return BadRequest();
            var json = JsonSerializer.Deserialize<Auth0UserResponse>(response.Content);
            return Ok(json);
        }
        
        [HttpPost("sync")]
        public async Task<IActionResult> SyncUser()
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized("Brak Auth0 ID.");
            
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user != null) return Ok(user);
            
            var client = new RestClient($"https://{_conf["Auth0:Domain"]}/api/v2/users/{auth0Id}");
            
            var token = GetAuth0ManagementToken();
            
            var request = new RestRequest
            {
                Method = Method.Get
            };
            request.AddHeader("authorization", $"Bearer {token}");

            var response = client.Execute(request);
            if (response.Content == null) return BadRequest("Nie udało się pobrać danych użytkownika z Auth0.");
            var json = JsonSerializer.Deserialize<Auth0UserResponse>(response.Content);

            user = new User
            {
                Auth0Id = auth0Id,
                Nickname = string.Equals(json?.Provider, "auth0", StringComparison.OrdinalIgnoreCase)
                    ? json?.Username ?? json?.Name ?? json?.Email ?? "Anon"
                    : json?.Nickname ?? json?.Name ?? json?.Email ?? "Anon"
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

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
        
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return NotFound("Użytkownik nie znaleziony.");
        
            user.Nickname = request.Nickname.Trim();
            _context.Users.Update(user);
            await _context.SaveChangesAsync();
        
            return Ok(user);
        }
        
        [HttpGet("stats")]
        [Authorize]
        public async Task<IActionResult> GetMyStats()
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized("Brak Auth0 ID.");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return NotFound("Użytkownik nie znaleziony.");

            var albumsCount = await _context.UserAlbums.CountAsync(ua => ua.UserId == user.Id);
            var reviewsCount = await _context.Reviews.CountAsync(r => r.UserId == user.Id);
            var averageScore = await _context.Reviews
                .Where(r => r.UserId == user.Id)
                .Select(r => (double?)r.Score)
                .AverageAsync(); // returns null if user has no reviews

            return Ok(new {
                AlbumsCount = albumsCount,
                ReviewsCount = reviewsCount,
                AverageScore = averageScore
            });
        }

        private JsonElement? GetAuth0ManagementToken()
        {
            var client = new RestClient($"https://{_conf["Auth0:Domain"]}/oauth/token");
            var request = new RestRequest
            {
                Method = Method.Post
            };
            request.AddHeader("content-type", "application/json");
            var jsonBody = JsonSerializer.Serialize(_tokenSettings);
            request.AddParameter("application/json", jsonBody, ParameterType.RequestBody);
            var response = client.Execute(request);
            if(response.Content == null) return null;
            
            return JsonSerializer.Deserialize<JsonElement>(response.Content).GetProperty("access_token");
        }
    }
    
    public class Auth0UserResponse
    {
        [JsonPropertyName("nickname")]
        public string? Nickname { get; set; }
        [JsonPropertyName("name")]
        public string? Name { get; set; }
        [JsonPropertyName("username")]
        public string? Username { get; set; }
        [JsonPropertyName("email")]
        public string? Email { get; set; }
        [JsonPropertyName("identities")]
        public List<Auth0Identity>? Identities { get; set; }
        
        [JsonIgnore]
        public string? Provider => Identities?.FirstOrDefault()?.Provider;
    }

    public class Auth0Identity
    {
        [JsonPropertyName("user_id")]
        public string? UserId { get; set; }

        [JsonPropertyName("provider")]
        public string? Provider { get; set; }

        [JsonPropertyName("connection")]
        public string? Connection { get; set; }

        [JsonPropertyName("isSocial")]
        public bool? IsSocial { get; set; }
    }
}