using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestSharp;
using System.Text.Json;
using System.Text.Json.Serialization;
using tunerate_api.Data;
using tunerate_api.Models;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "admin")]
    public class AdminController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _conf;
        private readonly Auth0TokenSettings? _tokenSettings;

        public AdminController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _conf = config;
            _tokenSettings = _conf.GetSection("Auth0ManagementToken").Get<Auth0TokenSettings>();
        }

        // --- General helpers ---

        [HttpGet("tables")]
        public IActionResult GetTables()
        {
            var tables = new[]
            {
                "Users", "Artists", "Albums", "Tags", "AlbumTags",
                "Reviews", "UserAlbums", "Friendships", "AlbumShares", "ChatMessages"
            };
            return Ok(tables);
        }

        [HttpGet("counts")]
        public async Task<IActionResult> GetCounts()
        {
            var counts = new
            {
                Users = await _context.Users.CountAsync(),
                Artists = await _context.Artists.CountAsync(),
                Albums = await _context.Albums.CountAsync(),
                Tags = await _context.Tags.CountAsync(),
                AlbumTags = await _context.AlbumTags.CountAsync(),
                Reviews = await _context.Reviews.CountAsync(),
                UserAlbums = await _context.UserAlbums.CountAsync(),
                Friendships = await _context.Friendships.CountAsync(),
                AlbumShares = await _context.AlbumShares.CountAsync(),
                ChatMessages = await _context.ChatMessages.CountAsync()
            };
            return Ok(counts);
        }

        // ---------------------------------------------------------------------
        // Users
        // ---------------------------------------------------------------------
        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? sortBy = null, [FromQuery] string? sortDir = "desc", [FromQuery] string? q = null)
        {
            var query = _context.Users.AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(u => u.Nickname.Contains(q) || u.Auth0Id.Contains(q));

            string Normalize(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "";
                var parts = s.Split('.');
                for (int i = 0; i < parts.Length; i++)
                    if (!string.IsNullOrEmpty(parts[i]))
                        parts[i] = char.ToUpper(parts[i][0]) + parts[i].Substring(1);
                return string.Join('.', parts);
            }

            var key = Normalize(sortBy);
            if (!string.IsNullOrWhiteSpace(key))
            {
                try
                {
                    var desc = sortDir?.ToLower() == "desc";
                    if (key.Contains('.'))
                    {
                        var parts = key.Split('.');
                        query = desc
                            ? query.OrderByDescending(e => EF.Property<object>(e, parts.Last()))
                            : query.OrderBy(e => EF.Property<object>(e, parts.Last()));
                    }
                    else
                    {
                        if (key == "Nickname")
                            query = desc ? query.OrderByDescending(u => u.Nickname) : query.OrderBy(u => u.Nickname);
                        else if (key == "Auth0Id")
                            query = desc ? query.OrderByDescending(u => u.Auth0Id) : query.OrderBy(u => u.Auth0Id);
                        else if (key == "CreatedAt")
                            query = desc ? query.OrderByDescending(u => u.CreatedAt) : query.OrderBy(u => u.CreatedAt);
                        else
                            query = desc ? query.OrderByDescending(e => EF.Property<object>(e, key)) : query.OrderBy(e => EF.Property<object>(e, key));
                    }
                }
                catch
                {
                    query = query.OrderByDescending(u => u.CreatedAt);
                }
            }
            else query = query.OrderByDescending(u => u.CreatedAt);

            var total = await query.CountAsync();
            var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            return Ok(new { Items = items, TotalCount = total, Page = page, PageSize = pageSize });
        }

        [HttpGet("users/{id:guid}")]
        public async Task<IActionResult> GetUser(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();
            return Ok(user);
        }

        [HttpPost("users")]
        public async Task<IActionResult> CreateUser([FromBody] User model)
        {
            model.Id = model.Id == Guid.Empty ? Guid.NewGuid() : model.Id;
            _context.Users.Add(model);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetUser), new { id = model.Id }, model);
        }

        [HttpPut("users/{id:guid}")]
        public async Task<IActionResult> UpdateUser(Guid id, [FromBody] User model)
        {
            var existing = await _context.Users.FindAsync(id);
            if (existing == null) return NotFound();
            existing.Auth0Id = model.Auth0Id;
            existing.Nickname = model.Nickname;
            if (model.CreatedAt != default) existing.CreatedAt = model.CreatedAt;
            _context.Users.Update(existing);
            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        [HttpDelete("users/{id:guid}")]
        public async Task<IActionResult> DeleteUser(Guid id)
        {
            var u = await _context.Users.FindAsync(id);
            if (u == null) return NotFound();
            var auth0Id = u.Auth0Id;
            _context.Users.Remove(u);
            await _context.SaveChangesAsync();

            try
            {
                var token = GetAuth0ManagementToken();
                if (token != null && !string.IsNullOrWhiteSpace(auth0Id))
                {
                    var client = new RestClient($"https://{_conf["Auth0:Domain"]}/api/v2/users/{auth0Id}");
                    var request = new RestRequest { Method = Method.Delete };
                    request.AddHeader("authorization", $"Bearer {token}");
                    await client.ExecuteAsync(request);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Auth0 delete attempt failed: " + ex.Message);
            }

            return Ok(new { message = "Deleted" });
        }

        // ---------------------------------------------------------------------
        // Artists
        // ---------------------------------------------------------------------
        [HttpGet("artists")]
        public async Task<IActionResult> GetArtists([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? sortBy = null, [FromQuery] string? sortDir = "desc", [FromQuery] string? q = null)
        {
            var query = _context.Artists.AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(a => a.Name.Contains(q));

            string Normalize(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "";
                var parts = s.Split('.');
                for (int i = 0; i < parts.Length; i++)
                    if (!string.IsNullOrEmpty(parts[i]))
                        parts[i] = char.ToUpper(parts[i][0]) + parts[i].Substring(1);
                return string.Join('.', parts);
            }

            var key = Normalize(sortBy);
            if (!string.IsNullOrWhiteSpace(key))
            {
                try
                {
                    var desc = sortDir?.ToLower() == "desc";
                    if (key.Contains('.'))
                    {
                        var parts = key.Split('.');
                        query = desc ? query.OrderByDescending(e => EF.Property<object>(e, parts.Last())) : query.OrderBy(e => EF.Property<object>(e, parts.Last()));
                    }
                    else
                    {
                        if (key == "Name")
                            query = desc ? query.OrderByDescending(a => a.Name) : query.OrderBy(a => a.Name);
                        else
                            query = desc ? query.OrderByDescending(e => EF.Property<object>(e, key)) : query.OrderBy(e => EF.Property<object>(e, key));
                    }
                }
                catch
                {
                    query = query.OrderBy(a => a.Name);
                }
            }
            else query = query.OrderBy(a => a.Name);

            var total = await query.CountAsync();
            var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            return Ok(new { Items = items, TotalCount = total, Page = page, PageSize = pageSize });
        }

        [HttpGet("artists/{id:guid}")]
        public async Task<IActionResult> GetArtist(Guid id)
        {
            var a = await _context.Artists.FindAsync(id);
            if (a == null) return NotFound();
            return Ok(a);
        }

        [HttpPost("artists")]
        public async Task<IActionResult> CreateArtist([FromBody] Artist model)
        {
            model.Id = model.Id == Guid.Empty ? Guid.NewGuid() : model.Id;
            _context.Artists.Add(model);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetArtist), new { id = model.Id }, model);
        }

        [HttpPut("artists/{id:guid}")]
        public async Task<IActionResult> UpdateArtist(Guid id, [FromBody] Artist model)
        {
            var a = await _context.Artists.FindAsync(id);
            if (a == null) return NotFound();
            a.Name = model.Name;
            a.ExternalId = model.ExternalId;
            _context.Artists.Update(a);
            await _context.SaveChangesAsync();
            return Ok(a);
        }

        [HttpDelete("artists/{id:guid}")]
        public async Task<IActionResult> DeleteArtist(Guid id)
        {
            var a = await _context.Artists.FindAsync(id);
            if (a == null) return NotFound();
            _context.Artists.Remove(a);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Deleted" });
        }

        // ---------------------------------------------------------------------
        // Albums
        // ---------------------------------------------------------------------
        [HttpGet("albums")]
        public async Task<IActionResult> GetAlbums([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? sortBy = null, [FromQuery] string? sortDir = "desc", [FromQuery] string? q = null)
        {
            var query = _context.Albums.Include(a => a.Artist).AsQueryable();

            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(a => a.ExternalId != null && (a.Title.Contains(q) || a.ExternalId.Contains(q) || a.Artist.Name.Contains(q)));

            string Normalize(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "";
                var parts = s.Split('.');
                for (int i = 0; i < parts.Length; i++)
                    if (!string.IsNullOrEmpty(parts[i]))
                        parts[i] = char.ToUpper(parts[i][0]) + parts[i].Substring(1);
                return string.Join('.', parts);
            }

            var key = Normalize(sortBy);
            if (!string.IsNullOrWhiteSpace(key))
            {
                try
                {
                    var desc = sortDir?.ToLower() == "desc";
                    if (key.Contains('.'))
                    {
                        var parts = key.Split('.');
                        if (parts.Length == 2 && parts[0] == "Artist" && parts[1] == "Name")
                            query = desc ? query.OrderByDescending(a => a.Artist.Name) : query.OrderBy(a => a.Artist.Name);
                        else
                            query = desc ? query.OrderByDescending(a => EF.Property<object>(a, parts[0])) : query.OrderBy(a => EF.Property<object>(a, parts[0]));
                    }
                    else
                    {
                        query = desc ? query.OrderByDescending(a => EF.Property<object>(a, key)) : query.OrderBy(a => EF.Property<object>(a, key));
                    }
                }
                catch
                {
                    query = query.OrderByDescending(a => a.ReleaseDate);
                }
            }
            else
            {
                query = query.OrderByDescending(a => a.ReleaseDate);
            }

            var projected = query.Select(a => new {
                a.Id,
                a.Title,
                a.ExternalId,
                a.CoverUrl,
                a.ReleaseDate,
                a.AverageRating,
                Artist = new { a.Artist.Id, a.Artist.Name }
            });

            var total = await projected.CountAsync();
            var items = await projected.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            return Ok(new { Items = items, TotalCount = total, Page = page, PageSize = pageSize });
        }

        [HttpGet("albums/{id:guid}")]
        public async Task<IActionResult> GetAlbum(Guid id)
        {
            var a = await _context.Albums.Include(x => x.Artist).FirstOrDefaultAsync(x => x.Id == id);
            if (a == null) return NotFound();
            return Ok(a);
        }

        [HttpPost("albums")]
        public async Task<IActionResult> CreateAlbum([FromBody] Album model)
        {
            model.Id = model.Id == Guid.Empty ? Guid.NewGuid() : model.Id;
            if (model.ArtistId != Guid.Empty)
            {
                var artist = await _context.Artists.FindAsync(model.ArtistId);
                if (artist == null) return BadRequest("ArtistId not found.");
            }
            _context.Albums.Add(model);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetAlbum), new { id = model.Id }, model);
        }

        [HttpPut("albums/{id:guid}")]
        public async Task<IActionResult> UpdateAlbum(Guid id, [FromBody] Album model)
        {
            var a = await _context.Albums.FindAsync(id);
            if (a == null) return NotFound();
            a.Title = model.Title;
            a.ExternalId = model.ExternalId;
            a.ReleaseDate = model.ReleaseDate;
            a.CoverUrl = model.CoverUrl;
            if (model.ArtistId != Guid.Empty)
            {
                var art = await _context.Artists.FindAsync(model.ArtistId);
                if (art == null) return BadRequest("ArtistId not found.");
                a.ArtistId = model.ArtistId;
            }
            a.AverageRating = model.AverageRating;
            _context.Albums.Update(a);
            await _context.SaveChangesAsync();
            return Ok(a);
        }

        [HttpDelete("albums/{id:guid}")]
        public async Task<IActionResult> DeleteAlbum(Guid id)
        {
            var a = await _context.Albums.FindAsync(id);
            if (a == null) return NotFound();
            _context.Albums.Remove(a);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Deleted" });
        }

        // ---------------------------------------------------------------------
        // Tags & AlbumTags
        // ---------------------------------------------------------------------
        [HttpGet("tags")]
        public async Task<IActionResult> GetTags([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? sortBy = null, [FromQuery] string? sortDir = "asc", [FromQuery] string? q = null)
        {
            var query = _context.Tags.AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(t => t.Name.Contains(q));

            string Normalize(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "";
                var parts = s.Split('.');
                for (int i = 0; i < parts.Length; i++)
                    if (!string.IsNullOrEmpty(parts[i]))
                        parts[i] = char.ToUpper(parts[i][0]) + parts[i].Substring(1);
                return string.Join('.', parts);
            }

            var key = Normalize(sortBy);
            if (!string.IsNullOrWhiteSpace(key))
            {
                try
                {
                    var desc = sortDir?.ToLower() == "desc";
                    if (key.Contains('.'))
                    {
                        var parts = key.Split('.');
                        query = desc ? query.OrderByDescending(e => EF.Property<object>(e, parts.Last())) : query.OrderBy(e => EF.Property<object>(e, parts.Last()));
                    }
                    else
                    {
                        if (key == "Name")
                            query = desc ? query.OrderByDescending(t => t.Name) : query.OrderBy(t => t.Name);
                        else
                            query = desc ? query.OrderByDescending(e => EF.Property<object>(e, key)) : query.OrderBy(e => EF.Property<object>(e, key));
                    }
                }
                catch
                {
                    query = query.OrderBy(t => t.Name);
                }
            }
            else query = query.OrderBy(t => t.Name);

            var total = await query.CountAsync();
            var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            return Ok(new { Items = items, TotalCount = total, Page = page, PageSize = pageSize });
        }

        [HttpGet("tags/{id:guid}")]
        public async Task<IActionResult> GetTag(Guid id)
        {
            var t = await _context.Tags.FindAsync(id);
            if (t == null) return NotFound();
            return Ok(t);
        }

        [HttpPost("tags")]
        public async Task<IActionResult> CreateTag([FromBody] Tag model)
        {
            model.Id = model.Id == Guid.Empty ? Guid.NewGuid() : model.Id;
            _context.Tags.Add(model);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetTag), new { id = model.Id }, model);
        }

        [HttpPut("tags/{id:guid}")]
        public async Task<IActionResult> UpdateTag(Guid id, [FromBody] Tag model)
        {
            var t = await _context.Tags.FindAsync(id);
            if (t == null) return NotFound();
            t.Name = model.Name;
            _context.Tags.Update(t);
            await _context.SaveChangesAsync();
            return Ok(t);
        }

        [HttpDelete("tags/{id:guid}")]
        public async Task<IActionResult> DeleteTag(Guid id)
        {
            var t = await _context.Tags.FindAsync(id);
            if (t == null) return NotFound();
            _context.Tags.Remove(t);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Deleted" });
        }

        [HttpGet("albumtags")]
        public async Task<IActionResult> GetAlbumTags([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? sortBy = null, [FromQuery] string? sortDir = "asc", [FromQuery] string? q = null)
        {
            var query = _context.AlbumTags.Include(at => at.Album).Include(at => at.Tag).AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(at => at.Album.Title.Contains(q) || at.Tag.Name.Contains(q));

            string Normalize(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "";
                var parts = s.Split('.');
                for (int i = 0; i < parts.Length; i++)
                    if (!string.IsNullOrEmpty(parts[i]))
                        parts[i] = char.ToUpper(parts[i][0]) + parts[i].Substring(1);
                return string.Join('.', parts);
            }

            var key = Normalize(sortBy);
            if (!string.IsNullOrWhiteSpace(key))
            {
                try
                {
                    var desc = sortDir?.ToLower() == "desc";
                    if (key.Contains('.'))
                    {
                        var parts = key.Split('.');
                        if (parts.Length == 2 && parts[0] == "Album" && parts[1] == "Title")
                            query = desc ? query.OrderByDescending(at => at.Album.Title) : query.OrderBy(at => at.Album.Title);
                        else if (parts.Length == 2 && parts[0] == "Tag" && parts[1] == "Name")
                            query = desc ? query.OrderByDescending(at => at.Tag.Name) : query.OrderBy(at => at.Tag.Name);
                        else
                            query = desc ? query.OrderByDescending(at => EF.Property<object>(at, parts.Last())) : query.OrderBy(at => EF.Property<object>(at, parts.Last()));
                    }
                    else
                    {
                        if (key == "AlbumId")
                            query = desc ? query.OrderByDescending(at => at.AlbumId) : query.OrderBy(at => at.AlbumId);
                        else if (key == "TagId")
                            query = desc ? query.OrderByDescending(at => at.TagId) : query.OrderBy(at => at.TagId);
                        else
                            query = desc ? query.OrderByDescending(at => EF.Property<object>(at, key)) : query.OrderBy(at => EF.Property<object>(at, key));
                    }
                }
                catch
                {
                    query = query.OrderBy(at => at.AlbumId);
                }
            }
            else
            {
                query = query.OrderBy(at => at.AlbumId);
            }

            var projected = query.Select(at => new {
                at.AlbumId,
                at.TagId,
                Album = new { at.Album.Id, at.Album.Title },
                Tag = new { at.Tag.Id, at.Tag.Name }
            });

            var total = await projected.CountAsync();
            var items = await projected.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            return Ok(new { Items = items, TotalCount = total, Page = page, PageSize = pageSize });
        }

        [HttpPost("albumtags")]
        public async Task<IActionResult> CreateAlbumTag([FromBody] AlbumTag model)
        {
            var album = await _context.Albums.FindAsync(model.AlbumId);
            var tag = await _context.Tags.FindAsync(model.TagId);
            if (album == null || tag == null) return BadRequest("AlbumId or TagId invalid.");
            _context.AlbumTags.Add(model);
            await _context.SaveChangesAsync();
            return Created("", model);
        }

        [HttpDelete("albumtags/{albumId:guid}/{tagId:guid}")]
        public async Task<IActionResult> DeleteAlbumTag(Guid albumId, Guid tagId)
        {
            var at = await _context.AlbumTags.FindAsync(new object[] { albumId, tagId });
            if (at == null) return NotFound();
            _context.AlbumTags.Remove(at);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Deleted" });
        }

        // ---------------------------------------------------------------------
        // Reviews
        // ---------------------------------------------------------------------
        [HttpGet("reviews")]
        public async Task<IActionResult> GetReviews([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? sortBy = null, [FromQuery] string? sortDir = "desc", [FromQuery] string? q = null)
        {
            var query = _context.Reviews.Include(r => r.User).Include(r => r.Album).AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(r => r.Content.Contains(q) || r.User.Nickname.Contains(q) || r.Album.Title.Contains(q));

            string Normalize(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "";
                var parts = s.Split('.');
                for (int i = 0; i < parts.Length; i++)
                    if (!string.IsNullOrEmpty(parts[i]))
                        parts[i] = char.ToUpper(parts[i][0]) + parts[i].Substring(1);
                return string.Join('.', parts);
            }

            var key = Normalize(sortBy);
            if (!string.IsNullOrWhiteSpace(key))
            {
                try
                {
                    var desc = sortDir?.ToLower() == "desc";
                    if (key.Contains('.'))
                    {
                        var parts = key.Split('.');
                        if (parts.Length == 2 && parts[0] == "User" && parts[1] == "Nickname")
                            query = desc ? query.OrderByDescending(r => r.User.Nickname) : query.OrderBy(r => r.User.Nickname);
                        else if (parts.Length == 2 && parts[0] == "Album" && parts[1] == "Title")
                            query = desc ? query.OrderByDescending(r => r.Album.Title) : query.OrderBy(r => r.Album.Title);
                        else
                            query = desc ? query.OrderByDescending(r => EF.Property<object>(r, parts[0])) : query.OrderBy(r => EF.Property<object>(r, parts[0]));
                    }
                    else
                    {
                        query = desc ? query.OrderByDescending(r => EF.Property<object>(r, key)) : query.OrderBy(r => EF.Property<object>(r, key));
                    }
                }
                catch
                {
                    query = query.OrderByDescending(r => r.CreatedAt);
                }
            }
            else
            {
                query = query.OrderByDescending(r => r.CreatedAt);
            }

            var projected = query.Select(r => new {
                r.Id,
                r.Content,
                r.Score,
                r.CreatedAt,
                UserId = r.User.Id,
                AlbumId = r.Album.Id,
                User = new { r.User.Id, r.User.Nickname },
                Album = new { r.Album.Id, r.Album.Title }
            });

            var total = await projected.CountAsync();
            var items = await projected.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            return Ok(new { Items = items, TotalCount = total, Page = page, PageSize = pageSize });
        }

        [HttpGet("reviews/{id:guid}")]
        public async Task<IActionResult> GetReview(Guid id)
        {
            var r = await _context.Reviews.FindAsync(id);
            if (r == null) return NotFound();
            return Ok(r);
        }

        [HttpPost("reviews")]
        public async Task<IActionResult> CreateReview([FromBody] Review model)
        {
            model.Id = model.Id == Guid.Empty ? Guid.NewGuid() : model.Id;
            _context.Reviews.Add(model);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetReview), new { id = model.Id }, model);
        }

        [HttpPut("reviews/{id:guid}")]
        public async Task<IActionResult> UpdateReview(Guid id, [FromBody] Review model)
        {
            var r = await _context.Reviews.FindAsync(id);
            if (r == null) return NotFound();
            r.Content = model.Content;
            r.Score = model.Score;
            r.CreatedAt = model.CreatedAt == default ? r.CreatedAt : model.CreatedAt;
            _context.Reviews.Update(r);
            await _context.SaveChangesAsync();
            return Ok(r);
        }

        [HttpDelete("reviews/{id:guid}")]
        public async Task<IActionResult> DeleteReview(Guid id)
        {
            var r = await _context.Reviews.FindAsync(id);
            if (r == null) return NotFound();
            _context.Reviews.Remove(r);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Deleted" });
        }

        // ---------------------------------------------------------------------
        // UserAlbums
        // ---------------------------------------------------------------------
        [HttpGet("useralbums")]
        public async Task<IActionResult> GetUserAlbums([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? sortBy = null, [FromQuery] string? sortDir = "desc", [FromQuery] string? q = null)
        {
            var query = _context.UserAlbums.Include(ua => ua.User).Include(ua => ua.Album).AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(ua => ua.User.Nickname.Contains(q) || ua.Album.Title.Contains(q));

            string Normalize(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "";
                var parts = s.Split('.');
                for (int i = 0; i < parts.Length; i++)
                    if (!string.IsNullOrEmpty(parts[i]))
                        parts[i] = char.ToUpper(parts[i][0]) + parts[i].Substring(1);
                return string.Join('.', parts);
            }

            var key = Normalize(sortBy);
            if (!string.IsNullOrWhiteSpace(key))
            {
                try
                {
                    var desc = sortDir?.ToLower() == "desc";
                    if (key.Contains('.'))
                    {
                        var parts = key.Split('.');
                        if (parts.Length == 2 && parts[0] == "User" && parts[1] == "Nickname")
                            query = desc ? query.OrderByDescending(ua => ua.User.Nickname) : query.OrderBy(ua => ua.User.Nickname);
                        else if (parts.Length == 2 && parts[0] == "Album" && parts[1] == "Title")
                            query = desc ? query.OrderByDescending(ua => ua.Album.Title) : query.OrderBy(ua => ua.Album.Title);
                        else
                            query = desc ? query.OrderByDescending(ua => EF.Property<object>(ua, parts.Last())) : query.OrderBy(ua => EF.Property<object>(ua, parts.Last()));
                    }
                    else
                    {
                        if (key == "Status")
                            query = desc ? query.OrderByDescending(ua => ua.Status) : query.OrderBy(ua => ua.Status);
                        else if (key == "CreatedAt")
                            query = desc ? query.OrderByDescending(ua => ua.CreatedAt) : query.OrderBy(ua => ua.CreatedAt);
                        else
                            query = desc ? query.OrderByDescending(ua => EF.Property<object>(ua, key)) : query.OrderBy(ua => EF.Property<object>(ua, key));
                    }
                }
                catch
                {
                    query = query.OrderByDescending(ua => ua.CreatedAt);
                }
            }
            else query = query.OrderByDescending(ua => ua.CreatedAt);

            var projected = query.Select(ua => new {
                ua.UserId,
                ua.AlbumId,
                ua.Status,
                ua.CreatedAt,
                User = new { ua.User.Id, ua.User.Nickname },
                Album = new { ua.Album.Id, ua.Album.Title }
            });

            var total = await projected.CountAsync();
            var items = await projected.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            return Ok(new { Items = items, TotalCount = total, Page = page, PageSize = pageSize });
        }

        [HttpGet("useralbums/{userId:guid}/{albumId:guid}")]
        public async Task<IActionResult> GetUserAlbum(Guid userId, Guid albumId)
        {
            var ua = await _context.UserAlbums.FindAsync(new object[] { userId, albumId });
            if (ua == null) return NotFound();
            return Ok(ua);
        }

        [HttpPost("useralbums")]
        public async Task<IActionResult> CreateUserAlbum([FromBody] UserAlbum model)
        {
            _context.UserAlbums.Add(model);
            await _context.SaveChangesAsync();
            return Created("", model);
        }

        [HttpPut("useralbums/{userId:guid}/{albumId:guid}")]
        public async Task<IActionResult> UpdateUserAlbum(Guid userId, Guid albumId, [FromBody] UserAlbum model)
        {
            var ua = await _context.UserAlbums.FindAsync(new object[] { userId, albumId });
            if (ua == null) return NotFound();
            ua.Status = model.Status;
            ua.CreatedAt = model.CreatedAt == default ? ua.CreatedAt : model.CreatedAt;
            _context.UserAlbums.Update(ua);
            await _context.SaveChangesAsync();
            return Ok(ua);
        }

        [HttpDelete("useralbums/{userId:guid}/{albumId:guid}")]
        public async Task<IActionResult> DeleteUserAlbum(Guid userId, Guid albumId)
        {
            var ua = await _context.UserAlbums.FindAsync(new object[] { userId, albumId });
            if (ua == null) return NotFound();
            _context.UserAlbums.Remove(ua);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Deleted" });
        }

        // ---------------------------------------------------------------------
        // Friendships
        // ---------------------------------------------------------------------
        [HttpGet("friendships")]
        public async Task<IActionResult> GetFriendships([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? sortBy = null, [FromQuery] string? sortDir = "desc", [FromQuery] string? q = null)
        {
            var query = _context.Friendships.Include(f => f.Requester).Include(f => f.Addressee).AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(f => f.Requester.Nickname.Contains(q) || f.Addressee.Nickname.Contains(q));

            string Normalize(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "";
                var parts = s.Split('.');
                for (int i = 0; i < parts.Length; i++)
                    if (!string.IsNullOrEmpty(parts[i]))
                        parts[i] = char.ToUpper(parts[i][0]) + parts[i].Substring(1);
                return string.Join('.', parts);
            }

            var key = Normalize(sortBy);
            if (!string.IsNullOrWhiteSpace(key))
            {
                try
                {
                    var desc = sortDir?.ToLower() == "desc";
                    if (key.Contains('.'))
                    {
                        var parts = key.Split('.');
                        if (parts.Length == 2 && parts[0] == "Requester" && parts[1] == "Nickname")
                            query = desc ? query.OrderByDescending(f => f.Requester.Nickname) : query.OrderBy(f => f.Requester.Nickname);
                        else if (parts.Length == 2 && parts[0] == "Addressee" && parts[1] == "Nickname")
                            query = desc ? query.OrderByDescending(f => f.Addressee.Nickname) : query.OrderBy(f => f.Addressee.Nickname);
                        else
                            query = desc ? query.OrderByDescending(f => EF.Property<object>(f, parts.Last())) : query.OrderBy(f => EF.Property<object>(f, parts.Last()));
                    }
                    else
                    {
                        if (key == "Status")
                            query = desc ? query.OrderByDescending(f => f.Status) : query.OrderBy(f => f.Status);
                        else if (key == "CreatedAt")
                            query = desc ? query.OrderByDescending(f => f.CreatedAt) : query.OrderBy(f => f.CreatedAt);
                        else
                            query = desc ? query.OrderByDescending(f => EF.Property<object>(f, key)) : query.OrderBy(f => EF.Property<object>(f, key));
                    }
                }
                catch
                {
                    query = query.OrderByDescending(f => f.CreatedAt);
                }
            }
            else query = query.OrderByDescending(f => f.CreatedAt);

            var projected = query.Select(f => new {
                f.Id, f.Status, f.CreatedAt,
                Requester = new { f.Requester.Id, f.Requester.Nickname },
                Addressee = new { f.Addressee.Id, f.Addressee.Nickname }
            });

            var total = await projected.CountAsync();
            var items = await projected.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            return Ok(new { Items = items, TotalCount = total, Page = page, PageSize = pageSize });
        }

        [HttpGet("friendships/{id:guid}")]
        public async Task<IActionResult> GetFriendship(Guid id)
        {
            var f = await _context.Friendships.FindAsync(id);
            if (f == null) return NotFound();
            return Ok(f);
        }

        [HttpPost("friendships")]
        public async Task<IActionResult> CreateFriendship([FromBody] Friendship model)
        {
            model.Id = model.Id == Guid.Empty ? Guid.NewGuid() : model.Id;
            _context.Friendships.Add(model);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetFriendship), new { id = model.Id }, model);
        }

        [HttpPut("friendships/{id:guid}")]
        public async Task<IActionResult> UpdateFriendship(Guid id, [FromBody] Friendship model)
        {
            var f = await _context.Friendships.FindAsync(id);
            if (f == null) return NotFound();
            f.Status = model.Status;
            _context.Friendships.Update(f);
            await _context.SaveChangesAsync();
            return Ok(f);
        }

        [HttpDelete("friendships/{id:guid}")]
        public async Task<IActionResult> DeleteFriendship(Guid id)
        {
            var f = await _context.Friendships.FindAsync(id);
            if (f == null) return NotFound();
            _context.Friendships.Remove(f);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Deleted" });
        }

        // ---------------------------------------------------------------------
        // AlbumShares
        // ---------------------------------------------------------------------
        [HttpGet("albumshares")]
        public async Task<IActionResult> GetAlbumShares([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? sortBy = null, [FromQuery] string? sortDir = "desc", [FromQuery] string? q = null)
        {
            var query = _context.AlbumShares.Include(s => s.Album).Include(s => s.FromUser).Include(s => s.ToUser).AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(s => s.Album.Title.Contains(q) || s.FromUser.Nickname.Contains(q) || s.ToUser.Nickname.Contains(q));

            string Normalize(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "";
                var parts = s.Split('.');
                for (int i = 0; i < parts.Length; i++)
                    if (!string.IsNullOrEmpty(parts[i]))
                        parts[i] = char.ToUpper(parts[i][0]) + parts[i].Substring(1);
                return string.Join('.', parts);
            }

            var key = Normalize(sortBy);
            if (!string.IsNullOrWhiteSpace(key))
            {
                try
                {
                    var desc = sortDir?.ToLower() == "desc";
                    if (key.Contains('.'))
                    {
                        var parts = key.Split('.');
                        if (parts.Length == 2 && parts[0] == "Album" && parts[1] == "Title")
                            query = desc ? query.OrderByDescending(s => s.Album.Title) : query.OrderBy(s => s.Album.Title);
                        else if (parts.Length == 2 && parts[0] == "FromUser" && parts[1] == "Nickname")
                            query = desc ? query.OrderByDescending(s => s.FromUser.Nickname) : query.OrderBy(s => s.FromUser.Nickname);
                        else if (parts.Length == 2 && parts[0] == "ToUser" && parts[1] == "Nickname")
                            query = desc ? query.OrderByDescending(s => s.ToUser.Nickname) : query.OrderBy(s => s.ToUser.Nickname);
                        else
                            query = desc ? query.OrderByDescending(s => EF.Property<object>(s, parts.Last())) : query.OrderBy(s => EF.Property<object>(s, parts.Last()));
                    }
                    else
                    {
                        if (key == "CreatedAt")
                            query = desc ? query.OrderByDescending(s => s.CreatedAt) : query.OrderBy(s => s.CreatedAt);
                        else if (key == "IsRead")
                            query = desc ? query.OrderByDescending(s => s.IsRead) : query.OrderBy(s => s.IsRead);
                        else
                            query = desc ? query.OrderByDescending(s => EF.Property<object>(s, key)) : query.OrderBy(s => EF.Property<object>(s, key));
                    }
                }
                catch
                {
                    query = query.OrderByDescending(s => s.CreatedAt);
                }
            }
            else query = query.OrderByDescending(s => s.CreatedAt);

            var projected = query.Select(s => new {
                s.Id,
                s.IsRead,
                s.CreatedAt,
                Album = new { s.Album.Id, s.Album.Title },
                FromUser = new { s.FromUser.Id, s.FromUser.Nickname },
                ToUser = new { s.ToUser.Id, s.ToUser.Nickname }
            });

            var total = await projected.CountAsync();
            var items = await projected.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            return Ok(new { Items = items, TotalCount = total, Page = page, PageSize = pageSize });
        }

        [HttpGet("albumshares/{id:guid}")]
        public async Task<IActionResult> GetAlbumShare(Guid id)
        {
            var s = await _context.AlbumShares.FindAsync(id);
            if (s == null) return NotFound();
            return Ok(s);
        }

        [HttpPost("albumshares")]
        public async Task<IActionResult> CreateAlbumShare([FromBody] AlbumShare model)
        {
            model.Id = model.Id == Guid.Empty ? Guid.NewGuid() : model.Id;
            _context.AlbumShares.Add(model);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetAlbumShare), new { id = model.Id }, model);
        }

        [HttpPut("albumshares/{id:guid}")]
        public async Task<IActionResult> UpdateAlbumShare(Guid id, [FromBody] AlbumShare model)
        {
            var s = await _context.AlbumShares.FindAsync(id);
            if (s == null) return NotFound();
            s.IsRead = model.IsRead;
            s.FromUserId = model.FromUserId;
            s.ToUserId = model.ToUserId;
            s.AlbumId = model.AlbumId;
            _context.AlbumShares.Update(s);
            await _context.SaveChangesAsync();
            return Ok(s);
        }

        [HttpDelete("albumshares/{id:guid}")]
        public async Task<IActionResult> DeleteAlbumShare(Guid id)
        {
            var s = await _context.AlbumShares.FindAsync(id);
            if (s == null) return NotFound();
            _context.AlbumShares.Remove(s);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Deleted" });
        }

        // ---------------------------------------------------------------------
        // ChatMessages
        // ---------------------------------------------------------------------
        [HttpGet("chatmessages")]
        public async Task<IActionResult> GetChatMessages([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? sortBy = null, [FromQuery] string? sortDir = "desc", [FromQuery] string? q = null)
        {
            var query = _context.ChatMessages.Include(m => m.FromUser).Include(m => m.ToUser).AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(m => m.Content.Contains(q) || m.FromUser.Nickname.Contains(q) || m.ToUser.Nickname.Contains(q));

            string Normalize(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return "";
                var parts = s.Split('.');
                for (int i = 0; i < parts.Length; i++)
                    if (!string.IsNullOrEmpty(parts[i]))
                        parts[i] = char.ToUpper(parts[i][0]) + parts[i].Substring(1);
                return string.Join('.', parts);
            }

            var key = Normalize(sortBy);
            if (!string.IsNullOrWhiteSpace(key))
            {
                try
                {
                    var desc = sortDir?.ToLower() == "desc";
                    if (key.Contains('.'))
                    {
                        var parts = key.Split('.');
                        if (parts.Length == 2 && parts[0] == "FromUser" && parts[1] == "Nickname")
                            query = desc ? query.OrderByDescending(m => m.FromUser.Nickname) : query.OrderBy(m => m.FromUser.Nickname);
                        else if (parts.Length == 2 && parts[0] == "ToUser" && parts[1] == "Nickname")
                            query = desc ? query.OrderByDescending(m => m.ToUser.Nickname) : query.OrderBy(m => m.ToUser.Nickname);
                        else
                            query = desc ? query.OrderByDescending(m => EF.Property<object>(m, parts.Last())) : query.OrderBy(m => EF.Property<object>(m, parts.Last()));
                    }
                    else
                    {
                        if (key == "SentAt")
                            query = desc ? query.OrderByDescending(m => m.SentAt) : query.OrderBy(m => m.SentAt);
                        else if (key == "IsRead")
                            query = desc ? query.OrderByDescending(m => m.IsRead) : query.OrderBy(m => m.IsRead);
                        else
                            query = desc ? query.OrderByDescending(m => EF.Property<object>(m, key)) : query.OrderBy(m => EF.Property<object>(m, key));
                    }
                }
                catch
                {
                    query = query.OrderByDescending(m => m.SentAt);
                }
            }
            else query = query.OrderByDescending(m => m.SentAt);

            var projected = query.Select(m => new {
                m.Id, m.Content, m.SentAt, m.IsRead,
                FromUser = new { m.FromUser.Id, m.FromUser.Nickname },
                ToUser = new { m.ToUser.Id, m.ToUser.Nickname }
            });

            var total = await projected.CountAsync();
            var items = await projected.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            return Ok(new { Items = items, TotalCount = total, Page = page, PageSize = pageSize });
        }

        [HttpGet("chatmessages/{id:guid}")]
        public async Task<IActionResult> GetChatMessage(Guid id)
        {
            var m = await _context.ChatMessages.FindAsync(id);
            if (m == null) return NotFound();
            return Ok(m);
        }

        [HttpPost("chatmessages")]
        public async Task<IActionResult> CreateChatMessage([FromBody] ChatMessage model)
        {
            model.Id = model.Id == Guid.Empty ? Guid.NewGuid() : model.Id;
            _context.ChatMessages.Add(model);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetChatMessage), new { id = model.Id }, model);
        }

        [HttpPut("chatmessages/{id:guid}")]
        public async Task<IActionResult> UpdateChatMessage(Guid id, [FromBody] ChatMessage model)
        {
            var m = await _context.ChatMessages.FindAsync(id);
            if (m == null) return NotFound();
            m.Content = model.Content;
            m.IsRead = model.IsRead;
            m.SentAt = model.SentAt == default ? m.SentAt : model.SentAt;
            _context.ChatMessages.Update(m);
            await _context.SaveChangesAsync();
            return Ok(m);
        }

        [HttpDelete("chatmessages/{id:guid}")]
        public async Task<IActionResult> DeleteChatMessage(Guid id)
        {
            var m = await _context.ChatMessages.FindAsync(id);
            if (m == null) return NotFound();
            _context.ChatMessages.Remove(m);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Deleted" });
        }

        // ---------------------------------------------------------------------
        // Auth0 management helpers
        // ---------------------------------------------------------------------
        private JsonElement? GetAuth0ManagementToken()
        {
            if (_tokenSettings == null) return null;

            var client = new RestClient($"https://{_conf["Auth0:Domain"]}/oauth/token");
            var request = new RestRequest
            {
                Method = Method.Post
            };
            request.AddHeader("content-type", "application/json");
            var jsonBody = JsonSerializer.Serialize(_tokenSettings);
            request.AddParameter("application/json", jsonBody, ParameterType.RequestBody);
            var response = client.Execute(request);
            if (response.Content == null) return null;

            try
            {
                var parsed = JsonSerializer.Deserialize<JsonElement>(response.Content);
                if (parsed.TryGetProperty("access_token", out var tokenProp))
                    return tokenProp;
            }
            catch(Exception ex)
            {
                Console.WriteLine($"{ex.Message}");
            }

            return null;
        }
        
        private async Task<string?> GetRoleIdByName(string roleName, JsonElement? tokenElement)
        {
            if (tokenElement == null) return null;
            var token = tokenElement.ToString();

            var client = new RestClient($"https://{_conf["Auth0:Domain"]}/api/v2/roles?name={Uri.EscapeDataString(roleName)}");
            var request = new RestRequest { Method = Method.Get };
            request.AddHeader("authorization", $"Bearer {token}");
            var response = await client.ExecuteAsync(request);
            if (!response.IsSuccessful || response.Content == null) return null;

            try
            {
                var arr = JsonSerializer.Deserialize<JsonElement>(response.Content);
                if (arr.ValueKind == JsonValueKind.Array && arr.GetArrayLength() > 0)
                {
                    var first = arr[0];
                    if (first.TryGetProperty("id", out var idProp))
                        return idProp.GetString();
                }
            }
            catch(Exception ex)
            {
                Console.WriteLine($"{ex.Message}"); 
            }

            return null;
        }
        
        [HttpPost("users/{auth0Id}/assign-role")]
        public async Task<IActionResult> AssignRoleToUser(string auth0Id, [FromBody] RoleChangeRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.RoleName)) return BadRequest("roleName required.");
            var token = GetAuth0ManagementToken();
            if (token == null) return StatusCode(500, "Auth0 management token not configured.");
            var roleId = await GetRoleIdByName(req.RoleName, token);
            if (roleId == null) return NotFound("Role not found.");

            var client = new RestClient($"https://{_conf["Auth0:Domain"]}/api/v2/users/{auth0Id}/roles");
            var request = new RestRequest { Method = Method.Post };
            request.AddHeader("authorization", $"Bearer {token}");
            request.AddHeader("content-type", "application/json");
            var body = JsonSerializer.Serialize(new { roles = new[] { roleId } });
            request.AddStringBody(body, ContentType.Json);
            var response = await client.ExecuteAsync(request);

            if (!response.IsSuccessful) return StatusCode((int)response.StatusCode, response.Content);
            return Ok(new { message = "Role assigned" });
        }
        
        [HttpPost("users/{auth0Id}/remove-role")]
        public async Task<IActionResult> RemoveRoleFromUser(string auth0Id, [FromBody] RoleChangeRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.RoleName)) return BadRequest("roleName required.");
            var token = GetAuth0ManagementToken();
            if (token == null) return StatusCode(500, "Auth0 management token not configured.");
            var roleId = await GetRoleIdByName(req.RoleName, token);
            if (roleId == null) return NotFound("Role not found.");

            var client = new RestClient($"https://{_conf["Auth0:Domain"]}/api/v2/users/{auth0Id}/roles");
            var request = new RestRequest { Method = Method.Delete };
            request.AddHeader("authorization", $"Bearer {token}");
            request.AddHeader("content-type", "application/json");
            var body = JsonSerializer.Serialize(new { roles = new[] { roleId } });
            request.AddStringBody(body, ContentType.Json);
            var response = await client.ExecuteAsync(request);

            if (!response.IsSuccessful) return StatusCode((int)response.StatusCode, response.Content);
            return Ok(new { message = "Role removed" });
        }

        public class RoleChangeRequest
        {
            [JsonPropertyName("roleName")]
            public string? RoleName { get; set; }
        }
    }
}