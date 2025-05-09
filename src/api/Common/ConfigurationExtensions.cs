using ServiceStack;

namespace FileLink.Common;
public static class ConfigurationExtensions
{
    public static T GetRequiredValue<T>(this IConfiguration configuration, string key)
    {
        T? value = configuration.GetValue<T>(key);
        value.ThrowIfNull($"Configuration value '{key}' is required but was not found.");
        return value;
    }
    public static T GetRequiredConfigurationSection<T>(this IConfiguration configuration, string key) where T : new()
    {
        IConfigurationSection section = configuration.GetSection(key);
        if (!section.Exists())
        {
            throw new InvalidOperationException($"Configuration section '{key}' is required but was not found.");
        }

        T result = section.Get<T>();
        return result == null ? throw new InvalidOperationException($"Configuration section '{key}' is not properly configured.") : result;
    }
}
