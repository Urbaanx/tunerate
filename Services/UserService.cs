using Microsoft.EntityFrameworkCore;
using RestSharp;
using System.Text.Json;
using tunerate_api.Data;
using tunerate_api.Models;
using tunerate_api.Interfaces;

namespace tunerate_api.Services
{
    public class UserService : IUserService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _conf;
        private readonly Auth0TokenSettings? _tokenSettings;

        public UserService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _conf = config;
            _tokenSettings = _conf.GetSection("Auth0ManagementToken").Get<Auth0TokenSettings>();
        }

        public async Task<List<User>> GetAllUsersAsync()
        {
            return await _context.Users.AsNoTracking().ToListAsync();
        }

        public async Task<User?> GetUserByAuth0IdAsync(string auth0Id)
        {
            return await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
        }

        public async Task<JsonElement?> GetAuth0UserFromAuth0ApiAsync(string auth0Id)
        {
            var client = new RestClient($"https://{_conf["Auth0:Domain"]}/api/v2/users/{auth0Id}");
            var token = await GetAuth0ManagementTokenAsync();

            var request = new RestRequest { Method = Method.Get };
            request.AddHeader("authorization", $"Bearer {token}");
            var response = client.Execute(request);
            if (response.Content == null) return null;

            return JsonSerializer.Deserialize<JsonElement>(response.Content);
        }

        public async Task<(User? User, string? Error)> SyncUserAsync(string auth0Id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user != null) return (user, null);

            var client = new RestClient($"https://{_conf["Auth0:Domain"]}/api/v2/users/{auth0Id}");
            var token = await GetAuth0ManagementTokenAsync();
            if (token == null) return (null, "Unable to get management token");
            var request = new RestRequest { Method = Method.Get };
            request.AddHeader("authorization", $"Bearer {token}");
            var response = client.Execute(request);
            if (response.Content == null) return (null, "Nie udało się pobrać danych użytkownika z Auth0.");

            var json = JsonSerializer.Deserialize<JsonElement>(response.Content);

            string nickname = "Anon";
            if (json.TryGetProperty("identities", out var identitiesElem) && identitiesElem.ValueKind == JsonValueKind.Array)
            {
                var first = identitiesElem.EnumerateArray().FirstOrDefault();
                if (first.ValueKind != JsonValueKind.Undefined && first.TryGetProperty("provider", out var prov))
                {
                    var provider = prov.GetString();
                    if (string.Equals(provider, "auth0", StringComparison.OrdinalIgnoreCase))
                    {
                        if (json.TryGetProperty("username", out var username) && username.ValueKind == JsonValueKind.String)
                            nickname = username.GetString()!;
                        else if (json.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String)
                            nickname = name.GetString()!;
                        else if (json.TryGetProperty("email", out var email) && email.ValueKind == JsonValueKind.String)
                            nickname = email.GetString()!;
                    }
                    else
                    {
                        if (json.TryGetProperty("nickname", out var nick) && nick.ValueKind == JsonValueKind.String)
                            nickname = nick.GetString()!;
                        else if (json.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String)
                            nickname = name.GetString()!;
                        else if (json.TryGetProperty("email", out var email) && email.ValueKind == JsonValueKind.String)
                            nickname = email.GetString()!;
                    }
                }
            }

            user = new User
            {
                Auth0Id = auth0Id,
                Nickname = nickname
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return (user, null);
        }

        public async Task<(User? User, string? Error)> ChangeNicknameAsync(string auth0Id, string newNickname)
        {
            if (string.IsNullOrWhiteSpace(newNickname)) return (null, "Nowa nazwa użytkownika jest wymagana.");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return (null, "Użytkownik nie znaleziony.");

            user.Nickname = newNickname.Trim();
            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            return (user, null);
        }

        public async Task<object> GetMyStatsAsync(string auth0Id)
        {
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return new { Error = "Użytkownik nie znaleziony." };

            var albumsCount = await _context.UserAlbums.CountAsync(ua => ua.UserId == user.Id);
            var reviewsCount = await _context.Reviews.CountAsync(r => r.UserId == user.Id);
            var averageScore = await _context.Reviews
                .Where(r => r.UserId == user.Id)
                .Select(r => (double?)r.Score)
                .AverageAsync();

            return new
            {
                AlbumsCount = albumsCount,
                ReviewsCount = reviewsCount,
                AverageScore = averageScore
            };
        }

        private async Task<JsonElement?> GetAuth0ManagementTokenAsync()
        {
            var client = new RestClient($"https://{_conf["Auth0:Domain"]}/oauth/token");
            var request = new RestRequest { Method = Method.Post };
            request.AddHeader("content-type", "application/json");
            var jsonBody = JsonSerializer.Serialize(_tokenSettings);
            request.AddParameter("application/json", jsonBody, ParameterType.RequestBody);
            var response = await client.ExecuteAsync(request);
            if (response.Content == null) return null;

            return JsonSerializer.Deserialize<JsonElement>(response.Content).GetProperty("access_token");
        }

        public async Task<(string? TicketUrl, string? Error)> CreatePasswordChangeTicketAsync(string auth0Id)
        {
            if (string.IsNullOrWhiteSpace(auth0Id)) return (null, "Brak Auth0 ID.");

            var token = await GetAuth0ManagementTokenAsync();
            if (token == null) return (null, "Unable to get management token");

            var client = new RestClient($"https://{_conf["Auth0:Domain"]}/api/v2/tickets/password-change");
            var request = new RestRequest { Method = Method.Post };
            request.AddHeader("authorization", $"Bearer {token}");
            request.AddHeader("content-type", "application/json");

            var body = new
            {
                user_id = auth0Id
            };
            request.AddJsonBody(body);

            var response = await client.ExecuteAsync(request);
            if (response.Content == null) return (null, "Brak odpowiedzi od Auth0.");

            try
            {
                var doc = JsonDocument.Parse(response.Content);
                if (doc.RootElement.TryGetProperty("ticket", out var ticketElem))
                    return (ticketElem.GetString(), null);
                
                return (null, $"Unexpected response: {response.Content}");
            }
            catch (Exception ex)
            {
                return (null, $"Błąd parsowania odpowiedzi: {ex.Message}");
            }
        }
    }
}