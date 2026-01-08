namespace tunerate_api.Interfaces
{
    public interface IDeezerPreviewService
    {
        Task<string?> GetPreviewUrlAsync(string artist, string trackTitle);
    }
}