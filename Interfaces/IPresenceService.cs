using System;

namespace tunerate_api.Interfaces
{
    public interface IPresenceService
    {
        bool IsOnline(string auth0Id);
        int ConnectionCount(string auth0Id);
        bool AddConnection(string auth0Id, string connectionId);
        bool RemoveConnection(string auth0Id, string connectionId);
    }
}