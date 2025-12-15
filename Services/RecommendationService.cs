using RestSharp;
using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using tunerate_api.Interfaces;

namespace tunerate_api.Services
{
    public class RecommendationService : IRecommendationService
    {
        private readonly RestClient _client;
        private readonly IMemoryCache _cache;
        private readonly TimeSpan _ttl = TimeSpan.FromSeconds(30);

        public RecommendationService(IConfiguration config, IMemoryCache cache)
        {
            _cache = cache;
            var baseUrl = config.GetValue<string>("RecommenderService") ?? "http://localhost:8001/";
            var options = new RestClientOptions(baseUrl);
            _client = new RestClient(options);
            _client.AddDefaultHeader("User-Agent", "TuneRate/1.0 (https://tunerate.app)");
        }

        private string BuildCacheKey(string resource, params string[] paramValues)
        {
            var pv = paramValues.Length > 0 ? string.Join("_", paramValues) : "";
            return $"reccache_{resource}_{pv}";
        }

        private async Task<(bool Success, object? Data, int? StatusCode, string? Error)> ExecuteRequestAsync(RestRequest request)
        {
            try
            {
                var paramValues = request.Parameters.Any()
                    ? string.Join("_", request.Parameters.Select(p => p.Value?.ToString() ?? ""))
                    : "";
                var key = BuildCacheKey(request.Resource, paramValues);

                if (_cache.TryGetValue<object>(key, out var cached))
                {
                    return (true, cached, 200, null);
                }

                var response = await _client.ExecuteAsync(request);

                if (response.StatusCode != HttpStatusCode.OK)
                {
                    var msg = string.IsNullOrEmpty(response.Content)
                        ? $"Błąd połączenia z serwisem rekomendacji: {(int)response.StatusCode}"
                        : response.Content;
                    return (false, null, (int)response.StatusCode, msg);
                }

                if (string.IsNullOrEmpty(response.Content))
                    return (true, null, 204, null);

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var json = JsonSerializer.Deserialize<object>(response.Content, options);

                _cache.Set(key, json, _ttl);

                return (true, json, 200, null);
            }
            catch (Exception ex)
            {
                return (false, null, 500, $"Błąd połączenia z serwisem rekomendacji: {ex.Message}");
            }
        }

        public Task<(bool Success, object? Data, int? StatusCode, string? Error)> GetRecommendationsAsync(Guid userId, string type = "content", int topN = 5)
        {
            string endpoint = type.ToLower() switch
            {
                "cf" or "collaborative" => $"recommend/cf/{userId}",
                "content" or "cbf" or "tag" => $"recommend/content/{userId}",
                _ => $"recommend/hybrid/{userId}"
            };

            var request = new RestRequest(endpoint);
            request.AddQueryParameter("top_n", topN.ToString());
            return ExecuteRequestAsync(request);
        }

        public Task<(bool Success, object? Data, int? StatusCode, string? Error)> GetAlbumRecommendationsAsync(Guid albumId, int topN = 5)
        {
            var request = new RestRequest($"recommend/album/{albumId}");
            request.AddQueryParameter("top_n", topN.ToString());
            return ExecuteRequestAsync(request);
        }

        public Task<(bool Success, object? Data, int? StatusCode, string? Error)> GetHealthAsync()
        {
            var request = new RestRequest("health");
            return ExecuteRequestAsync(request);
        }
    }
}