using System.ComponentModel.DataAnnotations.Schema;

namespace tunerate_api.Models
{
    public class Artist
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        [Column(TypeName = "varchar(30)")]
        public string Name { get; set; } = string.Empty;
        [Column(TypeName = "varchar(100)")]
        public string? ExternalId { get; set; }

        public ICollection<Album> Albums { get; set; } = new List<Album>();
    }
}