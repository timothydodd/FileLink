using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace FileLink.Common.HealthCheck;

public static class HealthCheck
{
    private static readonly JsonSerializerOptions s_serializerOptions = new JsonSerializerOptions
    {
        WriteIndented = true
    };
    public static void AddHealthChecks(IServiceCollection services, string connectionString)
    {
        _ = services.AddHealthChecks()
            .AddMySql(
                connectionString: connectionString,
                name: "MYSQL DB",
                failureStatus: HealthStatus.Degraded,
                tags: new string[] { "db", "sql" }
            );
    }


    public static async Task WriteResponse(HttpContext context,
        HealthReport report)
    {
        context.Response.ContentType = "application/json";
        var response = new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(x => new
            {
                name = x.Key,
                status = x.Value.Status.ToString(),
                description = x.Value.Description,
                data = x.Value.Data
            })
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(response, s_serializerOptions));

    }


}
