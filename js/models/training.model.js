/**
 * TRAINING MODEL - v7.0
 * 5 Algorithmes de progression scientifiques + Sélecteur automatique hebdomadaire
 * Basé sur les retours utilisateur (RPE) pour choisir l'algo optimal chaque semaine.
 */

// ============================================================
// REGISTRE DES 5 ALGORITHMES
// ============================================================
window.TRAINING_ALGORITHMS = {
    GTG: {
        id: 'GTG',
        name: 'Grease The Groove',
        icon: '🔥',
        author: 'Pavel Tsatsouline',
        description: 'Entraînement neurologique sub-maximal (50% du max). Haute fréquence, jamais jusqu\'à l\'échec. Idéal pour progresser vite sans fatigue.',
        color: '#10B981',
        bestFor: 'Débutants, plateaux, récupération'
    },
    RUSSIAN_FIGHTER: {
        id: 'RUSSIAN_FIGHTER',
        name: 'Russian Fighter',
        icon: '⚔️',
        author: 'Pavel Tsatsouline',
        description: 'Séries en échelle décroissante (50%→10% du max par session). Programme militaire russe pour la force ET l\'endurance musculaire.',
        color: '#EF4444',
        bestFor: 'Intermédiaires, force et endurance'
    },
    ARMSTRONG: {
        id: 'ARMSTRONG',
        name: 'Armstrong Push-up',
        icon: '🏋️',
        author: 'Maj. Charles Lewis Armstrong',
        description: 'Programme militaire américain. Cycles Léger→Modéré→Intense + série max quotidienne le soir. Référence absolue pour les pompes.',
        color: '#F59E0B',
        bestFor: 'Intermédiaires/avancés, record absolu'
    },
    DENSITY: {
        id: 'DENSITY',
        name: 'Density Training',
        icon: '⏱️',
        author: 'Mountain Tactical Institute',
        description: 'Accumulation maximale de volume sur des blocs chronométrés (40-50% du max). Développe la capacité de travail totale et la résistance à la fatigue.',
        color: '#6366F1',
        bestFor: 'Tout niveau, endurance musculaire'
    },
    WAVE_531: {
        id: 'WAVE_531',
        name: '5-3-1 Wave Loading',
        icon: '🌊',
        author: 'Jim Wendler (adapté)',
        description: 'Périodisation en vagues: 65%→75%→85%→décharge (4 semaines). La méthode scientifique de référence pour la progression à long terme.',
        color: '#8B5CF6',
        bestFor: 'Avancés, progression constante long terme'
    }
};

