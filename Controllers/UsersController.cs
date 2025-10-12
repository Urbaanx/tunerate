using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using tunerate_api.Data;
using tunerate_api.Models;

namespace tunerate_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("sync")]
        public async Task<IActionResult> SyncUser()
        {
            var auth0Id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            var nickname = User.FindFirst("nickname")?.Value 
                           ?? User.FindFirst("name")?.Value 
                           ?? "Anon";

            if (auth0Id == null) return Unauthorized("Brak Auth0 ID.");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Auth0Id == auth0Id);
            if (user == null)
            {
                user = new User
                {
                    Auth0Id = auth0Id,
                    Nickname = nickname
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }

            return Ok(user);
        }
    }
}