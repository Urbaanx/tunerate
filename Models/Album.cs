using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace tunerate_api.Models
{
    public class Album
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();
        [Column(TypeName = "varchar(255)")]
        public string Title { get; set; } = string.Empty;
        [Column(TypeName = "varchar(36)")]
        public string? MusicBrainzId { get; set; }
        [Column(TypeName = "date")]
        public DateTime ReleaseDate { get; set; }
        [Column(TypeName = "varchar(255)")]
        public string? CoverUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Guid ArtistId { get; set; }
        public required Artist Artist { get; set; }
        
        public double AverageRating { get; set; }
        public ICollection<Review> Reviews { get; set; } = new List<Review>();
        public ICollection<AlbumTag> AlbumTags { get; set; } = new List<AlbumTag>();
        public ICollection<UserAlbum> UserAlbums { get; set; } = new List<UserAlbum>();
    }
}