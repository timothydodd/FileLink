using System.Diagnostics.CodeAnalysis;
using System.Security.Claims;
using FileLink.Common.Jwt;
using ServiceStack;

namespace FileLink.Services;

public class UserResolverService
{
    private readonly IssuerConfiguration _issuers;
    private readonly ICurrentPrincipalAccessor _principalAccessor;

    public UserResolverService(IssuerConfiguration issuers, ICurrentPrincipalAccessor principalAccessor)
    {
        _issuers = issuers;
        _principalAccessor = principalAccessor;
    }


    public string GetAuthId()
    {
        ClaimsIdentity claimsIdentity = GetClaimsIdentity();
        var nameClaim = claimsIdentity?.FindFirst(Find)?.Value;
        return nameClaim;
    }
    private bool Find(Claim x)
    {
        return x.Type == Constants.Claims.AuthId && _issuers.IsValidAuthority(x.Issuer);
    }

    public string GetAuthRole()
    {
        ClaimsIdentity claimsIdentity = GetClaimsIdentity();
        var role = claimsIdentity
                   .FindFirst(x => x.Type == claimsIdentity.RoleClaimType &&
                                   _issuers.IsValidAuthority(x.Issuer))
                   .Value;
        return string.IsNullOrWhiteSpace(role) ? throw new Exception("Invalid AuthRole") : role;
    }

    public ClaimsIdentity GetClaimsIdentity()
    {
        ClaimsPrincipal principal = _principalAccessor.Principal;
        return principal.Identity is not ClaimsIdentity claimsIdentity ? throw new UnauthorizedAccessException("Invalid user claim") : claimsIdentity;
    }

    public string GetCustomClaim(string claimType)
    {
        var claim = GetClaimsIdentity()
                    .FindFirst(x => x.Type == claimType && _issuers.IsValidAuthority(x.Issuer))
                    .Value;
        return claim;
    }

    public IEnumerable<string>? GetPermissions()
    {
        ClaimsIdentity claimsIdentity = GetClaimsIdentity();
        if (claimsIdentity.HasClaim(c => c.Type == "permissions"))
        {
            // Split the scopes string into an array
            IEnumerable<Claim> permissions =
                claimsIdentity.FindAll(c => c.Type == "permissions" &&
                                            _issuers.IsValidAuthority(c.Issuer));


            return permissions.Select(x => x.Value);
        }

        return null;
    }

    public Guid GetAppUserId()
    {
        ClaimsIdentity claimsIdentity = GetClaimsIdentity();
        var personId = claimsIdentity
                       .FindFirst(c => c.Type == Constants.CustomClaims.AppUserId &&
                                       _issuers.IsValidAuthority(c.Issuer))
                       .Value;
        var id = Guid.Parse(personId);
        return id == Guid.Empty ? throw new Exception("Invalid PersonId Claim") : id;
    }

    public Guid GetGroupId()
    {

        ClaimsIdentity claimsIdentity = GetClaimsIdentity();
        var documentId = claimsIdentity
                       .FindFirst(c => c.Type == Constants.CustomClaims.GroupId &&
                                       _issuers.IsValidAuthority(c.Issuer))
                       .Value;
        return Guid.Parse(documentId);
    }

    public string GetName()
    {
        ClaimsIdentity claimsIdentity = GetClaimsIdentity();
        var name = claimsIdentity
                      .FindFirst(c => c.Type == JwtClaimTypes.Name &&
                                      _issuers.IsValidAuthority(c.Issuer))
                      .Value;

        return name ?? throw new Exception("Invalid Name Claim");
    }

    public bool HasIdentity()
    {
        ClaimsPrincipal principal = _principalAccessor.Principal;

        return principal != null
            && principal.Identity is ClaimsIdentity claimsIdentity && claimsIdentity.IsAuthenticated;
    }

    public bool HasPermission(string requirement)
    {
        ClaimsIdentity claimsIdentity = GetClaimsIdentity();
        if (claimsIdentity.HasClaim(c => c.Type == "permissions"))
        {
            // Split the scopes string into an array
            IEnumerable<Claim> permissions =
                claimsIdentity.FindAll(c => c.Type == "permissions" &&
                                            _issuers.IsValidAuthority(c.Issuer));

            // Succeed if the scope array contains the required scope
            if (permissions.Any(s => s.Value == requirement))
            {
                return true;
            }
        }

        return false;
    }
}


public class IssuerConfiguration
{
    public IssuerConfiguration(IEnumerable<string> issuers)
    {
        ValidAuthorities = [.. issuers.Select(x => x.TrimEnd('/'))];
    }

    public List<string> ValidAuthorities { get; }

    public bool IsValidAuthority(string authority)
    {
        var a = authority.Trim('/');

        return ValidAuthorities.Contains(a);
    }
}
public interface ICurrentPrincipalAccessor
{
    ClaimsPrincipal Principal { get; }

    IDisposable Change(ClaimsPrincipal principal);
}

public class HttpContextCurrentPrincipalAccessor : ThreadCurrentPrincipalAccessor
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpContextCurrentPrincipalAccessor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    protected override ClaimsPrincipal GetClaimsPrincipal()
    {
        return _httpContextAccessor.HttpContext?.User ?? base.GetClaimsPrincipal();
    }
}
public class ThreadCurrentPrincipalAccessor : CurrentPrincipalAccessorBase, ISingletonDependency
{
    protected override ClaimsPrincipal? GetClaimsPrincipal()
    {
        return Thread.CurrentPrincipal as ClaimsPrincipal;
    }
}

public abstract class CurrentPrincipalAccessorBase : ICurrentPrincipalAccessor
{
    public ClaimsPrincipal Principal => _currentPrincipal.Value ?? GetClaimsPrincipal();

    private readonly AsyncLocal<ClaimsPrincipal> _currentPrincipal = new();

    protected abstract ClaimsPrincipal GetClaimsPrincipal();

    public virtual IDisposable Change(ClaimsPrincipal principal)
    {
        return SetCurrent(principal);
    }

    private IDisposable SetCurrent(ClaimsPrincipal principal)
    {
        ClaimsPrincipal parent = Principal;
        _currentPrincipal.Value = principal;
        return new DisposeAction(() =>
        {
            _currentPrincipal.Value = parent;
        });
    }
}
public class DisposeAction : IDisposable
{
    private readonly Action _action;

    /// <summary>
    /// Creates a new <see cref="DisposeAction"/> object.
    /// </summary>
    /// <param name="action">Action to be executed when this object is disposed.</param>
    public DisposeAction([NotNull] Action action)
    {
        action.ThrowIfNull(nameof(action));

        _action = action;
    }

    public void Dispose()
    {
        _action();
    }
}

public interface ISingletonDependency
{

}
