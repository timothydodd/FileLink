#!/bin/sh

echo "Injecting environment variables into compiled JS files..."

# Set default dir if not provided
JS_DIR=${1:-/app/wwwroot}

# Define key-value pairs of placeholders and their env variable names
placeholders="api_url API_URL
domain DOMAIN"

for line in $placeholders; do
    key=$(echo $line | cut -d' ' -f1)
    var=$(echo $line | cut -d' ' -f2)
    value=$(printenv $var)

    if [ -z "$value" ]; then
        echo "Warning: $var not set, skipping..."
        continue
    fi

    echo "Replacing #sf#{$key}#sf# with $value"

    # Escape characters for sed (slashes, ampersands)
    escaped_value=$(printf '%s' "$value" | sed 's/[&/\]/\\&/g')

    # Find all .js files and do in-place substitution
    find "$JS_DIR" -type f -name '*.js' -exec sed -i "s|#sf#{$key}#sf#|$escaped_value|g" {} +
done

exec dotnet FileLink.dll