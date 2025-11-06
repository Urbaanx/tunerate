using Microsoft.AspNetCore.Mvc;
using RestSharp;
using System.Net;
using System.Text.Json;

namespace tunerate_api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RecommendationController : ControllerBase
    {
        private readonly RestClient _client;

        public RecommendationController()
        {
            var options = new RestClientOptions("http://localhost:8001/");
            _client = new RestClient(options);
            _client.AddDefaultHeader("User-Agent", "TuneRate/1.0 (https://tunerate.app)");
        }

        [HttpGet("{userId}")]
        public async Task<IActionResult> GetRecommendations(Guid userId, int topN = 5)
        {
            var request = new RestRequest($"recommend/{userId}");
            request.AddQueryParameter("top_n", topN.ToString());

            try
            {
                var response = await _client.ExecuteAsync(request);

                if (response.StatusCode != HttpStatusCode.OK)
                {
                    var msg = string.IsNullOrEmpty(response.Content)
                        ? $"Błąd połączenia z serwisem rekomendacji: {(int)response.StatusCode}"
                        : response.Content;
                    return StatusCode((int)response.StatusCode, msg);
                }

                if (string.IsNullOrEmpty(response.Content))
                    return NoContent();

                Console.WriteLine($"{JsonSerializer.Deserialize<object>(response.Content)}");
                
                return Ok(JsonSerializer.Deserialize<object>(response.Content));

            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Błąd połączenia z serwisem rekomendacji: {ex.Message}");
            }
        }
    }
}