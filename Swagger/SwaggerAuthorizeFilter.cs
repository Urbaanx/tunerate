using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace tunerate_api.Swagger
{
    public class SwaggerAuthorizeFilter : IOperationFilter
    {
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            var hasAuthorize = context.MethodInfo
                                   .DeclaringType?.GetCustomAttributes(true)
                                   .OfType<AuthorizeAttribute>().Any() == true
                               || context.MethodInfo
                                   .GetCustomAttributes(true)
                                   .OfType<AuthorizeAttribute>().Any();

            operation.Extensions.Add("x-requiresAuth", new Microsoft.OpenApi.Any.OpenApiBoolean(hasAuthorize));
        }
    }
}