using Microsoft.AspNetCore.Authorization;
using System.Text.Json;

namespace tunerate_api;

public class HasScopeHandler: AuthorizationHandler<HasScopeRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, HasScopeRequirement requirement)
    {
        var matchingClaims = context.User.Claims
            .Where(c => string.Equals(c.Type, "permissions", StringComparison.OrdinalIgnoreCase)
                     || string.Equals(c.Type, "permission", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (!matchingClaims.Any())
            return Task.CompletedTask;

        var scopes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var claim in matchingClaims)
        {
            var raw = (claim?.Value ?? "").Trim();
            if (string.IsNullOrEmpty(raw)) continue;
            
            if (raw.StartsWith("["))
            {
                try
                {
                    var arr = JsonSerializer.Deserialize<string[]>(raw);
                    if (arr != null)
                    {
                        foreach (var item in arr)
                            if (!string.IsNullOrWhiteSpace(item))
                                scopes.Add(item.Trim());
                        continue;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Exception parsing scopes claim as JSON array: {ex}");
                }
            }
            
            foreach (var part in raw.Split(' ', StringSplitOptions.RemoveEmptyEntries))
                scopes.Add(part.Trim());
        }

        if (scopes.Contains(requirement.Scope))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}