// ============================================================
// TRAINING MODEL
// ============================================================
window.TrainingModel = class TrainingModel {

    // ==========================================================
    // POINT D'ENTRÉE PRINCIPAL
    // ==========================================================
    static generateWeek(weekNumber, maxReps, exerciseType, previousWeek = null, targetReps = null) {
        const allWeeks = StorageService.load().allWeeks || [];
        const relevantWeeks = allWeeks.filter(w => w.exerciseType === exerciseType);

        // 1. Sélectionner le meilleur algorithme via le système de scoring
        const { algoId, selectionReason, algoScores } = this._selectBestAlgorithm(relevantWeeks, previousWeek);
        const algo = window.TRAINING_ALGORITHMS[algoId];

        // 2. Calculer les données de progression communes (rétro-compat)
        const progressionData = this._calculateProgression(maxReps, previousWeek);

        // 3. Jour 1: Test de référence
        const day1 = this._createTestDay(maxReps);

        // 4. Générer les jours d'entraînement selon l'algorithme choisi
        const trainingDays = this._generateAlgoDays(
            algoId, weekNumber, maxReps, progressionData, previousWeek, relevantWeeks
        );

        // 5. Détection de plateau et conseils globaux
        const plateauDetection = this._detectPlateau(previousWeek, allWeeks, exerciseType);
        const globalAdvice = this._generateGlobalAdvice(
            maxReps, previousWeek, progressionData, plateauDetection, algoId, selectionReason, algoScores
        );
        const finalTarget = targetReps || (previousWeek ? previousWeek.targetReps : null);

        const program = [day1, ...trainingDays];
        const totalVolume = program.reduce((acc, day) => acc + (day.sets * day.reps), 0);

        return {
            weekNumber,
            exerciseType,
            maxReps,
            targetReps: finalTarget,
            program,
            totalVolume,
            date: new Date().toISOString(),
            progressionFactor: progressionData.factor,
            globalAdvice,
            dayTypePerformance: progressionData.dayTypePerformance,
            plateauInfo: plateauDetection,
            adaptationMetrics: progressionData.adaptationMetrics,
            volumeCompletionRate: progressionData.volumeCompletionRate,
            criticalFailure: progressionData.criticalFailure,
            consecutiveFailures: progressionData.consecutiveFailures,
            // Nouvelles propriétés algorithme
            algoId,
            algoName: algo.name,
            algoIcon: algo.icon,
            algoAuthor: algo.author,
            algoDescription: algo.description,
            selectionReason,
            algoScores
        };
    }

    // ==========================================================
    // SÉLECTEUR D'ALGORITHME (IA basée sur feedback)
    // ==========================================================
    static _selectBestAlgorithm(relevantWeeks, previousWeek) {
        const allAlgoIds = Object.keys(window.TRAINING_ALGORITHMS);

        // Semaine 1: commencer avec GTG (meilleure entrée pour tous les niveaux)
        if (relevantWeeks.length === 0) {
            return {
                algoId: 'GTG',
                selectionReason: '🚀 Première semaine — Grease The Groove est l\'algorithme idéal pour calibrer votre niveau et commencer à progresser rapidement.',
                algoScores: {}
            };
        }

        // Compter l'usage de chaque algorithme
        const usageCount = {};
        allAlgoIds.forEach(id => usageCount[id] = 0);
        relevantWeeks.forEach(w => {
            if (w.algoId && usageCount[w.algoId] !== undefined) usageCount[w.algoId]++;
        });

        // Phase d'exploration: si certains algos n'ont jamais été testés, les essayer
        const untestedAlgos = allAlgoIds.filter(id => usageCount[id] === 0);
        if (untestedAlgos.length > 0) {
            const nextAlgo = untestedAlgos[0];
            const algo = window.TRAINING_ALGORITHMS[nextAlgo];
            return {
                algoId: nextAlgo,
                selectionReason: `🧪 Phase d'exploration — Test de l'algorithme <strong>${algo.name}</strong> (${algo.icon}) pour découvrir votre méthode idéale. ${algo.description}`,
                algoScores: this._computeAllScores(relevantWeeks, allAlgoIds)
            };
        }

        // Phase d'exploitation: scorer tous les algos et choisir le meilleur
        const scores = this._computeAllScores(relevantWeeks, allAlgoIds);

        // Bonus d'exploration: éviter de rester coincé sur 1 seul algo
        const scoredWithBonus = {};
        allAlgoIds.forEach(id => {
            // Trouver depuis combien de semaines cet algo n'a pas été utilisé
            const recentUsage = [...relevantWeeks].reverse().findIndex(w => w.algoId === id);
            const unusedBonus = recentUsage >= 4 ? 0.8 : (recentUsage >= 3 ? 0.4 : 0);
            scoredWithBonus[id] = (scores[id] || 0) + unusedBonus;
        });

        const bestAlgoId = Object.entries(scoredWithBonus)
            .reduce((best, [id, score]) => score > best[1] ? [id, score] : best, ['GTG', -Infinity])[0];

        const bestAlgo = window.TRAINING_ALGORITHMS[bestAlgoId];
        const score = scores[bestAlgoId];
        const weeksUsed = usageCount[bestAlgoId];

        // Générer la raison de sélection
        let reason = `🤖 Sélection automatique — <strong>${bestAlgo.icon} ${bestAlgo.name}</strong> a obtenu le meilleur score basé sur vos ${relevantWeeks.filter(w=>w.algoId===bestAlgoId).reduce((acc,w)=>{return acc+(w.program||[]).filter(d=>d.feedback&&d.day!==1).length},0)} retours (score: ${score > 0 ? '+' : ''}${score.toFixed(1)}). `;

        if (score > 3) reason += 'Vos feedbacks indiquent que cet algorithme est parfaitement calibré pour vous. ';
        else if (score > 1) reason += 'Cet algorithme produit de bonnes sensations selon vos retours. ';
        else if (score === 0) reason += 'Toujours en phase de calibrage — continuez à noter vos séances. ';
        else reason += 'Résultat mitigé, mais c\'est actuellement le meilleur disponible. Variez les retours pour affiner. ';

        reason += `<em>Meilleur pour: ${bestAlgo.bestFor}</em>`;

        return { algoId: bestAlgoId, selectionReason: reason, algoScores: scores };
    }

    static _computeAllScores(relevantWeeks, allAlgoIds) {
        const scores = {};
        allAlgoIds.forEach(id => {
            scores[id] = this._scoreAlgorithm(relevantWeeks, id);
        });
        return scores;
    }

    /**
     * Score un algorithme selon les feedbacks RPE et les gains de max.
     * Système de points:
     *   😊 Trop facile   → -0.5  (mauvaise calibration, trop léger)
     *   👍 Parfait       → +2.0  (optimal, continuer)
     *   😅 Difficile fini → +1.0 (bon challenge, progression en cours)
     *   😰 Impossible    → -2.0  (surcharge, adapter)
     *   Gain de max      → +3.0  (résultat concret, meilleur indicateur)
     *   Baisse de max    → -1.0
     */
    static _scoreAlgorithm(weeks, algoId) {
        const algoWeeks = weeks.filter(w => w.algoId === algoId);
        if (algoWeeks.length === 0) return 0;

        let totalScore = 0;
        let dataPoints = 0;

        algoWeeks.forEach((week, wi) => {
            const trainingDays = (week.program || []).filter(d => d.day !== 1 && d.feedback);
            trainingDays.forEach(d => {
                dataPoints++;
                switch (d.feedback) {
                    case 'parfait':         totalScore += 2.0;  break;
                    case 'difficile_fini':  totalScore += 1.0;  break;
                    case 'trop_facile':     totalScore -= 0.5;  break;
                    case 'trop_difficile':  totalScore -= 2.0;  break;
                }
            });

            // Bonus/malus sur l'évolution du max (indicateur de résultats réels)
            if (wi > 0) {
                const prevWeek = algoWeeks[wi - 1];
                if (week.maxReps > prevWeek.maxReps) totalScore += 3.0;
                else if (week.maxReps < prevWeek.maxReps) totalScore -= 1.0;
            }
        });

        return dataPoints > 0 ? totalScore / dataPoints : 0;
    }

    // ==========================================================
    // DISPATCHER D'ALGORITHMES
    // ==========================================================
    static _generateAlgoDays(algoId, weekNumber, maxReps, progressionData, previousWeek, allWeeks) {
        switch (algoId) {
            case 'GTG':            return this._generateGTGDays(maxReps, progressionData, previousWeek);
            case 'RUSSIAN_FIGHTER': return this._generateRussianFighterDays(maxReps, progressionData, previousWeek);
            case 'ARMSTRONG':      return this._generateArmstrongDays(maxReps, progressionData, previousWeek);
            case 'DENSITY':        return this._generateDensityDays(maxReps, progressionData, previousWeek);
            case 'WAVE_531':       return this._generateWaveDays(weekNumber, maxReps, progressionData, previousWeek);
            default:               return this._generateGTGDays(maxReps, progressionData, previousWeek);
        }
    }

    // ==========================================================
    // ALGORITHME 1: GREASE THE GROOVE (GTG)
    // Pavel Tsatsouline — Sub-maximal, haute fréquence
    // Principe: 50% du max, jamais jusqu'à l'échec, plusieurs fois/jour
    // Neuroscience: myélinisation des voies motrices par répétition qualitative
    // ==========================================================
    static _generateGTGDays(maxReps, progressionData, previousWeek) {
        const factor = Math.max(0.85, Math.min(1.15, progressionData.factor));
        const DIST = window.CONFIG.VOLUME_DISTRIBUTION;
        const sessions = [];

        // GTG: 50% du max par série. Ne jamais aller à l'échec.
        const baseReps = Math.max(1, Math.round(maxReps * 0.50 * factor));

        const adjustedReps = this._adjustRepsFromFeedback(baseReps, previousWeek, 'GTG');

        DIST.forEach((dist, i) => {
            const calendarDay = i + 2;
            // Matin: volume principal — 5 à 8 séries légères
            const morningSets = Math.max(4, Math.min(10, Math.round(6 * (dist.coeff / 0.18))));
            const morningReps = Math.max(1, adjustedReps);

            sessions.push({
                day: (i * 2) + 2,
                dayType: 'GTG Matin',
                sets: morningSets,
                reps: morningReps,
                rest: 30,
                calendarDay,
                timeOfDay: 'Matin',
                intensity: 50,
                explanation: `🔥 <strong>GREASE THE GROOVE — Matin</strong> (Pavel Tsatsouline)<br>` +
                    `${morningSets} séries × ${morningReps} reps à <strong>50% de votre max</strong>. ` +
                    `N'allez JAMAIS à l'échec ! Repos 30s entre les séries. ` +
                    `Répartissez si possible sur la matinée. ` +
                    `Objectif: répétition parfaite pour graisser les sillons neuromusculaires.`,
                feedback: null
            });

            // Soir: consolidation — 4 à 6 séries, légèrement moins
            const eveningSets = Math.max(3, Math.round(morningSets * 0.70));
            const eveningReps = Math.max(1, Math.round(morningReps * 0.85));

            sessions.push({
                day: (i * 2) + 3,
                dayType: 'GTG Soir',
                sets: eveningSets,
                reps: eveningReps,
                rest: 30,
                calendarDay,
                timeOfDay: 'Soir',
                intensity: 42,
                explanation: `🔥 <strong>GREASE THE GROOVE — Soir</strong><br>` +
                    `${eveningSets} séries × ${eveningReps} reps. Séance courte pour consolider. ` +
                    `Arrêtez si vous êtes fatigué — la fraîcheur est obligatoire en GTG. ` +
                    `Volume total journée: <strong>${morningSets * morningReps + eveningSets * eveningReps} reps</strong>.`,
                feedback: null
            });
        });

        return sessions;
    }

    // ==========================================================
    // ALGORITHME 2: RUSSIAN FIGHTER PULL-UP (adapté pompes/abdos)
    // Pavel Tsatsouline — Échelle décroissante quotidienne
    // Principe: 5 séries/session en descente (50→40→30→20→10% du max)
    // Programme russe militaire éprouvé
    // ==========================================================
    static _generateRussianFighterDays(maxReps, progressionData, previousWeek) {
        const factor = Math.max(0.85, Math.min(1.15, progressionData.factor));
        const DIST = window.CONFIG.VOLUME_DISTRIBUTION;
        const sessions = [];

        // Ladder: pourcentages du max pour les 5 séries
        const LADDER_PCT = [0.50, 0.40, 0.30, 0.20, 0.10];

        DIST.forEach((dist, i) => {
            const calendarDay = i + 2;
            // Intensité légèrement croissante au fil de la semaine
            const dayFactor = factor * (0.85 + i * 0.03);

            const ladderReps = LADDER_PCT.map(pct =>
                Math.max(1, Math.round(maxReps * pct * dayFactor))
            );
            const totalMorning = ladderReps.reduce((a, b) => a + b, 0);

            // Matin: DESCENTE (fort → faible)
            sessions.push({
                day: (i * 2) + 2,
                dayType: `Échelle ↓ J${i + 1}`,
                sets: LADDER_PCT.length,
                reps: ladderReps[0],
                rest: 60,
                calendarDay,
                timeOfDay: 'Matin',
                intensity: 50,
                _ladderReps: ladderReps,
                explanation: `⚔️ <strong>RUSSIAN FIGHTER — Jour ${i + 1} Matin (Descente)</strong><br>` +
                    `5 séries en échelle décroissante: <strong>${ladderReps.join(' → ')} reps</strong>. ` +
                    `Repos 60s entre séries. Total: ${totalMorning} reps. ` +
                    `Démarrer fort et descendre progressivement développe force ET endurance en une seule session.`,
                feedback: null
            });

            // Soir: MONTÉE (faible → fort) — inverse pour la récupération active
            const eveningLadder = [...ladderReps].reverse();
            const totalEvening = eveningLadder.reduce((a, b) => a + b, 0);

            sessions.push({
                day: (i * 2) + 3,
                dayType: `Échelle ↑ J${i + 1}`,
                sets: LADDER_PCT.length,
                reps: eveningLadder[0],
                rest: 90,
                calendarDay,
                timeOfDay: 'Soir',
                intensity: 30,
                _ladderReps: eveningLadder,
                explanation: `⚔️ <strong>RUSSIAN FIGHTER — Jour ${i + 1} Soir (Montée)</strong><br>` +
                    `Montée ascendante: <strong>${eveningLadder.join(' → ')} reps</strong>. ` +
                    `Repos 90s entre séries. Total: ${totalEvening} reps. ` +
                    `Terminer plus fort qu'on a commencé — principe clé du programme russe.`,
                feedback: null
            });
        });

        return sessions;
    }

    // ==========================================================
    // ALGORITHME 3: ARMSTRONG PUSH-UP PROGRAM
    // Maj. Charles Lewis Armstrong (USMC) — Programme militaire américain
    // Principe: 5 séries le matin (Léger/Modéré/Intense en cycle) + 1 série max le soir
    // Utilisé pour préparer les tests physiques militaires
    // ==========================================================
    static _generateArmstrongDays(maxReps, progressionData, previousWeek) {
        const factor = Math.max(0.85, Math.min(1.15, progressionData.factor));
        const DIST = window.CONFIG.VOLUME_DISTRIBUTION;
        const sessions = [];

        // Cycle Armstrong: L-M-L-I-M-L sur 6 jours
        const CYCLES = [
            { label: 'Léger',   pct: 0.60, sets: 5, rest: 60 },
            { label: 'Modéré',  pct: 0.70, sets: 5, rest: 90 },
            { label: 'Léger',   pct: 0.60, sets: 5, rest: 60 },
            { label: 'Intense', pct: 0.80, sets: 4, rest: 120 },
            { label: 'Modéré',  pct: 0.70, sets: 5, rest: 90 },
            { label: 'Léger',   pct: 0.60, sets: 5, rest: 60 }
        ];

        DIST.forEach((dist, i) => {
            const calendarDay = i + 2;
            const cycle = CYCLES[i];
            const morningReps = Math.max(1, Math.round(maxReps * cycle.pct * factor));

            // Matin: séries cyclées (L/M/I)
            sessions.push({
                day: (i * 2) + 2,
                dayType: cycle.label,
                sets: cycle.sets,
                reps: morningReps,
                rest: cycle.rest,
                calendarDay,
                timeOfDay: 'Matin',
                intensity: Math.round(cycle.pct * 100),
                explanation: `🏋️ <strong>ARMSTRONG — ${cycle.label} (${Math.round(cycle.pct * 100)}%)</strong><br>` +
                    `${cycle.sets} séries × ${morningReps} reps. Repos ${cycle.rest}s entre séries. ` +
                    `<em>Règle d'or Armstrong:</em> restez à 2 reps de l'échec absolu. ` +
                    `${cycle.label === 'Intense' ? '⚡ Jour intense: repoussez vos limites mais gardez la technique !' : ''}`,
                feedback: null
            });

            // Soir: SÉRIE MAX unique — cœur du programme Armstrong
            const eveTarget = Math.max(1, Math.round(morningReps * 1.15));
            sessions.push({
                day: (i * 2) + 3,
                dayType: 'Série Max',
                sets: 1,
                reps: eveTarget,
                rest: 0,
                calendarDay,
                timeOfDay: 'Soir',
                intensity: 90,
                explanation: `🏋️ <strong>ARMSTRONG — Série Max Soir</strong><br>` +
                    `1 série max (~${eveTarget} reps). Donnez absolument tout ! ` +
                    `Arrêtez uniquement si votre technique se dégrade. ` +
                    `Cette série quotidienne est le cœur du programme Armstrong — notez votre résultat pour vous battre demain.`,
                feedback: null
            });
        });

        return sessions;
    }

    // ==========================================================
    // ALGORITHME 4: DENSITY TRAINING
    // Mountain Tactical Institute — Travail par densité chronométrée
    // Principe: accumuler max de volume sur des blocs de temps fixe
    // % du max toutes les X secondes pendant Y minutes
    // Développe la résistance à la fatigue + capacité de travail
    // ==========================================================
    static _generateDensityDays(maxReps, progressionData, previousWeek) {
        const factor = Math.max(0.85, Math.min(1.15, progressionData.factor));
        const DIST = window.CONFIG.VOLUME_DISTRIBUTION;
        const sessions = [];

        const DENSITY_CONFIG = [
            { label: 'Densité Modérée', pct: 0.40, blockMin: 8,  restSec: 20 },
            { label: 'Densité Haute',   pct: 0.50, blockMin: 8,  restSec: 15 },
            { label: 'Densité Légère',  pct: 0.35, blockMin: 8,  restSec: 25 },
            { label: 'Densité Haute',   pct: 0.50, blockMin: 10, restSec: 15 },
            { label: 'Densité Modérée', pct: 0.40, blockMin: 8,  restSec: 20 },
            { label: 'Densité Légère',  pct: 0.35, blockMin: 6,  restSec: 30 }
        ];

        DIST.forEach((dist, i) => {
            const calendarDay = i + 2;
            const dc = DENSITY_CONFIG[i];
            const repsPerSet = Math.max(1, Math.round(maxReps * dc.pct * factor));
            const avgRepTime = 2; // secondes par rep
            const setTime = repsPerSet * avgRepTime + dc.restSec;
            const estimatedSets = Math.max(3, Math.floor((dc.blockMin * 60) / setTime));
            const totalReps = estimatedSets * repsPerSet;

            // Matin: bloc densité principal
            sessions.push({
                day: (i * 2) + 2,
                dayType: dc.label,
                sets: estimatedSets,
                reps: repsPerSet,
                rest: dc.restSec,
                calendarDay,
                timeOfDay: 'Matin',
                intensity: Math.round(dc.pct * 100),
                explanation: `⏱️ <strong>DENSITY TRAINING — ${dc.label}</strong> (MTI)<br>` +
                    `${repsPerSet} reps toutes les ~${dc.restSec + repsPerSet * avgRepTime}s pendant <strong>${dc.blockMin} minutes</strong>. ` +
                    `Estimé: ${estimatedSets} séries (~${totalReps} reps total). ` +
                    `Gardez le rythme — la densité s'améliore chaque semaine. ` +
                    `Comptez vos séries complètes pour vous battre la prochaine fois !`,
                feedback: null
            });

            // Soir: AMRAP 5 minutes (As Many Reps As Possible)
            const eveReps = Math.max(1, Math.round(maxReps * 0.30 * factor));
            const eveSetTime = eveReps * avgRepTime + 20;
            const eveSets = Math.max(3, Math.floor((5 * 60) / eveSetTime));

            sessions.push({
                day: (i * 2) + 3,
                dayType: 'AMRAP 5min',
                sets: eveSets,
                reps: eveReps,
                rest: 20,
                calendarDay,
                timeOfDay: 'Soir',
                intensity: 30,
                explanation: `⏱️ <strong>DENSITY — AMRAP Soir</strong><br>` +
                    `Maximum de reps en <strong>5 minutes</strong>: ${eveReps} reps/série, repos 20s. ` +
                    `Estimé: ~${eveSets} séries. ` +
                    `Notez votre total et battez-le la prochaine fois — c'est l'indicateur de progression du density training.`,
                feedback: null
            });
        });

        return sessions;
    }

    // ==========================================================
    // ALGORITHME 5: 5-3-1 WAVE LOADING (adapté bodyweight)
    // Jim Wendler — Périodisation en vagues
    // Cycle 4 semaines: 65%→75%→85%→décharge, puis recommencer +5%
    // La référence scientifique pour la progression à long terme
    // ==========================================================
    static _generateWaveDays(weekNumber, maxReps, progressionData, previousWeek) {
        const factor = Math.max(0.85, Math.min(1.15, progressionData.factor));
        const DIST = window.CONFIG.VOLUME_DISTRIBUTION;
        const sessions = [];

        // Déterminer la phase de vague (1-4) selon le numéro de semaine dans le cycle
        const wavePhase = ((weekNumber - 1) % 4) + 1;

        const WAVE_CONFIG = {
            1: { label: 'Semaine 5 Reps (65%)',  pct: 0.65, sets: 5, rest: 60,  desc: 'Phase de construction — 5 séries modérées. Construisez la base.' },
            2: { label: 'Semaine 3 Reps (75%)',  pct: 0.75, sets: 3, rest: 90,  desc: 'Phase de progression — 3 séries plus lourdes. Challengez-vous.' },
            3: { label: 'Semaine 1 Rep (85%)',   pct: 0.85, sets: 2, rest: 120, desc: '⚡ Phase intensive — Battez votre record personnel !' },
            4: { label: 'Décharge (40%)',        pct: 0.40, sets: 3, rest: 45,  desc: '🔄 Semaine de décharge — Récupération active. Indispensable pour progresser.' }
        };

        const wc = WAVE_CONFIG[wavePhase];
        const phaseLabel = `Phase ${wavePhase}/4`;

        DIST.forEach((dist, i) => {
            const calendarDay = i + 2;
            // Légère variation selon le type de jour
            const dayPctMultiplier = dist.type === 'Léger' ? 0.85 : dist.type === 'Intense' ? 1.10 : 1.0;
            const effectivePct = wc.pct * dayPctMultiplier;
            const reps = Math.max(1, Math.round(maxReps * effectivePct * factor));

            // Matin: séries principales de la vague
            sessions.push({
                day: (i * 2) + 2,
                dayType: `${wc.label}`,
                sets: wc.sets,
                reps,
                rest: wc.rest,
                calendarDay,
                timeOfDay: 'Matin',
                intensity: Math.round(effectivePct * 100),
                explanation: `🌊 <strong>5-3-1 WAVE — ${phaseLabel}: ${wc.label}</strong> (Wendler)<br>` +
                    `${wc.sets} séries × ${reps} reps à ${Math.round(effectivePct * 100)}% de votre max. ` +
                    `Repos ${wc.rest}s. <em>${wc.desc}</em>`,
                feedback: null
            });

            // Soir: Back-off sets (consolidation à intensité réduite)
            const backOffReps = Math.max(1, Math.round(reps * 0.80));
            const backOffSets = Math.max(2, wc.sets - 1);
            const backOffRest = Math.round(wc.rest * 0.75);

            sessions.push({
                day: (i * 2) + 3,
                dayType: `Back-off ${wavePhase === 4 ? '(Décharge)' : ''}`,
                sets: backOffSets,
                reps: backOffReps,
                rest: backOffRest,
                calendarDay,
                timeOfDay: 'Soir',
                intensity: Math.round(effectivePct * 80),
                explanation: `🌊 <strong>5-3-1 WAVE — Back-off Soir</strong><br>` +
                    `${backOffSets} séries × ${backOffReps} reps à intensité réduite. Repos ${backOffRest}s. ` +
                    `Les back-off sets consolident les gains du matin et accélèrent la récupération pour demain.`,
                feedback: null
            });
        });

        return sessions;
    }

    // ==========================================================
    // HELPERS PARTAGÉS
    // ==========================================================

    /** Ajuste les reps en fonction des feedbacks de la semaine précédente */
    static _adjustRepsFromFeedback(baseReps, previousWeek, algoId) {
        if (!previousWeek) return baseReps;
        const feedbacks = (previousWeek.program || [])
            .filter(d => d.day !== 1 && d.feedback)
            .map(d => d.feedback);
        if (feedbacks.length === 0) return baseReps;

        const failRate = feedbacks.filter(f => f === 'trop_difficile').length / feedbacks.length;
        const easyRate = feedbacks.filter(f => f === 'trop_facile').length / feedbacks.length;

        if (failRate > 0.4) return Math.max(1, Math.round(baseReps * 0.90));
        if (easyRate > 0.5) return Math.round(baseReps * 1.08);
        return baseReps;
    }

    static _createTestDay(maxReps) {
        return {
            day: 1,
            dayType: 'Test',
            sets: 1,
            reps: maxReps,
            rest: 0,
            explanation: "🎯 <strong>TEST DE RÉFÉRENCE</strong> — Réalisez votre maximum absolu en une seule série, technique parfaite. Ce résultat calibre TOUS les algorithmes. Soyez honnête : ni trop, ni trop peu.",
            feedback: null
        };
    }

    static _getBaseIntensity(type) {
        return type === 'Léger' ? 0.60 : (type === 'Modéré' ? 0.70 : 0.75);
    }

    // ==========================================================
    // ALGORITHME DE PROGRESSION (rétro-compatibilité)
    // ==========================================================
    static _calculateProgression(currentMax, previousWeek) {
        if (!previousWeek) return {
            factor: 1.0, dominantFeedback: null, volumeCompletionRate: 1.0,
            dayTypePerformance: {}, adaptationMetrics: {}, consecutiveFailures: 0, criticalFailure: false
        };

        const delta = (currentMax - previousWeek.maxReps) / previousWeek.maxReps;
        let totalPlannedVolume = 0, totalActualVolume = 0;
        const feedbacks = [];
        const dayTypePerformance = {
            'Léger':  { total: 0, easy: 0, perfect: 0, hard: 0, failure: 0, failureRate: 0, easyRate: 0 },
            'Modéré': { total: 0, easy: 0, perfect: 0, hard: 0, failure: 0, failureRate: 0, easyRate: 0 },
            'Intense':{ total: 0, easy: 0, perfect: 0, hard: 0, failure: 0, failureRate: 0, easyRate: 0 }
        };

        previousWeek.program.forEach(day => {
            if (day.day === 1) return;
            const planned = day.sets * day.reps;
            totalPlannedVolume += planned;

            // Trouver le type canonique (pour les algos custom, mapper vers Léger/Modéré/Intense)
            const canonicalType = this._mapDayTypeToCanonical(day.dayType);
            const perf = dayTypePerformance[canonicalType];
            if (perf) perf.total++;

            if (day.feedback === CONFIG.FEEDBACK.TROP_DIFFICILE && day.actualSets !== undefined) {
                const actual = (parseInt(day.actualSets) || 0) * day.reps + (parseInt(day.actualLastReps) || 0);
                totalActualVolume += actual;
                if (perf) perf.failure++;
                feedbacks.push(day.feedback);
            } else if (day.feedback === CONFIG.FEEDBACK.TROP_DIFFICILE) {
                totalActualVolume += planned * 0.75;
                if (perf) perf.failure++;
                feedbacks.push(day.feedback);
            } else {
                totalActualVolume += planned;
                if (day.feedback === CONFIG.FEEDBACK.TROP_FACILE && perf) perf.easy++;
                if (day.feedback === CONFIG.FEEDBACK.PARFAIT && perf) perf.perfect++;
                if (day.feedback === CONFIG.FEEDBACK.DIFFICILE_FINI && perf) perf.hard++;
                if (day.feedback) feedbacks.push(day.feedback);
            }
        });

        Object.values(dayTypePerformance).forEach(perf => {
            if (perf.total > 0) {
                perf.failureRate = perf.failure / perf.total;
                perf.easyRate = perf.easy / perf.total;
            }
        });

        const volumeCompletionRate = totalPlannedVolume > 0 ? (totalActualVolume / totalPlannedVolume) : 1.0;

        let dominant = CONFIG.FEEDBACK.PARFAIT;
        const totalF = feedbacks.length;
        if (totalF > 0) {
            if (feedbacks.includes(CONFIG.FEEDBACK.TROP_DIFFICILE)) dominant = CONFIG.FEEDBACK.TROP_DIFFICILE;
            else if (feedbacks.filter(f => f === CONFIG.FEEDBACK.DIFFICILE_FINI).length > totalF / 2) dominant = CONFIG.FEEDBACK.DIFFICILE_FINI;
            else if (feedbacks.filter(f => f === CONFIG.FEEDBACK.TROP_FACILE).length > totalF / 2) dominant = CONFIG.FEEDBACK.TROP_FACILE;
        }

        const criticalFailure = volumeCompletionRate < 0.60;
        let factor = 1.0;
        if (dominant === CONFIG.FEEDBACK.TROP_DIFFICILE) {
            factor = Math.max(0.70, volumeCompletionRate * 0.95);
        } else if (delta > 0.10) {
            factor = dominant === CONFIG.FEEDBACK.TROP_FACILE ? 1.15 : 1.10;
        } else if (delta > 0.03) {
            factor = 1.05;
        } else if (delta > -0.03) {
            factor = dominant === CONFIG.FEEDBACK.TROP_FACILE ? 1.08 : 1.0;
        } else {
            factor = 0.85;
        }

        const allWeeks = StorageService.load().allWeeks || [];
        const consecutiveFailures = this._countConsecutiveFailures(allWeeks, previousWeek.exerciseType);

        return { factor, dominantFeedback: dominant, volumeCompletionRate, dayTypePerformance,
            adaptationMetrics: { delta, totalF }, consecutiveFailures, criticalFailure };
    }

    static _mapDayTypeToCanonical(dayType) {
        if (!dayType) return 'Modéré';
        const dt = dayType.toLowerCase();
        if (dt.includes('léger') || dt.includes('leger') || dt.includes('light') || dt.includes('gtg soir') || dt.includes('décharge') || dt.includes('back-off')) return 'Léger';
        if (dt.includes('intense') || dt.includes('haute') || dt.includes('intense') || dt.includes('max') || dt.includes('amrap') || dt.includes('85')) return 'Intense';
        return 'Modéré';
    }

    static _countConsecutiveFailures(allWeeks, exerciseType) {
        const relevantWeeks = allWeeks.filter(w => w.exerciseType === exerciseType).reverse();
        let count = 0;
        for (const week of relevantWeeks) {
            const failureCount = (week.program || []).filter(d => d.feedback === CONFIG.FEEDBACK.TROP_DIFFICILE).length;
            if (failureCount > 0) count++;
            else break;
        }
        return count;
    }

    static _detectPlateau(previousWeek, allWeeks, exerciseType) {
        if (!previousWeek) return null;
        const weeks = allWeeks || StorageService.load().allWeeks || [];
        const sameExercise = weeks.filter(w => w.exerciseType === (exerciseType || previousWeek.exerciseType));
        if (sameExercise.length < 3) return { detected: false, weeksSinceGain: 0, suggestion: null };

        let weeksSinceGain = 0;
        let detected = false;
        let suggestion = null;

        for (let i = sameExercise.length - 1; i >= 0 && i >= sameExercise.length - 4; i--) {
            if (i > 0 && sameExercise[i].maxReps > sameExercise[i - 1].maxReps) {
                weeksSinceGain = sameExercise.length - i - 1;
                break;
            }
        }

        if (weeksSinceGain >= 3) {
            detected = true;
            suggestion = `Plateau de ${weeksSinceGain} semaines détecté. Le sélecteur d'algorithme va automatiquement choisir une nouvelle méthode pour casser ce plateau la prochaine semaine.`;
        } else if (weeksSinceGain === 2) {
            suggestion = "Stagnation depuis 2 semaines. Si ça continue, le sélecteur changera d'algorithme.";
        }

        return { detected, weeksSinceGain, suggestion };
    }

    // ==========================================================
    // CONSEILS GLOBAUX (enrichis avec info algo)
    // ==========================================================
    static _generateGlobalAdvice(currentMax, previousWeek, data, plateauInfo, algoId, selectionReason, algoScores) {
        const algo = window.TRAINING_ALGORITHMS[algoId];

        if (!previousWeek) {
            return `🚀 Bienvenue ! Programme démarré avec <strong>${algo.icon} ${algo.name}</strong> (${algo.author}).<br>` +
                `<em>${algo.description}</em><br><br>` +
                `Le système analysera vos feedbacks chaque semaine pour sélectionner automatiquement l'algorithme le plus adapté à votre progression.`;
        }

        const diff = currentMax - previousWeek.maxReps;
        let text = '';

        // Performance de la semaine
        if (diff > 0) {
            text = `✅ <strong>+${diff} rep${diff > 1 ? 's' : ''} !</strong> Progression ${previousWeek.maxReps} → ${currentMax}. `;
        } else if (diff === 0) {
            text = `➡️ <strong>Max stable</strong> (${currentMax} reps). Normal après un effort intense. `;
        } else {
            text = `⚠️ <strong>Légère baisse</strong>: ${previousWeek.maxReps} → ${currentMax} reps. Récupération insuffisante ? `;
        }

        // Adaptation feedback
        if (data.dominantFeedback === CONFIG.FEEDBACK.TROP_FACILE) {
            text += `Le programme précédent était trop facile (volume augmenté). `;
        } else if (data.dominantFeedback === CONFIG.FEEDBACK.TROP_DIFFICILE) {
            const pct = Math.round(data.volumeCompletionRate * 100);
            text += `Échec technique: ${pct}% du volume réalisé. `;
            
        } else if (data.dominantFeedback === CONFIG.FEEDBACK.DIFFICILE_FINI) {
            text += `Difficulté bien calibrée — progression modérée appliquée (+5%). `;
        } else {
            text += `Semaine bien gérée — progression continue (+3%). `;
        }

        // Plateau
        if (plateauInfo?.detected) {
            text += `<strong>⚠️ Plateau :</strong> ${plateauInfo.suggestion} `;
        }

        // Sélection algorithme
        text += `<hr style="margin:1rem 0; border-color:rgba(255,255,255,0.1)">`;
        text += `<strong>🤖 Algorithme semaine suivante:</strong> ${selectionReason}`;

        // Tableau des scores si disponible
        if (algoScores && Object.keys(algoScores).length > 0) {
            text += `<div style="margin-top:1rem; font-size:0.85rem; color:var(--text-muted)">`;
            text += `<strong>📊 Scores des algorithmes:</strong><br>`;
            const sortedScores = Object.entries(algoScores).sort((a, b) => b[1] - a[1]);
            sortedScores.forEach(([id, score]) => {
                const a = window.TRAINING_ALGORITHMS[id];
                const bar = '▓'.repeat(Math.max(0, Math.round((score + 2) * 2)));
                const scoreText = score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
                const isCurrent = id === algoId ? ' ← choisi' : '';
                text += `${a.icon} ${a.name}: <strong>${scoreText}</strong>${isCurrent}<br>`;
            });
            text += `</div>`;
        }

        return text;
    }

    // ==========================================================
    // PRÉDICTION ET ANALYSE
    // ==========================================================
    static calculatePrediction(currentMax, targetReps) {
        if (!targetReps || targetReps <= currentMax) return null;
        const weeklyGrowth = 1.05;
        const weeksNeeded = Math.ceil(Math.log(targetReps / currentMax) / Math.log(weeklyGrowth));
        const estimatedDate = new Date();
        estimatedDate.setDate(estimatedDate.getDate() + weeksNeeded * 7);
        return {
            weeksNeeded,
            estimatedDate: estimatedDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
            weeklyGrowthPct: Math.round((weeklyGrowth - 1) * 100)
        };
    }

    static generateOverview(currentWeek, allWeeks) {
        if (!currentWeek) return '';
        let html = `<p><strong>Situation actuelle :</strong> ${currentWeek.globalAdvice || ''}</p>`;

        if (currentWeek.dayTypePerformance) {
            html += '<div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed var(--text-muted);">';
            html += '<h4 style="font-size: 0.9rem; color: var(--text-dim); margin-bottom: 1rem; text-transform: uppercase;">Performance par Type de Jour</h4>';
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">';

            ['Léger', 'Modéré', 'Intense'].forEach(type => {
                const perf = currentWeek.dayTypePerformance[type];
                if (perf && perf.total > 0) {
                    const failurePct = Math.round(perf.failureRate * 100);
                    const easyPct = Math.round(perf.easyRate * 100);
                    const perfectPct = Math.round((perf.perfect / perf.total) * 100);
                    const hardPct = Math.round((perf.hard / perf.total) * 100);

                    let statusColor = 'var(--success)', statusText = '✓ Adapté';
                    if (failurePct > 30) { statusColor = 'var(--danger)'; statusText = '⚠️ Trop difficile'; }
                    else if (easyPct > 40) { statusColor = 'var(--warning)'; statusText = '↑ Trop facile'; }

                    html += `<div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; border-left: 3px solid ${statusColor};">
                        <div style="font-weight: 600; font-size: 0.9rem; color: white; margin-bottom: 0.5rem;">${type}</div>
                        <div style="font-size: 0.75rem; color: ${statusColor}; margin-bottom: 0.5rem;">${statusText}</div>
                        <div style="font-size: 0.75rem; display: flex; flex-direction: column; gap: 2px; color: var(--text-muted);">
                            ${failurePct > 0 ? `<span>❌ Échec: ${failurePct}%</span>` : ''}
                            ${perfectPct > 0 ? `<span>👍 Parfait: ${perfectPct}%</span>` : ''}
                            ${easyPct > 0 ? `<span>😊 Facile: ${easyPct}%</span>` : ''}
                            ${hardPct > 0 ? `<span>😅 Difficile: ${hardPct}%</span>` : ''}
                        </div>
                    </div>`;
                }
            });
            html += '</div></div>';
        }

        // Afficher l'algo actif et les scores
        if (currentWeek.algoId && window.TRAINING_ALGORITHMS) {
            const algo = window.TRAINING_ALGORITHMS[currentWeek.algoId];
            if (algo) {
                html += `<div style="margin-top:1.5rem; padding:1rem; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">`;
                html += `<div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem">Algorithme actif</div>`;
                html += `<div style="font-weight:700; color:white">${algo.icon} ${algo.name}</div>`;
                html += `<div style="font-size:0.85rem; color:var(--text-dim); margin-top:0.3rem">${algo.description}</div>`;
                html += `</div>`;
            }
        }

        return html;
    }

    static generateOptimization(currentWeek) {
        if (!currentWeek) return '';
        let html = '<div style="background: rgba(0, 212, 255, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #00D4FF;">';

        const weeklyAvgProgress = currentWeek.adaptationMetrics?.delta ? Math.round(currentWeek.adaptationMetrics.delta * 100) : 0;
        if (weeklyAvgProgress > 5) {
            html += `<p><strong>🚀 Progression solide</strong><br>Vous progressez bien (+${weeklyAvgProgress}%). L'algorithme actuel est efficace — le sélecteur le confirmera si la tendance continue.</p>`;
        } else if (weeklyAvgProgress < -3) {
            html += `<p><strong>⚡ Ajustement nécessaire</strong><br>Baisse de ${Math.abs(weeklyAvgProgress)}%. Le sélecteur automatique explorera un autre algorithme si la tendance se confirme.</p>`;
        }

        if (currentWeek.algoScores && Object.keys(currentWeek.algoScores).length > 0) {
            html += '<div style="margin-top:1rem"><strong>📊 Comparatif des algorithmes:</strong>';
            html += '<div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem">';
            const sorted = Object.entries(currentWeek.algoScores).sort((a, b) => b[1] - a[1]);
            sorted.forEach(([id, score]) => {
                const a = window.TRAINING_ALGORITHMS[id];
                if (!a) return;
                const isActive = id === currentWeek.algoId;
                const scoreText = score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
                const scoreColor = score > 1 ? '#10B981' : score < 0 ? '#EF4444' : '#F59E0B';
                html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0.75rem; background:rgba(255,255,255,${isActive ? '0.08' : '0.02'}); border-radius:6px; ${isActive ? 'border-left:3px solid ' + (a.color || '#00D4FF') : ''}">
                    <span style="font-size:0.85rem">${a.icon} ${a.name}${isActive ? ' <em style="color:var(--text-muted);font-size:0.75rem">(actif)</em>' : ''}</span>
                    <strong style="color:${scoreColor}">${scoreText}</strong>
                </div>`;
            });
            html += '</div></div>';
        }

        html += '</div>';
        return html;
    }

    static generateAlerts(currentWeek) {
        if (!currentWeek) return '';
        let html = '';

        if (currentWeek.consecutiveFailures >= 2) {
            html += `<div style="background: rgba(239, 68, 68, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #EF4444; margin-bottom: 1rem;">
                <p><strong>⚠️ Échecs en cascade (${currentWeek.consecutiveFailures} semaines)</strong><br>Le sélecteur automatique va changer d'algorithme pour casser ce cycle. Assurez-vous de bien récupérer entre les séances.</p>
            </div>`;
        }

        if (currentWeek.plateauInfo?.detected) {
            html += `<div style="background: rgba(245, 158, 11, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #F59E0B; margin-bottom: 1rem;">
                <p><strong>⚠️ Plateau détecté</strong><br>${currentWeek.plateauInfo.suggestion}</p>
            </div>`;
        } else if (currentWeek.plateauInfo?.suggestion) {
            html += `<div style="background: rgba(245, 158, 11, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #F59E0B; margin-bottom: 1rem;">
                <p><strong>ℹ️ Vigilance</strong><br>${currentWeek.plateauInfo.suggestion}</p>
            </div>`;
        }

        if (currentWeek.criticalFailure) {
            html += `<div style="background: rgba(239, 68, 68, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #EF4444;">
                <p><strong>⚠️ Échec critique (&lt;60% du volume)</strong><br>Le sélecteur algorithmique a pris en compte cet échec critique pour ajuster la semaine prochaine.</p>
            </div>`;
        }

        if (!html) {
            html = '<p style="color: #10B981; font-weight: 600;">✓ Aucune alerte. Continuez ainsi !</p>';
        }

        return html;
    }
};
