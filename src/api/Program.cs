using FileLink.Common;
using FileLink.Common.HealthCheck;
using FileLink.Plugin;
using FileLink.Services;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using ServiceStack;
using ServiceStack.OrmLite;
namespace FileLink;

public class Program
{
    public async static Task Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        var config = builder.Configuration;
        var env = builder.Environment;
        ILogger logger = LoggerFactory.Create(builder =>
        {
            builder.AddSimpleConsole(c =>
            {
                c.SingleLine = true;
                c.IncludeScopes = false;
                c.TimestampFormat = "HH:mm:ss ";
            });
        }).CreateLogger("PreHost");

        // Add core services
        builder.Services.AddControllers();
        builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        builder.Services.AddMemoryCache();
        builder.Services.AddHttpLogging(_ => { });

        // Add modular service groups
        builder.Services
            .AddDatabase(config, logger)
            .AddJwtAuth(config, env, logger)
            .AddCorsPolicy(config)
            .AddBackgroundServices()
            .AddCompressionAndCaching()
            .AddApplicationServices()
            .AddOmdbPlugin(config, logger);

        builder.Services.AddLargeFileSupport(builder.WebHost);

        bool isDevelopment = builder.Environment.IsDevelopment();
        builder.Services.AddAuthorization(ops =>
        {
            ops.AddDefaultPolicies();
        });

        var app = builder.Build();

        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        // Initialize DB
        using (var scope = app.Services.CreateScope())
        {
            var dbInitializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
            dbInitializer.CreateTable();

            var omdbSettings = config.GetSection("OmdbSettings").Get<OmdbSettings>();
            if (omdbSettings is not null && !string.IsNullOrEmpty(omdbSettings.ApiKey))
            {
                var uploadItemRepo = scope.ServiceProvider.GetRequiredService<Repos.UploadItemRepo>();
                var metaItems = await uploadItemRepo.GetAllItemsWithOutMetadata();
                var queue = scope.ServiceProvider.GetRequiredService<BackgroundTaskQueue>();
                foreach (var item in metaItems)
                {
                    await queue.QueueFileProcessAsync(item);
                }
            }
        }
        // Configure the HTTP request pipeline.
        ConfigureMiddleware(app);



        app.Run();
    }
    private static void ConfigureMiddleware(WebApplication app)
    {
        app.UseCors("Origins");
        app.UseResponseCaching();
        app.UseResponseCompression();
        app.UseRouting();
        app.UseAuthorization();
        app.UseStaticFiles();
        app.UseDefaultFiles();
        app.Use(async (context, next) =>
        {
            context.Response.Headers.Append("X-Accel-Buffering", "no");
            await next();
        });
        app.MapControllers();
        app.UseHealthChecks("/health", new HealthCheckOptions { ResponseWriter = HealthCheck.WriteResponse });
        app.MapFallbackToFile("/index.html");
    }
}
