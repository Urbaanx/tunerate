using System.ComponentModel.DataAnnotations;

namespace tunerate_api.DTOs;

public class AlbumDto
{
    [Required]
    [StringLength(255)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [StringLength(255)]
    public string Artist { get; set; } = string.Empty;

    public Guid ArtistId { get; set; }

    public string? ReleaseDate { get; set; } = string.Empty;

    public string ExternalId { get; set; } = string.Empty;

    public string CoverUrl { get; set; } = string.Empty;
}