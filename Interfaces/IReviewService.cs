using System;
using System.Threading.Tasks;
using tunerate_api.Models;
using tunerate_api.DTOs;

namespace tunerate_api.Interfaces
{
    public interface IReviewService
    {
        Task<object> GetAlbumReviewsAsync(Guid albumId, int page, int pageSize, string sort);
        Task<(Album? Album, Review? Review, User? User, string? Error)> AddOrUpdateReviewAsync(Guid albumId, string auth0Id, ReviewDto reviewDto);
        Task<(Review? Review, string? Error)> EditReviewAsync(Guid reviewId, string auth0Id, ReviewDto reviewDto);
        Task<(bool Success, string? Error)> DeleteReviewAsync(Guid reviewId, string auth0Id);
    }
}