using Microsoft.EntityFrameworkCore;
using tunerate_api.Models;

namespace tunerate_api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Artist> Artists { get; set; }
        public DbSet<Album> Albums { get; set; }
        public DbSet<Tag> Tags { get; set; }
        public DbSet<AlbumTag> AlbumTags { get; set; }
        public DbSet<Review> Reviews { get; set; }
        public DbSet<UserAlbum> UserAlbums { get; set; }

        // nowe tabele dla systemu społecznościowego
        public DbSet<Friendship> Friendships { get; set; }
        public DbSet<AlbumShare> AlbumShares { get; set; }   // model rekomendacji/polecenia albumu (rename by not collide)
        public DbSet<ChatMessage> ChatMessages { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            modelBuilder.Entity<AlbumTag>()
                .HasKey(at => new { at.AlbumId, at.TagId });

            modelBuilder.Entity<AlbumTag>()
                .HasOne(at => at.Album)
                .WithMany(a => a.AlbumTags)
                .HasForeignKey(at => at.AlbumId);

            modelBuilder.Entity<AlbumTag>()
                .HasOne(at => at.Tag)
                .WithMany(t => t.AlbumTags)
                .HasForeignKey(at => at.TagId);
            
            modelBuilder.Entity<UserAlbum>()
                .HasKey(ua => new { ua.UserId, ua.AlbumId });

            modelBuilder.Entity<UserAlbum>()
                .HasOne(ua => ua.User)
                .WithMany(u => u.UserAlbums)
                .HasForeignKey(ua => ua.UserId);

            modelBuilder.Entity<UserAlbum>()
                .HasOne(ua => ua.Album)
                .WithMany(a => a.UserAlbums)
                .HasForeignKey(ua => ua.AlbumId);

            // konfiguracja Friendship (unikat dla pary requester/addressee)
            modelBuilder.Entity<Friendship>()
                .HasIndex(f => new { f.RequesterId, f.AddresseeId })
                .IsUnique();

            modelBuilder.Entity<Friendship>()
                .HasOne(f => f.Requester)
                .WithMany()
                .HasForeignKey(f => f.RequesterId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Friendship>()
                .HasOne(f => f.Addressee)
                .WithMany()
                .HasForeignKey(f => f.AddresseeId)
                .OnDelete(DeleteBehavior.Restrict);

            // AlbumShare relacje
            modelBuilder.Entity<AlbumShare>()
                .HasOne(s => s.FromUser)
                .WithMany()
                .HasForeignKey(s => s.FromUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AlbumShare>()
                .HasOne(s => s.ToUser)
                .WithMany()
                .HasForeignKey(s => s.ToUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AlbumShare>()
                .HasOne(s => s.Album)
                .WithMany()
                .HasForeignKey(s => s.AlbumId)
                .OnDelete(DeleteBehavior.Cascade);

            // ChatMessage relacje
            modelBuilder.Entity<ChatMessage>()
                .HasOne(m => m.FromUser)
                .WithMany()
                .HasForeignKey(m => m.FromUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ChatMessage>()
                .HasOne(m => m.ToUser)
                .WithMany()
                .HasForeignKey(m => m.ToUserId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
