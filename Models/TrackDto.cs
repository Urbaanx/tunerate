namespace tunerate_api.Models;

public class TrackDto
{
    public string Title { get; set; } = "";
    public int DurationMs { get; set; }
    public string? PreviewUrl { get; set; } 
}