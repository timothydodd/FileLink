using System.Data;
using ServiceStack.OrmLite.Dapper;

public class SqliteGuidConverter : SqlMapper.TypeHandler<Guid>
{
    public override void SetValue(IDbDataParameter parameter, Guid value)
    {
        parameter.DbType = DbType.String;
        parameter.Value = value.ToString();
    }

    public override Guid Parse(object value)
    {
        var str = value?.ToString();

        if (str == null || string.IsNullOrWhiteSpace(str))
            return Guid.Empty;

        return Guid.Parse(str);
    }
}
