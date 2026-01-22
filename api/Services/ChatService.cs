using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using tunerate_api.Data;
using tunerate_api.Hubs;
using tunerate_api.Models;
using tunerate_api.Interfaces;

namespace tunerate_api.Services
{
    public class ChatService : IChatService
    {
        private readonly AppDbContext _db;
        private readonly IHubContext<SocialHub> _hub;

        public ChatService(AppDbContext db, IHubContext<SocialHub> hub)
        {
            _db = db;
            _hub = hub;
        }

        public async Task<User?> GetUserByAuth0IdAsync(string auth0Id)
        {
            return await _db.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
        }

        public async Task<List<object>?> GetChatHistoryAsync(string auth0Id, Guid otherUserId, int limit = 100)
        {
            var me = await GetUserByAuth0IdAsync(auth0Id);
            if (me == null) return null;

            var messages = await _db.ChatMessages
                .Where(m => (m.FromUserId == me.Id && m.ToUserId == otherUserId) ||
                            (m.FromUserId == otherUserId && m.ToUserId == me.Id))
                .OrderByDescending(m => m.SentAt)
                .Take(limit)
                .OrderBy(m => m.SentAt)
                .Select(m => new
                {
                    m.Id,
                    m.FromUserId,
                    m.ToUserId,
                    m.Content,
                    m.SentAt,
                    m.IsRead
                })
                .ToListAsync();

            return messages.Cast<object>().ToList();
        }

        public async Task<object?> GetUnreadCountsAsync(string auth0Id)
        {
            var me = await GetUserByAuth0IdAsync(auth0Id);
            if (me == null) return null;

            var perUser = await _db.ChatMessages
                .Where(m => m.ToUserId == me.Id && !m.IsRead)
                .GroupBy(m => m.FromUserId)
                .Select(g => new { FromUserId = g.Key, Count = g.Count() })
                .ToListAsync();

            var total = perUser.Sum(x => x.Count);

            return new { total, perUser };
        }

        public async Task<int?> MarkThreadReadAsync(string auth0Id, Guid otherUserId)
        {
            var me = await GetUserByAuth0IdAsync(auth0Id);
            if (me == null) return null;

            var toMark = await _db.ChatMessages
                .Where(m => m.FromUserId == otherUserId && m.ToUserId == me.Id && !m.IsRead)
                .ToListAsync();

            if (toMark.Count == 0)
            {
                return 0;
            }

            foreach (var m in toMark) m.IsRead = true;
            await _db.SaveChangesAsync();

            var myAuth0 = me.Auth0Id;
            var recipient = await _db.Users.FindAsync(otherUserId);

            var myCounts = await _db.ChatMessages
                .Where(m => m.ToUserId == me.Id && !m.IsRead)
                .GroupBy(m => m.FromUserId)
                .Select(g => new { FromUserId = g.Key, Count = g.Count() })
                .ToListAsync();
            var myTotal = myCounts.Sum(x => x.Count);

            await _hub.Clients.Group(myAuth0).SendAsync("UnreadCountsUpdated", new { total = myTotal, perUser = myCounts });

            if (recipient != null)
            {
                var recipientCounts = await _db.ChatMessages
                    .Where(m => m.ToUserId == recipient.Id && !m.IsRead)
                    .GroupBy(m => m.FromUserId)
                    .Select(g => new { FromUserId = g.Key, Count = g.Count() })
                    .ToListAsync();
                var recipientTotal = recipientCounts.Sum(x => x.Count);
                await _hub.Clients.Group(recipient.Auth0Id).SendAsync("UnreadCountsUpdated", new { total = recipientTotal, perUser = recipientCounts });
            }

            return toMark.Count;
        }

        public async Task<object?> SendMessageAsync(string auth0Id, Guid toUserId, string content)
        {
            var from = await GetUserByAuth0IdAsync(auth0Id);
            if (from == null) return null;

            var target = await _db.Users.FindAsync(toUserId);
            if (target == null) return null;

            var message = new ChatMessage
            {
                FromUserId = from.Id,
                ToUserId = toUserId,
                Content = content,
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            _db.ChatMessages.Add(message);
            await _db.SaveChangesAsync();

            await _hub.Clients.Group(target.Auth0Id).SendAsync("ChatMessageReceived", new
            {
                message.Id,
                FromUser = new { from.Id, from.Nickname, from.Auth0Id },
                ToUserId = toUserId,
                message.Content,
                message.SentAt
            });

            var recipientCounts = await _db.ChatMessages
                .Where(m => m.ToUserId == toUserId && !m.IsRead)
                .GroupBy(m => m.FromUserId)
                .Select(g => new { FromUserId = g.Key, Count = g.Count() })
                .ToListAsync();
            var recipientTotal = recipientCounts.Sum(x => x.Count);
            await _hub.Clients.Group(target.Auth0Id).SendAsync("UnreadCountsUpdated", new { total = recipientTotal, perUser = recipientCounts });

            return new
            {
                message.Id,
                message.Content,
                message.SentAt
            };
        }
    }
}