using tunerate_api.Models;
using System.Text.Json;

namespace tunerate_api.Services
{
    public class MusicBrainzService
    {
        private readonly HttpClient _httpClient;

        public MusicBrainzService(HttpClient httpClient)
        {
            _httpClient = httpClient;
            _httpClient.BaseAddress = new Uri("https://musicbrainz.org/ws/2/");
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "TuneRate/1.0 (https://tunerate.app)");
        }

        public async Task<List<AlbumDto>> SearchAlbumsAsync(string query)
        {
            var url = $"release/?query={Uri.EscapeDataString(query)}&fmt=json&limit=10";
            var response = await _httpClient.GetStringAsync(url);

            using var jsonDoc = JsonDocument.Parse(response);
            var root = jsonDoc.RootElement;
            var releases = root.GetProperty("releases");

            var results = new List<AlbumDto>();

            foreach (var release in releases.EnumerateArray())
            {
                var title = release.GetProperty("title").GetString();
                var id = release.GetProperty("id").GetString();
                var artist = release.GetProperty("artist-credit")[0]
                    .GetProperty("name").GetString();
                var artistId = release.GetProperty("artist-credit")[0].GetProperty("artist").GetProperty("id").GetString();

                string releaseDate = release.TryGetProperty("date", out var dateProp)
                    ? dateProp.GetString() ?? ""
                    : "";

                if (id != null)
                {
                    var coverArtUrl = await GetCoverArtUrlAsync(id);
                
                    results.Add(new AlbumDto
                    {
                        Title = title ?? "",
                        Artist = artist ?? "",
                        ArtistId = Guid.Parse(artistId!),
                        ReleaseDate = releaseDate,
                        ExternalId = id,
                        CoverUrl = coverArtUrl
                    });
                }
            }

            return results;
        }
        
        private async Task<string> GetCoverArtUrlAsync(string musicBrainzReleaseId)
        {
            if (string.IsNullOrEmpty(musicBrainzReleaseId))
            {
                return "";
            }
            
            var caaUrl = $"https://coverartarchive.org/release/{musicBrainzReleaseId}";

            try
            {
                var response = await _httpClient.GetStringAsync(caaUrl);

                using var jsonDoc = JsonDocument.Parse(response);
                var root = jsonDoc.RootElement;
                
                if (root.TryGetProperty("images", out var images) && images.ValueKind == JsonValueKind.Array)
                {
                    var frontImage = images.EnumerateArray()
                        .FirstOrDefault(img => img.TryGetProperty("front", out var isFront) && isFront.GetBoolean());

                    if (frontImage.ValueKind != JsonValueKind.Undefined && frontImage.TryGetProperty("thumbnails", out _))
                    {
                        return frontImage.GetProperty("image").GetString() ?? "";
                    }
                }
            }
            catch (HttpRequestException ex) when (ex.Message.Contains("404"))
            {
                Console.WriteLine($"Cover Art not found for release ID: {musicBrainzReleaseId}");
                return "";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching cover art for {musicBrainzReleaseId}: {ex.Message}");
                return "";
            }

            return "";
        }
        
        
    }
}