using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using tunerate_api.Data;
using tunerate_api.Hubs;
using tunerate_api.Models;
using tunerate_api.Interfaces;

namespace tunerate_api.Services
{
    public class AlbumShareService : IAlbumShareService
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<SocialHub> _hub;

        public AlbumShareService(AppDbContext context, IHubContext<SocialHub> hub)
        {
            _context = context;
            _hub = hub;
        }

        private async Task<User?> GetUserByAuth0IdAsync(string auth0Id)
        {
            return await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
        }

        public async Task<(bool Success, string? Error, object? Payload)> ShareAlbumAsync(string auth0Id, Guid toUserId, Guid albumId)
        {
            var from = await GetUserByAuth0IdAsync(auth0Id);
            if (from == null) return (false, "Unauthorized", null);

            var target = await _context.Users.FindAsync(toUserId);
            if (target == null) return (false, "Użytkownik docelowy nie znaleziony.", null);

            var album = await _context.Albums
                .Include(a => a.Artist)
                .FirstOrDefaultAsync(a => a.Id == albumId);

            if (album == null) return (false, "Album nie znaleziony.", null);

            var share = new AlbumShare
            {
                FromUserId = from.Id,
                ToUserId = toUserId,
                AlbumId = albumId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.AlbumShares.Add(share);
            await _context.SaveChangesAsync();

            var payload = new
            {
                share.Id,
                share.IsRead,
                share.CreatedAt,
                FromUser = new { from.Id, from.Nickname, from.Auth0Id },
                Album = new
                {
                    album.Id,
                    album.Title,
                    album.CoverUrl,
                    album.ExternalId,
                    album.Artist.Name,
                    album.ReleaseDate
                }
            };

            await _hub.Clients.Group(target.Auth0Id).SendAsync("AlbumShareReceived", payload);

            return (true, null, payload);
        }

        public async Task<IEnumerable<object>?> GetReceivedSharesAsync(string auth0Id)
        {
            var current = await GetUserByAuth0IdAsync(auth0Id);
            if (current == null) return null;

            var shares = await _context.AlbumShares
                .AsNoTracking()
                .Where(s => s.ToUserId == current.Id)
                .Include(s => s.FromUser)
                .Include(s => s.Album).ThenInclude(a => a.Artist)
                .OrderByDescending(s => s.CreatedAt)
                .Select(s => new
                {
                    s.Id,
                    s.IsRead,
                    s.CreatedAt,
                    FromUser = new { s.FromUser.Id, s.FromUser.Nickname, s.FromUser.Auth0Id },
                    Album = new
                    {
                        s.Album.Id,
                        s.Album.Title,
                        s.Album.CoverUrl,
                        s.Album.ExternalId,
                        s.Album.Artist.Name,
                        s.Album.ReleaseDate
                    }
                })
                .ToListAsync();

            return shares;
        }

        public async Task<(bool Success, string? Error, object? Result)> MarkShareReadAsync(string auth0Id, Guid shareId)
        {
            var current = await GetUserByAuth0IdAsync(auth0Id);
            if (current == null) return (false, "Unauthorized", null);

            var s = await _context.AlbumShares.FindAsync(shareId);
            if (s == null) return (false, "NotFound", null);
            if (s.ToUserId != current.Id) return (false, "Forbid", null);

            s.IsRead = true;
            await _context.SaveChangesAsync();

            var result = new
            {
                s.Id,
                s.IsRead,
                s.CreatedAt,
                s.AlbumId
            };

            return (true, null, result);
        }
    }
}