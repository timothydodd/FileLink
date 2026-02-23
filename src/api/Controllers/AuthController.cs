using System.ComponentModel.DataAnnotations;
using FileLink.Common.Jwt;
using FileLink.Repos;
using FileLink.Services;
using LogMkApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using static FileLink.Constants;

namespace FileLink.Controllers;
[Route("api/auth")]
[ApiController]

public class AuthController : Controller
{
    private readonly ILogger<AuthController> _logger;
    readonly UserResolverService _userResolverService;
    readonly AuthLinkGenerator _authLinkGenerator;
    readonly AppUserRepo _appUserRepo;
    private readonly JwtService _jwtService;
    readonly PasswordService _passwordService;
    readonly LinkCodeRepo _linkCodeRepo;
    private readonly AuthSettings _authSettings;
    private readonly AuditLogService _auditLogService;
    public AuthController(
        UserResolverService userResolverService,
        AuthLinkGenerator authLinkGenerator,
        JwtService jwtService,
        AppUserRepo appUserRepo,
        PasswordService passwordService,
        LinkCodeRepo linkCodeRepo,
        ILogger<AuthController> logger,
        AuthSettings authSettings,
        AuditLogService auditLogService)
    {
        _userResolverService = userResolverService;
        _authLinkGenerator = authLinkGenerator;
        _jwtService = jwtService;
        _appUserRepo = appUserRepo;
        _passwordService = passwordService;
        _linkCodeRepo = linkCodeRepo;
        _logger = logger;
        _authSettings = authSettings;
        _auditLogService = auditLogService;
    }
    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] TokenRefreshRequest request)
    {
        try
        {
            var (accessToken, refreshToken, expiresIn) = await _jwtService.RefreshToken(
                request.ExpiredAccessToken,
                request.RefreshToken);

            return Ok(new
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresIn = expiresIn
            });
        }
        catch (SecurityTokenException ex)
        {
            return Unauthorized(new { Message = ex.Message });
        }
    }

    [Authorize]
    [HttpPost("revoke")]
    public async Task<IActionResult> Revoke([FromBody] TokenRevokeRequest request)
    {
        await _jwtService.RevokeRefreshToken(request.RefreshToken);
        return NoContent();
    }
    [Authorize(Policy = Constants.AuthPolicy.RequireOwner)]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var user = await _appUserRepo.Get(_userResolverService.GetAppUserId());
        if (user == null)
        {
            return NotFound("User not found.");
        }
        if (!_passwordService.VerifyPassword(user, request.OldPassword))
        {
            return Unauthorized("Invalid password.");
        }
        user.PasswordHash = _passwordService.HashPassword(user, request.NewPassword);
        await _appUserRepo.UpdatePassword(user.AppUserId, user.PasswordHash);
        return Ok();
    }
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest loginRequest)
    {
        var code = loginRequest.Code;

        var lc = await _authLinkGenerator.GetLinkCodeByCode(code);
        if (lc == null)
        {
            _logger.LogError("Code not found: {Code}", code);
            return BadRequest("Invalid Code");
        }
        _logger.LogInformation("User Logged In group: {GroupId} userId: {AppUserId}", lc.GroupId, lc.AppUserId);
        if (lc.ExpireDate < DateTime.UtcNow)
        {
            _logger.LogError("Code expired: {Code}", code);
            return BadRequest("Code expired");
        }

        // Password verification
        if (!string.IsNullOrEmpty(lc.PasswordHash))
        {
            if (string.IsNullOrEmpty(loginRequest.Password))
            {
                return Ok(new LoginPasswordRequiredResponse(true));
            }
            if (!_passwordService.VerifyLinkPassword(loginRequest.Password, lc.PasswordHash))
            {
                return Unauthorized("Invalid password");
            }
        }

        lc.LastAccess = DateTime.UtcNow;

        if (lc.MaxUses.HasValue && lc.Uses >= lc.MaxUses)
        {
            await _linkCodeRepo.DeleteAsync(lc);
            _logger.LogInformation("Code used max times, Code deleted: {Code}", code);
            return BadRequest("Code used max times");
        }
        if (lc.Uses != null)
        {
            lc.Uses++;
        }
        else
        {
            lc.Uses = 1;
        }
        await _linkCodeRepo.UpdateAsync(lc);
        var accessTokenExpiry = TimeSpan.FromMinutes(_authSettings.AccessTokenExpiryInMinutes);
        var token = await _jwtService.AuthToken("Unknown", lc.GroupId, lc.AppUserId,
        lc.Role, accessTokenExpiry);
        var refreshToken = await _jwtService.GenerateRefreshToken(lc.AppUserId);

        _ = _auditLogService.LogAsync(AuditActions.LinkLogin, lc.AppUserId, lc.GroupId, detail: $"Code: {code}");

        return Ok(new LoginResponse(token, refreshToken, (long)accessTokenExpiry.TotalSeconds));
    }
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("admin/login")]
    public async Task<IActionResult> AdminLoginRequest(AdminLoginRequest request)
    {

        var user = await _appUserRepo.GetByUserName(request.UserName);

        if (user == null || !_passwordService.VerifyPassword(user, request.Password))
        {
            return Unauthorized("Invalid email or password.");
        }
        var accessTokenExpiry = TimeSpan.FromMinutes(_authSettings.AccessTokenExpiryInMinutes);
        var token = await _jwtService.AuthToken(user.UserName, null, user.AppUserId,
        Constants.AuthRoleTypes.Owner, accessTokenExpiry);
        var refreshToken = await _jwtService.GenerateRefreshToken(user.AppUserId);

        _ = _auditLogService.LogAsync(AuditActions.AdminLogin, user.AppUserId, detail: $"User: {user.UserName}");

        return Ok(new LoginResponse(token, refreshToken, (long)accessTokenExpiry.TotalSeconds));
    }
    [Authorize]
    [HttpGet("code")]
    public async Task<IActionResult> GetCode()
    {
        var code = await _authLinkGenerator.GetCode(_userResolverService.GetGroupId(), _userResolverService.GetAppUserId(), 20, new TimeSpan(15, 0, 0, 0));

        if (code == null)
        {
            return BadRequest("Code not found.");
        }
        return Ok(new GetCodeRequest(code));
    }
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    [HttpGet("group/{groupId}/link")]
    public async Task<IActionResult> ShareLink([FromRoute] Guid groupId, [FromQuery] bool? reRoll, int? hoursValid)
    {
        if (reRoll == null)
        {
            reRoll = false;
        }
        if (hoursValid == null)
        {
            hoursValid = 15 * 24;
        }
        var code = await _authLinkGenerator.GetShareLink(groupId, new TimeSpan(0, hoursValid.Value, 0, 0), reRoll.Value);
        if (code == null)
        {
            return BadRequest("Code not found.");
        }

        _ = _auditLogService.LogAsync(AuditActions.LinkCreated, _userResolverService.GetAppUserId(), groupId, detail: $"Code: {code.Code}");

        return Ok(new ShareLinkResponse(code.Code, DateTime.SpecifyKind(code.Expiration, DateTimeKind.Utc), code.HasPassword, code.BandwidthLimitKBps));
    }
    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    [HttpPost("group/{groupId}/link/password")]
    public async Task<IActionResult> SetLinkPassword([FromRoute] Guid groupId, [FromBody] SetLinkPasswordRequest request)
    {
        var codes = await _linkCodeRepo.GetAll(groupId);
        var readerCode = codes?.FirstOrDefault(c => c.Role == Constants.AuthRoleTypes.Reader);
        if (readerCode == null)
        {
            return NotFound("No share link found for this group");
        }

        readerCode.PasswordHash = string.IsNullOrEmpty(request.Password)
            ? null
            : _passwordService.HashLinkPassword(request.Password);

        await _linkCodeRepo.UpdateAsync(readerCode);
        return Ok();
    }

    [Authorize(Policy = Constants.AuthPolicy.RequireEditorRole)]
    [HttpPost("group/{groupId}/link/settings")]
    public async Task<IActionResult> UpdateLinkSettings([FromRoute] Guid groupId, [FromBody] UpdateLinkSettingsRequest request)
    {
        var codes = await _linkCodeRepo.GetAll(groupId);
        var readerCode = codes?.FirstOrDefault(c => c.Role == Constants.AuthRoleTypes.Reader);
        if (readerCode == null)
        {
            return NotFound("No share link found for this group");
        }

        if (request.HoursValid.HasValue && request.HoursValid.Value > 0)
        {
            readerCode.ExpireDate = DateTime.UtcNow.Add(new TimeSpan(0, request.HoursValid.Value, 0, 0));
        }

        if (request.PasswordEnabled.HasValue)
        {
            if (request.PasswordEnabled.Value)
            {
                if (!string.IsNullOrEmpty(request.Password))
                {
                    readerCode.PasswordHash = _passwordService.HashLinkPassword(request.Password);
                }
            }
            else
            {
                readerCode.PasswordHash = null;
            }
        }

        if (request.BandwidthLimitKBps.HasValue)
        {
            readerCode.BandwidthLimitKBps = request.BandwidthLimitKBps.Value > 0 ? request.BandwidthLimitKBps.Value : null;
        }

        await _linkCodeRepo.UpdateAsync(readerCode);
        return Ok(new ShareLinkResponse(readerCode.Code, DateTime.SpecifyKind(readerCode.ExpireDate, DateTimeKind.Utc), !string.IsNullOrEmpty(readerCode.PasswordHash), readerCode.BandwidthLimitKBps));
    }
    [Authorize(Policy = Constants.AuthPolicy.RequireOwner)]
    [HttpGet("links")]
    public async Task<IActionResult> GetLinks()
    {
        var links = await _linkCodeRepo.GetAll();
        if (links == null)
        {
            return BadRequest("Code not found.");
        }
        return Ok(links.Select(x =>
        {
            DateTime? lastAccess = x.LastAccess == null ? null : DateTime.SpecifyKind(x.LastAccess.Value, DateTimeKind.Utc);
            return new LinkList(x.GroupId, x.Code, DateTime.SpecifyKind(x.ExpireDate, DateTimeKind.Utc), x.Uses, x.MaxUses, lastAccess, x.ItemCount, !string.IsNullOrEmpty(x.PasswordHash));
        }));
    }

    [Authorize(Policy = Constants.AuthPolicy.RequireOwner)]
    [HttpPost("links/delete")]
    public async Task<IActionResult> BulkDeleteLinks([FromBody] BulkLinkCodesRequest request)
    {
        if (request.Codes == null || request.Codes.Count == 0)
            return BadRequest("No codes provided.");
        await _linkCodeRepo.DeleteByCodes(request.Codes);
        return NoContent();
    }

    [Authorize(Policy = Constants.AuthPolicy.RequireOwner)]
    [HttpPost("links/expire")]
    public async Task<IActionResult> BulkExpireLinks([FromBody] BulkLinkCodesRequest request)
    {
        if (request.Codes == null || request.Codes.Count == 0)
            return BadRequest("No codes provided.");
        await _linkCodeRepo.ExpireByCodes(request.Codes);
        return NoContent();
    }

}

