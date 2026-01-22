namespace tunerate_api.Interfaces
{
    public interface IRecommendationService
    {
        Task<(bool Success, object? Data, int? StatusCode, string? Error)> GetRecommendationsAsync(Guid userId, string type = "content", int topN = 5);
        Task<(bool Success, object? Data, int? StatusCode, string? Error)> GetAlbumRecommendationsAsync(Guid albumId, int topN = 5);
        Task<(bool Success, object? Data, int? StatusCode, string? Error)> GetHealthAsync();
    }
}