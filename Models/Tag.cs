using System;
using System.Collections.Generic;

namespace tunerate_api.Models
{
    public class Tag
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;

        public ICollection<AlbumTag> AlbumTags { get; set; } = new List<AlbumTag>();
    }
}