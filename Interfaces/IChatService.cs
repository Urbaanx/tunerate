using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using tunerate_api.Models;

namespace tunerate_api.Interfaces
{
    public interface IChatService
    {
        Task<User?> GetUserByAuth0IdAsync(string auth0Id);
        Task<List<object>?> GetChatHistoryAsync(string auth0Id, Guid otherUserId, int limit = 100);
        Task<object?> GetUnreadCountsAsync(string auth0Id);
        Task<int?> MarkThreadReadAsync(string auth0Id, Guid otherUserId);
        Task<object?> SendMessageAsync(string auth0Id, Guid toUserId, string content);
    }
}