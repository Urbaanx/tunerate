using Microsoft.EntityFrameworkCore;
using tunerate_api.Data;
using tunerate_api.Models;

namespace tunerate_api.Services
{
    public class AlbumService
    {
        private readonly AppDbContext _context;

        public AlbumService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<(bool Success, string Message)> AddAlbumToUserAsync(string auth0Id, AlbumDto albumDto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null)
                return (false, "Nie znaleziono użytkownika.");

            // 🔹 Znajdź lub utwórz artystę
            var artist = await _context.Artists
                .FirstOrDefaultAsync(a => a.ExternalId == albumDto.ArtistId.ToString());

            if (artist == null)
            {
                artist = new Artist
                {
                    Name = albumDto.Artist,
                    ExternalId = albumDto.ArtistId != Guid.Empty
                        ? albumDto.ArtistId.ToString()
                        : null
                };
                _context.Artists.Add(artist);
            }

            // 🔹 Znajdź lub utwórz album
            Album? album = null;

            if (!string.IsNullOrWhiteSpace(albumDto.ExternalId))
            {
                album = await _context.Albums
                    .FirstOrDefaultAsync(a => a.ExternalId == albumDto.ExternalId);
            }
            else
            {
                // awaryjne wyszukiwanie po tytule i artyście
                album = await _context.Albums
                    .Include(a => a.Artist)
                    .FirstOrDefaultAsync(a =>
                        a.Title == albumDto.Title &&
                        a.Artist.Name == albumDto.Artist);
            }

            if (album == null)
            {
                var releaseDate = DateTime.UtcNow;
                if (!string.IsNullOrEmpty(albumDto.ReleaseDate.ToString()) &&
                    DateTime.TryParse(albumDto.ReleaseDate, out var parsed))
                {
                    releaseDate = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
                }

                album = new Album
                {
                    Title = albumDto.Title,
                    Artist = artist,
                    ExternalId = albumDto.ExternalId,
                    ReleaseDate = releaseDate,
                    CoverUrl = albumDto.CoverUrl
                };

                _context.Albums.Add(album);
            }

            // 🔹 Sprawdź, czy album już w kolekcji
            var alreadyExists = await _context.UserAlbums
                .AnyAsync(ua => ua.UserId == user.Id && ua.AlbumId == album.Id);

            if (alreadyExists)
                return (false, "Album już znajduje się w kolekcji.");

            _context.UserAlbums.Add(new UserAlbum
            {
                User = user,
                Album = album,
                Status = "listened",
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return (true, "Album dodany do kolekcji!");
        }

        public async Task<IEnumerable<object>> GetUserAlbumsAsync(string auth0Id)
        {
            var user = await _context.Users
                .Include(u => u.UserAlbums)
                    .ThenInclude(ua => ua.Album)
                        .ThenInclude(a => a.Artist)
                .FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);

            if (user == null)
                return Enumerable.Empty<object>();

            return user.UserAlbums.Select(ua => new
            {
                ua.Album.Id,
                ua.Album.Title,
                ua.Album.CoverUrl,
                ReleaseDate = ua.Album.ReleaseDate.ToString("yyyy-MM-dd"),
                Artist = ua.Album.Artist.Name,
                ua.Status,
                ua.CreatedAt
            }).ToList();
        }
        public async Task<(bool Success, string Message)> RemoveAlbumFromUserAsync(string auth0Id, Guid albumId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null)
                return (false, "Nie znaleziono użytkownika.");

            var ua = await _context.UserAlbums
                .FirstOrDefaultAsync(x => x.UserId == user.Id && x.AlbumId == albumId);

            if (ua == null)
                return (false, "Album nie znajduje się w kolekcji użytkownika.");

            _context.UserAlbums.Remove(ua);
            await _context.SaveChangesAsync();

            return (true, "Album usunięty z kolekcji.");
        }
    }
}
