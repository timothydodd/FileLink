using System.Data;
using System.Globalization;
using ServiceStack.OrmLite.Dapper;

namespace FileLink.Common;

public class DateTimeHandler : SqlMapper.TypeHandler<DateTime>
{
    public override void SetValue(IDbDataParameter parameter, DateTime value)
    {
        if (value is DateTime dt)
        {
            // Store in ISO 8601 format with full precision and 'Z' to indicate UTC (optional)
            parameter.Value = $"'{dt.ToString("yyyy-MM-ddTHH:mm:ss.fffffff", CultureInfo.InvariantCulture)}'";
            return;
        }
        parameter.Value = value;
    }

    public override DateTime Parse(object value)
    {

        if (value is string str)
        {
            return DateTime.Parse(str, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);
        }
        return DateTime.SpecifyKind((DateTime)value, DateTimeKind.Utc);
    }
}
