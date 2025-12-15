using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace tunerate_api.Interfaces
{
    public interface IAlbumShareService
    {
        Task<(bool Success, string? Error, object? Payload)> ShareAlbumAsync(string auth0Id, Guid toUserId, Guid albumId);
        Task<IEnumerable<object>?> GetReceivedSharesAsync(string auth0Id);
        Task<(bool Success, string? Error, object? Result)> MarkShareReadAsync(string auth0Id, Guid shareId);
    }
}