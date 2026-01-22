using System.ComponentModel.DataAnnotations;

namespace tunerate_api.Models
{
    public class Tag
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        public ICollection<AlbumTag> AlbumTags { get; set; } = new List<AlbumTag>();
    }
}