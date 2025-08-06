// Function to load HTML content into an element
async function loadHTML(url, elementId) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status}`);
        }
        const html = await response.text();
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = html;
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error loading ${url}:`, error);
        return false;
    }
}

// Initialize the application
async function initializeApp() {
    try {
        console.log('Starting application initialization...');
        
        // Load header and popover first
        const [headerLoaded, popoverLoaded] = await Promise.all([
            loadHTML('header.html', 'header-container'),
            loadHTML('popover.html', 'popoverOverlay')
        ]);

        if (headerLoaded && popoverLoaded) {
            console.log('UI components loaded successfully');
            
            // Now load the main application script
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'app/script.js';
                script.onload = () => {
                    console.log('Main application script loaded');
                    
                    // Check if the main app initialization function exists
                    if (typeof window.initializeApp === 'function') {
                        try {
                            window.initializeApp();
                            resolve();
                        } catch (error) {
                            console.error('Error during app initialization:', error);
                            reject(error);
                        }
                    } else {
                        const error = new Error('Main app initialization function not found');
                        console.error(error);
                        reject(error);
                    }
                };
                
                script.onerror = (error) => {
                    console.error('Failed to load main application script:', error);
                    reject(error);
                };
                
                document.body.appendChild(script);
            });
        } else {
            throw new Error('Failed to load one or more UI components');
        }
    } catch (error) {
        console.error('Error in initializeApp:', error);
        throw error;
    }
}

// Start the application when the DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
