using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using tunerate_api.Services;

namespace tunerate_api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AlbumsController : ControllerBase
    {
        private readonly MusicBrainzService _musicBrainzService;

        public AlbumsController(MusicBrainzService musicBrainzService)
        {
            _musicBrainzService = musicBrainzService;
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
    }
}
