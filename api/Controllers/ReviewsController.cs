using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using tunerate_api.DTOs;
using tunerate_api.Interfaces;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReviewsController : ControllerBase
    {
        private readonly IReviewService _reviewService;

        public ReviewsController(IReviewService reviewService)
        {
            _reviewService = reviewService;
        }

        [HttpGet("{albumId}")]
        public async Task<IActionResult> GetAlbumReviews(
            Guid albumId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 5,
            [FromQuery] string sort = "newest")
        {
            var result = await _reviewService.GetAlbumReviewsAsync(albumId, page, pageSize, sort);
            return Ok(result);
        }

        [HttpPost("{albumId}")]
        public async Task<IActionResult> AddReview(Guid albumId, [FromBody] ReviewDto reviewDto)
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized();

            var (album, review, user, error) = await _reviewService.AddOrUpdateReviewAsync(albumId, auth0Id, reviewDto);
            if (error != null) return BadRequest(error);

            return Ok(new
            {
                AlbumId = album!.Id,
                album.AverageRating,
                Review = new
                {
                    review!.Content,
                    review.Score,
                    User = user!.Nickname
                }
            });
        }

        [HttpPut("{reviewId}")]
        public async Task<IActionResult> EditReview(Guid reviewId, [FromBody] ReviewDto reviewDto)
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized();

            var (review, error) = await _reviewService.EditReviewAsync(reviewId, auth0Id, reviewDto);
            if (error != null) return error == "Nie znaleziono recenzji." ? NotFound(error) : Forbid(error);

            return Ok(new
            {
                Message = "Recenzja została zaktualizowana.",
                review!.Id,
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

            var (success, error) = await _reviewService.DeleteReviewAsync(reviewId, auth0Id);
            if (!success)
                if (error != null)
                    return error == "Nie znaleziono recenzji." ? NotFound(error) : Forbid(error);

            return Ok(new { Message = "Recenzja została usunięta." });
        }
    }
}
