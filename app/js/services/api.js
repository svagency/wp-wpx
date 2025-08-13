// API Service
const ApiService = (function() {
    // Helper function to handle API responses
    async function handleResponse(response) {
        if (!response.ok) {
            const error = await response.json().catch(() => ({
                message: `API request failed with status ${response.status}: ${response.statusText}`
            }));
            throw new Error(error.message || 'API request failed');
        }
        return response.json();
    }

    // Helper function to create request headers
    function getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // Add nonce for authenticated requests if available
        if (Config.api.nonce) {
            headers['X-WP-Nonce'] = Config.api.nonce;
        }

        return headers;
    }

    async function fetchPostTypes() {
        try {
            const url = `${Config.api.baseUrl}${Config.api.endpoints.types}`;
            console.log('Fetching post types from:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: getHeaders(),
                credentials: 'same-origin',
                mode: 'cors'
            });

            const data = await handleResponse(response);
            
            const postTypes = Object.values(data).filter(type => type.rest_base && type.rest_base !== 'media');
            State.update({ availablePostTypes: postTypes });
            return postTypes;
        } catch (error) {
            console.error('Error fetching post types:', error);
            // If we have mock data available, use it as a fallback
            if (window.mockPostTypes) {
                console.warn('Using mock post types as fallback');
                const postTypes = Object.values(window.mockPostTypes);
                State.update({ availablePostTypes: postTypes });
                return postTypes;
            }
            throw error;
        }
    }

    async function fetchPosts(type = 'posts', params = {}) {
        try {
            // Add default parameters
            const defaultParams = {
                _embed: 'true',
                page: 1,
                per_page: 10,
                ...params
            };

            // Build query string from params
            const queryString = Object.entries(defaultParams)
                .filter(([_, value]) => value !== undefined && value !== null)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');

            const url = `${Config.api.baseUrl}wp/v2/${type}${queryString ? `?${queryString}` : ''}`;
            console.log(`Fetching ${type} from:`, url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: getHeaders(),
                credentials: 'same-origin',
                mode: 'cors',
                cache: 'no-cache'
            });

            const data = await handleResponse(response);
            
            // Update state with pagination info if available
            const total = parseInt(response.headers.get('X-WP-Total')) || data.length;
            const totalPages = parseInt(response.headers.get('X-WP-TotalPages')) || 1;
            
            State.update({
                currentPage: defaultParams.page,
                totalItems: total,
                totalPages: totalPages,
                hasMore: defaultParams.page < totalPages
            });
            
            return data;
        } catch (error) {
            console.error(`Error fetching ${type}:`, error);
            // Return empty array instead of throwing to prevent app crash
            return [];
        }
    }

    return {
        fetchPostTypes,
        fetchPosts
    };
})();

window.ApiService = ApiService;
