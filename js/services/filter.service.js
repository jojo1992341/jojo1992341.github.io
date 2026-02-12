// Dépendance globale : window.CONFIG

window.FilterService = class FilterService {
    constructor() {
        this.filters = this._loadFilters();
    }

    _loadFilters() {
        try {
            const stored = localStorage.getItem(window.CONFIG.FILTER_STORAGE_KEY);
            return stored ? JSON.parse(stored) : this._defaultFilters();
        } catch (e) {
            return this._defaultFilters();
        }
    }

    _defaultFilters() {
        return {
            statMetric: 'max',
            analysisType: 'overview',
            tableFilter: 'all',
            feedbackFilter: 'all'
        };
    }

    saveFilters() {
        try {
            localStorage.setItem(window.CONFIG.FILTER_STORAGE_KEY, JSON.stringify(this.filters));
        } catch (e) {
            console.error('Filter save error:', e);
        }
    }

    setFilter(key, value) {
        this.filters[key] = value;
        this.saveFilters();
    }

    getFilter(key) {
        return this.filters[key];
    }
}
