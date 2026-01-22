using tunerate_api.DTOs;

namespace tunerate_api.Interfaces
{
    public interface IMusicBrainzService
    {
        Task<(List<AlbumDto> Items, int TotalCount)> SearchAlbumsAsync(string query, int page, int pageSize, string sort);
        Task<List<string>> GetAlbumTagsAsync(string releaseId);
        Task<List<TrackDto>> GetAlbumTracksAsync(string releaseId);
    }
}