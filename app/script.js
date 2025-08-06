(function() {
    // Global variables scoped to this IIFE
    let currentType = 'posts';
    let currentPage = 1;
    let isLoading = false;
    let hasMore = true;
    let currentItem = null;
    let allItems = [];
    let availablePostTypes = [];
    let allCategories = [];
    let allTags = [];
    let activeCategory = 'all';
    let activeTag = 'all';
    let showFeaturedImages = true; // Default to showing featured images

// Predefined sites configuration
const SITES = {
    current: { 
        id: 'current',
        name: 'Current Site',
        url: '' // Will be set at runtime
    },
    parent: { 
        id: 'parent',
        name: 'Parent Site',
        url: '' // Will be set at runtime
    },
    svagency: { 
        id: 'svagency',
        name: 'SV Agency',
        url: 'https://sv.agency/wp-json/wp/v2'
    },
    maxfx: { 
        id: 'maxfx',
        name: 'MaxFX',
        url: 'https://maxfx.local/wp-json/wp/v2'
    },
    coingeek: { 
        id: 'coingeek',
        name: 'CoinGeek',
        url: 'https://coingeek.com/wp-json/wp/v2'
    }
};

// Load settings from JSON
const settings = JSON.parse(document.getElementById('appSettings').textContent);

// Set current and parent site URLs in the SITES config
SITES.current.url = settings.wpApiBase || 'https://sv.agency/wp-json/wp/v2';
SITES.parent.url = SITES.current.url.replace(/\/wp-json\/wp\/v2$/, '').replace(/\/[^/]+$/, '') + '/wp-json/wp/v2';

// Initialize API base URL
let wpApiBase = SITES.current.url;
let currentSiteId = 'current';

// Initialize UI from settings
function initSettings() {
    // Set up load more toggle
    const loadMoreToggle = document.getElementById('loadMoreToggle');
    if (loadMoreToggle) {
        loadMoreToggle.checked = settings.loadMore !== false; // Default to true if not set
    }
    
    // Set up items per page
    const itemsPerPageInput = document.getElementById('itemsPerPageInput');
    if (itemsPerPageInput) {
        itemsPerPageInput.value = settings.itemsPerPage || 5;
    }
    
    // Set up sort button
    const sortBtn = document.getElementById('sortBtn');
    if (sortBtn) {
        settings.sortDescending = settings.sortDescending !== false; // Default to true if not set
        sortBtn.textContent = `Sort: ${settings.sortDescending ? 'Newest First' : 'Oldest First'}`;
    }
    
    // Set up view mode
    setMainViewMode(settings.mainViewMode || 'feed');
    
    // Set up item size
    setItemSize(settings.itemSize || 'medium');
    
    // Set up featured images toggle
    const featuredImagesToggle = document.getElementById('featuredImagesToggle');
    if (featuredImagesToggle) {
        showFeaturedImages = settings.showFeaturedImages !== false; // Default to true if not set
        featuredImagesToggle.checked = showFeaturedImages;
        featuredImagesToggle.addEventListener('change', function() {
            showFeaturedImages = this.checked;
            settings.showFeaturedImages = showFeaturedImages;
            saveSettings();
            renderMainView();
        });
    }
}

// Set item size
function setItemSize(size) {
    settings.itemSize = size;
    
    // Update button states
    document.querySelectorAll('.size-btn').forEach(btn => {
        const isActive = btn.dataset.size === size;
        btn.classList.toggle('bg-white', isActive);
        btn.classList.toggle('text-gray-700', isActive);
        btn.classList.toggle('shadow-sm', isActive);
        btn.classList.toggle('bg-gray-100', !isActive);
        btn.classList.toggle('text-gray-500', !isActive);
    });
    
    // Add size class to body
    document.body.classList.remove('items-small', 'items-medium', 'items-large');
    document.body.classList.add(`items-${size}`);
    
    // Save settings to localStorage
    saveSettings();
    
    // Re-render current view
    renderMainView();
}

// Initialize intersection observer
const observer = new IntersectionObserver((entries) => {
    // Only auto-load more when in feed or grid view, not carousel
    if (entries[0].isIntersecting && !isLoading && hasMore && settings.loadMore && 
        (settings.mainViewMode === 'feed' || settings.mainViewMode === 'grid')) {
        loadMoreContent();
    }
}, { threshold: 0.1 });

// Fetch available post types
async function fetchPostTypes() {
    try {
        // Use the base API URL without the /wp/v2 part
        // Construct the correct REST API URL for post types
        let baseUrl = wpApiBase;
        
        // If the URL contains /wp-json/, use that as the base
        if (wpApiBase.includes('/wp-json/')) {
            baseUrl = wpApiBase.split('/wp-json/')[0] + '/wp-json';
        } 
        // If it's just the site URL, append /wp-json
        else if (!wpApiBase.endsWith('/wp-json') && !wpApiBase.endsWith('/wp-json/')) {
            baseUrl = wpApiBase.endsWith('/') 
                ? wpApiBase + 'wp-json' 
                : wpApiBase + '/wp-json';
        }
        
        const typesEndpoint = `${baseUrl}/wp/v2/types`;
        console.log('Fetching post types from:', typesEndpoint);
        
        const response = await fetch(typesEndpoint);
        if (!response.ok) {
            console.error('Failed to fetch post types:', response.status, response.statusText);
            throw new Error(`Failed to fetch post types: ${response.status} ${response.statusText}`);
        }
        
        const types = await response.json();
        
        // Define excluded post types (WordPress system types)
        const excludedTypes = [
            'nav_menu_item',
            'wp_template',
            'wp_template_part', 
            'wp_global_styles',
            'wp_navigation',
            'wp_font_family',
            'wp_font_face',
            'blocks',
            'block-types'
        ];
        
        // Get all post types and their REST bases
        const postTypesWithBases = [];
        
        // First, log all available post types for debugging
        console.log('Available post types from API:', types);
        
        // Process each post type
        Object.entries(types).forEach(([type, typeData]) => {
            // Skip excluded system types
            if (excludedTypes.includes(type) || !typeData.rest_base) {
                console.log(`Skipping post type: ${type}`, { 
                    excluded: excludedTypes.includes(type),
                    hasRestBase: !!typeData.rest_base,
                    typeData 
                });
                return;
            }
            
            console.log(`Including post type: ${type}`, { 
                public: typeData.public,
                show_in_rest: typeData.show_in_rest,
                show_ui: typeData.show_ui,
                rest_base: typeData.rest_base
            });
            
            postTypesWithBases.push({
                name: type,
                restBase: typeData.rest_base,
                ...typeData
            });
        });
        
        console.log('Processed post types:', postTypesWithBases);
        
        // Store the mapping for later use
        window.postTypeMapping = {};
        postTypesWithBases.forEach(pt => {
            window.postTypeMapping[pt.name] = pt.restBase;
        });
        
        availablePostTypes = postTypesWithBases.map(pt => pt.name);
        console.log('Available post types:', availablePostTypes);
        renderPostTypesNav();
    } catch (error) {
        console.error('Error fetching post types:', error);
        // Fallback to basic post types
        availablePostTypes = ['posts', 'pages', 'media'];
        window.postTypeMapping = {
            'posts': 'posts',
            'pages': 'pages', 
            'media': 'media'
        };
        renderPostTypesNav();
    }
}

// Render post types navigation
function renderPostTypesNav() {
    const navContainer = document.getElementById('post-types-nav');
    if (!navContainer) return;
    
    const buttons = availablePostTypes.map(type => {
        const isActive = type === currentType;
        const displayName = type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ');
        return `
            <button onclick="resetAndLoadContent('${type}')" 
                    class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive 
                            ? 'bg-blue-500 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                    }">
                ${displayName}
            </button>
        `;
    }).join('');
    
    navContainer.innerHTML = buttons;
}

// Initialize API source dropdown
function initApiSourceDropdown() {
    const select = document.getElementById('apiSourceSelect');
    if (!select) return;
    
    try {
        // Clear existing options
        select.innerHTML = '';
        
        // Add options from SITES object (excluding custom)
        Object.entries(SITES).forEach(([id, site]) => {
            if (site.name && id !== 'custom') {  // Skip custom option
                const option = document.createElement('option');
                option.value = id;
                option.textContent = site.name;
                select.appendChild(option);
            }
        });
        
        // Set the selected value (default to current if invalid)
        if (settings.apiSource && SITES[settings.apiSource] && settings.apiSource !== 'custom') {
            select.value = settings.apiSource;
        } else {
            select.value = 'current';
            settings.apiSource = 'current';
        }
        
        // Add change event listener
        select.addEventListener('change', (e) => {
            const newSource = e.target.value;
            console.log('API source changed to:', newSource);
            setApiSource(newSource);
        });
        
        // Update the API base URL based on the selected source
        updateApiBaseUrl();
    } catch (error) {
        console.error('Error initializing API source dropdown:', error);
    }
}

// Set API source
function setApiSource(source) {
    if (!SITES[source] || source === 'custom') {
        console.error('Invalid API source:', source);
        return;
    }
    
    console.log('Setting API source to:', source);
    settings.apiSource = source;
    saveSettings();
    
    // Show loading state
    const contentContainer = document.getElementById('contentContainer');
    if (contentContainer) {
        contentContainer.innerHTML = '<div class="p-4 text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div><p class="mt-2 text-gray-600">Loading content...</p></div>';
    }
    
    // Reset states
    currentPage = 1;
    hasMore = true;
    currentType = 'posts'; // Reset to default post type
    
    // Update the API base URL
    updateApiBaseUrl();
    
    // Clear any existing timeouts/intervals
    if (window.loadMoreTimeout) {
        clearTimeout(window.loadMoreTimeout);
    }
    
    // Reset the intersection observer
    observer.disconnect();
    
    // Clear existing data
    allItems = [];
    allCategories = [];
    allTags = [];
    activeCategory = 'all';
    activeTag = 'all';
    
    // Clear existing content containers
    const contentFeed = document.getElementById('contentFeed');
    if (contentFeed) contentFeed.innerHTML = '';
    if (contentContainer) contentContainer.innerHTML = '<div id="contentFeed" class="space-y-4"></div>';
    
    // Update UI
    updateItemsCounter(0);
    updateLoadMoreButton();
    
    // Reload post types first
    console.log('Fetching post types for new source...');
    fetchPostTypes()
        .then(() => {
            console.log('Post types loaded:', window.availablePostTypes);
            
            // After post types are loaded, reset and load content with the first available type
            const firstType = window.availablePostTypes && window.availablePostTypes.length > 0 
                ? window.availablePostTypes[0].restBase 
                : 'posts';
                
            console.log('Loading content for type:', firstType);
            return resetAndLoadContent(firstType);
        })
        .catch(error => {
            console.error('Error changing API source:', error);
            if (contentContainer) {
                contentContainer.innerHTML = `<div class="p-4 text-center text-red-600">
                    <p>Error loading content from the selected source.</p>
                    <p class="text-sm text-gray-600">${error.message || 'Unknown error'}</p>
                </div>`;
            }
        });
}

// Update API base URL based on selected source
function updateApiBaseUrl() {
    const site = SITES[settings.apiSource];
    if (site && site.url) {
        wpApiBase = site.url;
        console.log('API Base URL set to:', wpApiBase);
    } else {
        console.error('Invalid API source or missing URL:', settings.apiSource);
        // Fallback to current site if the selected source is invalid
        wpApiBase = SITES.current.url;
    }
}

// Save settings to localStorage
function saveSettings() {
    try {
        // Update settings from UI
        const loadMoreToggle = document.getElementById('loadMoreToggle');
        if (loadMoreToggle) settings.loadMore = loadMoreToggle.checked;
        
        const itemsPerPageInput = document.getElementById('itemsPerPageInput');
        if (itemsPerPageInput) settings.itemsPerPage = parseInt(itemsPerPageInput.value, 10) || 5;
        
        const sortBtn = document.getElementById('sortBtn');
        if (sortBtn) settings.sortDescending = sortBtn.textContent.includes('Newest');
        
        const activeViewBtn = document.querySelector('.main-view-btn.active');
        if (activeViewBtn) settings.mainViewMode = activeViewBtn.dataset.mode || 'feed';
        
        const activeSizeBtn = document.querySelector('.size-btn.active');
        if (activeSizeBtn) settings.itemSize = activeSizeBtn.dataset.size || 'medium';
        
        // Save to localStorage
        localStorage.setItem('wpApiViewerSettings', JSON.stringify(settings));
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Load settings from localStorage
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('wpApiViewerSettings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            // Merge with default settings
            Object.assign(settings, parsed);
            
            // Ensure required settings exist
            if (typeof settings.loadMore === 'undefined') settings.loadMore = true;
            if (!settings.itemsPerPage) settings.itemsPerPage = 5;
            if (typeof settings.sortDescending === 'undefined') settings.sortDescending = true;
            if (!settings.mainViewMode) settings.mainViewMode = 'feed';
            if (!settings.itemSize) settings.itemSize = 'medium';
            if (!settings.apiSource) settings.apiSource = 'current';
            
            return true;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    
    // Default settings
    settings.loadMore = true;
    settings.itemsPerPage = 5;
    settings.sortDescending = true;
    settings.mainViewMode = 'feed';
    settings.itemSize = 'medium';
    settings.apiSource = 'current';
    settings.showFeaturedImages = true;
    
    return false;
}

// Initialize app
function init() {
    // Load settings from localStorage
    loadSettings();
    
    // Initialize API source dropdown
    initApiSourceDropdown();
    
    // Initialize UI from settings
    initSettings();
    
    // Fetch available post types
    fetchPostTypes();
    
    // Set up event listeners
    document.getElementById('settingsBtn').addEventListener('click', () => {
        alert('Settings dialog will be implemented here');
    });
    
    // Initialize the app
    resetAndLoadContent('posts');
    
    // Set up intersection observer for infinite scroll
    observer.observe(document.getElementById('endMarker'));
}

// Update items per page setting
function updateItemsPerPage() {
    const value = parseInt(document.getElementById('itemsPerPageInput').value);
    settings.itemsPerPage = Math.min(Math.max(value, 1), 20);
    document.getElementById('itemsPerPageInput').value = settings.itemsPerPage;
    saveSettings(); // Save settings to localStorage
}

// Toggle load more setting
function toggleLoadMore() {
    settings.loadMore = !settings.loadMore;
    document.querySelector('.toggle-label').classList.toggle('bg-blue-500', settings.loadMore);
    document.querySelector('.toggle-label').classList.toggle('bg-gray-300', !settings.loadMore);
    saveSettings(); // Save settings to localStorage
    updateItemsCounter(); // Reset counter
    updateLoadMoreButton(); // Reset button state
    renderPostTypesNav(); // Update navigation active state
    loadContent();
}

// Reset and load fresh content
function resetAndLoadContent(type) {
    console.log('Resetting and loading content for type:', type);
    
    // Reset state
    currentType = type;
    currentPage = 1;
    hasMore = true;
    allItems = [];
    allCategories = [];
    allTags = [];
    activeCategory = 'all';
    activeTag = 'all';
    
    // Clear content containers
    const contentFeed = document.getElementById('contentFeed');
    const contentContainer = document.getElementById('contentContainer');
    
    if (contentFeed) contentFeed.innerHTML = '';
    if (contentContainer) contentContainer.innerHTML = '<div id="contentFeed" class="space-y-4"></div>';
    
    // Reset UI elements
    updateItemsCounter(0);
    updateLoadMoreButton();
    
    // Reinitialize the intersection observer if needed
    const sentinel = document.getElementById('sentinel');
    if (sentinel) {
        observer.disconnect();
        observer.observe(sentinel);
    }
    
    // Load the content
    loadContent();
}

// Update items counter
function updateItemsCounter(visibleCount = null) {
    const counterElement = document.getElementById('items-loaded');
    if (!counterElement) return;
    
    const totalItems = allItems.length;
    const visibleItems = visibleCount !== null ? visibleCount : document.querySelectorAll('.feed-item, .grid-item:not([style*="display: none"])').length;
    
    counterElement.textContent = visibleItems;
    
    // Add visual feedback when count changes
    const oldCount = parseInt(counterElement.dataset.lastCount) || 0;
    counterElement.dataset.lastCount = visibleItems;
    
    if (visibleItems > oldCount) {
        // Highlight when items are added
        counterElement.style.color = '#ffd700';
        counterElement.style.fontWeight = 'bold';
        setTimeout(() => {
            counterElement.style.color = '';
            counterElement.style.fontWeight = '';
        }, 800);
    } else if (visibleItems < oldCount) {
        // Different highlight when items are reset
        counterElement.style.color = '#ff6b6b';
        setTimeout(() => {
            counterElement.style.color = '';
        }, 800);
    }
    
    // Show/hide no results message
    const noResults = document.getElementById('noResults');
    if (noResults) {
        noResults.style.display = (visibleItems === 0 && totalItems > 0) ? 'block' : 'none';
    }
}

// Load content
async function loadContent() {
    if (isLoading) return;
    
    isLoading = true;
    updateLoadMoreButton(); // Update button state
    const loadingElement = document.getElementById('loading');
    if (loadingElement) loadingElement.classList.remove('hidden');
    
    try {
        // Get the correct REST base for the current post type
        const postTypeMapping = window.postTypeMapping || {};
        const restBase = postTypeMapping[currentType] || currentType;
        
        // Handle different post types correctly
        let url;
        if (restBase === 'media' || currentType === 'attachment') {
            url = `${wpApiBase}/media?_embed&per_page=${settings.itemsPerPage}&page=${currentPage}&orderby=date&order=${settings.sortDescending ? 'desc' : 'asc'}&media_type=image`;
        } else {
            // Ensure we have a valid restBase
            if (!restBase) {
                throw new Error(`Invalid post type: ${currentType}`);
            }
            // Add _embed parameter to include featured media and author, and acf=1 to include ACF fields
            url = `${wpApiBase}/${restBase}?_embed&acf=1&per_page=${settings.itemsPerPage}&page=${currentPage}&orderby=date&order=${settings.sortDescending ? 'desc' : 'asc'}`;
        }
        
        // Add search query if provided
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim()) {
            url += `&search=${encodeURIComponent(searchInput.value.trim())}`;
        }
        
        console.log('Fetching URL:', url); // Debug log
        console.log('API Source:', settings.apiSource); // Debug log
        
        const response = await fetch(url);
        if (!response.ok) {
            console.error('Response status:', response.status);
            console.error('Response headers:', response.headers);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const totalPages = parseInt(response.headers.get('X-WP-TotalPages')) || 1;
        hasMore = currentPage < totalPages;
        
        let newItems = await response.json();
        
        // Sort sticky posts to the top
        if (currentType === 'posts') {
            newItems.sort((a, b) => {
                // If both or neither are sticky, maintain their order
                if (!!a.sticky === !!b.sticky) return 0;
                // Put sticky posts first
                return a.sticky ? -1 : 1;
            });
        }
        
        allItems = [...allItems, ...newItems];
        
        // Extract and store unique categories and tags
        updateCategoriesAndTags(newItems);
        
        // Update the navigation menus
        updateNavigationMenus();
        
        // Apply current filters
        applyFilters();
        
        // Display API source info in the UI
        const sourceInfo = document.createElement('div');
        sourceInfo.className = 'text-xs text-gray-500 mb-2 mt-2';
        sourceInfo.innerHTML = `API Source: ${settings.apiSource === 'custom' ? 'Custom URL' : settings.apiSource === 'parent' ? 'Parent Site' : 'Current Site'}`;
        
        // Add source info to the content feed if it's the first page
        if (currentPage === 1) {
            const container = document.getElementById('contentFeed');
            container.prepend(sourceInfo);
        }
        
        renderMainView();
        updateItemsCounter(); // Update counter after loading new items
        currentPage++;
    } catch (error) {
        console.error('Error fetching content:', error);
        document.getElementById('contentFeed').innerHTML += 
            `<div class="p-4 bg-red-100 text-red-700 rounded">Error loading content: ${error.message}</div>`;
    } finally {
        isLoading = false;
        updateLoadMoreButton(); // Update button state
        document.getElementById('loading').classList.add('hidden');
    }
}

// Load more content when scrolling to bottom or button click
function loadMoreContent() {
    if (!isLoading && hasMore) {
        loadContent();
    }
}

// Update load more button state
function updateLoadMoreButton() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        // Disable button in carousel mode
        if (settings.mainViewMode === 'carousel') {
            loadMoreBtn.textContent = 'Switch to Grid/List to Load';
            loadMoreBtn.disabled = true;
        } else if (isLoading) {
            loadMoreBtn.textContent = 'Loading...';
            loadMoreBtn.disabled = true;
        } else if (!hasMore) {
            loadMoreBtn.textContent = 'No More Items';
            loadMoreBtn.disabled = true;
        } else {
            loadMoreBtn.textContent = 'Load More';
            loadMoreBtn.disabled = false;
        }
    }
}

// Set main view mode
function setMainViewMode(mode) {
    settings.mainViewMode = mode;
    document.querySelectorAll('.main-view-btn').forEach(btn => {
        btn.classList.toggle('bg-blue-500', btn.dataset.mode === mode);
        btn.classList.toggle('text-white', btn.dataset.mode === mode);
        btn.classList.toggle('bg-gray-100', btn.dataset.mode !== mode);
        btn.classList.toggle('text-gray-700', btn.dataset.mode !== mode);
    });
    updateLoadMoreButton(); // Update button state when switching views
    saveSettings(); // Save settings to localStorage
    renderMainView();
}

// Render main view based on mode
function renderMainView() {
    const container = document.getElementById('contentFeed');
    container.innerHTML = '';
    
    if (allItems.length === 0 && currentPage === 1) {
        container.innerHTML = '<div class="p-4 bg-gray-100 rounded">No items found</div>';
        return;
    }
    
    // Apply client-side sorting if toggled
    const itemsToDisplay = [...allItems];
    if (!settings.sortDescending) {
        itemsToDisplay.reverse();
    }
    
    switch(settings.mainViewMode) {
        case 'feed':
            renderFeedView(itemsToDisplay, container);
            break;
        case 'grid':
            renderGridView(itemsToDisplay, container);
            break;
        case 'carousel':
            // Carousel only shows currently loaded items, no additional loading
            renderCarouselView(allItems, container, false);
            break;
    }
}

// Feed View (List)
function renderFeedView(items, container) {
    // Store the current state of showFeaturedImages to avoid changes during render
    const shouldShowImages = showFeaturedImages;
    container.className = 'space-y-4';
    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow feed-item';
        itemEl.onclick = () => openPopover(item);
        
        // Add data attributes for filtering
        if (item.categories && item.categories.length > 0) {
            itemEl.dataset.categories = item.categories.map(c => c.id).join(' ');
        }
        if (item.tags && item.tags.length > 0) {
            itemEl.dataset.tags = item.tags.map(t => t.id).join(' ');
        }
        
        const title = item.title?.rendered || item.caption?.rendered || 'Untitled';
        const date = new Date(item.date).toLocaleDateString();
        const featuredImage = item._embedded?.['wp:featuredmedia']?.[0]?.source_url || 
                           item.source_url || 
                           item._embedded?.['wp:featuredmedia']?.[0]?.media_details?.sizes?.medium?.source_url ||
                           item.featured_media_url;
        
        // Show excerpt for password-protected posts
        if (item.password) {
            itemEl.innerHTML = `
                <div class="flex items-start gap-4">
                    <div class="flex-shrink-0 text-gray-400 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h2 class="text-lg font-semibold">${title}</h2>
                        <div class="text-sm text-gray-500 mb-2">${date}</div>
                        <div class="text-gray-600">${item.excerpt?.rendered || 'This content is password protected.'}</div>
                    </div>
                </div>
            `;
            container.appendChild(itemEl);
            return;
        }
        
        // Small size: only title, no image
        if (settings.itemSize === 'small') {
            itemEl.innerHTML = `
                <div class="feed-content">
                    <h2 class="text-xl font-semibold mb-1">${title}</h2>
                </div>
            `;
        } else {
            itemEl.innerHTML = `
                <div class="flex gap-4">
                    ${shouldShowImages && featuredImage ? `
                        <div class="flex-shrink-0">
                            <img src="${featuredImage}" alt="${title}" class="w-24 h-24 object-cover rounded-lg feed-image">
                        </div>
                    ` : ''}
                    <div class="flex-1 feed-content">
                        <h2 class="text-xl font-semibold mb-1">${title}</h2>
                        <div class="flex items-center text-sm text-gray-500 mb-2">
                            <span>${date}</span>
                            <span class="mx-2">•</span>
                            <span class="bg-gray-100 px-2 py-1 rounded">${currentType}</span>
                        </div>
                        ${item.categories?.length > 0 ? `
                            <div class="flex flex-wrap gap-1 mb-2">
                                ${item.categories.map(cat => `
                                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${cat.name}</span>
                                `).join('')}
                            </div>
                        ` : ''}
                        ${item.tags?.length > 0 ? `
                            <div class="flex flex-wrap gap-1 mb-2">
                                ${item.tags.map(tag => `
                                    <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">${tag.name}</span>
                                `).join('')}
                            </div>
                        ` : ''}
                        <div class="text-gray-600 line-clamp-3">${item.excerpt?.rendered || item.description?.rendered || ''}</div>
                        ${renderAcfFieldsPreview(item.acf)}
                    </div>
                </div>
            `;
        }
        container.appendChild(itemEl);
    });
}

