using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace tunerate_api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PrintController : ControllerBase
    {
        [HttpGet]
        [Authorize]
        public IActionResult GetSecuredMessage()
        {
            // Pomyślna walidacja JWT tokenu przez Auth0 oznacza zalogowanego użytkownika
            return Ok(new { Message = "Wiadomość z zabezpieczonego API w C#." });
        }
    }
}
