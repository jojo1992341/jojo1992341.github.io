// Dépendance globale : window.CONFIG

window.TrainingModel = class TrainingModel {
    static generateWeek(weekNumber, maxReps, exerciseType, previousWeek = null, targetReps = null) {
        // --- 1. INITIALISATION & RECUPERATION DES METRIQUES ---
        const config = window.CONFIG; // Utilisation explicite de window.CONFIG
        const day1 = this._createTestDay(maxReps);
        const progressionData = this._calculateProgression(maxReps, previousWeek);

        // Volume de base ajusté par le facteur calculé
        const baseVolume = Math.round(maxReps * 2.5 * 6 * progressionData.factor);

        const trainingDays = CONFIG.VOLUME_DISTRIBUTION.map((dist, index) => {
            return this._createTrainingDay(index + 2, dist, baseVolume, maxReps, progressionData, previousWeek);
        });

        const plateauDetection = this._detectPlateau(previousWeek);
        const globalAdvice = this._generateGlobalAdvice(maxReps, previousWeek, progressionData, plateauDetection);
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
            consecutiveFailures: progressionData.consecutiveFailures
        };
    }

    static _createTestDay(maxReps) {
        return {
            day: 1, dayType: 'Test', sets: 1, reps: maxReps, rest: 0,
            explanation: "Test de référence pour établir votre point de départ. Réalisez votre maximum de répétitions en gardant une technique parfaite — c'est ce qui compte vraiment, pas le nombre. Ce résultat calibrera l'intensité de tout votre programme.", feedback: null
        };
    }

    static _createTrainingDay(dayNum, dist, baseVolume, currentMax, progressionData = {}, previousWeek = null) {
        const baseIntensity = this._getBaseIntensity(dist.type);
        const intensity = this._getAdaptiveIntensity(dist.type, baseIntensity, progressionData, previousWeek);

        const { sets, reps, fractionnementApplique } = this._calculateSmartSeriesReps(dist.type, baseVolume, currentMax, intensity, previousWeek, dist.coeff, progressionData);
        const rest = this._calculateAdaptiveRest(dist.type, intensity, previousWeek, fractionnementApplique);

        return {
            day: dayNum, dayType: dist.type, sets, reps, rest,
            intensity: Math.round(intensity * 100),
            fractionnementApplique,
            explanation: this._getExplanation(dist.type, sets, reps, rest, intensity, fractionnementApplique),
            feedback: null
        };
    }

    static _getBaseIntensity(type) {
        return type === 'Léger' ? 0.60 : (type === 'Modéré' ? 0.70 : 0.75);
    }

    static _getAdaptiveIntensity(dayType, baseIntensity, progressionData = {}, previousWeek = null) {
        if (!previousWeek || !progressionData.dayTypePerformance) return baseIntensity;

        const perfData = progressionData.dayTypePerformance[dayType];
        if (!perfData) return baseIntensity;

        let adaptedIntensity = baseIntensity;

        if (perfData.failureRate > 0.5) {
            adaptedIntensity *= 0.90;
        } else if (perfData.failureRate > 0.25) {
            adaptedIntensity *= 0.95;
        } else if (perfData.easyRate > 0.6) {
            adaptedIntensity *= 1.05;
        } else if (perfData.easyRate > 0.35) {
            adaptedIntensity *= 1.02;
        }

        return Math.max(0.50, Math.min(0.85, adaptedIntensity));
    }

    static _calculateSmartSeriesReps(dayType, baseVolume, currentMax, intensity, previousWeek = null, distributionCoeff = 0.18, progressionData = {}) {
        const repsPerSet = Math.max(1, Math.round(currentMax * intensity));
        const dayVolume = Math.round(baseVolume * distributionCoeff);

        let sets = Math.max(CONFIG.RULES.MIN_SETS,
            Math.min(CONFIG.RULES.MAX_SETS, Math.round(dayVolume / repsPerSet)));

        let reps = Math.round(dayVolume / sets);
        let fractionnementApplique = false;

        if (previousWeek) {
            const prevDay = previousWeek.program.find(d => d.dayType === dayType);
            if (prevDay && prevDay.feedback === CONFIG.FEEDBACK.TROP_DIFFICILE && prevDay.actualSets !== undefined) {
                const completedSets = parseInt(prevDay.actualSets) || 0;
                const lastReps = parseInt(prevDay.actualLastReps) || 0;
                const actualVolume = (completedSets * prevDay.reps) + lastReps;
                const completionRate = actualVolume / (prevDay.sets * prevDay.reps);

                if (completionRate < 0.60) {
                    fractionnementApplique = true;
                    const targetVolume = Math.round(dayVolume * Math.max(0.70, completionRate * 0.95));
                    sets = Math.min(CONFIG.RULES.MAX_SETS, Math.round(sets * 1.5));
                    reps = Math.max(1, Math.round(targetVolume / sets));
                } else if (completionRate < 0.75) {
                    fractionnementApplique = true;
                    const targetVolume = Math.round(dayVolume * 0.85);
                    sets = Math.min(CONFIG.RULES.MAX_SETS, Math.round(sets * 1.2));
                    reps = Math.max(1, Math.round(targetVolume / sets));
                } else if (completionRate < 0.85) {
                    const targetVolume = Math.round(dayVolume * 0.92);
                    reps = Math.max(1, reps - 1);
                    sets = Math.min(CONFIG.RULES.MAX_SETS, Math.round(targetVolume / reps));
                }
            }
        }

        return { sets, reps, fractionnementApplique };
    }

    static _calculateAdaptiveRest(dayType, intensity, previousWeek = null, fractionnementApplique = false) {
        let baseRest = dayType === 'Léger' ? 45 : (dayType === 'Modéré' ? 60 : 90);
        if (intensity > 0.75) baseRest += 15;

        if (fractionnementApplique) {
            baseRest = Math.min(CONFIG.RULES.MAX_REST, baseRest + 20);
        }

        if (previousWeek) {
            const prevDay = previousWeek.program.find(d => d.dayType === dayType);
            if (prevDay && prevDay.feedback === CONFIG.FEEDBACK.TROP_DIFFICILE && !fractionnementApplique) {
                baseRest = Math.min(CONFIG.RULES.MAX_REST, baseRest + 15);
            } else if (prevDay && prevDay.feedback === CONFIG.FEEDBACK.TROP_FACILE && dayType !== 'Léger' && !fractionnementApplique) {
                baseRest = Math.max(CONFIG.RULES.MIN_REST, baseRest - 10);
            }
        }

        return Math.max(CONFIG.RULES.MIN_REST, Math.min(CONFIG.RULES.MAX_REST, baseRest));
    }

    // --- ALGORITHME DE PROGRESSION AVANCÉ ---
    static _calculateProgression(currentMax, previousWeek) {
        if (!previousWeek) return {
            factor: 1.0,
            dominantFeedback: null,
            volumeCompletionRate: 1.0,
            dayTypePerformance: {},
            adaptationMetrics: {},
            consecutiveFailures: 0,
            criticalFailure: false
        };

        const delta = (currentMax - previousWeek.maxReps) / previousWeek.maxReps;

        let totalPlannedVolume = 0;
        let totalActualVolume = 0;

        const feedbacks = [];
        const dayTypePerformance = {
            'Léger': { total: 0, easy: 0, perfect: 0, hard: 0, failure: 0, failureRate: 0, easyRate: 0 },
            'Modéré': { total: 0, easy: 0, perfect: 0, hard: 0, failure: 0, failureRate: 0, easyRate: 0 },
            'Intense': { total: 0, easy: 0, perfect: 0, hard: 0, failure: 0, failureRate: 0, easyRate: 0 }
        };

        previousWeek.program.forEach(day => {
            if (day.day === 1) return;

            const planned = day.sets * day.reps;
            totalPlannedVolume += planned;

            const perf = dayTypePerformance[day.dayType];
            if (perf) perf.total++;

            if (day.feedback === CONFIG.FEEDBACK.TROP_DIFFICILE && day.actualSets !== undefined) {
                const completedSets = parseInt(day.actualSets) || 0;
                const lastReps = parseInt(day.actualLastReps) || 0;
                const actual = (completedSets * day.reps) + lastReps;
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
            factor = dominant === CONFIG.FEEDBACK.TROP_DIFFICILE ? 0.90 : 1.05;
        } else if (delta > -0.03) {
            factor = dominant === CONFIG.FEEDBACK.TROP_FACILE ? 1.08 : 1.0;
        } else {
            factor = 0.85;
        }

        const allWeeks = StorageService.load().allWeeks || [];
        const consecutiveFailures = this._countConsecutiveFailures(allWeeks, previousWeek.exerciseType);

        return {
            factor,
            dominantFeedback: dominant,
            volumeCompletionRate,
            dayTypePerformance,
            adaptationMetrics: { delta, totalF },
            consecutiveFailures,
            criticalFailure
        };
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

    static _detectPlateau(previousWeek) {
        if (!previousWeek) return null;

        const allWeeks = StorageService.load().allWeeks || [];
        const sameExercise = allWeeks.filter(w => w.exerciseType === previousWeek.exerciseType);

        if (sameExercise.length < 3) {
            return { detected: false, weeksSinceGain: 0, suggestion: null };
        }

        let weeksSinceGain = 0;
        let detected = false;
        let suggestion = null;

        for (let i = sameExercise.length - 1; i >= 0 && i >= sameExercise.length - 4; i--) {
            const week = sameExercise[i];
            if (i > 0) {
                const prevWeekData = sameExercise[i - 1];
                if (week.maxReps > prevWeekData.maxReps) {
                    weeksSinceGain = sameExercise.length - i - 1;
                    break;
                }
            }
        }

        if (weeksSinceGain >= 3) {
            detected = true;
            suggestion = `Plateau de ${weeksSinceGain} semaines détecté ! Vos muscles se sont adaptés à l'entraînement actuel. Il est temps d'innover : décharger une semaine, augmenter drastiquement le volume, ou varier les exercices (angles différents, variations comme les pompes sur coussin, etc.). Les plateaux sont normaux et temporaires !`;
        } else if (weeksSinceGain === 2) {
            suggestion = "Vous stagnez depuis 2 semaines. Pas de panique, c'est courant. Restez vigilant et préparez-vous à ajuster votre approche si ça continue.";
        }

        return { detected, weeksSinceGain, suggestion };
    }

    static _getExplanation(dayType, sets, reps, rest, intensity, fractionnementApplique = false) {
        const pct = Math.round(intensity * 100);

        if (fractionnementApplique) {
            return `📊 <strong>FRACTIONNEMENT APPLIQUÉ</strong> — Après votre échec précédent, j'ai recalibré l'approche : j'ai augmenté le nombre de séries (${sets}) tout en réduisant les répétitions (${reps}) par série. Cela vous permet d'accumuler le volume prévu sans franchir votre seuil d'échec. L'intensité est à ${pct}% et le repos augmenté à ${rest}s pour favoriser une meilleure récupération. Cette stratégie vous rapproche progressivement de votre capacité maximale.`;
        }

        if (dayType === 'Léger') {
            return `🔵 <strong>JOUR LÉGER</strong> (Récupération Active) — À ${pct}% de votre intensité maximale. Objectif : permettre à vos muscles de récupérer tout en maintenant l'habitude technique. ${sets} séries courtes de ${reps} reps. Repos rapide (${rest}s) car l'effort est modéré. Vous resterez frais pour les jours plus intenses.`;
        }
        if (dayType === 'Modéré') {
            return `🟡 <strong>JOUR MODÉRÉ</strong> (Équilibre) — À ${pct}% de votre intensité maximale. Le sweet spot pour construire la force sans épuisement immédiat. ${sets} séries de ${reps} reps. Repos de ${rest}s pour une récupération partielle. Cet équilibre vous permet de bien progresser sans casser votre capacité de récupération.`;
        }
        return `🔴 <strong>JOUR INTENSE</strong> (Stimulation Maximale) — À ${pct}% de votre intensité maximale, c'est votre jour plus difficile. ${sets} séries pour générer une adaptation musculaire optimale. Repos de ${rest}s (complet) car l'effort est maximal. Vous sortirez épuisé, c'est normal et c'est l'objectif !`;
    }

    static _generateGlobalAdvice(currentMax, previousWeek, data, plateauInfo) {
        if (!previousWeek) {
            return "Bienvenue dans votre programme personnalisé ! Semaine 1 commence par un test de calibrage, suivi de 6 jours d'entraînement alternant intensité faible, moyenne et élevée pour stimuler la progression tout en permettant la récupération.";
        }

        const diff = currentMax - previousWeek.maxReps;
        let text = '';

        if (diff > 0) {
            text = `✅ <strong>Progression solide !</strong> Vous avez gagné <strong>${diff} répétition${diff > 1 ? 's' : ''}</strong> (${previousWeek.maxReps} → ${currentMax}). `;
        } else if (diff === 0) {
            text = `➡️ <strong>Plateau cette semaine.</strong> Vous maintenez ${currentMax} répétitions, ce qui est normal après effort intense. `;
        } else {
            text = `⚠️ <strong>Légère baisse.</strong> Vous êtes passé de ${previousWeek.maxReps} à ${currentMax} reps (${Math.abs(diff)} de moins). Cela peut indiquer une récupération insuffisante — restez vigilant. `;
        }

        if (data.dominantFeedback === CONFIG.FEEDBACK.TROP_FACILE) {
            text += `Le programme précédent était trop facile pour vous. J'ai donc augmenté le volume global (plus de répétitions ou de séries). `;
            const intensePerf = data.dayTypePerformance?.['Intense'];
            if (intensePerf?.easyRate > 0.5) {
                text += `Vos jours intenses étaient particulièrement maîtrisés, j'ai donc relevé aussi l'intensité pour vous challenger davantage.`;
            }
        } else if (data.dominantFeedback === CONFIG.FEEDBACK.TROP_DIFFICILE) {
            const pct = Math.round(data.volumeCompletionRate * 100);
            text += `Vous avez atteint l'échec technique — vous avez réussi ${pct}% du volume prévu. `;

            if (data.criticalFailure) {
                text += `C'est un signal que le programme dépasse légèrement votre capacité actuelle. <strong>Ma stratégie :</strong> j'augmente le nombre de séries mais réduis les reps par série, ce qui vous permet d'atteindre votre volume cible sans franchir votre seuil d'épuisement. Les repos sont aussi augmentés pour favoriser la récupération. `;
            } else {
                text += `J'ajuste le volume pour qu'il soit plus réaliste et atteignable, tout en gardant une progression modérée. `;
            }

            if (data.consecutiveFailures >= 2) {
                text += `<strong>Alerte :</strong> C'est votre ${data.consecutiveFailures}e semaine consécutive d'échec. J'ai réduit l'intensité et augmenté significativement le repos pour casser ce cycle.`;
            }

            const moderatePerf = data.dayTypePerformance?.['Modéré'];
            if (moderatePerf?.failureRate > 0.5) {
                text += `Vos jours modérés étaient particulièrement difficiles — j'ai baissé leur intensité pour un équilibre meilleur.`;
            }
        } else if (data.dominantFeedback === CONFIG.FEEDBACK.DIFFICILE_FINI) {
            text += `La difficulté était bien calibrée — vous terminez juste ce qu'il faut. J'applique une progression modérée (+3-5%) pour continuer sur cette lancée sans risque.`;
        } else {
            text += `Vous avez bien géré la semaine. J'applique une progression progressive (+5%) pour continuer à bâtir votre force.`;
        }

        if (plateauInfo?.detected) {
            text += ` <strong>⚠️ Plateau détecté :</strong> Vous stagnez depuis plus de 3 semaines. C'est le moment d'innover : augmentez drastiquement le volume un jour, ou testez des variations d'exercice.`;
        } else if (plateauInfo?.suggestion) {
            text += ` <strong>ℹ️ Vigilance :</strong> ${plateauInfo.suggestion}`;
        }

        return text;
    }

    static calculatePrediction(currentMax, targetReps) {
        if (!targetReps || targetReps <= currentMax) return null;
        const weeklyGrowth = 1.05;
        const weeksNeeded = Math.ceil(Math.log(targetReps / currentMax) / Math.log(weeklyGrowth));
        if (weeksNeeded > 52) return "> 1 an";
        const today = new Date();
        const futureDate = new Date(today.setDate(today.getDate() + (weeksNeeded * 7)));
        return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(futureDate);
    }
}
