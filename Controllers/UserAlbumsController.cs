using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using tunerate_api.Data;
using tunerate_api.Models;
using tunerate_api.Services;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UserAlbumsController : ControllerBase
    {
        private readonly AlbumService _albumService;

        public UserAlbumsController(AlbumService albumService)
        {
            _albumService = albumService;
        }

        [HttpPost]
        public async Task<IActionResult> AddAlbum([FromBody] AlbumDto albumDto)
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null)
                return Unauthorized();

            var result = await _albumService.AddAlbumToUserAsync(auth0Id, albumDto);

            if (!result.Success)
                return Conflict(result.Message);

            return Ok(new { message = result.Message });
        }


        [HttpGet]
        public async Task<IActionResult> GetUserAlbums()
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null)
                return Unauthorized();

            var albums = await _albumService.GetUserAlbumsAsync(auth0Id);

            if (!albums.Any())
                return NotFound("Nie znaleziono użytkownika lub albumów.");

            return Ok(albums);
        }
        
        [HttpDelete("{albumId:guid}")]
        public async Task<IActionResult> RemoveAlbum(Guid albumId)
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null)
                return Unauthorized();

            var result = await _albumService.RemoveAlbumFromUserAsync(auth0Id, albumId);

            if (!result.Success)
                return NotFound(result.Message);

            return Ok(new { message = result.Message });
        }
    }
}
