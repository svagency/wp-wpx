// Core configuration
const Config = {
    api: {
        // Try to get from WordPress, otherwise use the current origin
        baseUrl: window.wpApiSettings?.root || `${window.location.origin}/wp-json/`,
        nonce: window.wpApiSettings?.nonce || 'standalone-nonce',
        endpoints: {
            posts: 'wp/v2/posts',
            pages: 'wp/v2/pages',
            media: 'wp/v2/media',
            categories: 'wp/v2/categories',
            tags: 'wp/v2/tags',
            types: 'wp/v2/types',
            // Add any custom endpoints here
            custom: 'wp/v2/custom'
        }
    },
    settings: {
        itemsPerPage: 10, // Reduced for testing
        defaultView: 'feed',
        availableViews: ['feed', 'grid', 'carousel']
    },
    
    // Helper to update config from settings
    updateFromSettings(settings) {
        if (settings.wpApiBase) {
            this.api.baseUrl = settings.wpApiBase.endsWith('/') ? settings.wpApiBase : `${settings.wpApiBase}/`;
        }
        
        if (settings.itemsPerPage) {
            this.settings.itemsPerPage = parseInt(settings.itemsPerPage, 10) || 10;
        }
        
        console.log('Config updated:', this);
    }
};

// Initialize with settings from the HTML if available
document.addEventListener('DOMContentLoaded', () => {
    try {
        const settingsElement = document.getElementById('appSettings');
        if (settingsElement) {
            const settings = JSON.parse(settingsElement.textContent);
            Config.updateFromSettings(settings);
        }
    } catch (error) {
        console.error('Error parsing app settings:', error);
    }
});

window.Config = Config;
