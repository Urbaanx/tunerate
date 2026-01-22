using tunerate_api.Models;
using tunerate_api.DTOs;

namespace tunerate_api.Interfaces
{
    public interface IAlbumService
    {
        Task<(Album Album, bool Created)> FindOrCreateAlbumAsync(AlbumDto albumDto);
        Task<(bool Success, string Message)> AddAlbumToUserAsync(string auth0Id, AlbumDto albumDto);
        Task<IEnumerable<object>?> GetUserAlbumsAsync(string auth0Id);
        Task<(bool Success, string Message)> RemoveAlbumFromUserAsync(string auth0Id, Guid albumId);
        Task<List<object>?> GetAlbumsOfUserAsync(Guid userId);
    }
}