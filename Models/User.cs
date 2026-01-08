using System.ComponentModel.DataAnnotations.Schema;

namespace tunerate_api.Models
{
    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        [Column(TypeName = "varchar(100)")]
        public string Auth0Id { get; set; } = string.Empty;
        [Column(TypeName = "varchar(50)")]
        public string Nickname { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public ICollection<Review> Reviews { get; set; } = new List<Review>();
        public ICollection<UserAlbum> UserAlbums { get; set; } = new List<UserAlbum>();
        public ICollection<ChatMessage> SentMessages { get; set; } = new List<ChatMessage>();
        public ICollection<ChatMessage> ReceivedMessages { get; set; } = new List<ChatMessage>();

        public ICollection<Friendship> FriendshipsRequested { get; set; } = new List<Friendship>();
        public ICollection<Friendship> FriendshipsReceived { get; set; } = new List<Friendship>();

        public ICollection<AlbumShare> AlbumSharesSent { get; set; } = new List<AlbumShare>();
        public ICollection<AlbumShare> AlbumSharesReceived { get; set; } = new List<AlbumShare>();
    }
}