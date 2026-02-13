const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class LocalStorageMock {
    constructor() { this.store = new Map(); }
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
    setItem(key, value) { this.store.set(key, String(value)); }
    removeItem(key) { this.store.delete(key); }
    clear() { this.store.clear(); }
}

function loadScript(relPath) {
    const abs = path.join(process.cwd(), relPath);
    const code = fs.readFileSync(abs, 'utf8');
    vm.runInThisContext(code, { filename: relPath });
}

function bootstrapRuntime() {
    global.window = global;
    global.localStorage = new LocalStorageMock();

    loadScript('js/config.js');
    loadScript('js/services/storage.service.js');
    loadScript('js/services/filter.service.js');
    loadScript('js/models/training.model.js');
}

test('TrainingModel.generateWeek crée une semaine valide', () => {
    bootstrapRuntime();

    const week = window.TrainingModel.generateWeek(1, 20, 'pompes');

    assert.equal(week.weekNumber, 1);
    assert.equal(week.exerciseType, 'pompes');
    assert.equal(week.program.length, 13);
    assert.equal(week.program[0].dayType, 'Test');
    assert.equal(week.fractionnementApplique, false);
});

test('TrainingModel expose fractionnementApplique=true après échec sévère précédent', () => {
    bootstrapRuntime();

    const prevWeek = window.TrainingModel.generateWeek(1, 20, 'pompes');
    const previousDay2 = prevWeek.program.find((d) => d.day === 2);
    previousDay2.feedback = window.CONFIG.FEEDBACK.TROP_DIFFICILE;
    previousDay2.actualSets = 0;
    previousDay2.actualLastReps = 0;

    const week2 = window.TrainingModel.generateWeek(2, 20, 'pompes', prevWeek);

    assert.equal(week2.fractionnementApplique, true);
    assert.equal(week2.program.some((d) => d.fractionnementApplique), true);
});

test('StorageService valide un schéma d\'import correct', () => {
    bootstrapRuntime();

    const data = {
        allWeeks: [{
            weekNumber: 1,
            exerciseType: 'pompes',
            maxReps: 25,
            targetReps: 40,
            program: [{ day: 1, dayType: 'Test', sets: 1, reps: 25, rest: 0, feedback: null }]
        }]
    };

    assert.doesNotThrow(() => window.StorageService._validateImportSchema(data));
});

test('StorageService rejette un feedback invalide', () => {
    bootstrapRuntime();

    const badData = {
        allWeeks: [{
            weekNumber: 1,
            exerciseType: 'pompes',
            maxReps: 25,
            program: [{ day: 2, dayType: 'Modéré', sets: 5, reps: 5, rest: 60, feedback: 'invalid' }]
        }]
    };

    assert.throws(() => window.StorageService._validateImportSchema(badData), /feedback inconnu/);
});

test('FilterService charge les filtres par défaut puis persiste les changements', () => {
    bootstrapRuntime();

    const filters = new window.FilterService();
    assert.equal(filters.getFilter('statMetric'), 'max');

    filters.setFilter('tableFilter', 'intense');

    const persisted = JSON.parse(localStorage.getItem(window.CONFIG.FILTER_STORAGE_KEY));
    assert.equal(persisted.tableFilter, 'intense');
});


test('StorageService migre un payload legacy (weeks/type/max) vers le schéma courant', () => {
    bootstrapRuntime();

    const legacy = {
        weeks: [{
            exercise: 'pompes',
            max: 22,
            program: [{ day: 1, type: 'Test', sets: 1, reps: 22 }]
        }]
    };

    const migrated = window.StorageService._migrateData(legacy);

    assert.equal(migrated.schemaVersion, 2);
    assert.equal(Array.isArray(migrated.allWeeks), true);
    assert.equal(migrated.allWeeks[0].exerciseType, 'pompes');
    assert.equal(migrated.allWeeks[0].maxReps, 22);
    assert.equal(migrated.allWeeks[0].program[0].dayType, 'Test');
    assert.equal(migrated.allWeeks[0].program[0].rest, 0);
});

test('StorageService.load applique migration/versioning sur données stockées legacy', () => {
    bootstrapRuntime();

    localStorage.setItem(window.CONFIG.STORAGE_KEY, JSON.stringify({
        trainingWeeks: [{
            weekNumber: 3,
            exercise: 'abdominaux',
            max: 30,
            program: [{ day: 1, type: 'Test', sets: 1, reps: 30 }]
        }]
    }));

    const loaded = window.StorageService.load();

    assert.equal(loaded.schemaVersion, 2);
    assert.equal(loaded.allWeeks.length, 1);
    assert.equal(loaded.allWeeks[0].exerciseType, 'abdominaux');
    assert.equal(loaded.allWeeks[0].maxReps, 30);
});
