using System;
using System.Collections.Generic;

namespace tunerate_api.Models
{
    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Auth0Id { get; set; } = string.Empty;
        public string Nickname { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<Rating> Ratings { get; set; } = new List<Rating>();
        public ICollection<Review> Reviews { get; set; } = new List<Review>();
        public ICollection<UserAlbum> UserAlbums { get; set; } = new List<UserAlbum>();
    }
}