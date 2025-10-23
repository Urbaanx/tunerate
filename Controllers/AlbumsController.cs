using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using tunerate_api.Data;
using tunerate_api.Services;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
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

        [HttpGet("search")]
        [Authorize]
        public async Task<IActionResult> Search([FromQuery] string query)
        {
            if (string.IsNullOrWhiteSpace(query))
                return BadRequest("Query cannot be empty");

            var albums = await _musicBrainzService.SearchAlbumsAsync(query);
            return Ok(albums);
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
                        Auth0Id = r.User.Auth0Id,
                        r.Content,
                        r.Score,
                        r.CreatedAt
                    })
            };

            return Ok(result);
        }

        // 📄 GET /api/albums/{id}/reviews
        [HttpGet("{id}/reviews")]
        [Authorize]
        public async Task<IActionResult> GetAlbumReviews(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 5, [FromQuery] string sort = "newest")
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0) pageSize = 5;

            var query = _context.Reviews
                .Include(r => r.User)
                .Where(r => r.AlbumId == id);
            
            var totalCount = await query.CountAsync();
            
            query = sort switch
            {
                "oldest" => query.OrderBy(r => r.CreatedAt),
                "score_desc" => query.OrderByDescending(r => r.Score),
                "score_asc" => query.OrderBy(r => r.Score),
                _ => query.OrderByDescending(r => r.CreatedAt)
            };
            
            var reviews = await _context.Reviews
                .Include(r => r.User)
                .Where(r => r.AlbumId == id)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new
                {
                    r.Id,
                    User = r.User.Nickname,
                    UserId = r.User.Id,
                    Auth0Id = r.User.Auth0Id,
                    r.Content,
                    r.Score,
                    r.CreatedAt
                })
                .ToListAsync();

            return Ok(reviews);
        }

        // ✍️ POST /api/albums/{id}/reviews — dodaj lub nadpisz recenzję
        [HttpPost("{id}/reviews")]
        [Authorize]
        public async Task<IActionResult> AddReview(Guid id, [FromBody] ReviewDto reviewDto)
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null)
                return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null)
                return NotFound("Nie znaleziono użytkownika.");

            var album = await _context.Albums
                .Include(a => a.Reviews)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (album == null)
                return NotFound("Nie znaleziono albumu.");

            var existing = await _context.Reviews.FirstOrDefaultAsync(r => r.AlbumId == id && r.UserId == user.Id);
            if (existing != null)
            {
                existing.Content = reviewDto.Content;
                existing.Score = reviewDto.Score;
                existing.CreatedAt = DateTime.UtcNow;
            }
            else
            {
                var review = new Review
                {
                    AlbumId = id,
                    UserId = user.Id,
                    Content = reviewDto.Content,
                    Score = reviewDto.Score
                };
                _context.Reviews.Add(review);
            }

            await _context.SaveChangesAsync();

            // 🔹 Aktualizuj średnią ocenę albumu
            album.AverageRating = album.Reviews.Any()
                ? album.Reviews.Average(r => r.Score)
                : null;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                AlbumId = album.Id,
                album.AverageRating,
                Review = new
                {
                    reviewDto.Content,
                    reviewDto.Score,
                    User = user.Nickname
                }
            });
        }

        // ✏️ PUT /api/albums/{albumId}/reviews/{reviewId} — edytuj recenzję
        [HttpPut("{albumId}/reviews/{reviewId}")]
        [Authorize]
        public async Task<IActionResult> EditReview(Guid albumId, Guid reviewId, [FromBody] ReviewDto reviewDto)
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null)
                return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null)
                return NotFound("Nie znaleziono użytkownika.");

            var review = await _context.Reviews.FirstOrDefaultAsync(r => r.Id == reviewId && r.AlbumId == albumId);
            if (review == null)
                return NotFound("Nie znaleziono recenzji.");

            if (review.UserId != user.Id)
                return Forbid("Nie możesz edytować cudzej recenzji.");

            review.Content = reviewDto.Content;
            review.Score = reviewDto.Score;
            review.CreatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // 🔹 Aktualizuj średnią ocenę
            var album = await _context.Albums.Include(a => a.Reviews)
                .FirstOrDefaultAsync(a => a.Id == albumId);
            if (album != null)
            {
                album.AverageRating = album.Reviews.Any()
                    ? album.Reviews.Average(r => r.Score)
                    : null;
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                Message = "Recenzja została zaktualizowana.",
                review.Id,
                review.Content,
                review.Score,
                review.CreatedAt
            });
        }

        // 🗑️ DELETE /api/albums/{albumId}/reviews/{reviewId} — usuń recenzję
        [HttpDelete("{albumId}/reviews/{reviewId}")]
        [Authorize]
        public async Task<IActionResult> DeleteReview(Guid albumId, Guid reviewId)
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null)
                return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null)
                return NotFound("Nie znaleziono użytkownika.");

            var review = await _context.Reviews.FirstOrDefaultAsync(r => r.Id == reviewId && r.AlbumId == albumId);
            if (review == null)
                return NotFound("Nie znaleziono recenzji.");

            if (review.UserId != user.Id)
                return Forbid("Nie możesz usuwać cudzej recenzji.");

            _context.Reviews.Remove(review);
            await _context.SaveChangesAsync();

            // 🔹 Aktualizuj średnią ocenę
            var album = await _context.Albums.Include(a => a.Reviews)
                .FirstOrDefaultAsync(a => a.Id == albumId);
            if (album != null)
            {
                album.AverageRating = album.Reviews.Any()
                    ? album.Reviews.Average(r => r.Score)
                    : null;
                await _context.SaveChangesAsync();
            }

            return Ok(new { Message = "Recenzja została usunięta." });
        }
    }
}