// Grid View
function renderGridView(items, container) {
    // Store the current state of showFeaturedImages to avoid changes during render
    const shouldShowImages = showFeaturedImages;
    container.className = 'grid gap-4 grid-view';
    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = `bg-white rounded-lg shadow cursor-pointer hover:shadow-md transition-all overflow-hidden grid-item ${settings.itemSize === 'small' ? 'small' : ''}`;
        itemEl.onclick = () => openPopover(item);
        
        // Add data attributes for filtering
        if (item.categories && item.categories.length > 0) {
            itemEl.dataset.categories = item.categories.map(c => c.id).join(' ');
        }
        if (item.tags && item.tags.length > 0) {
            itemEl.dataset.tags = item.tags.map(t => t.id).join(' ');
        }
        
        const title = item.title?.rendered || item.caption?.rendered || 'Untitled';
        const date = new Date(item.date).toLocaleDateString();
        const featuredImage = item._embedded?.['wp:featuredmedia']?.[0]?.source_url || 
                           item.source_url || 
                           item._embedded?.['wp:featuredmedia']?.[0]?.media_details?.sizes?.medium?.source_url ||
                           item.featured_media_url;
        
        // Show excerpt for password-protected posts in grid view
        if (item.password) {
            itemEl.innerHTML = `
                <div class="h-full flex flex-col">
                    <div class="flex items-center gap-2 mb-2 text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span class="text-xs">Protected</span>
                    </div>
                    <h3 class="text-sm font-medium mb-1 line-clamp-2">${title}</h3>
                    <div class="text-xs text-gray-500 mb-2">${date}</div>
                    <div class="text-xs text-gray-600 line-clamp-3">${item.excerpt?.rendered?.replace(/<[^>]*>?/gm, '') || 'This content is password protected.'}</div>
                </div>
            `;
            container.appendChild(itemEl);
            return;
        }
        
        // Small size: small thumbnail and just title
        if (settings.itemSize === 'small') {
            // Create categories and tags HTML
            const categoriesHtml = item.categories?.length > 0 ? `
                <div class="flex flex-wrap gap-1 mt-1">
                    ${item.categories.slice(0, 2).map(cat => `
                        <span class="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">${cat.name}</span>
                    `).join('')}
                    ${item.categories.length > 2 ? `<span class="text-xs text-gray-400">+${item.categories.length - 2}</span>` : ''}
                </div>
            ` : '';

            const tagsHtml = item.tags?.length > 0 ? `
                <div class="flex flex-wrap gap-1 mt-1">
                    ${item.tags.slice(0, 2).map(tag => `
                        <span class="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">${tag.name}</span>
                    `).join('')}
                    ${item.tags.length > 2 ? `<span class="text-xs text-gray-400">+${item.tags.length - 2}</span>` : ''}
                </div>
            ` : '';

            itemEl.innerHTML = `
                <div class="relative h-full group">
                    <div class="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden">
                        ${shouldShowImages && featuredImage ? `
                            <img src="${featuredImage}" alt="${title}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
                        ` : ''}
                    </div>
                    <div class="mt-2">
                        <h3 class="font-medium text-gray-900 line-clamp-2">${title}</h3>
                        <p class="text-xs text-gray-500">${date}</p>
                        ${categoriesHtml}
                        ${tagsHtml}
                    </div>
                </div>
            `;
        } else {
            itemEl.innerHTML = `
                ${shouldShowImages && featuredImage ? `
                    <img src="${featuredImage}" alt="${title}" class="w-full h-48 object-cover rounded-lg mb-3 grid-image">
                ` : ''}
                <h3 class="text-lg font-semibold mb-1">${title}</h3>
                <div class="text-xs text-gray-500 mb-2">${date}</div>
                ${item.categories?.length > 0 ? `
                    <div class="flex flex-wrap gap-1 mb-2">
                        ${item.categories.map(cat => `
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${cat.name}</span>
                        `).join('')}
                    </div>
                ` : ''}
                ${item.tags?.length > 0 ? `
                    <div class="flex flex-wrap gap-1 mb-2">
                        ${item.tags.map(tag => `
                            <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">${tag.name}</span>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="text-sm line-clamp-3 grid-content">${item.excerpt?.rendered || item.description?.rendered || ''}</div>
            `;
        }
        container.appendChild(itemEl);
    });
}

