// Import dependencies
import { ApiService } from './services/api.js';
import { FeedView } from './views/feedView.js';

// Main application
class App {
    constructor() {
        this.feedView = null;
        this.isLoading = false;
        this.currentPage = 1;
        this.hasMore = true;
        this.currentType = 'posts';
        this.activeCategory = 'all';
        this.activeTag = 'all';
        this.searchQuery = '';
    }

    updateState(newState) {
        Object.assign(this, newState);
        console.log('State updated:', {
            isLoading: this.isLoading,
            currentPage: this.currentPage,
            hasMore: this.hasMore,
            currentType: this.currentType,
            activeCategory: this.activeCategory,
            activeTag: this.activeTag,
            searchQuery: this.searchQuery
        });
    }

    getState() {
        return {
            isLoading: this.isLoading,
            currentPage: this.currentPage,
            hasMore: this.hasMore,
            currentType: this.currentType,
            activeCategory: this.activeCategory,
            activeTag: this.activeTag,
            searchQuery: this.searchQuery
        };
    }

    async init() {
        console.log('Initializing application...');
        
        try {
            // Initialize views
            this.feedView = new FeedView();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial content
            await this.loadInitialContent();
            
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showError('Failed to initialize application');
        }
    }

    async loadInitialContent() {
        try {
            console.log('Loading initial content...');
            
            // Reset state
            this.updateState({
                currentPage: 1,
                hasMore: true,
                isLoading: true,
                currentType: 'posts',
                activeCategory: 'all',
                activeTag: 'all',
                searchQuery: ''
            });
            
            if (this.feedView) {
                this.feedView.showLoading();
                this.feedView.clearError();
            }
            
            // Load post types first
            const postTypes = await ApiService.fetchPostTypes();
            console.log('Loaded post types:', postTypes);
            
            // Then load initial posts
            await this.loadContent('posts');
            
        } catch (error) {
            console.error('Error loading initial content:', error);
            this.showError(`Failed to load content: ${error.message}`);
            
            // Show error in the feed view if available
            if (this.feedView) {
                this.feedView.showError('Failed to load content. Please try again later.');
            }
        } finally {
            this.updateState({ isLoading: false });
            
            // Hide loading indicator
            if (this.feedView) {
                this.feedView.hideLoading();
            }
        }
    }

    async loadContent(type, reset = true) {
        if (this.isLoading) {
            console.log('Content load already in progress');
            return;
        }

        try {
            this.updateState({ 
                isLoading: true,
                currentType: type
            });

            const params = {
                page: reset ? 1 : this.currentPage,
                per_page: 10,
                _embed: true
            };

            if (this.searchQuery) {
                params.search = this.searchQuery;
            }

            if (this.activeCategory && this.activeCategory !== 'all') {
                params.categories = this.activeCategory;
            }

            if (this.activeTag && this.activeTag !== 'all') {
                params.tags = this.activeTag;
            }

            console.log('Fetching content with params:', params);
            const items = await ApiService.fetchPosts(type, params);

            if (this.feedView) {
                if (reset) {
                    this.feedView.render(items);
                } else {
                    this.feedView.appendItems(items);
                }
            }

            // Update pagination state
            this.updateState({
                currentPage: reset ? 2 : this.currentPage + 1,
                hasMore: items.length >= 10,
                isLoading: false
            });

            return items;
        } catch (error) {
            console.error('Error loading content:', error);
            this.showError(error.message || 'Failed to load content');
            throw error;
        } finally {
            this.updateState({ isLoading: false });
        }
    }

    showError(message) {
        console.error('Error:', message);
        if (this.feedView) {
            this.feedView.showError(message);
        } else {
            // Fallback error display
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message p-4 bg-red-100 text-red-700 rounded fixed bottom-4 right-4 z-50';
            errorDiv.textContent = message;
            document.body.appendChild(errorDiv);

            // Remove after 5 seconds
            setTimeout(() => {
                if (document.body.contains(errorDiv)) {
                    document.body.removeChild(errorDiv);
                }
            }, 5000);
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Handle window resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (this.popover && this.popover.isOpen()) {
                    this.popover.reposition();
                }
            }, 250);
        });

        // Handle infinite scroll
        let scrollTimer;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                if (this.isLoading || !this.hasMore) return;

                const scrollPosition = window.innerHeight + window.scrollY;
                const pageHeight = document.documentElement.offsetHeight;
                const threshold = 300; // pixels from bottom

                if (scrollPosition > pageHeight - threshold) {
                    this.loadContent(this.currentType, false);
                }
            }, 200);
        });

        console.log('Event listeners set up');
    }
}

// Create and export singleton instance
export const app = new App();

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, initializing app...');
    
    // Make app globally available for debugging
    window.app = app;
    
    // Initialize the app
    app.init();
});
