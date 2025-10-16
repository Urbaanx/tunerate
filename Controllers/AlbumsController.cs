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
                .Include(a => a.Ratings)
                .Include(a => a.Reviews)
                    .ThenInclude(r => r.User)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (album == null)
                return NotFound("Nie znaleziono albumu.");

            var avgRating = album.Ratings.Any()
                ? album.Ratings.Average(r => r.Score)
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
                        r.Content,
                        r.CreatedAt
                    })
            };

            return Ok(result);
        }

        // 📄 GET /api/albums/{id}/reviews
        [HttpGet("{id}/reviews")]
        [Authorize]
        public async Task<IActionResult> GetAlbumReviews(Guid id)
        {
            var reviews = await _context.Reviews
                .Include(r => r.User)
                .Where(r => r.AlbumId == id)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new
                {
                    r.Id,
                    User = r.User.Nickname,
                    r.Content,
                    r.CreatedAt
                })
                .ToListAsync();

            return Ok(reviews);
        }

        // ✍️ POST /api/albums/{id}/reviews
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

            var album = await _context.Albums.FirstOrDefaultAsync(a => a.Id == id);
            if (album == null)
                return NotFound("Nie znaleziono albumu.");

            var review = new Review
            {
                AlbumId = id,
                UserId = user.Id,
                Content = reviewDto.Content
            };

            _context.Reviews.Add(review);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                review.Id,
                review.Content,
                User = user.Nickname,
                review.CreatedAt
            });
        }
    }
}
