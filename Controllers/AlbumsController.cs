using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using tunerate_api.Data;
using tunerate_api.Services;
using Microsoft.EntityFrameworkCore;
using tunerate_api.Models;

namespace tunerate_api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AlbumsController : ControllerBase
    {
        private readonly MusicBrainzService _musicBrainzService;
        private readonly AppDbContext _context;

        public AlbumsController(MusicBrainzService musicBrainzService, AppDbContext context)
        {
            _musicBrainzService = musicBrainzService;
            _context = context;
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
                .Include(a => a.Artist)
                .Include(a => a.Reviews)
                .Include(a => a.AlbumTags).ThenInclude(at => at.Tag)
                .AsQueryable();

            // 🔹 Wyszukiwanie po tytule lub nazwie artysty (niezależnie od paginacji)
            if (!string.IsNullOrWhiteSpace(query))
            {
                var lowered = query.Trim().ToLower();
                albumsQuery = albumsQuery.Where(a =>
                    a.Title.ToLower().Contains(lowered) ||
                    a.Artist.Name.ToLower().Contains(lowered));
            }

            // 🔹 Filtry
            if (!string.IsNullOrWhiteSpace(artist))
                albumsQuery = albumsQuery.Where(a =>
                    EF.Functions.ILike(a.Artist.Name, $"%{artist}%"));

            if (year.HasValue)
                albumsQuery = albumsQuery.Where(a => a.ReleaseDate.Year == year.Value);

            if (!string.IsNullOrWhiteSpace(genre))
                albumsQuery = albumsQuery.Where(a =>
                    a.AlbumTags.Any(t => EF.Functions.ILike(t.Tag.Name, $"%{genre}%")));

            // 🔹 Sortowanie
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

            // 🔹 Popularność = liczba recenzji
            if (popularity == "most_reviewed")
                albumsQuery = albumsQuery.OrderByDescending(a => a.Reviews.Count);
            else if (popularity == "least_reviewed")
                albumsQuery = albumsQuery.OrderBy(a => a.Reviews.Count);

            // 🔹 Paginacja
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
        
        [HttpGet("all")]
        public async Task<IActionResult> GetAllAlbumsFlat()
        {
            var albums = await _context.Albums
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
                Items = albumsFromApi.Items,
                TotalCount = albumsFromApi.TotalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)albumsFromApi.TotalCount / pageSize),
                Source = "musicbrainz"
            });
        }

        // POST /api/albums
        [HttpPost]
        public async Task<IActionResult> CreateAlbum([FromBody] AlbumDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Artist))
                return BadRequest("Tytuł i wykonawca są wymagane.");

            var existingAlbum = await _context.Albums
                .Include(a => a.Artist)
                .FirstOrDefaultAsync(a =>
                    (!string.IsNullOrEmpty(dto.ExternalId) && a.ExternalId == dto.ExternalId) ||
                    (a.Title == dto.Title && a.Artist.Name == dto.Artist));

            if (existingAlbum != null)
                return Ok(new
                {
                    existingAlbum.Id,
                    existingAlbum.Title,
                    Artist = existingAlbum.Artist?.Name,
                    existingAlbum.CoverUrl,
                    existingAlbum.ReleaseDate,
                    existingAlbum.ExternalId
                });

            var artist = await _context.Artists.FirstOrDefaultAsync(a => a.Name == dto.Artist);
            if (artist == null)
            {
                artist = new Artist { Name = dto.Artist };
                _context.Artists.Add(artist);
                await _context.SaveChangesAsync();
            }

            var album = new Album
            {
                Title = dto.Title,
                Artist = artist,
                ArtistId = artist.Id,
                CoverUrl = dto.CoverUrl,
                ReleaseDate = Convert.ToDateTime(dto.ReleaseDate),
                ExternalId = dto.ExternalId
            };

            _context.Albums.Add(album);
            await _context.SaveChangesAsync();

            if (!string.IsNullOrEmpty(dto.ExternalId))
            {
                var tags = await _musicBrainzService.GetAlbumTagsAsync(dto.ExternalId);
                foreach (var tagName in tags)
                {
                    var existingTag = await _context.Tags.FirstOrDefaultAsync(t => t.Name == tagName);
                    if (existingTag == null)
                    {
                        existingTag = new Tag { Name = tagName };
                        _context.Tags.Add(existingTag);
                        await _context.SaveChangesAsync();
                    }

                    if (!await _context.AlbumTags.AnyAsync(t => t.AlbumId == album.Id && t.TagId == existingTag.Id))
                    {
                        _context.AlbumTags.Add(new AlbumTag
                        {
                            AlbumId = album.Id,
                            TagId = existingTag.Id
                        });
                    }
                }
                await _context.SaveChangesAsync();
            }

            return CreatedAtAction(nameof(GetAlbumDetails), new { id = album.Id }, new
            {
                album.Id,
                album.Title,
                Artist = artist.Name,
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
                .Include(a => a.Artist)
                .Include(a => a.Reviews)
                    .ThenInclude(r => r.User)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (album == null)
                return NotFound("Nie znaleziono albumu.");

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

            return Ok(result);
        }
    }
}
