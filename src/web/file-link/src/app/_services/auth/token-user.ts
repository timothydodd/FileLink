export class TokenUser {
  groupId!: string;
  externalAuthId: string | null = null;
  appUserId!: string;
  email: string | null = null;
  name!: string;
  avatarUrl: string | null = null;
  role!: string;
  scope: string[] | null = null;
}
