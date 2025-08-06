export class Constants {
  static EmptyGuid = '00000000-0000-0000-0000-000000000000';

  static UserPrefKeys = {
    saveKey: 'settings-preferences',
    authCacheLocation: 'authCacheLocation',
    showWelcome: (userId: string) => `showWelcome-${userId}`,
  };
}