public record LinkList(Guid GroupId,
    string Code, DateTime expirationDate, int? uses, int? maxUses, DateTime? lastAccess, int ItemCount, bool HasPassword);
public record GetCodeRequest(string Code);
public record ShareLinkResponse(string Code, DateTime expirationDate, bool HasPassword, int? BandwidthLimitKBps = null);
public record LoginRequest(string Code, string? Password = null);
public record LoginPasswordRequiredResponse(bool PasswordRequired);
public record SetLinkPasswordRequest(string? Password);
public record LoginResponse(string Token, string RefreshToken, long ExpiresIn);
public class AdminLoginRequest
{
    public required string UserName { get; set; }
    public required string Password { get; set; }
}
public record BulkLinkCodesRequest(List<string> Codes);
public record UpdateLinkSettingsRequest(int? HoursValid, bool? PasswordEnabled, string? Password, int? BandwidthLimitKBps);
public record ChangePasswordRequest
{
    public required string OldPassword { get; set; }
    public required string NewPassword { get; set; }
}
public class TokenRefreshRequest
{
    [Required]
    public required string ExpiredAccessToken { get; set; }

    [Required]
    public required string RefreshToken { get; set; }
}

public class TokenRevokeRequest
{
    [Required]
    public required string RefreshToken { get; set; }
}
