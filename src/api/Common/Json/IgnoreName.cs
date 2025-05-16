using System.Collections;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FileLink.Common.Json;
public class IgnorePropertyByNameConverter<T> : JsonConverter<T>
{
    private readonly string _propertyNameToIgnore;

    public IgnorePropertyByNameConverter(string propertyNameToIgnore)
    {
        _propertyNameToIgnore = propertyNameToIgnore;
    }
    public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        throw new NotImplementedException("Deserialization is not supported.");
    }

    public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options)
    {
        Type type = typeof(T);
        bool isEnumerable = typeof(IEnumerable).IsAssignableFrom(type) && type != typeof(string);



        if (isEnumerable)
        {
            IEnumerable enumerable = (IEnumerable)value;
            writer.WriteStartArray();

            foreach (var item in enumerable)
            {
                WriteObject(writer, item, options);
            }

            writer.WriteEndArray();
        }
        else
        {

            WriteObject(writer, value, options);


        }

    }

    private void WriteObject(Utf8JsonWriter writer, object value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        PropertyInfo[] properties = value.GetType().GetProperties(BindingFlags.Instance | BindingFlags.Public);
        foreach (PropertyInfo property in properties)
        {
            if (property.Name != _propertyNameToIgnore && property.CanRead)
            {
                var propertyValue = property.GetValue(value);
                writer.WritePropertyName(property.Name);
                JsonSerializer.Serialize(writer, propertyValue, options);
            }
        }
        writer.WriteEndObject();
    }
}
