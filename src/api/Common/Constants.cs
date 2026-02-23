using System.Collections.ObjectModel;

namespace FileLink;

public static class Constants
{
    public static class AuthRoleTypes
    {

        public const string Owner = "Owner";
        public const string Editor = "Editor";
        public const string Reader = "Reader";


        public const string System = "System";


        public static readonly ReadOnlyCollection<string> RolesList =
            new(new[]{
            Owner,
            Editor,
            Reader
        });


        public const string Roles =
            Owner + "," +
            Editor + "," +
            Reader;

    }
    public static class Claims
    {
        public const string AuthId = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";
    }

    public static class CustomClaims
    {

        public const string GroupId = "https://filelink.com/group_id";
        public const string AppUserId = "https://filelink.com/app_user_id";
        public const string Scope = "https://filelink.com/scope";
        public const string AvatarId = "https://filelink.com/avatar_id";
    }

    public static class AuthScopes
    {
        public const string Editor = "editor";
        public const string Owner = "owner";
        public const string Reader = "reader";

    }
    public static class AuthPolicy
    {
        public const string RequireOwner = "RequireOwner";
        public const string RequireEditorRole = "RequireEditorRole";
        public const string AnyRole = "AnyRole";
    }
    public static class AuditActions
    {
        public const string FileDownload = "FileDownload";
        public const string LinkLogin = "LinkLogin";
        public const string AdminLogin = "AdminLogin";
        public const string GroupCreated = "GroupCreated";
        public const string GroupDeleted = "GroupDeleted";
        public const string LinkCreated = "LinkCreated";
        public const string FileUploaded = "FileUploaded";
    }
    public static class SystemGuids
    {
        public static Guid SystemUserId = Guid.Parse("122C665D-B146-4BDD-B73A-61D70996B101");
    }
}
