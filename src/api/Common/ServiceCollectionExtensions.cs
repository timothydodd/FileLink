using System.IO.Compression;
using System.Security.Cryptography;
using FileLink.Common;
using FileLink.Common.HealthCheck;
using FileLink.Common.Jwt;
using FileLink.Plugin;
using FileLink.Repos;
using FileLink.Services;
using LogMkApi.Services;
using LogSummaryService;
using Microsoft.AspNetCore.ResponseCompression;
using ServiceStack.Data;
using ServiceStack.OrmLite;
using ServiceStack.OrmLite.Dapper;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddDatabase(this IServiceCollection services, IConfiguration config, ILogger logger)
    {
        var isSqlite = string.Equals(config["DatabaseType"], "sqlite", StringComparison.InvariantCultureIgnoreCase);
        var storageSettings = config.GetRequiredSection("StorageSettings").Get<StorageSettings>()!;
        string connectionString;

        if (isSqlite)
        {

            var dbPath = Path.Combine(StorageSettings.ResolvePath(storageSettings.DatabaseFilesPath), "FileLink.db");


            logger.LogInformation("Using SQLite database at {dbPath}", dbPath);


            Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);
            connectionString = $"Data Source={dbPath};Version=3;Pooling=true;Max Pool Size=20;BinaryGUID=False";

            SqlMapper.AddTypeHandler(typeof(Guid), new SqliteGuidConverter());
            SqlMapper.AddTypeHandler(typeof(Guid?), new SqliteGuidConverter());
            SqlMapper.AddTypeHandler(typeof(DateTime), new DateTimeHandler());
            SqlMapper.AddTypeHandler(typeof(DateTime?), new DateTimeHandler());

            services.AddHealthChecks().AddSqliteCheck(name: "sqlite", connectionString);
            services.AddSingleton<IDbConnectionFactory>(new OrmLiteConnectionFactory(connectionString, SqliteDialect.Provider));
        }
        else
        {
            connectionString = config.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("Missing MySQL connection string");
            services.AddHealthChecks().AddMySql(connectionString);
            services.AddSingleton<IDbConnectionFactory>(new OrmLiteConnectionFactory(connectionString, MySqlDialect.Provider));
        }

        services.AddSingleton(storageSettings);
        return services;
    }

    public static IServiceCollection AddJwtAuth(this IServiceCollection services, IConfiguration config, IWebHostEnvironment env, ILogger logger)
    {
        var jwtAuth = config.GetRequiredConfigurationSection<AuthSettings>("Auth");
        if (string.IsNullOrEmpty(jwtAuth.SecurityKey))
        {
            logger.LogInformation("No JWT key found, generating a new one.");
            var storageSettings = config.GetRequiredSection("StorageSettings").Get<StorageSettings>()!;
            var keyPath = Path.Combine(StorageSettings.ResolvePath(storageSettings.DatabaseFilesPath), "jwtkey.txt");
            // Check a fallback file first
            logger.LogInformation("Using JWT key file at {keyPath}", keyPath);
            if (File.Exists(keyPath))
            {
                jwtAuth.SecurityKey = File.ReadAllText(keyPath);
            }
            else
            {
                // Generate a 256-bit key (32 bytes)
                var key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
                jwtAuth.SecurityKey = key;
                File.WriteAllText(keyPath, key); // Persist for next time
            }
        }
        services.AddSingleton(jwtAuth);
        services.AddScoped<JwtService>();
        services.AddScoped<AuthLinkGenerator>();
        services.AddSingleton(new IssuerConfiguration(new[] { jwtAuth.Issuer! }));
        services.AddSingleton<ICurrentPrincipalAccessor, HttpContextCurrentPrincipalAccessor>();
        services.AddAuthentication(opts =>
        {
            opts.DefaultAuthenticateScheme = "LLJwtAuth";
            opts.DefaultChallengeScheme = "LLJwtAuth";
        }).UseFileLinkJwtAuth(jwtAuth, env.IsDevelopment());


        return services;
    }
    public static IServiceCollection AddCorsPolicy(this IServiceCollection services, IConfiguration config, ILogger logger)
    {
        var origins = config.GetValue<string>("AllowedOrigins")?.Split(',');
        services.AddCors(options =>
        {
            options.AddPolicy("Origins", policy =>
            {
                if (origins is not null)
                {
                    logger.LogInformation("CORS policy set to allow origins: {origins}", string.Join(", ", origins));
                    policy.WithOrigins(origins)
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .SetIsOriginAllowed(_ => true)
                          .AllowCredentials();
                }
                else
                {
                    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
                }
            });
        });
        return services;
    }
    public static IServiceCollection AddBackgroundServices(this IServiceCollection services)
    {
        services.AddSingleton<BackgroundTaskQueue>();
        services.AddSingleton<QueueTester>();

        services.AddHostedService<PollingBackgroundService>();
        services.AddHostedService<FileCleanUpBackgroundService>();
        return services;
    }
    public static IServiceCollection AddCompressionAndCaching(this IServiceCollection services)
    {
        services.AddRequestDecompression();
        services.AddResponseCaching();
        services.AddResponseCompression(options =>
        {
            options.Providers.Add<BrotliCompressionProvider>();
            options.Providers.Add<GzipCompressionProvider>();
            options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
            {
            "application/json"
        });
        });
        services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);

        services.Configure<BrotliCompressionProviderOptions>(options => options.Level = CompressionLevel.Optimal);

        return services;
    }
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<UserResolverService>();
        services.AddSingleton<DatabaseInitializer>();
        services.AddSingleton<PreSignUrlService>();
        services.AddSingleton<UploadItemRepo>();
        services.AddSingleton<UploadGroupRepo>();
        services.AddSingleton<RefreshTokenRepo>();
        services.AddSingleton<AppUserRepo>();
        services.AddSingleton<LinkCodeRepo>();
        services.AddSingleton<PasswordService>();
        services.AddSingleton<LocalFileCache>();
        services.AddSingleton<UploadService>();
        services.AddLogging(logging =>
        {
            logging.AddSimpleConsole(c =>
            {
                c.SingleLine = true;
                c.IncludeScopes = false;
                c.TimestampFormat = "HH:mm:ss ";
            });
        });
        services.AddSignalR();
        return services;

    }
    public static IServiceCollection AddOmdbPlugin(this IServiceCollection services, IConfiguration config, ILogger logger)
    {
        var omdbSettings = config.GetSection("OmdbSettings").Get<OmdbSettings>();
        if (omdbSettings is not null && !string.IsNullOrEmpty(omdbSettings.ApiKey))
        {
            logger.LogInformation("OMDB settings found, registering OMDB plugin.");
            services.AddSingleton(b => omdbSettings);
            services.AddHttpClient<OmdbClient>();
            services.AddSingleton<IFilePlugin, MoviePlugin>();
        }
        else
        {
            logger.LogWarning("No OMDB settings found, skipping OMDB plugin registration.");
        }
        return services;
    }

}
