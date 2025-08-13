// Base view class
class BaseView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    showLoading() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="flex justify-center items-center p-8">
                <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                <span class="ml-2">Loading...</span>
            </div>
        `;
    }

    showError(message) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <p>${message || 'An error occurred'}</p>
                <button onclick="window.location.reload()" class="mt-2 text-blue-600 hover:underline">
                    Try again
                </button>
            </div>
        `;
    }

    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

window.BaseView = BaseView;
