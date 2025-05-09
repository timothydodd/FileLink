namespace FileLink.Common.HealthCheck;

using System.Data.SQLite; // or Microsoft.Data.Sqlite if you're using that
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

public class SqliteHealthCheck : IHealthCheck
{
    private readonly string _connectionString;

    public SqliteHealthCheck(string connectionString)
    {
        _connectionString = connectionString;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var connection = new SQLiteConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT 1";
            await command.ExecuteScalarAsync(cancellationToken);

            return HealthCheckResult.Healthy("SQLite is available.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("SQLite is unavailable.", ex);
        }
    }

}
public static class SqliteHealthCheckExtensions
{
    public static IHealthChecksBuilder AddSqliteCheck(this IHealthChecksBuilder builder, string name, string connectionString)
    {
        return builder.AddCheck(name, new SqliteHealthCheck(connectionString));
    }
}
