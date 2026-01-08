namespace tunerate_api;

public class Auth0TokenSettings
{
    public string client_id { get; set; }
    public string client_secret { get; set; }
    public string audience { get; set; }
    public string grant_type { get; set; }
    public string? scope { get; set; }
}