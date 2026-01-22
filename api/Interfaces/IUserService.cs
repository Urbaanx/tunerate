using System.Text.Json;
using tunerate_api.Models;

namespace tunerate_api.Interfaces
{
    public interface IUserService
    {
        Task<List<User>> GetAllUsersAsync();
        Task<User?> GetUserByAuth0IdAsync(string auth0Id);
        Task<JsonElement?> GetAuth0UserFromAuth0ApiAsync(string auth0Id);
        Task<(User? User, string? Error)> SyncUserAsync(string auth0Id);
        Task<(User? User, string? Error)> ChangeNicknameAsync(string auth0Id, string newNickname);
        Task<object> GetMyStatsAsync(string auth0Id);
        Task<(string? TicketUrl, string? Error)> CreatePasswordChangeTicketAsync(string auth0Id);
    }
}