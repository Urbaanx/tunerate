using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Caching.Memory;
using tunerate_api.Data;
using tunerate_api.Interfaces;
using Microsoft.EntityFrameworkCore;
using tunerate_api.DTOs;

namespace tunerate_api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AlbumsController : ControllerBase
    {
        private readonly IMusicBrainzService _musicBrainzService;
        private readonly IDeezerPreviewService _deezerPreviewService;
        private readonly IMemoryCache _cache;
        private readonly AppDbContext _context;
        private readonly IAlbumService _albumService;
        public AlbumsController(IMusicBrainzService musicBrainzService, AppDbContext context, IDeezerPreviewService deezerPreviewService,
            IMemoryCache cache, IAlbumService albumService)
        {
            _musicBrainzService = musicBrainzService;
            _context = context;
            _deezerPreviewService = deezerPreviewService;
            _cache = cache;
            _albumService = albumService;
        }
        
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAllAlbums(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string sort = "title_asc",
            [FromQuery] string? genre = null,
            [FromQuery] string? artist = null,
            [FromQuery] int? year = null,
            [FromQuery] string? popularity = null,
            [FromQuery] string? query = null)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0) pageSize = 20;

            var albumsQuery = _context.Albums
                .AsNoTracking()
                .Include(a => a.Artist)
                .Include(a => a.Reviews)
                .Include(a => a.AlbumTags).ThenInclude(at => at.Tag)
                .AsQueryable();
            
            if (!string.IsNullOrWhiteSpace(query))
            {
                var lowered = query.Trim().ToLower();
                albumsQuery = albumsQuery.Where(a =>
                    a.Title.ToLower().Contains(lowered) ||
                    a.Artist.Name.ToLower().Contains(lowered));
            }
            
            if (!string.IsNullOrWhiteSpace(artist))
                albumsQuery = albumsQuery.Where(a =>
                    EF.Functions.ILike(a.Artist.Name, $"%{artist}%"));

            if (year.HasValue)
                albumsQuery = albumsQuery.Where(a => a.ReleaseDate.Year == year.Value);

            if (!string.IsNullOrWhiteSpace(genre))
                albumsQuery = albumsQuery.Where(a =>
                    a.AlbumTags.Any(t => EF.Functions.ILike(t.Tag.Name, $"%{genre}%")));
            
            albumsQuery = sort switch
            {
                "title_desc" => albumsQuery.OrderByDescending(a => a.Title),
                "artist_asc" => albumsQuery.OrderBy(a => a.Artist.Name),
                "artist_desc" => albumsQuery.OrderByDescending(a => a.Artist.Name),
                "date_desc" => albumsQuery.OrderByDescending(a => a.ReleaseDate),
                "date_asc" => albumsQuery.OrderBy(a => a.ReleaseDate),
                "rating_desc" => albumsQuery.OrderByDescending(a => a.Reviews.Any() ? a.Reviews.Average(r => r.Score) : 0),
                "rating_asc" => albumsQuery.OrderBy(a => a.Reviews.Any() ? a.Reviews.Average(r => r.Score) : 0),
                _ => albumsQuery.OrderBy(a => a.Title)
            };
            
            if (popularity == "most_reviewed")
                albumsQuery = albumsQuery.OrderByDescending(a => a.Reviews.Count);
            else if (popularity == "least_reviewed")
                albumsQuery = albumsQuery.OrderBy(a => a.Reviews.Count);
            
            var totalCount = await albumsQuery.CountAsync();
            var albums = await albumsQuery
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new
                {
                    a.Id,
                    a.Title,
                    Artist = a.Artist.Name,
                    a.CoverUrl,
                    a.ReleaseDate,
                    a.ExternalId,
                    AverageRating = a.Reviews.Any() ? a.Reviews.Average(r => r.Score) : (double?)null,
                    Tags = a.AlbumTags.Select(at => at.Tag.Name).ToList(),
                    ReviewsCount = a.Reviews.Count
                })
                .ToListAsync();

            return Ok(new
            {
                Items = albums,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize),
                Source = "local"
            });
        }
        
        [HttpGet("preview")]
        public async Task<IActionResult> GetLandingPagePreviewAlbums()
        {
            var albums = await _context.Albums
                .AsNoTracking()
                .Include(a => a.Artist)
                .Include(a => a.AlbumTags).ThenInclude(at => at.Tag)
                .Include(a => a.Reviews)
                .OrderBy(a => EF.Functions.Random())
                .Take(3)
                .Select(a => new
                {
                    a.Id,
                    a.Title,
                    Artist = a.Artist.Name,
                    a.CoverUrl,
                    a.ReleaseDate,
                    AverageRating = a.Reviews.Any() ? a.Reviews.Average(r => r.Score) : (double?)null,
                    Tags = a.AlbumTags.Select(at => at.Tag.Name).ToList(),
                    ReviewsCount = a.Reviews.Count
                })
                .ToListAsync();
        
            return Ok(new
            {
                Items = albums,
                albums.Count,
                Source = "local_preview"
            });
        }
        
        
        [HttpGet("all")]
        public async Task<IActionResult> GetAllAlbumsFlat()
        {
            var albums = await _context.Albums
                .AsNoTracking()
                .Include(a => a.Artist)
                .Select(a => new
                {
                    a.Id,
                    a.Title,
                    Artist = a.Artist.Name
                })
                .ToListAsync();

            return Ok(albums);
        }
        
        [HttpGet("search")]
        [Authorize]
        public async Task<IActionResult> Search(
            [FromQuery] string query,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string sort = "title_asc")
        {
            if (string.IsNullOrWhiteSpace(query))
                return BadRequest("Query cannot be empty");

            if (page <= 0) page = 1;
            if (pageSize <= 0) pageSize = 10;

            var albumsFromApi = await _musicBrainzService.SearchAlbumsAsync(query, page, pageSize, sort);

            return Ok(new
            {
                albumsFromApi.Items,
                albumsFromApi.TotalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)albumsFromApi.TotalCount / pageSize),
                Source = "musicbrainz"
            });
        }
        
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateAlbum([FromBody] AlbumDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Artist))
                return BadRequest("Tytuł i wykonawca są wymagane.");

            var (album, created) = await _albumService.FindOrCreateAlbumAsync(dto);

            if (!created)
                return Ok(new
                {
                    album.Id,
                    album.Title,
                    Artist = album.Artist.Name,
                    album.CoverUrl,
                    album.ReleaseDate,
                    album.ExternalId
                });

            return CreatedAtAction(nameof(GetAlbumDetails), new { id = album.Id }, new
            {
                album.Id,
                album.Title,
                Artist = album.Artist.Name,
                album.CoverUrl,
                album.ReleaseDate,
                album.ExternalId
            });
        }

        [HttpGet("{id}")]
        [Authorize]
        public async Task<IActionResult> GetAlbumDetails(Guid id)
        {
            var album = await _context.Albums
                .AsNoTracking()
                .Include(a => a.Artist)
                .Include(a => a.Reviews)
                .ThenInclude(r => r.User)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (album == null)
                return NotFound("Nie znaleziono albumu.");

            string cacheKey = $"album_details_{id}";

            if (_cache.TryGetValue(cacheKey, out var cached))
            {
                return Ok(cached);
            }
            
            List<TrackDto> tracks = new();
            int totalDurationMs = 0;

            if (!string.IsNullOrEmpty(album.ExternalId))
            {
                tracks = await _musicBrainzService.GetAlbumTracksAsync(album.ExternalId);
                totalDurationMs = tracks.Sum(t => t.DurationMs);
                
                var previewTasks = tracks.Select(t => _deezerPreviewService.GetPreviewUrlAsync(album.Artist.Name, t.Title)).ToArray();
                var previews = await Task.WhenAll(previewTasks);
                for (int i = 0; i < tracks.Count; i++)
                {
                    tracks[i].PreviewUrl = previews[i];
                }
            }

            var avgRating = album.Reviews.Any()
                ? album.Reviews.Average(r => r.Score)
                : (double?)null;

            var result = new
            {
                album.Id,
                album.Title,
                Artist = album.Artist.Name,
                album.CoverUrl,
                album.ReleaseDate,
                AverageRating = avgRating,
                Tracks = tracks,
                TotalDurationMs = totalDurationMs,
                Reviews = album.Reviews
                    .OrderByDescending(r => r.CreatedAt)
                    .Select(r => new
                    {
                        r.Id,
                        User = r.User.Nickname,
                        UserId = r.User.Id,
                        r.User.Auth0Id,
                        r.Content,
                        r.Score,
                        r.CreatedAt
                    })
            };
            
            var cacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30)
            };
            _cache.Set(cacheKey, result, cacheOptions);

            return Ok(result);
        }
    }
}
