using System.ComponentModel.DataAnnotations;

namespace tunerate_api.Models;

public class ChatMessage
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid FromUserId { get; set; }
    public Guid ToUserId { get; set; }

    public string Content { get; set; } = string.Empty;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    
    public bool IsRead { get; set; } = false;

    public User FromUser { get; set; }
    public User ToUser { get; set; }
}