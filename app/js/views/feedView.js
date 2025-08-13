// Feed view implementation
class FeedView extends BaseView {
    constructor() {
        super('content-feed'); // Match the ID in index.html
        this.init();
    }

    init() {
        console.log('Initializing FeedView');
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.error(`Container with ID '${this.containerId}' not found`);
            return;
        }
        
        // Initialize with empty state
        this.items = [];
        this.isLoading = false;
        
        // Create loading indicator
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'loading-indicator hidden';
        this.loadingIndicator.innerHTML = `
            <div class="flex justify-center items-center py-8">
                <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        `;
        this.container.appendChild(this.loadingIndicator);
        
        // Create error message container
        this.errorContainer = document.createElement('div');
        this.errorContainer.className = 'error-message hidden p-4 mb-4 text-red-700 bg-red-100 rounded';
        this.container.appendChild(this.errorContainer);
    }
    
    showLoading() {
        this.isLoading = true;
        this.loadingIndicator.classList.remove('hidden');
    }
    
    hideLoading() {
        this.isLoading = false;
        this.loadingIndicator.classList.add('hidden');
    }
    
    showError(message) {
        this.errorContainer.textContent = message || 'An error occurred while loading content.';
        this.errorContainer.classList.remove('hidden');
        this.hideLoading();
    }
    
    clearError() {
        this.errorContainer.textContent = '';
        this.errorContainer.classList.add('hidden');
    }

    render(items) {
        if (!this.container) {
            console.error('Container not found for FeedView');
            return;
        }
        
        console.log('Rendering items:', items);
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            this.showMessage('No items found');
            return;
        }
        
        // Store items for potential future use
        this.items = items;
        
        // Clear existing content
        this.clear();
        
        // Add items to the container
        items.forEach(item => {
            const itemElement = this.createItemElement(item);
            if (itemElement) {
                this.container.appendChild(itemElement);
            }
        });
        
        // Setup event listeners
        this.setupEventListeners();
    }

    appendItems(items) {
        if (!this.container || !items || !Array.isArray(items) || items.length === 0) {
            console.log('No items to append or container not found');
            return;
        }
        
        console.log(`Appending ${items.length} items`);
        
        // Add new items to our stored items
        this.items = [...(this.items || []), ...items];
        
        // Create and append new items
        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const itemElement = this.createItemElement(item);
            if (itemElement) {
                fragment.appendChild(itemElement);
            }
        });
        
        this.container.appendChild(fragment);
        this.setupEventListeners();
    }

    createItemElement(item) {
        if (!item || !item.title) {
            console.warn('Invalid item data:', item);
            return null;
        }
        
        const div = document.createElement('div');
        div.className = 'feed-item p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer mb-4';
        
        // Safely get title and excerpt
        const title = item.title.rendered || item.title || 'No Title';
        let excerpt = '';
        
        if (item.excerpt && item.excerpt.rendered) {
            excerpt = item.excerpt.rendered;
        } else if (item.excerpt) {
            excerpt = item.excerpt;
        } else if (item.content && item.content.rendered) {
            // Use first 100 chars of content as fallback
            excerpt = item.content.rendered.substring(0, 100) + '...';
        }
        
        // Create a safe string representation of the item for the popover
        const safeItem = this.escapeHtml(JSON.stringify(item));
        
        // Format date if available
        let dateHtml = '';
        if (item.date) {
            const date = new Date(item.date);
            dateHtml = `
                <div class="text-sm text-gray-500 mt-1">
                    ${date.toLocaleDateString()}
                </div>
            `;
        }
        
        // Add featured image if available
        let imageHtml = '';
        if (item._embedded && item._embedded['wp:featuredmedia'] && item._embedded['wp:featuredmedia'][0]) {
            const media = item._embedded['wp:featuredmedia'][0];
            const imageUrl = media.source_url || 'https://via.placeholder.com/800x400?text=No+Image';
            const altText = media.alt_text || title;
            
            imageHtml = `
                <div class="mb-3">
                    <img src="${imageUrl}" 
                         alt="${this.escapeHtml(altText)}" 
                         class="w-full h-48 object-cover rounded">
                </div>
            `;
        }
        
        // Set the HTML content
        div.innerHTML = `
            ${imageHtml}
            <h3 class="text-lg font-medium text-gray-900">${this.escapeHtml(title)}</h3>
            ${dateHtml}
            <div class="text-gray-600 mt-2">${excerpt}</div>
        `;
        
        // Add click handler
        div.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (window.Popover && typeof window.Popover.open === 'function') {
                window.Popover.open(item, e);
            } else {
                console.error('Popover not available');
                // Fallback: Navigate to the post link if available
                if (item.link) {
                    window.location.href = item.link;
                }
            }
        });
        
        return div;
    }
    
    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    setupEventListeners() {
        // Event delegation is handled by individual item elements
        console.log('FeedView event listeners set up');
    }

    showLoading() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="text-center py-8">
                <div class="loading mx-auto"></div>
                <p class="mt-2 text-gray-600">Loading content...</p>
            </div>
        `;
    }

    showError(message) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="text-center py-8">
                <div class="text-red-600 mb-4">
                    <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    <p class="mt-2">${message || 'An error occurred while loading content.'}</p>
                </div>
                <button onclick="window.App.loadContent('posts')" 
                        class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                    Retry
                </button>
            </div>
        `;
    }

    showMessage(message) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="text-center py-8 text-gray-600">
                <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="mt-2">${message || 'No content available.'}</p>
            </div>
        `;
    }

    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Export for use in other modules
window.FeedView = FeedView;
