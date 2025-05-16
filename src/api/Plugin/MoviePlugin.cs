using System.Text.Json;
using System.Text.RegularExpressions;
using FileLink.Repos;

namespace FileLink.Plugin;

public class MoviePlugin : IFilePlugin
{
    public readonly OmdbClient _omdbClient;
    public readonly ILogger<MoviePlugin> _logger;
    public readonly UploadItemRepo _uploadItemRepo;

    readonly Dictionary<string, string> _seriesPostersCache = new Dictionary<string, string>();
    readonly string _webRootPath;
    readonly string _postersPath;
    public MoviePlugin(OmdbClient omdbClient, ILogger<MoviePlugin> logger, UploadItemRepo uploadItemRepo, IWebHostEnvironment env)
    {
        _omdbClient = omdbClient;
        _logger = logger;
        _uploadItemRepo = uploadItemRepo;
        _webRootPath = env.WebRootPath;
        _postersPath = Path.Combine(_webRootPath, "posters");
    }

    public HashSet<string> FileExtensions => new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".webm", ".m4v", ".3gp", ".mpg", ".mpeg", ".m2v", ".vob", ".m2ts", ".mts", ".divx", ".xvid" };
    public async Task Process(UploadItem item)
    {
        var filename = Path.GetFileNameWithoutExtension(item.FileName);
        var (seriesName, season, episode) = ExtractSeasonAndEpisodeTitle(filename);
        if (seriesName != null && season != null && episode != null)
        {
            var omdbItem = await _omdbClient.GetTvShowEpisodes(seriesName, season, episode);
            if (omdbItem == null)
                return;
            omdbItem.Series = seriesName;

            var metadata = await UpdateTvShow(omdbItem);
            if (metadata == null)
                return;

            // Implement your series processing logic here
            if (_seriesPostersCache.ContainsKey(seriesName))
            {
                metadata.SeriesPoster = _seriesPostersCache[seriesName];
            }
            else
            {
                var series = await _omdbClient.GetSeries(seriesName);
                if (series != null)
                {
                    metadata.SeriesPoster = await GetSeriesPoster(series);
                    if (metadata.SeriesPoster != null)
                        _seriesPostersCache.Add(seriesName, metadata.SeriesPoster);
                }
            }

            item.Metadata = JsonSerializer.Serialize(metadata);
            await _uploadItemRepo.UpdateAsync(item);
            return;
        }
        var (year, title) = ExtractYear(filename);
        if (year != null && title != null)
        {
            var omdbItem = await _omdbClient.GetMovie(title, year);
            if (omdbItem == null)
                return;
            var metadata = await UpdateMovie(omdbItem);
            item.Metadata = JsonSerializer.Serialize(metadata);
            await _uploadItemRepo.UpdateAsync(item);
        }
        // Implement your movie processing logic here

    }

    public async Task<string?> GetSeriesPoster(OmdbMovie? metaData)

    {
        if (metaData == null || metaData.Title == null)
        {
            return null;
        }


        // try downloading the poster into local wwwroot
        if (metaData.Poster != null && metaData.Poster.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        {
            var directory = _postersPath;
            if (!Directory.Exists(directory))
                Directory.CreateDirectory(directory);

            var name = removeSpecialCharacters(metaData.Title);
            var posterPath = Path.Combine(directory, $"{name}-s.jpg");
            var urlPath = $"posters/{name}-s.jpg";
            if (File.Exists(posterPath))
                return urlPath;
            try
            {
                using var fileStream = System.IO.File.Create(posterPath);
                await _omdbClient.GetPoster(metaData.Poster, fileStream);
                return urlPath;


            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error downloading poster for {metaData.Title}");
            }
        }
        return null;
    }
    public async Task<Metadata?> UpdateMovie(OmdbMovie? metaData)

    {
        if (metaData == null || metaData.Title == null)
        {
            return null;
        }
        var file = new Metadata();
        file.Title = metaData.Title;
        file.MediaType = "movie";
        //  file.Directors = ConvertComaSeparatedToJsonArray(metaData.Director);
        file.Genre = ConvertComaSeparatedToJsonArray(metaData.Genre);
        //  file.Plot = metaData.Plot;
        // file.Rated = metaData.Rated;
        //  file.Runtime = metaData.Runtime;
        // file.Writers = ConvertComaSeparatedToJsonArray(metaData.Writer);
        // file.Actors = ConvertComaSeparatedToJsonArray(metaData.Actors);
        // file.Country = metaData.Country;
        //  file.Language = metaData.Language;
        // file.ReleaseDate = TryParseDateTime(metaData.Released);
        file.Year = metaData.Year != null ? int.Parse(metaData.Year) : (int?)null;
        file.Poster = metaData.Poster;
        file.MetaDataDate = DateTime.UtcNow;
        file.ImdbRating = TryParseDecimal(metaData.ImdbRating);
        file.ImdbId = metaData.ImdbID;

        // try downloading the poster into local wwwroot
        if (metaData.Poster != null && metaData.Poster.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        {
            var directory = _postersPath;
            if (!Directory.Exists(directory))
                Directory.CreateDirectory(directory);

            var name = getPosterName(file);
            var posterPath = Path.Combine(directory, $"{name}.jpg");

            try
            {
                if (!Path.Exists(posterPath))
                {
                    using var fileStream = System.IO.File.Create(posterPath);
                    await _omdbClient.GetPoster(metaData.Poster, fileStream);
                }
                file.Poster = $"posters/{name}.jpg";


            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error downloading poster for {file}");
            }
        }
        return file;
    }
    public async Task<Metadata?> UpdateTvShow(OmdbMovie? metaData)

    {
        if (metaData == null || metaData.Title == null)
        {
            return null;
        }
        var file = new Metadata();
        file.Title = metaData.Title;
        file.MediaType = "series";
        // file.Directors = ConvertComaSeparatedToJsonArray(metaData.Director);
        file.Genre = ConvertComaSeparatedToJsonArray(metaData.Genre);
        // file.Plot = metaData.Plot;
        // file.Rated = metaData.Rated;
        //file.Runtime = metaData.Runtime;
        // file.Writers = ConvertComaSeparatedToJsonArray(metaData.Writer);
        // file.Actors = ConvertComaSeparatedToJsonArray(metaData.Actors);
        // file.Country = metaData.Country;
        //  file.Language = metaData.Language;
        //  file.ReleaseDate = TryParseDateTime(metaData.Released);
        file.Year = metaData.Year != null ? int.Parse(metaData.Year) : (int?)null;
        file.Poster = metaData.Poster;
        file.SeriesName = metaData.Series;
        file.Episode = TryParseInt(metaData.Episode);
        file.Season = TryParseInt(metaData.Season);
        file.MetaDataDate = DateTime.UtcNow;
        file.ImdbRating = TryParseDecimal(metaData.ImdbRating);
        file.ImdbId = metaData.ImdbID;

        // try downloading the poster into local wwwroot
        if (metaData.Poster != null && metaData.Poster.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        {
            var directory = _postersPath;
            if (!Directory.Exists(directory))
                Directory.CreateDirectory(directory);

            var name = getPosterName(file);
            var posterPath = Path.Combine(directory, $"{name}.jpg");

            try
            {
                if (!Path.Exists(posterPath))
                {
                    using var fileStream = System.IO.File.Create(posterPath);
                    await _omdbClient.GetPoster(metaData.Poster, fileStream);
                }
                file.Poster = $"posters/{name}.jpg";


            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error downloading poster for {file.Title}");
            }
        }
        return file;
    }
    private (int?, string) ExtractYear(string fileName)
    {

        int? year = null;
        var match = Regex.Match(fileName, @"\((\d{4})\)");
        var title = fileName;
        if (match.Success)
        {
            title = fileName.Replace(match.Value, "").Trim();
            year = int.Parse(match.Groups[1].Value);
        }
        return (year, title);

    }
    private (string, string, string) ExtractSeasonAndEpisodeTitle(string filename)
    {

        // Define the regular expression pattern to match the series name, season, and episode
        string pattern = @"^(.*?)(?:\s\([^)]+\))?\s-\sS(\d{2})[eE](\d{2})\s-.*";


        // Create a regex object
        Regex regex = new Regex(pattern, RegexOptions.Compiled);

        // Perform the match
        Match match = regex.Match(filename);

        if (match.Success)
        {
            string seriesName = match.Groups[1].Value.Trim();
            string season = match.Groups[2].Value;
            string episode = match.Groups[3].Value;

            Console.WriteLine($"Series: {seriesName}");
            Console.WriteLine($"Season: {season}");
            Console.WriteLine($"Episode: {episode}");
            return (seriesName, season, episode);
        }
        else
        {
            Console.WriteLine("No match found.");
            return (null, null, null);
        }
    }
    private string? ConvertComaSeparatedToJsonArray(string? s)
    {
        if (string.IsNullOrWhiteSpace(s))
            return null;
        return JsonSerializer.Serialize(s.Split(',').Select(x => x.Trim()).ToArray());
    }
    public decimal? TryParseDecimal(string? v)
    {
        decimal? o = null;
        if (string.IsNullOrWhiteSpace(v))
        {
            return o;
        }
        if (decimal.TryParse(v, out decimal result))
        {
            o = result;
        }
        return o;
    }
    public DateTime? TryParseDateTime(string? v)
    {

        if (string.IsNullOrWhiteSpace(v))
            return null;
        if (DateTime.TryParse(v, out DateTime result))
            return result;

        return null;
    }
    public int? TryParseInt(string? v)
    {
        int? o = null;
        if (string.IsNullOrWhiteSpace(v))
        {
            return o;
        }
        if (int.TryParse(v, out int result))
        {
            o = result;
        }
        return o;
    }
    private string removeSpecialCharacters(string s)
    {
        return Regex.Replace(s, "[^a-zA-Z0-9_.]+", "", RegexOptions.Compiled);
    }
    private string getPosterName(Metadata d)
    {
        if (d.SeriesName != null)
        {
            return $"{removeSpecialCharacters(d.SeriesName)}-S{d.Season}E{d.Episode}";
        }

        return $"{removeSpecialCharacters(d.Title)}-{d.Year}";

    }
}





public interface IFilePlugin
{
    HashSet<string> FileExtensions { get; }
    public Task Process(UploadItem item);
}
public static class FilePluginExtensions
{
    public static bool HasFileType(this IFilePlugin item, string ext)
    {
        if (!ext.StartsWith("."))
        {
            ext = "." + ext;
        }
        return item.FileExtensions.Contains(ext);
    }
}


public class Metadata
{
    public string? Title { get; set; }
    public int? Year { get; set; }
    public decimal? ImdbRating { get; set; }
    public string? ImdbId { get; set; }
    public string? Genre { get; set; }
    public string? MediaType { get; set; }
    public string? SeriesName { get; set; }
    public int? Season { get; set; }
    public int? Episode { get; set; }
    public string? SeriesPoster { get; set; }
    public string? Poster { get; set; }
    public DateTime? MetaDataDate { get; set; }
}
