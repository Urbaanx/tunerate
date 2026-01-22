using System.ComponentModel.DataAnnotations;

namespace tunerate_api.DTOs;

public class ReviewDto
{
    [Required]
    [StringLength(2000)]
    public string Content { get; set; } = string.Empty;

    [Range(1, 10)]
    public int Score { get; set; }
}