// This file will be dynamically generated at runtime
// It provides runtime environment configuration for the Angular app

(function (window) {
  // Default values (used if environment variables are not provided)
  var defaultConfig = {
    apiUrl: window.location.origin,
    auth: {
      clientId: 'filelink',
      audience: 'https://www.filelink.com',
      useLocalStorage: true,
    },
    // Add other default settings as needed
  };

  // Expose the configuration to the application
  window.APP_CONFIG = defaultConfig;
})(window);
