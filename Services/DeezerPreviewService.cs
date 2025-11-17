using RestSharp;
using System.Text.Json;

namespace tunerate_api.Services;

public class DeezerPreviewService
{
    private readonly RestClient _client;

    public DeezerPreviewService()
    {
        var options = new RestClientOptions("https://api.deezer.com/");
        _client = new RestClient(options);
        _client.AddDefaultHeader("User-Agent", "TuneRate/1.0 (https://tunerate.app)");
    }

    public async Task<string?> GetPreviewUrlAsync(string artist, string trackTitle)
    {
        if (string.IsNullOrWhiteSpace(artist) || string.IsNullOrWhiteSpace(trackTitle))
            return null;

        string query = $"artist:\"{artist}\" track:\"{trackTitle}\"";

        var request = new RestRequest("search");
        request.AddQueryParameter("q", query);

        try
        {
            var response = await _client.ExecuteAsync(request);
            if (!response.IsSuccessful || string.IsNullOrEmpty(response.Content))
                return null;

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var result = JsonSerializer.Deserialize<DeezerSearchResponse>(response.Content, options);
            var preview = result?.Data?.FirstOrDefault()?.Preview;

            return string.IsNullOrWhiteSpace(preview) ? null : preview;
        }
        catch
        {
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