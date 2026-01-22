using System.ComponentModel.DataAnnotations;

namespace tunerate_api.Models;

public class Friendship
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RequesterId { get; set; }
    public Guid AddresseeId { get; set; }

    public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Nawigacje
    public User Requester { get; set; }
    public User Addressee { get; set; }
}

public enum FriendshipStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2
}