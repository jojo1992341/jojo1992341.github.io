// Configuration globale
window.CONFIG = {
    // Paliers de difficulté (RPE - Rate of Perceived Exertion)
    RPE: {
        FACILE: 1,
        MODERE: 2,
        DIFFICILE: 3,
        ECHEC: 4
    },
    // Constantes pour l'algorithme
    ALGO: {
        INCREMENT_DEFAULT: 1.025, // +2.5%
        INCREMENT_EASY: 1.05,     // +5%
        DECREMENT_HARD: 0.95,     // -5%
        DECREMENT_FAILURE: 0.90,  // -10%
        VOLUME_MIN_WEEKLY: 50     // Reps minimum par semaine
    },
    RULES: {
        MIN_INTENSITY: 0.01, MAX_INTENSITY: 0.99,
        MAX_SETS: 60, MIN_SETS: 1,
        MIN_REST: 1, MAX_REST: 1200,
    },
    FEEDBACK: {
        TROP_FACILE: 'trop_facile',
        PARFAIT: 'parfait',
        DIFFICILE_FINI: 'difficile_fini',
        TROP_DIFFICILE: 'trop_difficile'
    },
    VOLUME_DISTRIBUTION: [
        { type: 'Modéré', coeff: 0.18 },
        { type: 'Intense', coeff: 0.22 },
        { type: 'Léger', coeff: 0.12 },
        { type: 'Intense', coeff: 0.22 },
        { type: 'Modéré', coeff: 0.18 },
        { type: 'Léger', coeff: 0.08 }
    ],
    STORAGE_KEY: 'coachProgressionData_v5',
    FILTER_STORAGE_KEY: 'coachProgressionFilters_v6'
};
