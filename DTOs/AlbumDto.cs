namespace tunerate_api.DTOs;

public class AlbumDto
{
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public Guid ArtistId { get; set; }
    public string? ReleaseDate { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty; // MusicBrainz ID
    public string CoverUrl { get; set; } = string.Empty;
}