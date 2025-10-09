using System;
using System.Collections.Generic;

namespace tunerate_api.Models
{
    public class Artist
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string? MusicBrainzId { get; set; }

        public ICollection<Album> Albums { get; set; } = new List<Album>();
    }
}