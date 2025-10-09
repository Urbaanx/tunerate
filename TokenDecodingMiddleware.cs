using System.IdentityModel.Tokens.Jwt;

namespace tunerate_api
{
    public class TokenDecodingMiddlewere
    {
        public readonly RequestDelegate _next;
        public TokenDecodingMiddlewere(RequestDelegate next)
        {
            _next = next;
        }

        public async Task Invoke(HttpContext context) 
        {
            if (context.Request.Headers.ContainsKey("Authorization"))
            {
                var token = context.Request.Headers["Authorization"].ToString().Replace("Bearer ", "");

                try
                {
                    // Decode the token
                    var handler = new JwtSecurityTokenHandler();
                    var jwtToken = handler.ReadJwtToken(token);

                    // Extract client_id (sub)
                    var clientId = jwtToken.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;
                    var permissions = jwtToken.Claims.FirstOrDefault(c => c.Type == "permissions")?.Value;
                    // Store client_id in HttpContext for downstream access
                    
                    context.Items["client_id"] = clientId;
                    context.Items["permissions"] = permissions;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Token decoding error: {ex.Message}");
                    context.Response.StatusCode = 401; // Unauthorized
                    await context.Response.WriteAsync("Invalid token");
                    return;
                }
            }

            await _next(context);
        }

    }
}