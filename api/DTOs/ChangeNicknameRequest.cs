using System.ComponentModel.DataAnnotations;

namespace tunerate_api.DTOs;

public class ChangeNicknameRequest
{
    [Required]
    [StringLength(50, MinimumLength = 1)]
    public string Nickname { get; set; } = string.Empty;
}