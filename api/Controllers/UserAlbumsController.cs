using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using tunerate_api.Interfaces;
using tunerate_api.DTOs;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UserAlbumsController : ControllerBase
    {
        private readonly IAlbumService _albumService;

        public UserAlbumsController(IAlbumService albumService)
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

            if (albums != null && !albums.Any())
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
        
        [HttpGet("{userId:guid}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetAlbumsOfUser(Guid userId)
        {
            var albums = await _albumService.GetAlbumsOfUserAsync(userId);

            if (albums == null)
                return NotFound("Użytkownik nie istnieje.");

            return Ok(albums);
        }

    }
}
