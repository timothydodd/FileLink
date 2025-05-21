(function (window) {
    var appConfig = {
        apiUrl: '${API_URL}',
        auth: {
            clientId: '${Auth__ClientId}',
            audience: '${Auth__Audience}',
            useLocalStorage: ${Auth_Use_Local_Storage},
        },
        // Add other environment-controlled settings as needed
    };
    window.APP_CONFIG = appConfig;
})(window);
