using System;

namespace tunerate_api.Models
{
    public class Rating
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public int Score { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Guid UserId { get; set; }
        public User User { get; set; }

        public Guid AlbumId { get; set; }
        public Album Album { get; set; }
    }
}