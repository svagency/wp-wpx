// Application state management
const State = (function() {
    let state = {
        currentType: 'posts',
        currentPage: 1,
        isLoading: false,
        hasMore: true,
        activeCategory: 'all',
        activeTag: 'all',
        availablePostTypes: [],
        availableCategories: [],
        availableTags: []
    };

    const listeners = {};

    return {
        get: function(key) {
            return state[key];
        },
        set: function(key, value) {
            const oldValue = state[key];
            state[key] = value;
            
            // Notify listeners if the value changed
            if (oldValue !== value && listeners[key]) {
                listeners[key].forEach(callback => callback(value, oldValue));
            }
            return true;
        },
        update: function(updates) {
            const oldState = { ...state };
            Object.assign(state, updates);
            
            // Notify listeners of changed values
            Object.entries(updates).forEach(([key, value]) => {
                if (oldState[key] !== value && listeners[key]) {
                    listeners[key].forEach(callback => callback(value, oldState[key]));
                }
            });
        },
        
        subscribe: function(key, callback) {
            if (!listeners[key]) {
                listeners[key] = [];
            }
            listeners[key].push(callback);
            
            // Return unsubscribe function
            return () => {
                listeners[key] = listeners[key].filter(cb => cb !== callback);
            };
        }
    };
})();

// Only set window.State if it doesn't exist to prevent overwriting
if (!window.State) {
    window.State = State;
}
