using RestSharp;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using tunerate_api.Interfaces;

namespace tunerate_api.Services;

public class DeezerPreviewService : IDeezerPreviewService
{
    private readonly RestClient _client;
    private readonly IMemoryCache _cache;
    private readonly TimeSpan _ttl = TimeSpan.FromHours(24);

    public DeezerPreviewService(IMemoryCache cache)
    {
        _cache = cache;
        var options = new RestClientOptions("https://api.deezer.com/");
        _client = new RestClient(options);
        _client.AddDefaultHeader("User-Agent", "TuneRate/1.0 (https://tunerate.app)");
    }

    public async Task<string?> GetPreviewUrlAsync(string artist, string trackTitle)
    {
        if (string.IsNullOrWhiteSpace(artist) || string.IsNullOrWhiteSpace(trackTitle))
            return null;

        var key = $"deezer_preview_{artist.Trim().ToLowerInvariant()}_{trackTitle.Trim().ToLowerInvariant()}";

        if (_cache.TryGetValue<string>(key, out var cached))
            return string.IsNullOrEmpty(cached) ? null : cached;

        string query = $"artist:\"{artist}\" track:\"{trackTitle}\"";

        var request = new RestRequest("search");
        request.AddQueryParameter("q", query);

        try
        {
            var response = await _client.ExecuteAsync(request);
            if (!response.IsSuccessful || string.IsNullOrEmpty(response.Content))
            {
                _cache.Set<string?>(key, null, _ttl);
                return null;
            }

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var result = JsonSerializer.Deserialize<DeezerSearchResponse>(response.Content, options);
            var preview = result?.Data?.FirstOrDefault()?.Preview;
            var value = string.IsNullOrWhiteSpace(preview) ? string.Empty : preview;
            _cache.Set(key, value, _ttl);
            return string.IsNullOrEmpty(value) ? null : value;
        }
        catch
        {
            _cache.Set(key, string.Empty, _ttl);
            return null;
        }
    }
}

public class DeezerSearchResponse
{
    public List<DeezerTrackItem>? Data { get; set; }
}

public class DeezerTrackItem
{
    public string? Preview { get; set; }
}