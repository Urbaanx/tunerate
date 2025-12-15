using Microsoft.AspNetCore.Mvc;
using tunerate_api.Interfaces;

namespace tunerate_api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RecommendationsController : ControllerBase
    {
        private readonly IRecommendationService _recommendationService;

        public RecommendationsController(IRecommendationService recommendationService)
        {
            _recommendationService = recommendationService;
        }

        [HttpGet("{userId}")]
        public async Task<IActionResult> GetRecommendations(Guid userId, string type = "content", int topN = 5)
        {
            var (success, data, status, error) = await _recommendationService.GetRecommendationsAsync(userId, type, topN);
            if (!success) return StatusCode(status ?? 500, error);
            if (status == 204) return NoContent();
            return Ok(data);
        }

        [HttpGet("album/{albumId}")]
        public async Task<IActionResult> GetAlbumRecommendations(Guid albumId, int topN = 5)
        {
            var (success, data, status, error) = await _recommendationService.GetAlbumRecommendationsAsync(albumId, topN);
            if (!success) return StatusCode(status ?? 500, error);
            if (status == 204) return NoContent();
            return Ok(data);
        }

        [HttpGet("health")]
        public async Task<IActionResult> GetHealth()
        {
            var (success, data, status, error) = await _recommendationService.GetHealthAsync();
            if (!success) return StatusCode(status ?? 500, error);
            if (status == 204) return NoContent();
            return Ok(data);
        }
    }
}
