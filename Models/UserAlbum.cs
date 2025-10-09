using System;

namespace tunerate_api.Models
{
    public class UserAlbum
    {
        public Guid UserId { get; set; }
        public User User { get; set; }

        public Guid AlbumId { get; set; }
        public Album Album { get; set; }

        public string Status { get; set; } = "listened";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}