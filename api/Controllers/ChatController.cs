using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using tunerate_api.Interfaces;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;

        public ChatController(IChatService chatService)
        {
            _chatService = chatService;
        }

        [HttpGet("history/{otherUserId:guid}")]
        public async Task<IActionResult> GetChatHistory(Guid otherUserId, int limit = 100)
        {
            var auth0 = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0 == null) return Unauthorized();

            var messages = await _chatService.GetChatHistoryAsync(auth0, otherUserId, limit);
            if (messages == null) return Unauthorized();
            return Ok(messages);
        }

        [HttpGet("unread-counts")]
        public async Task<IActionResult> GetUnreadCounts()
        {
            var auth0 = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0 == null) return Unauthorized();

            var counts = await _chatService.GetUnreadCountsAsync(auth0);
            if (counts == null) return Unauthorized();
            return Ok(counts);
        }

        [HttpPost("mark-read/{otherUserId:guid}")]
        public async Task<IActionResult> MarkThreadRead(Guid otherUserId)
        {
            var auth0 = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0 == null) return Unauthorized();

            var marked = await _chatService.MarkThreadReadAsync(auth0, otherUserId);
            if (marked == null) return Unauthorized();
            return Ok(new { marked });
        }

        [HttpPost("send/{toUserId:guid}")]
        public async Task<IActionResult> SendMessage(Guid toUserId, [FromBody] SendMessageDto dto)
        {
            var auth0 = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (auth0 == null) return Unauthorized();

            var result = await _chatService.SendMessageAsync(auth0, toUserId, dto.Content);
            if (result == null) return NotFound("Użytkownik docelowy nie znaleziony lub brak uprawnień.");
            return Ok(result);
        }

        public class SendMessageDto
        {
            public string Content { get; set; } = string.Empty;
        }
    }
}
