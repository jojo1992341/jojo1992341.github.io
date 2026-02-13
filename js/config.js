// Configuration globale - v7.0
window.CONFIG = {
    // Paliers de difficulté (RPE - Rate of Perceived Exertion)
    RPE: {
        FACILE: 1,
        MODERE: 2,
        DIFFICILE: 3,
        ECHEC: 4
    },
    // Constantes pour l'algorithme de progression de base
    ALGO: {
        INCREMENT_DEFAULT: 1.025,
        INCREMENT_EASY: 1.05,
        DECREMENT_HARD: 0.95,
        DECREMENT_FAILURE: 0.90,
        VOLUME_MIN_WEEKLY: 50
    },
    // Constantes pour le sélecteur d'algorithme
    ALGO_SELECTOR: {
        EXPLORATION_BONUS: 0.8,       // Bonus si algo non utilisé depuis 4+ semaines
        EXPLORATION_BONUS_3W: 0.4,    // Bonus si non utilisé depuis 3 semaines
        MIN_WEEKS_TO_EXPLOIT: 5,      // Semaines avant de passer en mode "exploitation"
        DEFAULT_ALGO: 'GTG'           // Algorithme par défaut (1ère semaine)
    },
    RULES: {
        MIN_INTENSITY: 0.01, MAX_INTENSITY: 0.99,
        MAX_SETS: 60, MIN_SETS: 1,
        MIN_REST: 1, MAX_REST: 1200,
    },
    FEEDBACK: {
        TROP_FACILE:    'trop_facile',
        PARFAIT:        'parfait',
        DIFFICILE_FINI: 'difficile_fini',
        TROP_DIFFICILE: 'trop_difficile'
    },
    // Distribution utilisée comme base de structure hebdomadaire
    // (chaque entrée = 1 jour calendaire, 2 sessions matin/soir)
    VOLUME_DISTRIBUTION: [
        { type: 'Modéré',  coeff: 0.18 },
        { type: 'Intense', coeff: 0.22 },
        { type: 'Léger',   coeff: 0.12 },
        { type: 'Intense', coeff: 0.22 },
        { type: 'Modéré',  coeff: 0.18 },
        { type: 'Léger',   coeff: 0.08 }
    ],
    STORAGE_KEY: 'coachProgressionData_v5',
    FILTER_STORAGE_KEY: 'coachProgressionFilters_v6'
};
