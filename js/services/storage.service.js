// Dépendance globale : window.CONFIG

window.StorageService = class StorageService {
    static load() {
        try { return JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEY)) || { allWeeks: [] }; }
        catch (e) { return { allWeeks: [] }; }
    }
    static save(data) {
        try { localStorage.setItem(window.CONFIG.STORAGE_KEY, JSON.stringify({ ...data, lastUpdated: new Date().toISOString() })); }
        catch (e) { console.error(e); }
    }
    static exportData(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `coach-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }
    static async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.allWeeks || !Array.isArray(data.allWeeks)) throw new Error("Format invalide");
                    resolve(data);
                } catch (err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
}
