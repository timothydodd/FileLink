using System.ComponentModel.DataAnnotations;
using FileLink.Common.Jwt;
using FileLink.Repos;
using FileLink.Services;
using LogMkApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

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
    public AuthController(
        UserResolverService userResolverService,
        AuthLinkGenerator authLinkGenerator,
        JwtService jwtService,
        AppUserRepo appUserRepo,
        PasswordService passwordService,
        LinkCodeRepo linkCodeRepo,
        ILogger<AuthController> logger,
        AuthSettings authSettings)
    {
        _userResolverService = userResolverService;
        _authLinkGenerator = authLinkGenerator;
        _jwtService = jwtService;
        _appUserRepo = appUserRepo;
        _passwordService = passwordService;
        _linkCodeRepo = linkCodeRepo;
        _logger = logger;
        _authSettings = authSettings;
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

        lc.LastAccess = DateTime.UtcNow;

        if (lc.MaxUses.HasValue && lc.Uses >= lc.MaxUses)
        {
            _linkCodeRepo.Delete(lc);
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
        _linkCodeRepo.Update(lc);
        var accessTokenExpiry = TimeSpan.FromMinutes(_authSettings.AccessTokenExpiryInMinutes);
        var token = await _jwtService.AuthToken("Unknown", lc.GroupId, lc.AppUserId,
        lc.Role, accessTokenExpiry);
        var refreshToken = await _jwtService.GenerateRefreshToken(lc.AppUserId);

        return Ok(new LoginResponse(token, refreshToken, (long)accessTokenExpiry.TotalSeconds));



    }
    [AllowAnonymous]
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

        return Ok(new ShareLinkResponse(code.Code, DateTime.SpecifyKind(code.Expiration, DateTimeKind.Utc)));
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
            return new LinkList(x.GroupId, x.Code, DateTime.SpecifyKind(x.ExpireDate, DateTimeKind.Utc), x.Uses, x.MaxUses, lastAccess, x.ItemCount);
        }));
    }

}

public record LinkList(Guid GroupId,
    string Code, DateTime expirationDate, int? uses, int? maxUses, DateTime? lastAccess, int ItemCount);
public record GetCodeRequest(string Code);
public record ShareLinkResponse(string Code, DateTime expirationDate);
public record LoginRequest(string Code);
public record LoginResponse(string Token, string RefreshToken, long ExpiresIn);
public class AdminLoginRequest
{
    public required string UserName { get; set; }
    public required string Password { get; set; }
}
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
