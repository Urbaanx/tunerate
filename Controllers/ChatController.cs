using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using tunerate_api.Data;
using tunerate_api.Hubs;
using tunerate_api.Models;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IHubContext<SocialHub> _hub;

        public ChatController(AppDbContext db, IHubContext<SocialHub> hub)
        {
            _db = db;
            _hub = hub;
        }

        private string GetAuth0Id()
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0Id == null) throw new UnauthorizedAccessException("Brak Auth0 ID w tokenie.");
            return auth0Id;
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var auth0 = GetAuth0Id();
            return await _db.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0);
        }

        // GET: api/chat/history/{otherUserId}
        [HttpGet("history/{otherUserId:guid}")]
        public async Task<IActionResult> GetChatHistory(Guid otherUserId, int limit = 100)
        {
            var me = await GetCurrentUserAsync();
            if (me == null) return Unauthorized();

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

            return Ok(messages);
        }

        // GET: api/chat/unread-counts
        [HttpGet("unread-counts")]
        public async Task<IActionResult> GetUnreadCounts()
        {
            var me = await GetCurrentUserAsync();
            if (me == null) return Unauthorized();

            var perUser = await _db.ChatMessages
                .Where(m => m.ToUserId == me.Id && !m.IsRead)
                .GroupBy(m => m.FromUserId)
                .Select(g => new { FromUserId = g.Key, Count = g.Count() })
                .ToListAsync();

            var total = perUser.Sum(x => x.Count);

            return Ok(new { total, perUser });
        }

        // POST: api/chat/mark-read/{otherUserId}
        [HttpPost("mark-read/{otherUserId:guid}")]
        public async Task<IActionResult> MarkThreadRead(Guid otherUserId)
        {
            var me = await GetCurrentUserAsync();
            if (me == null) return Unauthorized();

            var toMark = await _db.ChatMessages
                .Where(m => m.FromUserId == otherUserId && m.ToUserId == me.Id && !m.IsRead)
                .ToListAsync();

            if (toMark.Count == 0) return Ok(new { marked = 0 });

            foreach (var m in toMark) m.IsRead = true;
            await _db.SaveChangesAsync();

            // powiadom oba konta o zmianie liczników (opcjonalnie)
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

            return Ok(new { marked = toMark.Count });
        }

        // POST: api/chat/send/{toUserId}
        [HttpPost("send/{toUserId:guid}")]
        public async Task<IActionResult> SendMessage(Guid toUserId, [FromBody] SendMessageDto dto)
        {
            var from = await GetCurrentUserAsync();
            if (from == null) return Unauthorized();

            var target = await _db.Users.FindAsync(toUserId);
            if (target == null) return NotFound("Użytkownik docelowy nie znaleziony.");

            var message = new ChatMessage
            {
                FromUserId = from.Id,
                ToUserId = toUserId,
                Content = dto.Content,
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            _db.ChatMessages.Add(message);
            await _db.SaveChangesAsync();

            // wysyłamy w czasie rzeczywistym - minimalny DTO (bez navigational cycles)
            await _hub.Clients.Group(target.Auth0Id).SendAsync("ChatMessageReceived", new
            {
                message.Id,
                FromUser = new { from.Id, from.Nickname, from.Auth0Id },
                ToUserId = toUserId,
                message.Content,
                message.SentAt
            });

            // odśwież i wyślij liczniki nieodczytanych do odbiorcy
            var recipientCounts = await _db.ChatMessages
                .Where(m => m.ToUserId == toUserId && !m.IsRead)
                .GroupBy(m => m.FromUserId)
                .Select(g => new { FromUserId = g.Key, Count = g.Count() })
                .ToListAsync();
            var recipientTotal = recipientCounts.Sum(x => x.Count);
            await _hub.Clients.Group(target.Auth0Id).SendAsync("UnreadCountsUpdated", new { total = recipientTotal, perUser = recipientCounts });

            return Ok(new
            {
                message.Id,
                message.Content,
                message.SentAt
            });
        }

        public class SendMessageDto
        {
            public string Content { get; set; } = string.Empty;
        }
    }
}