// Universal Carousel View (reusable)
function renderCarouselView(items, container, isContentCarousel = false) {
    // Store the current state of showFeaturedImages to avoid changes during render
    const shouldShowImages = showFeaturedImages;
    container.className = 'relative';
    
    // For carousel, use the items that are currently loaded in allItems
    // Apply the same sorting as grid and feed views
    let currentItems = [...allItems];
    if (!settings.sortDescending) {
        currentItems.reverse();
    }
    
    if (currentItems.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-500">No items loaded yet. Switch to Grid or List view to load items.</div>';
        return;
    }
    
    let slidesHtml = '';
    let indicatorsHtml = '';
    
    currentItems.forEach((item, index) => {
        if (isContentCarousel) {
            // For content blocks carousel
            const blocks = parseContentBlocks(item.content?.rendered || '');
            if (blocks.length === 0) {
                slidesHtml += `
                    <div class="carousel-slide w-full flex-shrink-0 ${index === 0 ? '' : 'hidden'}" data-index="${index}">
                        <div class="prose max-w-none">${item.content?.rendered || 'No content'}</div>
                    </div>
                `;
            } else {
                blocks.forEach((block, blockIndex) => {
                    slidesHtml += `
                        <div class="carousel-slide w-full flex-shrink-0 ${blockIndex === 0 ? '' : 'hidden'}" data-index="${blockIndex}">
                            <div class="prose max-w-none">${block}</div>
                        </div>
                    `;
                });
            }
        } else {
            // For main feed carousel
            const title = item.title?.rendered || item.caption?.rendered || 'Untitled';
            const date = new Date(item.date).toLocaleDateString();
            const mediaUrl = item.source_url || 
                          item._embedded?.['wp:featuredmedia']?.[0]?.source_url || 
                          item._embedded?.['wp:featuredmedia']?.[0]?.media_details?.sizes?.medium?.source_url ||
                          item.featured_media_url;
            
            slidesHtml += `
                <div class="carousel-slide w-full flex-shrink-0 ${index === 0 ? '' : 'hidden'}" data-index="${index}">
                    <div class="bg-white p-6 rounded-lg">
                        <h3 class="text-xl font-bold mb-2">${title}</h3>
                        <div class="text-sm text-gray-500 mb-4">${date}</div>
                        ${mediaUrl ? `<img src="${mediaUrl}" alt="${title}" class="w-full h-auto rounded-lg mb-4 max-h-64 object-contain mx-auto">` : ''}
                        <div class="prose max-w-none">${item.excerpt?.rendered || item.description?.rendered || ''}</div>
                    </div>
                </div>
            `;
        }
        
        if (!isContentCarousel) {
            indicatorsHtml += `
                <button onclick="showSlide(this, ${index})" class="w-3 h-3 rounded-full mx-1 ${index === 0 ? 'bg-blue-500' : 'bg-gray-300'}"></button>
            `;
        }
    });
    
    container.innerHTML = `
        <div class="flex overflow-hidden relative" id="${isContentCarousel ? 'contentCarousel' : 'mainCarousel'}">
            ${slidesHtml}
        </div>
        ${!isContentCarousel ? `
            <div class="flex justify-center mt-4">
                ${indicatorsHtml}
            </div>
            <button onclick="navigateCarousel('prev')" class="absolute left-0 top-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow-md ml-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <button onclick="navigateCarousel('next')" class="absolute right-0 top-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow-md mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            </button>
        ` : ''}
    `;
}

