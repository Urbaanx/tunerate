using System.ComponentModel.DataAnnotations;

namespace tunerate_api.Models;

public class AlbumShare
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid FromUserId { get; set; }
    public Guid ToUserId { get; set; }
    public Guid AlbumId { get; set; }

    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public User FromUser { get; set; }
    public User ToUser { get; set; }
    public Album Album { get; set; }
}