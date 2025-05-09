using Microsoft.AspNetCore.Authorization;

namespace FileLink.Common;

public static class AuthorizationPolicies
{
    public static void AddDefaultPolicies(this AuthorizationOptions options)
    {
        options.AddPolicy(Constants.AuthPolicy.RequireEditorRole,
            policy => policy.RequireRole(Constants.AuthRoleTypes.Owner, Constants.AuthRoleTypes.Editor));
        options.AddPolicy(Constants.AuthPolicy.RequireOwner,
            policy => policy.RequireRole(Constants.AuthRoleTypes.Owner));
        options.AddPolicy(Constants.AuthPolicy.AnyRole,
            policy => policy.RequireRole(Constants.AuthRoleTypes.Owner, Constants.AuthRoleTypes.Editor, Constants.AuthRoleTypes.Reader));

        var defaultPolicy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .RequireRole(Constants.AuthRoleTypes.Reader, Constants.AuthRoleTypes.Owner, Constants.AuthRoleTypes.Editor)
            .Build();
        options.DefaultPolicy = defaultPolicy;
    }
}