// Parse content into Gutenberg blocks
function parseContentBlocks(content) {
    if (!content) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    return Array.from(doc.body.children).map(el => el.outerHTML);
}

// Set content view mode
function setContentViewMode(mode) {
    settings.contentViewMode = mode;
    document.querySelectorAll('.content-view-btn').forEach(btn => {
        btn.classList.toggle('bg-blue-500', btn.dataset.mode === mode);
        btn.classList.toggle('text-white', btn.dataset.mode === mode);
        btn.classList.toggle('bg-gray-100', btn.dataset.mode !== mode);
        btn.classList.toggle('text-gray-700', btn.dataset.mode !== mode);
    });
    saveSettings(); // Save settings to localStorage
    renderContentView();
}

// Render content view
function renderContentView() {
    const container = document.getElementById('popoverContent');
    
    switch(settings.contentViewMode) {
        case 'page':
            renderPageView();
            break;
        case 'grid':
            renderBlocksGridView();
            break;
        case 'carousel':
            renderCarouselView([currentItem], container, true);
            break;
    }
}

// Page View
function renderPageView() {
    const title = currentItem.title?.rendered || currentItem.caption?.rendered || 'Untitled';
    const date = new Date(currentItem.date).toLocaleDateString();
    const featuredImage = currentItem._embedded?.['wp:featuredmedia']?.[0]?.source_url || 
                       currentItem.source_url || 
                       currentItem._embedded?.['wp:featuredmedia']?.[0]?.media_details?.sizes?.medium?.source_url ||
                       currentItem.featured_media_url;
    
    // Generate metadata table
    const metadataTable = generateMetadataTable(currentItem);
    
    // Generate ACF fields section if available
    const acfFields = currentItem.acf || {};
    const hasAcfFields = Object.keys(acfFields).length > 0 && 
                        Object.values(acfFields).some(val => val !== null && val !== undefined && val !== '');
    
    // Filter out empty ACF fields
    const displayAcfFields = hasAcfFields ? 
        Object.entries(acfFields)
            .filter(([key, value]) => value !== null && value !== undefined && value !== '' && !key.startsWith('_'))
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        : [];
    
    // Check if we have location data in ACF fields
    const locationData = displayAcfFields.find(([key, value]) => value && typeof value === 'object' && 'lat' in value && 'lng' in value);
    const hasLocationData = !!locationData;
    const nonLocationFields = displayAcfFields.filter(([key, value]) => !(value && typeof value === 'object' && 'lat' in value && 'lng' in value));
    
    document.getElementById('popoverContent').innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 space-y-6">
                <div>
                    <h2 class="text-2xl font-bold mb-2">${title}</h2>
                    <div class="text-sm text-gray-500 mb-4">${date}</div>
                    ${featuredImage ? `<img src="${featuredImage}" alt="${title}" class="w-full h-auto rounded-lg shadow mb-4">` : ''}
                    <div class="prose max-w-none">${currentItem.content?.rendered || currentItem.description?.rendered || ''}</div>
                </div>
                
                ${hasLocationData ? `
                    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <h3 class="text-lg font-semibold p-4 border-b border-gray-200 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                            Location
                        </h3>
                        ${renderLocationData(locationData[1])}
                    </div>
                ` : ''}
                
                ${nonLocationFields.length > 0 ? `
                    <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 class="text-lg font-semibold mb-3 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                            </svg>
                            Additional Information
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            ${nonLocationFields.map(([key, value]) => {
                                const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                let displayValue = formatAcfValue(value, key);
                                
                                return `
                                    <div class="bg-white p-3 rounded border border-gray-200">
                                        <div class="text-sm font-medium text-gray-500 mb-1">${displayKey}</div>
                                        <div class="text-gray-800 break-words">${displayValue}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="space-y-6">
                <div class="bg-white p-4 rounded-lg border border-gray-200">
                    <h3 class="text-lg font-semibold mb-3 flex items-center">
                        <svg class="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Details
                    </h3>
                    ${metadataTable}
                </div>
            </div>
        </div>
    `;
}

// Render location data with Google Map
function renderLocationData(locationData) {
    if (!locationData || !locationData.lat || !locationData.lng) return '';
    
    const { 
        address, 
        lat, 
        lng, 
        street_number, 
        street_name, 
        city, 
        state_short, 
        post_code, 
        country,
        place_id
    } = locationData;
    
    // Generate Google Maps embed URL
    const mapUrl = `https://www.google.com/maps/embed/v1/place
        ?key=AIzaSyDGO9Rzc6uh9MkB3jT2xZOw-1u9fGeiIRc
        &q=${encodeURIComponent(address)}
        ¢er=${lat},${lng}
        &zoom=15
        &maptype=roadmap`.replace(/\s+/g, '');
    
    // Generate Google Maps link
    const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${place_id}`;
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
                <h3 class="text-lg font-semibold mb-3 flex items-center">
                    <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    Location Details
                </h3>
                <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table class="w-full">
                        <tbody class="divide-y divide-gray-200">
                            ${street_number ? `
                                <tr>
                                    <td class="py-2 px-4 text-sm font-medium text-gray-500 bg-gray-50 w-1/3">Address</td>
                                    <td class="py-2 px-4 text-sm text-gray-900">
                                        ${street_number} ${street_name}
                                    </td>
                                </tr>
                            ` : ''}
                            ${city || state_short || post_code ? `
                                <tr>
                                    <td class="py-2 px-4 text-sm font-medium text-gray-500 bg-gray-50 w-1/3">Location</td>
                                    <td class="py-2 px-4 text-sm text-gray-900">
                                        ${[city, state_short, post_code].filter(Boolean).join(', ')}
                                    </td>
                                </tr>
                            ` : ''}
                            ${country ? `
                                <tr>
                                    <td class="py-2 px-4 text-sm font-medium text-gray-500 bg-gray-50 w-1/3">Country</td>
                                    <td class="py-2 px-4 text-sm text-gray-900">${country}</td>
                                </tr>
                            ` : ''}
                            <tr>
                                <td class="py-2 px-4 text-sm font-medium text-gray-500 bg-gray-50 w-1/3">Coordinates</td>
                                <td class="py-2 px-4 text-sm text-gray-900">
                                    ${lat.toFixed(6)}, ${lng.toFixed(6)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="p-4 border-t border-gray-200">
                        <a href="${googleMapsLink}" target="_blank" class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                            </svg>
                            Open in Google Maps
                        </a>
                    </div>
                </div>
            </div>
            <div class="h-64 md:h-full rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                <iframe 
                    width="100%" 
                    height="100%" 
                    frameborder="0" 
                    style="border:0" 
                    src="${mapUrl}" 
                    allowfullscreen
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade">
                </iframe>
                <div class="absolute bottom-2 right-2 bg-white px-2 py-1 text-xs rounded shadow-md">
                    <a href="${googleMapsLink}" target="_blank" class="text-blue-600 hover:underline">View Larger Map</a>
                </div>
            </div>
        </div>
    `;
}

// Helper function to format ACF field values for display
function formatAcfValue(value, key = '') {
    if (value === null || value === undefined) return '';
    
    // Handle arrays and objects
    if (Array.isArray(value)) {
        if (value.length === 0) return '';
        // If it's an array of objects, try to find a meaningful value
        if (typeof value[0] === 'object' && value[0] !== null) {
            // Try to find common fields like title, name, or label
            const firstItem = value[0];
            const displayValue = firstItem.title || firstItem.name || firstItem.label || 
                               firstItem.url || firstItem.ID || JSON.stringify(firstItem);
            return `${displayValue}${value.length > 1 ? ` +${value.length - 1} more` : ''}`;
        }
        return value.join(', ');
    }
    
    // Handle objects
    if (typeof value === 'object') {
        // Check for ACF Google Map field
        if (value.lat && value.lng) {
            return renderLocationData(value);
        }
        
        // Check for common ACF field types
        if (value.url) {
            // Image or file field
            if (value.sizes && value.sizes.thumbnail) {
                return `<img src="${value.sizes.thumbnail}" alt="${value.alt || ''}" class="max-w-full h-auto rounded">`;
            }
            return `<a href="${value.url}" target="_blank" class="text-blue-600 hover:underline">${value.filename || 'View File'}</a>`;
        }
        
        // Check for date field
        if (value.date) {
            return new Date(value.date).toLocaleDateString();
        }
        
        // Check for link field
        if (value.title && value.url) {
            return `<a href="${value.url}" target="_blank" class="text-blue-600 hover:underline">${value.title}</a>`;
        }
        
        // Default object display
        return JSON.stringify(value);
    }
    
    // Handle boolean values
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    
    // Handle URLs
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
        return `<a href="${value}" target="_blank" class="text-blue-600 hover:underline">${value}</a>`;
    }
    
    // Handle email addresses
    if (typeof value === 'string' && value.includes('@')) {
        return `<a href="mailto:${value}" class="text-blue-600 hover:underline">${value}</a>`;
    }
    
    // Default: convert to string
    return String(value);
}

// Helper function to render ACF fields in a preview
function renderAcfFieldsPreview(acfFields) {
    if (!acfFields || Object.keys(acfFields).length === 0) {
        return '';
    }
    
    // Filter out empty or system fields
    const displayFields = Object.entries(acfFields).filter(([key, value]) => {
        // Skip empty values and system fields (starting with _)
        return value !== null && 
               value !== undefined && 
               value !== '' && 
               !key.startsWith('_') && 
               !Array.isArray(value) && 
               typeof value !== 'object';
    }).slice(0, 3); // Show only first 3 fields in preview
    
    if (displayFields.length === 0) {
        return '';
    }
    
    return `
        <div class="mt-2 pt-2 border-t border-gray-100">
            <div class="flex flex-wrap gap-1">
                ${displayFields.map(([key, value]) => {
                    const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    let displayValue = String(value);
                    
                    // Truncate long values
                    if (displayValue.length > 50) {
                        displayValue = displayValue.substring(0, 50) + '...';
                    }
                    
                    return `
                        <div class="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded flex items-center">
                            <span class="font-medium">${displayKey}:</span>
                            <span class="ml-1">${displayValue}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Generate metadata table
function generateMetadataTable(item) {
    const metadata = [];
    
    // Basic WordPress fields
    if (item.id) metadata.push(['ID', item.id]);
    if (item.slug) metadata.push(['Slug', item.slug]);
    if (item.status) metadata.push(['Status', item.status]);
    if (item.type) metadata.push(['Type', item.type]);
    if (item.link) metadata.push(['Link', `<a href="${item.link}" target="_blank" class="text-blue-600 hover:underline">${item.link}</a>`]);
    if (item.guid?.rendered) metadata.push(['GUID', item.guid.rendered]);
    
    // Dates
    if (item.date) metadata.push(['Created', new Date(item.date).toLocaleString()]);
    if (item.modified) metadata.push(['Modified', new Date(item.modified).toLocaleString()]);
    if (item.date_gmt) metadata.push(['Created (GMT)', new Date(item.date_gmt).toLocaleString()]);
    if (item.modified_gmt) metadata.push(['Modified (GMT)', new Date(item.modified_gmt).toLocaleString()]);
    
    // Author
    if (item.author) metadata.push(['Author ID', item.author]);
    if (item._embedded?.author?.[0]) {
        const author = item._embedded.author[0];
        metadata.push(['Author Name', author.name || 'N/A']);
        metadata.push(['Author Link', `<a href="${author.link}" target="_blank" class="text-blue-600 hover:underline">${author.link}</a>`]);
    }
    
    // Categories and Tags
    if (item.categories && item.categories.length > 0) {
        metadata.push(['Categories', item.categories.join(', ')]);
    }
    if (item.tags && item.tags.length > 0) {
        metadata.push(['Tags', item.tags.join(', ')]);
    }
    if (item._embedded?.['wp:term']) {
        const terms = item._embedded['wp:term'].flat();
        if (terms.length > 0) {
            const termNames = terms.map(term => term.name).join(', ');
            metadata.push(['Terms', termNames]);
        }
    }
    
    // Featured Media
    if (item.featured_media) metadata.push(['Featured Media ID', item.featured_media]);
    if (item._embedded?.['wp:featuredmedia']?.[0]) {
        const media = item._embedded['wp:featuredmedia'][0];
        metadata.push(['Media Title', media.title?.rendered || 'N/A']);
        metadata.push(['Media Alt Text', media.alt_text || 'N/A']);
        metadata.push(['Media Caption', media.caption?.rendered || 'N/A']);
        metadata.push(['Media Description', media.description?.rendered || 'N/A']);
    }
    
    // Comment status
    if (item.comment_status) metadata.push(['Comment Status', item.comment_status]);
    if (item.ping_status) metadata.push(['Ping Status', item.ping_status]);
    if (item.sticky) metadata.push(['Sticky', item.sticky ? 'Yes' : 'No']);
    if (item.template) metadata.push(['Template', item.template]);
    if (item.format) metadata.push(['Format', item.format]);
    
    // Meta fields (ACF and custom fields)
    if (item.meta) {
        Object.entries(item.meta).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                metadata.push([`Meta: ${key}`, displayValue]);
            }
        });
    }
    
    // ACF fields (if available)
    if (item.acf) {
        Object.entries(item.acf).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                metadata.push([`ACF: ${key}`, displayValue]);
            }
        });
    }
    
    // Custom fields
    if (item.custom_fields) {
        Object.entries(item.custom_fields).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                metadata.push([`Custom: ${key}`, displayValue]);
            }
        });
    }
    
    // Generate table HTML
    if (metadata.length === 0) {
        return '<p class="text-gray-500">No metadata available</p>';
    }
    
    const tableRows = metadata.map(([key, value]) => `
        <tr class="border-b border-gray-200">
            <td class="py-2 px-3 font-medium text-gray-700 bg-gray-50">${key}</td>
            <td class="py-2 px-3 text-gray-900 break-words">${value}</td>
        </tr>
    `).join('');
    
    return `
        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table class="w-full text-sm">
                <thead>
                    <tr class="bg-gray-100">
                        <th class="py-2 px-3 text-left font-semibold text-gray-700">Field</th>
                        <th class="py-2 px-3 text-left font-semibold text-gray-700">Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}

// Blocks Grid View
function renderBlocksGridView() {
    const blocks = parseContentBlocks(currentItem.content?.rendered || '');
    const container = document.getElementById('popoverContent');
    
    if (blocks.length === 0) {
        container.innerHTML = '<div class="prose max-w-none">No content blocks found</div>';
        return;
    }
    
    container.innerHTML = `
        <h3 class="text-xl font-bold mb-4">Content Blocks</h3>
        <div class="grid gap-4 grid-view">
            ${blocks.map((block, index) => `
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div class="text-xs font-mono text-gray-500 mb-2">Block ${index + 1}</div>
                    <div class="prose max-w-none">${block}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// Carousel navigation
function showSlide(btn, index) {
    const carouselId = btn.closest('.relative').querySelector('[id$="Carousel"]').id;
    const slides = document.querySelectorAll(`#${carouselId} .carousel-slide`);
    const indicators = btn.parentElement.children;
    
    slides.forEach(slide => slide.classList.add('hidden'));
    Array.from(indicators).forEach(ind => {
        ind.classList.remove('bg-blue-500');
        ind.classList.add('bg-gray-300');
    });
    
    slides[index].classList.remove('hidden');
    btn.classList.add('bg-blue-500');
    btn.classList.remove('bg-gray-300');
}

function navigateCarousel(direction) {
    const carousel = document.getElementById('mainCarousel');
    const slides = carousel.querySelectorAll('.carousel-slide');
    const activeIndex = Array.from(slides).findIndex(slide => !slide.classList.contains('hidden'));
    const newIndex = direction === 'next' 
        ? (activeIndex + 1) % slides.length 
        : (activeIndex - 1 + slides.length) % slides.length;
    
    const indicatorBtn = document.querySelector(`button[onclick^="showSlide"][onclick*="${newIndex}"]`) ||
                        document.querySelector(`button[onclick^="showSlide"]`);
    if (indicatorBtn) showSlide(indicatorBtn, newIndex);
}

// Open popover
async function openPopover(item) {
    currentItem = item;
    const overlay = document.getElementById('popoverOverlay');
    const content = document.getElementById('popoverContent');
    const container = document.getElementById('popoverContentContainer');
    const backdrop = document.getElementById('popoverBackdrop');
    
    // Show overlay
    overlay.classList.remove('hidden');
    
    // Force reflow to ensure the element is in the DOM before applying transitions
    void overlay.offsetHeight;
    
    // Start animations
    overlay.classList.add('flex');
    overlay.classList.remove('bg-opacity-0');
    overlay.classList.add('bg-opacity-50');
    
    backdrop.classList.remove('bg-opacity-0');
    backdrop.classList.add('bg-opacity-50');
    
    container.classList.remove('opacity-0', 'scale-95');
    container.classList.add('opacity-100', 'scale-100');
    
    // Show loading state
    content.innerHTML = `
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    `;
    
    try {
        // For posts and pages, try to get full content
        if (currentType === 'posts' || currentType === 'pages') {
            const restBase = window.postTypeMapping?.[currentType] || currentType;
            const response = await fetch(`${wpApiBase}/${restBase}/${item.id}?_embed`);
            if (response.ok) {
                currentItem = await response.json();
            }
        }
        
        renderContentView();
    } catch (error) {
        console.error('Error loading content:', error);
        // Just render with the data we already have
        renderContentView();
    }
}

// Close popover with animation
function closePopover() {
    const overlay = document.getElementById('popoverOverlay');
    const container = document.getElementById('popoverContentContainer');
    const backdrop = document.getElementById('popoverBackdrop');
    
    // Start exit animations
    overlay.classList.remove('bg-opacity-50');
    overlay.classList.add('bg-opacity-0');
    
    backdrop.classList.remove('bg-opacity-50');
    backdrop.classList.add('bg-opacity-0');
    
    container.classList.remove('opacity-100', 'scale-100');
    container.classList.add('opacity-0', 'scale-95');
    
    // Hide overlay after animation completes
    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }, 300); // Match this with the CSS transition duration
}

// Toggle sort order
function toggleSortOrder() {
    settings.sortDescending = !settings.sortDescending;
    document.getElementById('sortBtn').textContent = 
        `Sort: ${settings.sortDescending ? 'Newest First' : 'Oldest First'}`;
    saveSettings(); // Save settings to localStorage
    renderMainView();
}

// Update categories and tags from items
function updateCategoriesAndTags(items) {
    items.forEach(item => {
        // Add categories
        if (item.categories && Array.isArray(item.categories)) {
            item.categories.forEach(cat => {
                if (!allCategories.some(c => c.id === cat.id)) {
                    allCategories.push(cat);
                }
            });
        }
        
        // Add tags
        if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => {
                if (!allTags.some(t => t.id === tag.id)) {
                    allTags.push(tag);
                }
            });
        }
    });
}

// Update navigation menus with categories and tags
function updateNavigationMenus() {
    const categoryNav = document.getElementById('categoryNav');
    const tagNav = document.getElementById('tagNav');
    
    if (!categoryNav || !tagNav) return;
    
    // Clear existing buttons (except the "All" button)
    categoryNav.innerHTML = '<button class="category-filter px-3 py-1 text-xs rounded-full bg-blue-600 text-white hover:bg-blue-700 font-medium" data-category="all">All</button>';
    tagNav.innerHTML = '<button class="tag-filter px-3 py-1 text-xs rounded-full bg-green-600 text-white hover:bg-green-700 font-medium" data-tag="all">All</button>';
    
    // Add category buttons
    allCategories.forEach(cat => {
        const button = document.createElement('button');
        button.className = 'category-filter px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200';
        button.textContent = cat.name;
        button.dataset.category = cat.id;
        categoryNav.appendChild(button);
    });
    
    // Add tag buttons
    allTags.forEach(tag => {
        const button = document.createElement('button');
        button.className = 'tag-filter px-3 py-1 text-xs rounded-full bg-green-100 text-green-800 hover:bg-green-200';
        button.textContent = tag.name;
        button.dataset.tag = tag.id;
        tagNav.appendChild(button);
    });
    
    // Add event listeners
    document.querySelectorAll('.category-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.category-filter').forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white', 'font-medium', 'hover:bg-blue-700');
                b.classList.add('bg-blue-100', 'text-blue-800', 'hover:bg-blue-200');
            });
            e.target.classList.remove('bg-blue-100', 'text-blue-800', 'hover:bg-blue-200');
            e.target.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'font-medium');
            activeCategory = e.target.dataset.category;
            applyFilters();
        });
    });
    
    document.querySelectorAll('.tag-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tag-filter').forEach(b => {
                b.classList.remove('bg-green-600', 'text-white', 'font-medium', 'hover:bg-green-700');
                b.classList.add('bg-green-100', 'text-green-800', 'hover:bg-green-200');
            });
            e.target.classList.remove('bg-green-100', 'text-green-800', 'hover:bg-green-200');
            e.target.classList.add('bg-green-600', 'text-white', 'hover:bg-green-700', 'font-medium');
            activeTag = e.target.dataset.tag;
            applyFilters();
        });
    });
}

// Apply category and tag filters
function applyFilters() {
    const items = document.querySelectorAll('.feed-item, .grid-item');
    let visibleCount = 0;
    
    items.forEach(item => {
        const categoryMatch = activeCategory === 'all' || 
            (item.dataset.categories && item.dataset.categories.split(' ').includes(activeCategory));
            
        const tagMatch = activeTag === 'all' || 
            (item.dataset.tags && item.dataset.tags.split(' ').includes(activeTag));
        
        if (categoryMatch && tagMatch) {
            item.style.display = '';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    // Update items counter
    updateItemsCounter(visibleCount);
}

    // Start the app
    document.addEventListener('DOMContentLoaded', function() {
        init();
    });
})(); // End of IIFE