using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Security.Claims;
using tunerate_api.Data;
using tunerate_api.Services;
using tunerate_api.Swagger;
using tunerate_api.Hubs;

namespace tunerate_api;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        var domain = $"https://{builder.Configuration["Auth0:Domain"]}/";

        // AUTH
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = domain;
                options.Audience = builder.Configuration["Auth0:Audience"];
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    NameClaimType = ClaimTypes.NameIdentifier
                };

                // Allow SignalR tokens via query string
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"].FirstOrDefault();
                        var path = context.HttpContext.Request.Path;

                        if (!string.IsNullOrEmpty(accessToken) &&
                            path.StartsWithSegments("/hubs/social"))
                        {
                            context.Token = accessToken;
                        }

                        return Task.CompletedTask;
                    }
                };
            });

        builder.Services.AddAuthorization(options =>
        {
            options.AddPolicy("admin", policy =>
                policy.Requirements.Add(new HasScopeRequirement("admin", domain)));
        });

        // SERVICES
        builder.Services.AddScoped<MusicBrainzService>();
        builder.Services.AddScoped<DeezerPreviewService>();
        builder.Services.AddScoped<AlbumService>();
        builder.Services.AddMemoryCache();

        builder.Services.AddControllers();
        builder.Services.AddSignalR();
        
        builder.Services.AddSingleton<IPresenceService, PresenceService>();
        builder.Services.AddSingleton<IAuthorizationHandler, HasScopeHandler>();

        // SWAGGER
        builder.Services.AddSwaggerGen(c =>
        {
            c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.ApiKey,
                Scheme = "Bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Enter 'Bearer' followed by your JWT token."
            });

            c.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference
                        {
                            Type = ReferenceType.SecurityScheme,
                            Id = "Bearer"
                        }
                    },
                    Array.Empty<string>()
                }
            });
            c.OperationFilter<SwaggerAuthorizeFilter>();
        });

        // CORS
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowSpecificOrigin", policy =>
            {
                policy.WithOrigins("http://localhost:5173")
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        // DB
        builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

        var app = builder.Build();

        // MIDDLEWARE
        app.UseMiddleware<TokenDecodingMiddlewere>();
        app.UseCors("AllowSpecificOrigin");

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseHttpsRedirection();
        app.UseAuthentication();
        app.UseAuthorization();

        // ROUTES
        app.MapControllers();
        app.MapHub<SocialHub>("/hubs/social");

        app.Run();
    }
}
