using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using tunerate_api.Data;
using tunerate_api.Models;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UserAlbumsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UserAlbumsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<IActionResult> AddAlbum([FromBody] AlbumDto albumDto)
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null) return Unauthorized("User not found in database.");
            
            var artist = await _context.Artists
                .FirstOrDefaultAsync(a => a.Name == albumDto.Artist || a.MusicBrainzId == albumDto.ArtistId.ToString());

            if (artist == null)
            {
                artist = new Artist
                {
                    Name = albumDto.Artist,
                    MusicBrainzId = albumDto.ArtistId != Guid.Empty ? albumDto.ArtistId.ToString() : null
                };
                _context.Artists.Add(artist);
                await _context.SaveChangesAsync();
            }
            
            var album = await _context.Albums.FirstOrDefaultAsync(a => a.MusicBrainzId == albumDto.ExternalId);
            if (album == null)
            {
                DateTime parsedDate = DateTime.UtcNow;
                if (!string.IsNullOrEmpty(albumDto.ReleaseDate))
                {
                    DateTime.TryParse(albumDto.ReleaseDate, out parsedDate);
                    parsedDate = DateTime.SpecifyKind(parsedDate, DateTimeKind.Utc);
                }

                album = new Album
                {
                    Title = albumDto.Title,
                    ArtistId = artist.Id,
                    MusicBrainzId = albumDto.ExternalId,
                    ReleaseDate = parsedDate,
                    CoverUrl = albumDto.CoverUrl,
                    CreatedAt = DateTime.UtcNow,
                    Artist = artist

                };
                _context.Albums.Add(album);
                await _context.SaveChangesAsync();
            }
            
            var exists = await _context.UserAlbums.AnyAsync(ua => ua.UserId == user.Id && ua.AlbumId == album.Id);
            if (exists)
                return Conflict("Album już znajduje się w kolekcji użytkownika.");
            
            var userAlbum = new UserAlbum
            {
                UserId = user.Id,
                AlbumId = album.Id,
                Status = "listened",
                CreatedAt = DateTime.UtcNow
            };

            _context.UserAlbums.Add(userAlbum);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Album dodany do kolekcji!" });
        }


        [HttpGet]
        public async Task<IActionResult> GetUserAlbums()
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) return Unauthorized();

            var user = await _context.Users.Include(user => user.UserAlbums).ThenInclude(userAlbum => userAlbum.Album)
                .ThenInclude(album => album.Artist).FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);

            if (user == null) return NotFound("Nie znaleziono użytkownika.");

            var albums = user.UserAlbums.Select(ua => new
            {
                ua.Album.Id,
                ua.Album.Title,
                ua.Album.CoverUrl,
                ReleaseDate = ua.Album.ReleaseDate.Date,
                Artist = ua.Album.Artist.Name,
                ua.Status,
                ua.CreatedAt
            });

            return Ok(albums);
        }
    }
}
