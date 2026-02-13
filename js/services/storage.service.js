// Dépendance globale : window.CONFIG

window.StorageService = class StorageService {
    static _currentSchemaVersion() {
        return 2;
    }

    static _defaultData() {
        return { schemaVersion: this._currentSchemaVersion(), allWeeks: [] };
    }

    static load() {
        try {
            const parsed = JSON.parse(localStorage.getItem(window.CONFIG.STORAGE_KEY));
            return this._migrateData(parsed);
        } catch (e) {
            return this._defaultData();
        }
    }

    static save(data) {
        try {
            const migrated = this._migrateData(data);
            localStorage.setItem(window.CONFIG.STORAGE_KEY, JSON.stringify({
                ...migrated,
                schemaVersion: this._currentSchemaVersion(),
                lastUpdated: new Date().toISOString()
            }));
        }
        catch (e) { console.error(e); }
    }

    static exportData(data) {
        const payload = this._migrateData(data);
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `coach-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    static _isFiniteNumber(value) {
        return Number.isFinite(value);
    }

    static _isString(value) {
        return typeof value === 'string';
    }

    static _migrateDay(day) {
        if (!day || typeof day !== 'object') return day;

        const migrated = { ...day };
        if (migrated.dayType === undefined && this._isString(migrated.type)) migrated.dayType = migrated.type;
        if (migrated.rest === undefined) migrated.rest = 0;
        if (migrated.sets === undefined) migrated.sets = 1;
        if (migrated.reps === undefined) migrated.reps = 1;
        if (migrated.day === undefined) migrated.day = 1;
        if (migrated.feedback === '') migrated.feedback = null;

        return migrated;
    }

    static _migrateWeek(week, index) {
        if (!week || typeof week !== 'object') return week;

        const migrated = { ...week };

        if (migrated.exerciseType === undefined && this._isString(migrated.exercise)) {
            migrated.exerciseType = migrated.exercise;
        }

        if (migrated.maxReps === undefined && this._isFiniteNumber(migrated.max)) {
            migrated.maxReps = migrated.max;
        }

        if (migrated.weekNumber === undefined) {
            migrated.weekNumber = index + 1;
        }

        if (!Array.isArray(migrated.program)) {
            migrated.program = [];
        }

        migrated.program = migrated.program.map((day) => this._migrateDay(day));

        return migrated;
    }

    static _migrateData(data) {
        if (!data || typeof data !== 'object') {
            return this._defaultData();
        }

        const migrated = { ...data };

        // Compat héritage: anciennes clés possibles
        if (!Array.isArray(migrated.allWeeks)) {
            if (Array.isArray(migrated.weeks)) migrated.allWeeks = migrated.weeks;
            else if (Array.isArray(migrated.trainingWeeks)) migrated.allWeeks = migrated.trainingWeeks;
            else migrated.allWeeks = [];
        }

        migrated.allWeeks = migrated.allWeeks.map((week, index) => this._migrateWeek(week, index));

        // Validation finale du schéma cible
        this._validateImportSchema({ allWeeks: migrated.allWeeks });

        migrated.schemaVersion = this._currentSchemaVersion();

        return migrated;
    }

    static _validateDay(day, weekIndex, dayIndex) {
        if (!day || typeof day !== 'object') {
            throw new Error(`Format invalide: semaine ${weekIndex + 1}, jour ${dayIndex + 1} doit être un objet`);
        }

        const requiredNumbers = ['day', 'sets', 'reps', 'rest'];
        requiredNumbers.forEach((key) => {
            if (!this._isFiniteNumber(day[key])) {
                throw new Error(`Format invalide: semaine ${weekIndex + 1}, jour ${dayIndex + 1}, champ '${key}' numérique requis`);
            }
        });

        if (!this._isString(day.dayType)) {
            throw new Error(`Format invalide: semaine ${weekIndex + 1}, jour ${dayIndex + 1}, champ 'dayType' texte requis`);
        }

        if (day.feedback !== undefined && day.feedback !== null) {
            const allowedFeedbacks = Object.values(window.CONFIG.FEEDBACK);
            if (!allowedFeedbacks.includes(day.feedback)) {
                throw new Error(`Format invalide: semaine ${weekIndex + 1}, jour ${dayIndex + 1}, feedback inconnu`);
            }
        }

        if (day.actualSets !== undefined && !this._isFiniteNumber(day.actualSets)) {
            throw new Error(`Format invalide: semaine ${weekIndex + 1}, jour ${dayIndex + 1}, champ 'actualSets' numérique attendu`);
        }

        if (day.actualLastReps !== undefined && !this._isFiniteNumber(day.actualLastReps)) {
            throw new Error(`Format invalide: semaine ${weekIndex + 1}, jour ${dayIndex + 1}, champ 'actualLastReps' numérique attendu`);
        }
    }

    static _validateWeek(week, weekIndex) {
        if (!week || typeof week !== 'object') {
            throw new Error(`Format invalide: semaine ${weekIndex + 1} doit être un objet`);
        }

        const requiredNumbers = ['weekNumber', 'maxReps'];
        requiredNumbers.forEach((key) => {
            if (!this._isFiniteNumber(week[key])) {
                throw new Error(`Format invalide: semaine ${weekIndex + 1}, champ '${key}' numérique requis`);
            }
        });

        if (!this._isString(week.exerciseType) || week.exerciseType.trim() === '') {
            throw new Error(`Format invalide: semaine ${weekIndex + 1}, champ 'exerciseType' texte requis`);
        }

        if (!Array.isArray(week.program) || week.program.length === 0) {
            throw new Error(`Format invalide: semaine ${weekIndex + 1}, champ 'program' non vide requis`);
        }

        if (week.targetReps !== undefined && week.targetReps !== null && !this._isFiniteNumber(week.targetReps)) {
            throw new Error(`Format invalide: semaine ${weekIndex + 1}, champ 'targetReps' numérique attendu`);
        }

        week.program.forEach((day, dayIndex) => this._validateDay(day, weekIndex, dayIndex));
    }

    static _validateImportSchema(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Format invalide: objet JSON attendu');
        }

        if (!Array.isArray(data.allWeeks)) {
            throw new Error("Format invalide: champ 'allWeeks' (tableau) requis");
        }

        data.allWeeks.forEach((week, weekIndex) => this._validateWeek(week, weekIndex));
    }

    static async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const migrated = this._migrateData(data);
                    resolve(migrated);
                } catch (err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
}
