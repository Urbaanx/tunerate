using Microsoft.AspNetCore.Mvc;
using RestSharp;
using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace tunerate_api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RecommendationsController : ControllerBase
    {
        private readonly RestClient _client;
        private readonly IMemoryCache _cache;
        private readonly TimeSpan _ttl = TimeSpan.FromSeconds(30);

        public RecommendationsController(IConfiguration config, IMemoryCache cache)
        {
            _cache = cache;
            var baseUrl = config.GetValue<string>("RecommenderService") ?? "http://localhost:8001/";
            var options = new RestClientOptions(baseUrl);
            _client = new RestClient(options);
            _client.AddDefaultHeader("User-Agent", "TuneRate/1.0 (https://tunerate.app)");
        }
        
        [HttpGet("{userId}")]
        public async Task<IActionResult> GetRecommendations(Guid userId, string type = "content", int topN = 5)
        {
            string endpoint = type.ToLower() switch
            {
                "cf" or "collaborative" => $"recommend/cf/{userId}",
                "content" or "cbf" or "tag" => $"recommend/content/{userId}",
                "hybrid" => $"recommend/hybrid/{userId}",
                _ => $"recommend/hybrid/{userId}" // domyślnie hybrydowy
            };


            var request = new RestRequest(endpoint);
            request.AddQueryParameter("top_n", topN.ToString());

            return await ExecuteRequestAsync(request);
        }
        
        [HttpGet("album/{albumId}")]
        public async Task<IActionResult> GetAlbumRecommendations(Guid albumId, int topN = 5)
        {
            var request = new RestRequest($"recommend/album/{albumId}");
            request.AddQueryParameter("top_n", topN.ToString());
            return await ExecuteRequestAsync(request);
        }
        
        [HttpGet("health")]
        public async Task<IActionResult> GetHealth()
        {
            var request = new RestRequest("health");
            return await ExecuteRequestAsync(request);
        }
        
        private async Task<IActionResult> ExecuteRequestAsync(RestRequest request)
        {
            try
            {
                var paramValues = request.Parameters.Any()
                    ? string.Join("_", request.Parameters.Select(p => p.Value?.ToString() ?? ""))
                    : "";
                var key = $"reccache_{request.Resource}_{paramValues}";

                if (_cache.TryGetValue<object>(key, out var cached))
                {
                    return Ok(cached);
                }

                var response = await _client.ExecuteAsync(request);

                if (response.StatusCode != HttpStatusCode.OK)
                {
                    var msg = string.IsNullOrEmpty(response.Content)
                        ? $"Błąd połączenia z serwisem rekomendacji: {(int)response.StatusCode}"
                        : response.Content;
                    return StatusCode((int)response.StatusCode, msg);
                }

                if (string.IsNullOrEmpty(response.Content))
                    return NoContent();
                
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var json = JsonSerializer.Deserialize<object>(response.Content, options);

                // cache successful deserialized response for a short time
                _cache.Set(key, json, _ttl);

                return Ok(json);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Błąd połączenia z serwisem rekomendacji: {ex.Message}");
            }
        }
    }
}
