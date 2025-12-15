using RestSharp;
using System.Text.Json;
using System.Net;
using Microsoft.Extensions.Caching.Memory;
using tunerate_api.DTOs;
using tunerate_api.Interfaces;

namespace tunerate_api.Services
{
    public class MusicBrainzService : IMusicBrainzService
    {
        private readonly RestClient _client;
        private readonly RestClient _coverArtClient;
        private readonly IMemoryCache _cache;
        private readonly SemaphoreSlim _semaphore = new SemaphoreSlim(5); // ograniczenie równoległości
        private readonly TimeSpan _searchCacheTtl = TimeSpan.FromMinutes(5);
        private readonly TimeSpan _coverCacheTtl = TimeSpan.FromDays(1);

        public MusicBrainzService(IMemoryCache cache)
        {
            _cache = cache;
            var options = new RestClientOptions("https://musicbrainz.org/ws/2/");
            _client = new RestClient(options);
            _client.AddDefaultHeader("User-Agent", "TuneRate/1.0 (https://tunerate.app)");

            _coverArtClient = new RestClient("https://coverartarchive.org/");
            _coverArtClient.AddDefaultHeader("User-Agent", "TuneRate/1.0 (https://tunerate.app)");
        }

        public async Task<(List<AlbumDto> Items, int TotalCount)> SearchAlbumsAsync(string query, int page, int pageSize, string sort)
        {
            if (string.IsNullOrWhiteSpace(query))
                return (new List<AlbumDto>(), 0);

            int offset = (page - 1) * pageSize;

            string cacheKey = $"mb_search_{query}_{page}_{pageSize}_{sort}";
            if (_cache.TryGetValue(cacheKey, out (List<AlbumDto> Items, int TotalCount) cached))
            {
                return cached;
            }

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
                    // dodaj bez okładki na razie
                    results.Add(new AlbumDto
                    {
                        Title = title ?? "",
                        Artist = artist,
                        ArtistId = !string.IsNullOrEmpty(artistId) && Guid.TryParse(artistId, out var g) ? g : Guid.Empty,
                        ReleaseDate = releaseDate,
                        ExternalId = id,
                        CoverUrl = ""
                    });
                }
            }

            // równoległe pobieranie okładek z limitem równoległości i cache
            var tasks = results.Select(async album =>
            {
                if (string.IsNullOrEmpty(album.ExternalId)) return;

                var cover = await GetCoverArtUrlCachedAsync(album.ExternalId);
                album.CoverUrl = cover;
            }).ToArray();

            await Task.WhenAll(tasks);

            results = sort switch
            {
                "title_desc" => results.OrderByDescending(a => a.Title).ToList(),
                "date_desc" => results.OrderByDescending(a => a.ReleaseDate).ToList(),
                _ => results
            };

            var final = (results, totalCount);
            _cache.Set(cacheKey, final, _searchCacheTtl);

            return final;
        }

        private async Task<string> GetCoverArtUrlCachedAsync(string musicBrainzReleaseId)
        {
            if (string.IsNullOrEmpty(musicBrainzReleaseId))
                return "";

            string key = $"cover_{musicBrainzReleaseId}";
            if (_cache.TryGetValue(key, out string? cached))
                if (cached != null)
                    return cached;

            await _semaphore.WaitAsync();
            try
            {
                var cover = await GetCoverArtUrlAsync(musicBrainzReleaseId);
                _cache.Set(key, cover, _coverCacheTtl);
                return cover;
            }
            finally
            {
                _semaphore.Release();
            }
        }

        private async Task<string> GetCoverArtUrlAsync(string musicBrainzReleaseId)
        {
            var request = new RestRequest($"release/{musicBrainzReleaseId}");
            var response = await _coverArtClient.ExecuteAsync(request);

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

        public async Task<List<TrackDto>> GetAlbumTracksAsync(string releaseId)
        {
            var request = new RestRequest($"release/{releaseId}");
            request.AddQueryParameter("inc", "recordings");
            request.AddQueryParameter("fmt", "json");

            var response = await _client.ExecuteAsync(request);
            if (response.Content == null) return new List<TrackDto>();

            using var json = JsonDocument.Parse(response.Content);

            var result = new List<TrackDto>();

            if (!json.RootElement.TryGetProperty("media", out var mediaArray))
                return result;

            foreach (var media in mediaArray.EnumerateArray())
            {
                if (!media.TryGetProperty("tracks", out var tracks))
                    continue;

                foreach (var t in tracks.EnumerateArray())
                {
                    var title = t.TryGetProperty("title", out var titleProp)
                        ? titleProp.GetString() ?? ""
                        : "";

                    var lengthMs = t.TryGetProperty("length", out var lenProp)
                        ? lenProp.GetInt32()
                        : 0;

                    result.Add(new TrackDto
                    {
                        Title = title,
                        DurationMs = lengthMs
                    });
                }
            }

            return result;
        }
    }
}
