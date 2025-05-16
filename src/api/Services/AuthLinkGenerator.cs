
using FileLink.Common.Security;
using FileLink.Repos;
namespace FileLink.Services;

public class AuthLinkGenerator
{
    private readonly LinkCodeRepo _linkCodeRepo;
    private readonly JwtService _jwtService;
    public AuthLinkGenerator(JwtService jwtService, LinkCodeRepo linkCodeRepo)
    {

        _jwtService = jwtService;
        _linkCodeRepo = linkCodeRepo;
    }

    public async Task<LinkCode> GetLinkCode(Guid groupId, Guid appUserId)
    {
        return await _linkCodeRepo.Get(groupId, appUserId);
    }
    public async Task<LinkCode> GetLinkCodeByCode(string code)
    {
        return await _linkCodeRepo.GetByCode(code);
    }
    public async Task<string> GetCode(Guid groupId,
                                        Guid appUserId,
                                       int length,
                                       TimeSpan expiration,
                                       bool upperCaseOnly = false)
    {
        LinkCode linkCode = await _linkCodeRepo.Get(groupId, appUserId);
        return linkCode == null
            ? throw new Exception("Link code not found.")
            : linkCode.ExpireDate.Subtract(new TimeSpan(3, 0, 0, 0)) > DateTime.UtcNow
            ? linkCode.Code
            : (await GenerateCode(groupId, appUserId, linkCode.Role, length, expiration, upperCaseOnly)).Code;

    }
    public async Task<LinkCode> GenerateCode(Guid groupId,
                                       Guid appUserId,
                                       string role,
                                       int length,
                                       TimeSpan expiration,
                                       bool upperCaseOnly = false)
    {
        DateTime expire = DateTime.UtcNow.Add(expiration);
        string code;
        if (length < 6)
        {
            throw new Exception("Code must be atleast 6 digits.");
        }


        code = PassGenerator.GetCode(length, upperCaseOnly);

        var hash = _jwtService.GetCodeHash(code);
        var linkCode = new LinkCode()
        {
            Code = code,
            GroupId = groupId,
            Role = role,
            AppUserId = appUserId,
            ExpireDate = expire
        };

        await _linkCodeRepo.Create(linkCode);
        return linkCode;
    }

    internal async Task<ShareCode> GetShareLink(Guid groupId, TimeSpan expiration, bool reroll = false)
    {
        if (reroll)
        {
            await _linkCodeRepo.DeleteShared(groupId);
        }
        else
        {
            var codes = await _linkCodeRepo.GetAll(groupId);
            if (codes != null)
            {


                foreach (var code in codes)
                {

                    if (code.Role == Constants.AuthRoleTypes.Reader)
                    {
                        return new ShareCode(code.Code, code.GroupId, code.AppUserId, code.ExpireDate);
                    }
                }
            }
        }
        var c = await GenerateCode(groupId, Guid.NewGuid(), Constants.AuthRoleTypes.Reader, 32, expiration, true);
        return new ShareCode(c.Code, c.GroupId, c.AppUserId, c.ExpireDate);
    }
}
public record ShareCode(string Code, Guid GroupId, Guid AppUserId, DateTime Expiration);
