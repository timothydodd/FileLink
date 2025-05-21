#!/bin/bash

# This script generates the runtime config js file by replacing environment variables
# for a .NET Angular application that serves static files from wwwroot

# Path to template and output file in the .NET wwwroot directory
TEMPLATE_FILE="/app/env-config.template.js"
OUTPUT_FILE="/app/wwwroot/env-config.js"

echo "Generating environment configuration..."

# Check if template file exists
if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "No template found. Please ensure env-config.js exists in your application."
  exit 1
fi

echo "Using template at $TEMPLATE_FILE"

# Copy template to output
cp "$TEMPLATE_FILE" "$OUTPUT_FILE"

# Replace all environment variables in the template
# List all environment variables you want to replace in the config
ENV_VARS="API_URL Auth__ClientId Auth__Audience Auth_Use_Local_Storage"

# Replace each environment variable in the output file
for env_var in $ENV_VARS; do
  # Get the value of the environment variable
  env_value=${!env_var}
  
  # Only replace if the environment variable is set
  if [ -n "$env_value" ]; then
    echo "Setting $env_var to $env_value"
    # Replace the placeholder with the actual value
    sed -i "s|\${$env_var}|$env_value|g" "$OUTPUT_FILE"
  else
    echo "$env_var not set, replacing with undefined"
    # Replace the placeholder and surrounding quotes with undefined
    sed -i "s|'[[:space:]]*\${$env_var}[[:space:]]*'|undefined|g" "$OUTPUT_FILE"
    sed -i "s|\"[[:space:]]*\${$env_var}[[:space:]]*\"|undefined|g" "$OUTPUT_FILE"
    # If the placeholder is not within quotes, just replace it with undefined
    sed -i "s|\${$env_var}|undefined|g" "$OUTPUT_FILE"
  fi
done

echo "Environment configuration generated at $OUTPUT_FILE"

# Execute the .NET application - hand over control completely
exec dotnet FileLink.dll
