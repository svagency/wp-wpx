// Base view class
class BaseView {
    constructor(containerId) {
        this.containerId = containerId; // Store the containerId
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with ID '${containerId}' not found`);
        }
    }

    showLoading() {
        if (this.container) {
            this.container.innerHTML = '<div class="text-center py-8">Loading...</div>';
        } else {
            console.error('Cannot show loading: container not found');
        }
    }

    showError(message) {
        if (this.container) {
            this.container.innerHTML = `
                <div class="p-4 text-center text-red-600">
                    <p>${message || 'An error occurred'}</p>
                </div>
            `;
        } else {
            console.error('Cannot show error: container not found');
        }
    }

    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

window.BaseView = BaseView;
