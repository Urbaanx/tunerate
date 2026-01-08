using System.ComponentModel.DataAnnotations.Schema;

namespace tunerate_api.Models
{
    public class Review
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        [Column(TypeName = "varchar(4000)")]
        public string Content { get; set; } = string.Empty;
        public int Score { get; set; } // 🔹 ocena 1–10
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Guid UserId { get; set; }
        public User User { get; set; }

        public Guid AlbumId { get; set; }
        public Album Album { get; set; }
    }
}