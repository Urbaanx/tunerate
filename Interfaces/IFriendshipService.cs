using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace tunerate_api.Interfaces
{
    public interface IFriendshipService
    {
        Task<IEnumerable<object>?> GetOutgoingRequestsAsync(string auth0Id);
        Task<(bool Success, string? Error, object? Payload)> SendFriendRequestAsync(string auth0Id, Guid toUserId);
        Task<(bool Success, string? Error, object? Payload)> AcceptFriendRequestAsync(string auth0Id, Guid friendshipId);
        Task<(bool Success, string? Error, object? Payload)> DeclineFriendRequestAsync(string auth0Id, Guid friendshipId);
        Task<IEnumerable<object>?> GetFriendsAsync(string auth0Id, IPresenceService presence);
        Task<IEnumerable<object>?> GetIncomingRequestsAsync(string auth0Id);
        Task<(bool Success, string? Error)> RemoveFriendAsync(string auth0Id, Guid friendId);
        Task<(bool Success, string? Error)> WithdrawOutgoingRequestAsync(string auth0Id, Guid friendshipId);
    }
}