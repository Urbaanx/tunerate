using tunerate_api.Models;
using RestSharp;
using System.Text.Json;
using System.Net;

namespace tunerate_api.Services
{
    public class MusicBrainzService
    {
        private readonly RestClient _client;

        public MusicBrainzService()
        {
            var options = new RestClientOptions("https://musicbrainz.org/ws/2/");
            _client = new RestClient(options);
            _client.AddDefaultHeader("User-Agent", "TuneRate/1.0 (https://tunerate.app)");
        }

        public async Task<(List<AlbumDto> Items, int TotalCount)> SearchAlbumsAsync(string query, int page, int pageSize, string sort)
        {
            int offset = (page - 1) * pageSize;

            string sortParam = sort switch
            {
                "title_asc" => "title",
                "title_desc" => "title",
                "date_asc" => "date",
                "date_desc" => "date",
                _ => "title"
            };

            var request = new RestRequest("release/");
            request.AddQueryParameter("query", query);
            request.AddQueryParameter("fmt", "json");
            request.AddQueryParameter("limit", pageSize.ToString());
            request.AddQueryParameter("offset", offset.ToString());
            request.AddQueryParameter("sort", sortParam);

            var response = await _client.ExecuteAsync(request);
            if (response.Content == null) return (new List<AlbumDto>(), 0);

            using var jsonDoc = JsonDocument.Parse(response.Content);
            var root = jsonDoc.RootElement;

            var releases = root.GetProperty("releases");
            var totalCount = root.TryGetProperty("release-count", out var countProp)
                ? countProp.GetInt32()
                : offset + releases.GetArrayLength() + pageSize; // fallback

            var results = new List<AlbumDto>();

            foreach (var release in releases.EnumerateArray())
            {
                var title = release.GetProperty("title").GetString();
                var id = release.GetProperty("id").GetString();

                string artist = "";
                string artistId = null!;
                if (release.TryGetProperty("artist-credit", out var ac) && ac.ValueKind == JsonValueKind.Array && ac.GetArrayLength() > 0)
                {
                    var first = ac[0];
                    artist = first.GetProperty("name").GetString() ?? "";
                    if (first.TryGetProperty("artist", out var artistObj) && artistObj.TryGetProperty("id", out var artistIdProp))
                    {
                        artistId = artistIdProp.GetString()!;
                    }
                }

                string releaseDate = release.TryGetProperty("date", out var dateProp)
                    ? dateProp.GetString() ?? ""
                    : "";

                if (id != null)
                {
                    var coverArtUrl = await GetCoverArtUrlAsync(id);

                    results.Add(new AlbumDto
                    {
                        Title = title ?? "",
                        Artist = artist,
                        ArtistId = !string.IsNullOrEmpty(artistId) ? Guid.Parse(artistId) : Guid.Empty,
                        ReleaseDate = releaseDate,
                        ExternalId = id,
                        CoverUrl = coverArtUrl
                    });
                }
            }

            results = sort switch
            {
                "title_desc" => results.OrderByDescending(a => a.Title).ToList(),
                "date_desc" => results.OrderByDescending(a => a.ReleaseDate).ToList(),
                _ => results
            };

            return (results, totalCount);
        }

        private async Task<string> GetCoverArtUrlAsync(string musicBrainzReleaseId)
        {
            if (string.IsNullOrEmpty(musicBrainzReleaseId))
            {
                return "";
            }

            var caaClient = new RestClient("https://coverartarchive.org/");
            caaClient.AddDefaultHeader("User-Agent", "TuneRate/1.0 (https://tunerate.app)");

            var request = new RestRequest($"release/{musicBrainzReleaseId}");
            var response = await caaClient.ExecuteAsync(request);

            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                return "";
            }

            if (response.Content == null) return "";

            try
            {
                using var jsonDoc = JsonDocument.Parse(response.Content);
                var root = jsonDoc.RootElement;

                if (root.TryGetProperty("images", out var images) && images.ValueKind == JsonValueKind.Array)
                {
                    var frontImage = images.EnumerateArray()
                        .FirstOrDefault(img => img.TryGetProperty("front", out var isFront) && isFront.GetBoolean());

                    if (frontImage.ValueKind != JsonValueKind.Undefined)
                    {
                        if (frontImage.TryGetProperty("image", out var imageProp))
                        {
                            return imageProp.GetString() ?? "";
                        }
                    }
                }
            }
            catch
            {
                return "";
            }

            return "";
        }

        public async Task<List<string>> GetAlbumTagsAsync(string releaseId)
        {
            if (string.IsNullOrEmpty(releaseId))
                return new List<string>();

            try
            {
                // 1️⃣ Pobierz release-group ID
                var releaseRequest = new RestRequest($"release/{releaseId}?inc=release-groups&fmt=json");
                var releaseResponse = await _client.ExecuteAsync(releaseRequest);

                if (releaseResponse.StatusCode != HttpStatusCode.OK || releaseResponse.Content == null)
                    return new List<string>();

                var releaseJson = JsonDocument.Parse(releaseResponse.Content);
                if (!releaseJson.RootElement.TryGetProperty("release-group", out var releaseGroup))
                {
                    return new List<string>();
                }

                var releaseGroupId = releaseGroup.GetProperty("id").GetString();

                // 2️⃣ Pobierz tagi z release-group
                var tagsRequest = new RestRequest($"release-group/{releaseGroupId}?inc=tags&fmt=json");
                var tagsResponse = await _client.ExecuteAsync(tagsRequest);
                

                if (tagsResponse.StatusCode != HttpStatusCode.OK || tagsResponse.Content == null)
                    return new List<string>();

                var tagsJson = JsonDocument.Parse(tagsResponse.Content);
                if (!tagsJson.RootElement.TryGetProperty("tags", out var tagsElement))
                {
                    return new List<string>();
                }

                return tagsElement.EnumerateArray()
                    .Select(t => t.GetProperty("name").GetString())
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Distinct()
                    .Take(10)
                    .ToList()!;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Błąd pobierania tagów: {ex.Message}");
                return new List<string>();
            }
        }


    }
}
