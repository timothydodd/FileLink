namespace FileLink.Common.HealthCheck;

using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Diagnostics.HealthChecks;

public class SqliteHealthCheck : IHealthCheck
{
    private readonly string _connectionString;
    private readonly string _table;
    public SqliteHealthCheck(string connectionString, string table)
    {
        _connectionString = connectionString;
        _table = table;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);
            using var command = connection.CreateCommand();
            command.CommandText = $"SELECT * FROM {_table} limit 1";
            await command.ExecuteScalarAsync(cancellationToken);

            stopwatch.Stop();

            var data = new Dictionary<string, object>
            {
                ["responseTimeMs"] = stopwatch.ElapsedMilliseconds,
                ["responseTimeTicks"] = stopwatch.ElapsedTicks,
                ["timestamp"] = DateTime.UtcNow
            };

            return HealthCheckResult.Healthy("SQLite is available.", data);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();

            var data = new Dictionary<string, object>
            {
                ["responseTimeMs"] = stopwatch.ElapsedMilliseconds,
                ["responseTimeTicks"] = stopwatch.ElapsedTicks,
                ["timestamp"] = DateTime.UtcNow,
                ["error"] = ex.Message
            };

            return HealthCheckResult.Unhealthy("SQLite is unavailable.", ex, data);
        }
    }

}
public static class SqliteHealthCheckExtensions
{
    public static IHealthChecksBuilder AddSqliteCheck(this IHealthChecksBuilder builder, string name, string connectionString)
    {
        return builder.AddCheck(name, new SqliteHealthCheck(connectionString, "AppUser")).AddCheck<SystemMetricsHealthCheck>("system-metrics");
    }
}
