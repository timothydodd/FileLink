# Base runtime image
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
USER app
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

# Stage for building .NET and Angular projects
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release

# Setup work dir and copy csproj/Angular project files early for cache
WORKDIR /src
COPY ["api/FileLink.csproj", "api/"]
COPY ["web/file-link/file-link.esproj", "web/file-link/"]

# Restore .NET packages early to cache
RUN dotnet restore "api/FileLink.csproj"

# Install Node.js and Angular CLI — do this BEFORE copying full project to leverage cache
RUN apt-get update && apt-get install -y curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g @angular/cli@18

# Cache node_modules: copy just Angular package files first
COPY web/file-link/package*.json web/file-link/
WORKDIR /src/web/file-link
RUN npm install --force

# Now bring in the rest of the source
COPY . /src

WORKDIR /src


# Back to .NET build
WORKDIR /src/api

RUN dotnet build "FileLink.csproj" -c $BUILD_CONFIGURATION -o /app/build

# Publish stage
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "FileLink.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# Final runtime image
FROM base AS final
USER root
WORKDIR /app
COPY --from=publish /app/publish .


# Create directories with proper permissions
RUN mkdir -p /app/wwwroot /app/data/db && \
    chown -R app:app /app/wwwroot /app/data /app/data/db

# Copy and fix the script
RUN chmod +x /app/generate-env-config.sh && \
    chown app:app /app/generate-env-config.sh


# Environment variables with default values
# ENV API_URL="https://na.robododd.com"
# ENV Auth__ClientId="https://na.robododd.com."
# ENV Auth__Audience="default-audience"
# ENV Auth_Use_Local_Storage="true"

USER app
# Run the script to generate env config before starting the application
ENTRYPOINT ["/bin/bash", "/app/generate-env-config.sh"]
