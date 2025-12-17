using Microsoft.EntityFrameworkCore;
using tunerate_api.Data;
using tunerate_api.Models;
using tunerate_api.DTOs;
using tunerate_api.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace tunerate_api.Services
{
    public class AlbumService : IAlbumService
    {
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;
        private readonly IMusicBrainzService _musicBrainzService;
        private readonly TimeSpan _userAlbumsTtl = TimeSpan.FromSeconds(60);

        public AlbumService(AppDbContext context, IMemoryCache cache, IMusicBrainzService musicBrainzService)
        {
            _context = context;
            _cache = cache;
            _musicBrainzService = musicBrainzService;
        }

        public async Task<(Album Album, bool Created)> FindOrCreateAlbumAsync(AlbumDto albumDto)
        {
            Artist? artist = null;
            if (albumDto.ArtistId != Guid.Empty)
            {
                artist = await _context.Artists
                    .FirstOrDefaultAsync(a => a.ExternalId == albumDto.ArtistId.ToString());
            }

            if (artist == null)
            {
                artist = await _context.Artists
                    .FirstOrDefaultAsync(a => a.Name == albumDto.Artist);
            }

            if (artist == null)
            {
                artist = new Artist
                {
                    Name = albumDto.Artist,
                    ExternalId = albumDto.ArtistId != Guid.Empty ? albumDto.ArtistId.ToString() : null
                };
                _context.Artists.Add(artist);
                await _context.SaveChangesAsync();
            }

            Album? album;

            if (!string.IsNullOrWhiteSpace(albumDto.ExternalId))
            {
                album = await _context.Albums
                    .Include(a => a.Artist)
                    .FirstOrDefaultAsync(a => a.ExternalId == albumDto.ExternalId);
            }
            else
            {
                album = await _context.Albums
                    .Include(a => a.Artist)
                    .FirstOrDefaultAsync(a =>
                        a.Title == albumDto.Title &&
                        a.Artist.Name == albumDto.Artist);
            }

            var created = false;

            if (album == null)
            {
                var releaseDate = DateTime.UtcNow;
                if (!string.IsNullOrWhiteSpace(albumDto.ReleaseDate) &&
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
                await _context.SaveChangesAsync();
                created = true;

                if (!string.IsNullOrEmpty(albumDto.ExternalId))
                {
                    var tags = await _musicBrainzService.GetAlbumTagsAsync(albumDto.ExternalId);
                    foreach (var tagName in tags)
                    {
                        var existingTag = await _context.Tags.FirstOrDefaultAsync(t => t.Name == tagName);
                        if (existingTag == null)
                        {
                            existingTag = new Tag { Name = tagName };
                            _context.Tags.Add(existingTag);
                            await _context.SaveChangesAsync();
                        }

                        if (!await _context.AlbumTags.AnyAsync(t => t.AlbumId == album.Id && t.TagId == existingTag.Id))
                        {
                            _context.AlbumTags.Add(new AlbumTag
                            {
                                AlbumId = album.Id,
                                TagId = existingTag.Id
                            });
                        }
                    }

                    await _context.SaveChangesAsync();
                }
            }

            return (album, created);
        }

        public async Task<(bool Success, string Message)> AddAlbumToUserAsync(string auth0Id, AlbumDto albumDto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null)
                return (false, "Nie znaleziono użytkownika.");

            var (album, _) = await FindOrCreateAlbumAsync(albumDto);

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

            _cache.Remove($"album_details_{album.Id}");

            return (true, "Album dodany do kolekcji.");
        }

        public async Task<IEnumerable<object>?> GetUserAlbumsAsync(string auth0Id)
        {
            var cacheKey = $"user_albums_{auth0Id}";
            if (_cache.TryGetValue<IEnumerable<object>>(cacheKey, out var cached))
                return cached;

            var user = await _context.Users
                .Include(u => u.UserAlbums)
                    .ThenInclude(ua => ua.Album)
                        .ThenInclude(a => a.Artist)
                .FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);

            if (user == null)
                return Enumerable.Empty<object>();

            var result = user.UserAlbums.Select(ua => new
            {
                ua.Album.Id,
                ua.Album.Title,
                ua.Album.CoverUrl,
                ReleaseDate = ua.Album.ReleaseDate.ToString("yyyy-MM-dd"),
                Artist = ua.Album.Artist.Name,
                ua.Status,
                ua.CreatedAt
            }).ToList();

            _cache.Set(cacheKey, result, _userAlbumsTtl);

            return result;
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

            _cache.Remove($"user_albums_{auth0Id}");
            
            _cache.Remove($"album_details_{albumId}");

            return (true, "Album usunięty z kolekcji.");
        }

        public async Task<List<object>?> GetAlbumsOfUserAsync(Guid userId)
        {
            var user = await _context.Users
                .Include(u => u.UserAlbums)
                    .ThenInclude(ua => ua.Album)
                        .ThenInclude(a => a.Artist)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return null;

            return user.UserAlbums
                .OrderByDescending(ua => ua.CreatedAt)
                .Select(ua => new
                {
                    id = ua.Album.Id,
                    title = ua.Album.Title,
                    artist = ua.Album.Artist.Name,
                    coverUrl = ua.Album.CoverUrl,
                    status = ua.Status,
                    createdAt = ua.CreatedAt,
                    releaseDate = ua.Album.ReleaseDate
                })
                .ToList<object>();
        }
    }
}
