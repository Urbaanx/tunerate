using System.Collections.Concurrent;
using tunerate_api.Interfaces;

namespace tunerate_api.Services
{
    public class PresenceService : IPresenceService
    {
        private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> _connections =
            new();

        public bool IsOnline(string auth0Id)
        {
            if (string.IsNullOrEmpty(auth0Id)) return false;
            return _connections.TryGetValue(auth0Id, out var set) && set.Count > 0;
        }

        public int ConnectionCount(string auth0Id)
        {
            if (string.IsNullOrEmpty(auth0Id)) return 0;
            return _connections.TryGetValue(auth0Id, out var set) ? set.Count : 0;
        }

        public bool AddConnection(string auth0Id, string connectionId)
        {
            if (string.IsNullOrEmpty(auth0Id) || string.IsNullOrEmpty(connectionId)) return false;
            var set = _connections.GetOrAdd(auth0Id, _ => new ConcurrentDictionary<string, byte>());
            set.TryAdd(connectionId, 0);
            return true;
        }

        public bool RemoveConnection(string auth0Id, string connectionId)
        {
            if (string.IsNullOrEmpty(auth0Id) || string.IsNullOrEmpty(connectionId)) return false;
            if (!_connections.TryGetValue(auth0Id, out var set)) return false;
            set.TryRemove(connectionId, out _);
            if (set.IsEmpty)
            {
                _connections.TryRemove(auth0Id, out _);
                return true;
            }
            return false;
        }
    }
}