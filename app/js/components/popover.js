// Popover Component
const Popover = (function() {
    let isOpen = false;
    let currentItem = null;
    
    function init() {
        // Initialize popover DOM if not exists
        let popover = document.getElementById('popoverOverlay');
        if (!popover) {
            popover = document.createElement('div');
            popover.id = 'popoverOverlay';
            popover.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 hidden';
            popover.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <button class="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-700" onclick="window.Popover.close()">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                    <div id="popoverContent" class="p-6"></div>
                </div>
            `;
            document.body.appendChild(popover);
        }
        return popover;
    }
    
    function open(item, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        if (!item) return;
        
        currentItem = item;
        const popover = init();
        const content = document.getElementById('popoverContent');
        
        if (!content) return;
        
        // Show loading state
        content.innerHTML = `
            <div class="flex justify-center items-center h-64">
                <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        `;
        
        // Show popover
        popover.classList.remove('hidden');
        isOpen = true;
        
        // Load content
        setTimeout(() => {
            if (content) {
                content.innerHTML = `
                    <h2 class="text-2xl font-bold mb-4">${item.title?.rendered || 'No Title'}</h2>
                    <div class="prose max-w-none">
                        ${item.content?.rendered || '<p>No content available</p>'}
                    </div>
                `;
            }
        }, 300);
    }
    
    function close() {
        const popover = document.getElementById('popoverOverlay');
        if (popover) {
            popover.classList.add('hidden');
        }
        isOpen = false;
        currentItem = null;
    }
    
    return {
        init,
        open,
        close,
        isOpen: () => isOpen
    };
})();

// Initialize on window load
window.addEventListener('load', () => {
    Popover.init();
});

window.Popover = Popover;
