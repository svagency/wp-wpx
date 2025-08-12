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
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="p-4 bg-red-50 text-red-700 rounded">
                    <p>Failed to load content from ${url}</p>
                    <button onclick="loadHTML('${url}', '${elementId}')" class="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 rounded">
                        Retry
                    </button>
                </div>`;
        }
        return false;
    }
}

// Initialize the application
async function initializeApp() {
    try {
        console.log('Starting application initialization...');
        
        // Load header
        const headerLoaded = await loadHTML('header.html', 'header-container');

        if (headerLoaded) {
            console.log('Header loaded successfully');
            
            // Now load the main application script
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'app/script.js';
                script.onload = () => {
                    console.log('Main application script loaded');
                    
                    // Check if the main app initialization function exists
                    if (typeof window.initializeApp === 'function') {
                        try {
                            // The popover will be initialized when needed via script.js
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
            throw new Error('Failed to load header');
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
