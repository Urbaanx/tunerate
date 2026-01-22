using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using tunerate_api.Data;
using tunerate_api.DTOs;
using tunerate_api.Models;
using tunerate_api.Interfaces;

namespace tunerate_api.Services
{
    public class ReviewService : IReviewService
    {
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;
        private readonly TimeSpan _reviewsTtl = TimeSpan.FromSeconds(15);

        public ReviewService(AppDbContext context, IMemoryCache cache)
        {
            _context = context;
            _cache = cache;
        }

        public async Task<object> GetAlbumReviewsAsync(Guid albumId, int page, int pageSize, string sort)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0) pageSize = 5;

            var cacheKey = $"reviews_{albumId}_{page}_{pageSize}_{sort}";
            if (_cache.TryGetValue<object>(cacheKey, out var cachedObj))
                if (cachedObj != null)
                    return cachedObj;

            var query = _context.Reviews
                .AsNoTracking()
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

            return result;
        }

        public async Task<(Album? Album, Review? Review, User? User, string? Error)> AddOrUpdateReviewAsync(Guid albumId, string auth0Id, ReviewDto reviewDto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return (null, null, null, "Nie znaleziono użytkownika.");

            var existing = await _context.Reviews.FirstOrDefaultAsync(r => r.AlbumId == albumId && r.UserId == user.Id);
            Review review;
            if (existing != null)
            {
                existing.Content = reviewDto.Content;
                existing.Score = reviewDto.Score;
                existing.CreatedAt = DateTime.UtcNow;
                review = existing;
            }
            else
            {
                review = new Review
                {
                    AlbumId = albumId,
                    UserId = user.Id,
                    Content = reviewDto.Content,
                    Score = reviewDto.Score,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Reviews.Add(review);
            }

            var album = await _context.Albums
                .Include(a => a.Reviews)
                .FirstOrDefaultAsync(a => a.Id == albumId);

            if (album == null) return (null, null, null, "Album nie znaleziony.");

            album.AverageRating = album.Reviews.Any()
                ? album.Reviews.Average(r => r.Score)
                : null;

            await _context.SaveChangesAsync();

            InvalidateReviewCache(albumId);

            return (album, review, user, null);
        }

        public async Task<(Review? Review, string? Error)> EditReviewAsync(Guid reviewId, string auth0Id, ReviewDto reviewDto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return (null, "Nie znaleziono użytkownika.");

            var review = await _context.Reviews
                .Include(r => r.Album)
                .ThenInclude(a => a.Reviews)
                .FirstOrDefaultAsync(r => r.Id == reviewId);

            if (review == null) return (null, "Nie znaleziono recenzji.");
            if (review.UserId != user.Id) return (null, "Nie możesz edytować cudzej recenzji.");

            review.Content = reviewDto.Content;
            review.Score = reviewDto.Score;
            review.CreatedAt = DateTime.UtcNow;

            review.Album.AverageRating = review.Album.Reviews.Any()
                ? review.Album.Reviews.Average(r => r.Score)
                : null;

            await _context.SaveChangesAsync();

            InvalidateReviewCache(review.AlbumId);

            return (review, null);
        }

        public async Task<(bool Success, string? Error)> DeleteReviewAsync(Guid reviewId, string auth0Id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return (false, "Nie znaleziono użytkownika.");

            var review = await _context.Reviews
                .Include(r => r.Album)
                .ThenInclude(a => a.Reviews)
                .FirstOrDefaultAsync(r => r.Id == reviewId);
            if (review == null) return (false, "Nie znaleziono recenzji.");
            if (review.UserId != user.Id) return (false, "Nie możesz usuwać cudzej recenzji.");

            var albumId = review.AlbumId;

            review.Album.Reviews.Remove(review);
            review.Album.AverageRating = review.Album.Reviews.Any()
                ? review.Album.Reviews.Average(r => r.Score)
                : null;

            _context.Reviews.Remove(review);
            await _context.SaveChangesAsync();

            InvalidateReviewCache(albumId);

            return (true, null);
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
            _cache.Remove($"album_details_{albumId}");
        }
    }
}