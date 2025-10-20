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
        }
    }
}