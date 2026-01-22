namespace tunerate_api.DTOs;

public class TrackDto
{
    public string Title { get; set; } = "";
    public int DurationMs { get; set; }
    public string? PreviewUrl { get; set; } 
}