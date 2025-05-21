export const environment = {
  production: true,
  cache: {
    logging: false,
  },
  apiUrl: window.location.origin,
  auth: {
    clientId: 'filelink',
    audience: 'https://www.filelink.com',
    useLocalStorage: true,
  },
};
