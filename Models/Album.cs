using System;
using System.Collections.Generic;

namespace tunerate_api.Models
{
    public class Album
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Title { get; set; } = string.Empty;
        public string? MusicBrainzId { get; set; }
        public int? ReleaseYear { get; set; }
        public string? CoverUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Guid ArtistId { get; set; }
        public Artist Artist { get; set; }

        public ICollection<Rating> Ratings { get; set; } = new List<Rating>();
        public ICollection<Review> Reviews { get; set; } = new List<Review>();
        public ICollection<AlbumTag> AlbumTags { get; set; } = new List<AlbumTag>();
        public ICollection<UserAlbum> UserAlbums { get; set; } = new List<UserAlbum>();
    }
}