using System.Text.Json;


namespace FileLink.Plugin;

public class OmdbClient
{
    private readonly HttpClient _client;
    private readonly OmdbSettings _omdbSettings;

    public OmdbClient(HttpClient client, OmdbSettings omdbSettings)
    {
        _client = client;
        _omdbSettings = omdbSettings;
    }
    public async Task<OmdbMovie?> GetMovie(string title, int? year)
    {
        //encode title
        title = System.Net.WebUtility.UrlEncode(title);

        var url = $"{_omdbSettings.BaseUrl}?apikey={_omdbSettings.ApiKey}&t={title}";
        if (year.HasValue && year > 0)
        {
            url += $"&y={year}";
        }
        var response = await _client.GetAsync(url);
        try
        {
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<OmdbMovie>(content);
        }
        catch (Exception)
        {


        }
        return null;
    }
    public async Task<OmdbMovie?> GetSeries(string title)
    {
        //encode title
        title = System.Net.WebUtility.UrlEncode(title);

        var url = $"{_omdbSettings.BaseUrl}?apikey={_omdbSettings.ApiKey}&t={title}&type=series";

        var response = await _client.GetAsync(url);
        try
        {
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<OmdbMovie>(content);
        }
        catch (Exception)
        {


        }
        return null;
    }
    public async Task<OmdbMovie?> GetTvShowEpisodes(string seriesName, string season, string episode)
    {
        //encode title
        seriesName = System.Net.WebUtility.UrlEncode(seriesName);

        var url = $"{_omdbSettings.BaseUrl}?apikey={_omdbSettings.ApiKey}&t={seriesName}&type=episode&season={season}&episode={episode}";

        var response = await _client.GetAsync(url);
        try
        {
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<OmdbMovie>(content);
        }
        catch (Exception)
        {


        }
        return null;
    }
    public async Task<OmdbMovie[]?> SearchMovie(string title, int? year)
    {
        title = System.Net.WebUtility.UrlEncode(title.Trim());

        var url = $"{_omdbSettings.BaseUrl}?apikey={_omdbSettings.ApiKey}&s={title}&type=movie";
        if (year.HasValue && year > 0)
        {
            url += $"&y={year}";
        }
        var response = await _client.GetAsync(url);
        try
        {
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();

            var r = JsonSerializer.Deserialize<SearchResult>(content);
            if (r != null && r.Search?.Count > 0)
            {
                return r.Search.ToArray();
            }

        }
        catch (Exception)
        {


        }
        return null;
    }

    public async Task GetPoster(string url, Stream output)
    {
        await (await _client.GetStreamAsync(url)).CopyToAsync(output);
    }
}
public class SearchResult
{
    public List<OmdbMovie>? Search { get; set; }
}
public class OmdbSeries
{
    public string? Title
    {
        get; set;
    }
    public required string Season { get; set; }
    public required List<OmdbMovie> Episodes { get; set; }
}
public class OmdbMovie
{
    public string? Title { get; set; }
    public string? Year { get; set; }
    public string? Rated { get; set; }
    public string? Released { get; set; }
    public string? Runtime { get; set; }
    public string? Genre { get; set; }
    public string? Director { get; set; }
    public string? Writer { get; set; }
    public string? Actors { get; set; }
    public string? Plot { get; set; }
    public string? Language { get; set; }
    public string? Country { get; set; }
    public string? Awards { get; set; }
    public string? Poster { get; set; }
    public string? Metascore { get; set; }
    public string? ImdbRating { get; set; }
    public string? ImdbVotes { get; set; }
    public string? ImdbID { get; set; }
    public string? Type { get; set; }
    public string? DVD { get; set; }
    public string? BoxOffice { get; set; }
    public string? Production { get; set; }
    public string? Website { get; set; }
    public string? Response { get; set; }
    public string? Season { get; set; }
    public string? Episode { get; set; }
    public string? Series { get; set; }
}
public class Rating
{
    public required string Source { get; set; }
    public required string Value { get; set; }
}

public class OmdbSettings
{
    public required string ApiKey { get; set; }
    public required string BaseUrl { get; set; }
}
