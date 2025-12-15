using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using tunerate_api.Data;
using tunerate_api.Models;
using tunerate_api.DTOs;
using Microsoft.Extensions.Caching.Memory;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReviewsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;
        private readonly TimeSpan _reviewsTtl = TimeSpan.FromSeconds(15);

        public ReviewsController(AppDbContext context, IMemoryCache cache)
        {
            _context = context;
            _cache = cache;
        }
        
        [HttpGet("{albumId}")]
        public async Task<IActionResult> GetAlbumReviews(
            Guid albumId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 5,
            [FromQuery] string sort = "newest")
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0) pageSize = 5;

            var cacheKey = $"reviews_{albumId}_{page}_{pageSize}_{sort}";
            if (_cache.TryGetValue<object>(cacheKey, out var cachedObj))
                return Ok(cachedObj);

            var query = _context.Reviews
                .Include(r => r.User)
                .Where(r => r.AlbumId == albumId);

            query = sort switch
            {
                "oldest" => query.OrderBy(r => r.CreatedAt),
                "score_desc" => query.OrderByDescending(r => r.Score),
                "score_asc" => query.OrderBy(r => r.Score),
                _ => query.OrderByDescending(r => r.CreatedAt)
            };

            var totalCount = await query.CountAsync();
            var reviews = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
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
                .ToListAsync();

            var result = new
            {
                Items = reviews,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            };

            _cache.Set(cacheKey, result, _reviewsTtl);
            
            var keysKey = $"reviews_keys_{albumId}";
            if (!_cache.TryGetValue<List<string>>(keysKey, out var keys))
            {
                keys = new List<string>();
            }
            if (keys != null && !keys.Contains(cacheKey))
            {
                keys.Add(cacheKey);
                _cache.Set(keysKey, keys, TimeSpan.FromHours(1));
            }

            return Ok(result);
        }
        
        [HttpPost("{albumId}")]
        public async Task<IActionResult> AddReview(Guid albumId, [FromBody] ReviewDto reviewDto)
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return NotFound("Nie znaleziono użytkownika.");

            var album = await _context.Albums
                .Include(a => a.Reviews)
                .FirstOrDefaultAsync(a => a.Id == albumId);

            if (album == null)
                return NotFound("Nie znaleziono albumu.");

            var existing = await _context.Reviews.FirstOrDefaultAsync(r => r.AlbumId == albumId && r.UserId == user.Id);
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
                    AlbumId = albumId,
                    UserId = user.Id,
                    Content = reviewDto.Content,
                    Score = reviewDto.Score
                };
                _context.Reviews.Add(review);
            }

            await _context.SaveChangesAsync();

            album.AverageRating = album.Reviews.Any()
                ? album.Reviews.Average(r => r.Score)
                : null;
            await _context.SaveChangesAsync();
            
            InvalidateReviewCache(albumId);

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
        
        [HttpPut("{reviewId}")]
        public async Task<IActionResult> EditReview(Guid reviewId, [FromBody] ReviewDto reviewDto)
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return NotFound("Nie znaleziono użytkownika.");

            var review = await _context.Reviews.FirstOrDefaultAsync(r => r.Id == reviewId);
            if (review == null) return NotFound("Nie znaleziono recenzji.");
            if (review.UserId != user.Id) return Forbid("Nie możesz edytować cudzej recenzji.");

            review.Content = reviewDto.Content;
            review.Score = reviewDto.Score;
            review.CreatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            var album = await _context.Albums.Include(a => a.Reviews)
                .FirstOrDefaultAsync(a => a.Id == review.AlbumId);
            if (album != null)
            {
                album.AverageRating = album.Reviews.Any()
                    ? album.Reviews.Average(r => r.Score)
                    : null;
                await _context.SaveChangesAsync();
            }
            
            InvalidateReviewCache(review.AlbumId);

            return Ok(new
            {
                Message = "Recenzja została zaktualizowana.",
                review.Id,
                review.Content,
                review.Score,
                review.CreatedAt
            });
        }
        
        [HttpDelete("{reviewId}")]
        public async Task<IActionResult> DeleteReview(Guid reviewId)
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return NotFound("Nie znaleziono użytkownika.");

            var review = await _context.Reviews.FirstOrDefaultAsync(r => r.Id == reviewId);
            if (review == null) return NotFound("Nie znaleziono recenzji.");
            if (review.UserId != user.Id) return Forbid("Nie możesz usuwać cudzej recenzji.");

            var albumId = review.AlbumId;

            _context.Reviews.Remove(review);
            await _context.SaveChangesAsync();

            var album = await _context.Albums.Include(a => a.Reviews)
                .FirstOrDefaultAsync(a => a.Id == albumId);
            if (album != null)
            {
                album.AverageRating = album.Reviews.Any()
                    ? album.Reviews.Average(r => r.Score)
                    : null;
                await _context.SaveChangesAsync();
            }
            
            InvalidateReviewCache(albumId);

            return Ok(new { Message = "Recenzja została usunięta." });
        }

        private void InvalidateReviewCache(Guid albumId)
        {
            var keysKey = $"reviews_keys_{albumId}";
            if (_cache.TryGetValue<List<string>>(keysKey, out var keys) && keys != null)
            {
                foreach (var k in keys)
                {
                    _cache.Remove(k);
                }
                _cache.Remove(keysKey);
            }
        }
    }
}
