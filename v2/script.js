/**
 * COACH PROGRESSION - Moteur complet (v5.0)
 * Architecture: MVC + Services
 * 
 * Nouveautés v5 :
 * - Gestion Avancée de l'Échec (Input Séries/Reps)
 * - Calcul précis du volume réalisé vs prévu
 * - Ajustement chirurgical de la progression basé sur l'échec réel
 */

// ============================================================================
// 1. CONFIGURATION
// ============================================================================

const CONFIG = {
    RULES: {
        MIN_INTENSITY: 0.55, MAX_INTENSITY: 0.80,
        MAX_SETS: 6, MIN_SETS: 2,
        MIN_REST: 45, MAX_REST: 120,
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
    STORAGE_KEY: 'coachProgressionData_v5'
};

// ============================================================================
// 2. SERVICES (Infrastructure)
// ============================================================================

class AudioService {
    constructor() { this.ctx = null; }
    _init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    playTick() { this._init(); this._beep(880, 0.1, 'square'); }
    playEnd() {
        this._init();
        const now = this.ctx.currentTime;
        this._beep(880, 0.1, 'square', now);
        this._beep(880, 0.1, 'square', now + 0.15);
        this._beep(440, 0.6, 'sine', now + 0.3);
    }
    _beep(freq, duration, type = 'sine', startTime = null) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = startTime || this.ctx.currentTime;
        osc.type = type; osc.frequency.value = freq;
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(start);
        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.stop(start + duration);
    }
}

class TimerService {
    constructor(audioService) {
        this.audio = audioService;
        this.interval = null;
        this.timeLeft = 0;
        this.ui = {
            overlay: document.getElementById('timerOverlay'),
            display: document.getElementById('timerDisplay'),
            addBtn: document.getElementById('addTimeBtn'),
            skipBtn: document.getElementById('skipTimerBtn')
        };
        if(this.ui.addBtn) this._bindEvents();
    }
    _bindEvents() {
        this.ui.addBtn.addEventListener('click', () => this.addTime(30));
        this.ui.skipBtn.addEventListener('click', () => this.stop());
    }
    start(seconds) {
        if (!seconds || seconds <= 0) return;
        this.stop();
        this.timeLeft = seconds;
        this.ui.overlay.classList.remove('hidden');
        this._updateDisplay();
        this.audio._init();
        this.interval = setInterval(() => {
            this.timeLeft--;
            this._updateDisplay();
            if (this.timeLeft <= 3 && this.timeLeft > 0) this.audio.playTick();
            if (this.timeLeft <= 0) { this.audio.playEnd(); this.stop(); }
        }, 1000);
    }
    addTime(s) { this.timeLeft += s; this._updateDisplay(); }
    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
        this.ui.overlay.classList.add('hidden');
    }
    _updateDisplay() {
        const m = Math.floor(this.timeLeft / 60).toString().padStart(2, '0');
        const s = (this.timeLeft % 60).toString().padStart(2, '0');
        this.ui.display.textContent = `${m}:${s}`;
    }
}

class StorageService {
    static load() {
        try { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)) || { allWeeks: [] }; } 
        catch (e) { return { allWeeks: [] }; }
    }
    static save(data) {
        try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ ...data, lastUpdated: new Date().toISOString() })); } 
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

class ChartService {
    static render(weeks, container, metric = 'max') {
        if (!container || weeks.length < 2) {
            container.innerHTML = '<p class="text-center text-muted" style="padding:2rem; font-size:0.9rem">Données insuffisantes.</p>';
            return;
        }

        const data = weeks.map(w => {
            let val = 0;
            if (metric === 'max') val = w.maxReps;
            else val = w.totalVolume || w.program.reduce((acc, d) => acc + (d.sets * d.reps), 0);
            return { week: w.weekNumber, val: val };
        });

        const maxVal = Math.max(...data.map(d => d.val)) * 1.1;
        const width = container.clientWidth || 300;
        const height = 150;
        const padding = 25;

        const xScale = (val, i) => padding + (i * (width - 2 * padding) / (data.length - 1));
        const yScale = val => height - padding - (val / maxVal * (height - 2 * padding));

        let pathD = `M ${xScale(data[0].val, 0)} ${yScale(data[0].val)}`;
        const points = data.map((d, i) => {
            const x = xScale(d.val, i);
            const y = yScale(d.val);
            if (i > 0) pathD += ` L ${x} ${y}`;
            const tooltip = metric === 'max' ? `${d.val} Reps` : `${d.val} Vol.`;
            return `<circle cx="${x}" cy="${y}" r="4" fill="var(--primary)" stroke="var(--bg-card)" stroke-width="2"><title>S${d.week}: ${tooltip}</title></circle>`;
        }).join('');

        const label = metric === 'max' ? 'Max Reps' : 'Volume Total';
        const color = metric === 'max' ? 'var(--primary)' : 'var(--secondary)';

        container.innerHTML = `
            <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible">
                <path d="${pathD}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                ${points.replace(/var\(--primary\)/g, color)}
                <text x="${width - padding}" y="${padding}" fill="var(--text-muted)" text-anchor="end" font-size="10">${label}</text>
            </svg>`;
    }
}

// ============================================================================
// 3. MODÈLE MÉTIER
// ============================================================================

class TrainingModel {
    static generateWeek(weekNumber, maxReps, exerciseType, previousWeek = null, targetReps = null) {
        const day1 = this._createTestDay(maxReps);
        const progressionData = this._calculateProgression(maxReps, previousWeek);
        
        // Volume de base ajusté par le facteur calculé
        const baseVolume = Math.round(maxReps * 2.5 * 6 * progressionData.factor);
        
        const trainingDays = CONFIG.VOLUME_DISTRIBUTION.map((dist, index) => {
            return this._createTrainingDay(index + 2, dist, baseVolume, maxReps);
        });

        const globalAdvice = this._generateGlobalAdvice(maxReps, previousWeek, progressionData);
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
            globalAdvice
        };
    }

    static _createTestDay(maxReps) {
        return {
            day: 1, dayType: 'Test', sets: 1, reps: maxReps, rest: 0,
            explanation: "Test de référence pour calibrer votre programme. Donnez votre maximum en technique parfaite.", feedback: null
        };
    }

    static _createTrainingDay(dayNum, dist, totalVolume, currentMax) {
        const intensity = this._getIntensity(dist.type);
        const repsPerSet = Math.max(1, Math.round(currentMax * intensity));
        const dayVolume = Math.round(totalVolume * dist.coeff);
        
        let sets = Math.max(CONFIG.RULES.MIN_SETS, 
                   Math.min(CONFIG.RULES.MAX_SETS, Math.round(dayVolume / repsPerSet)));
        
        const adjustedReps = Math.round(dayVolume / sets);
        const rest = this._calculateRest(intensity, dist.type);

        return {
            day: dayNum, dayType: dist.type, sets, reps: adjustedReps, rest,
            explanation: this._getExplanation(dist.type, sets, adjustedReps, rest, intensity),
            feedback: null
        };
    }

    static _getIntensity(type) { return type === 'Léger' ? 0.60 : (type === 'Modéré' ? 0.70 : 0.75); }

    static _calculateRest(intensity, type) {
        let rest = type === 'Léger' ? 45 : (type === 'Modéré' ? 60 : 90);
        if (intensity > 0.75) rest += 15;
        return Math.max(CONFIG.RULES.MIN_REST, Math.min(CONFIG.RULES.MAX_REST, rest));
    }

    // --- ALGORITHME DE PROGRESSION AVANCÉ ---
    static _calculateProgression(currentMax, previousWeek) {
        if (!previousWeek) return { factor: 1.0, dominantFeedback: null, volumeCompletionRate: 1.0 };

        const delta = (currentMax - previousWeek.maxReps) / previousWeek.maxReps;
        
        let totalPlannedVolume = 0;
        let totalActualVolume = 0;
        
        const feedbacks = [];

        // Analyse détaillée du volume réel vs prévu
        previousWeek.program.forEach(day => {
            if (day.day === 1) return; // Ignore Test Day
            
            const planned = day.sets * day.reps;
            totalPlannedVolume += planned;
            
            // Si données précises d'échec
            if (day.feedback === CONFIG.FEEDBACK.TROP_DIFFICILE && day.actualSets !== undefined) {
                // Volume = Séries complètes * reps + reps dernière série
                // Si actualSets n'est pas défini (ancienne version), on assume 70%
                const completedSets = parseInt(day.actualSets) || 0;
                const lastReps = parseInt(day.actualLastReps) || 0;
                const actual = (completedSets * day.reps) + lastReps;
                totalActualVolume += actual;
                feedbacks.push(day.feedback);
            } 
            else if (day.feedback === CONFIG.FEEDBACK.TROP_DIFFICILE) {
                // Échec sans détails (fallback)
                totalActualVolume += planned * 0.75;
                feedbacks.push(day.feedback);
            }
            else {
                // Succès (on assume 100% du volume fait)
                totalActualVolume += planned;
                if (day.feedback) feedbacks.push(day.feedback);
            }
        });

        // Ratio de complétion (ex: 0.85 si 85% du volume a été fait)
        const volumeCompletionRate = totalPlannedVolume > 0 ? (totalActualVolume / totalPlannedVolume) : 1.0;

        // Détermination feedback dominant
        let dominant = CONFIG.FEEDBACK.PARFAIT;
        const totalF = feedbacks.length;
        if (totalF > 0) {
            if (feedbacks.includes(CONFIG.FEEDBACK.TROP_DIFFICILE)) dominant = CONFIG.FEEDBACK.TROP_DIFFICILE;
            else if (feedbacks.filter(f => f === CONFIG.FEEDBACK.DIFFICILE_FINI).length > totalF/2) dominant = CONFIG.FEEDBACK.DIFFICILE_FINI;
            else if (feedbacks.filter(f => f === CONFIG.FEEDBACK.TROP_FACILE).length > totalF/2) dominant = CONFIG.FEEDBACK.TROP_FACILE;
        }

        // --- DÉCISION DU FACTEUR ---
        let factor = 1.0;

        if (dominant === CONFIG.FEEDBACK.TROP_DIFFICILE) {
            // AJUSTEMENT CHIRURGICAL:
            // Si l'utilisateur a échoué, on aligne le volume futur sur sa capacité réelle démontrée
            // On prend le taux de complétion comme base pour le facteur
            // Ex: s'il a fait 80% du volume, factor = 0.85 (légère marge de progression)
            factor = Math.max(0.70, volumeCompletionRate * 0.95); 
        } 
        else if (delta > 0.10) factor = dominant === CONFIG.FEEDBACK.TROP_FACILE ? 1.15 : 1.10;
        else if (delta > 0.03) factor = dominant === CONFIG.FEEDBACK.TROP_DIFFICILE ? 0.90 : 1.05; // Cas rare
        else if (delta > -0.03) factor = dominant === CONFIG.FEEDBACK.TROP_FACILE ? 1.08 : 1.0;
        else factor = 0.85; // Régression

        return { factor, dominantFeedback: dominant, volumeCompletionRate };
    }

    static _getExplanation(dayType, sets, reps, rest, intensity) {
        const pct = Math.round(intensity * 100);
        if (dayType === 'Léger') return `Jour de récupération active à ${pct}% de votre max. Le volume réduit (${sets} séries) permet à vos muscles de récupérer tout en maintenant la technique. Repos court (${rest}s).`;
        if (dayType === 'Modéré') return `Entraînement équilibré à ${pct}% de votre max. ${sets} séries de ${reps} répétitions pour construire la force sans épuisement. Repos de ${rest}s pour une récupération partielle.`;
        return `Jour de stimulation maximale à ${pct}% de votre max ! ${sets} séries pour générer l'adaptation musculaire. Repos de ${rest}s pour récupération complète.`;
    }

    static _generateGlobalAdvice(currentMax, previousWeek, data) {
        if (!previousWeek) return "Bienvenue ! Ce programme commence par un test, puis alterne jours intenses et légers.";
        
        const diff = currentMax - previousWeek.maxReps;
        let text = diff > 0 
            ? `Excellent ! Progression de ${diff} répétitions. `
            : (diff === 0 ? `Stagnation normale (${currentMax} reps). ` : `Légère baisse de ${Math.abs(diff)} reps. `);

        if (data.dominantFeedback === CONFIG.FEEDBACK.TROP_FACILE) {
            text += "Programme précédent facile : volume augmenté.";
        } else if (data.dominantFeedback === CONFIG.FEEDBACK.TROP_DIFFICILE) {
            // Message intelligent basé sur le taux de complétion
            const pct = Math.round(data.volumeCompletionRate * 100);
            text += `Vous avez atteint l'échec technique (Volume réalisé : ${pct}%). J'ai recalibré précisément le volume de cette semaine pour correspondre à votre capacité réelle, sans vous épuiser.`;
        } else if (data.dominantFeedback === CONFIG.FEEDBACK.DIFFICILE_FINI) {
            text += "Difficulté correcte : volume maintenu pour adaptation.";
        } else {
            text += "Progression standard (+5%) appliquée.";
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

// ============================================================================
// 4. CONTRÔLEUR UI
// ============================================================================

class AppController {
    constructor() {
        this.state = { allWeeks: [], currentWeek: null, chartMetric: 'max' };
        this.audio = new AudioService();
        this.timer = new TimerService(this.audio);
        
        this.ui = {
            setup: document.getElementById('setupSection'),
            program: document.getElementById('programSection'),
            history: document.getElementById('historySection'),
            inputs: {
                exercise: document.getElementById('exerciseSelect'),
                maxReps: document.getElementById('maxReps'),
                targetReps: document.getElementById('targetReps'),
                importFile: document.getElementById('importFile')
            },
            display: {
                weekNum: document.getElementById('weekNumber'),
                weekTitle: document.getElementById('weekTitle'),
                weekMax: document.getElementById('weekMax'),
                globalExp: document.getElementById('globalExplanation'),
                tableBody: document.getElementById('programTableBody'),
                feedback: document.getElementById('dailyFeedbackContainer'),
                historyContent: document.getElementById('historyContent'),
                chartContainer: document.getElementById('progressionChart'),
                goalContainer: document.getElementById('goalContainer'),
                goalValue: document.getElementById('goalValue'),
                predictionBadge: document.getElementById('predictionBadge')
            }
        };
        
        this._bindEvents();
        this._init();
    }

    _init() {
        const data = StorageService.load();
        this.state.allWeeks = data.allWeeks || [];
        if (this.state.allWeeks.length > 0) {
            this._displayWeek(this.state.allWeeks[this.state.allWeeks.length - 1]);
        }
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
        }
    }

    _bindEvents() {
        document.getElementById('generateBtn').addEventListener('click', () => this._handleGenerate());
        document.getElementById('newWeekBtn').addEventListener('click', () => this._showSetup());
        document.getElementById('reopenWeekBtn').addEventListener('click', () => this._reopenLastWeek());
        document.getElementById('historyBtn').addEventListener('click', () => this._showHistory());
        document.getElementById('closeHistoryBtn').addEventListener('click', () => this.ui.history.classList.add('hidden'));
        document.getElementById('exportBtn').addEventListener('click', () => StorageService.exportData({ allWeeks: this.state.allWeeks }));
        document.getElementById('importBtn').addEventListener('click', () => this.ui.inputs.importFile.click());
        this.ui.inputs.importFile.addEventListener('change', (e) => this._handleImport(e));
        
        this.ui.inputs.exercise.addEventListener('change', () => {
             const type = this.ui.inputs.exercise.value;
             const last = this.state.allWeeks.filter(w => w.exerciseType === type).pop();
             if(last && last.targetReps) this.ui.inputs.targetReps.value = last.targetReps;
             else this.ui.inputs.targetReps.value = '';
        });

        document.addEventListener('click', (e) => {
            if(e.target.matches('.chart-toggle')) {
                this.state.chartMetric = e.target.dataset.metric;
                this._refreshChart();
                document.querySelectorAll('.chart-toggle').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    }

    _save() { StorageService.save({ allWeeks: this.state.allWeeks }); }

    // --- Actions ---

    _handleGenerate() {
        const max = parseInt(this.ui.inputs.maxReps.value);
        if (!max || max < 1) return alert("Répétitions invalides");
        const target = this.ui.inputs.targetReps.value ? parseInt(this.ui.inputs.targetReps.value) : null;
        const type = this.ui.inputs.exercise.value;
        const exerciseHistory = this.state.allWeeks.filter(w => w.exerciseType === type);
        const prevWeek = exerciseHistory.length > 0 ? exerciseHistory[exerciseHistory.length - 1] : null;
        
        const newWeek = TrainingModel.generateWeek(this.state.allWeeks.length + 1, max, type, prevWeek, target);
        this.state.allWeeks.push(newWeek);
        this._save();
        this._displayWeek(newWeek);
    }

    async _handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            if(!confirm("Écraser les données ?")) return;
            const data = await StorageService.importData(file);
            this.state.allWeeks = data.allWeeks;
            this._save();
            this._init();
            alert("Import OK");
        } catch (err) { alert("Erreur: " + err.message); }
        e.target.value = '';
    }

    _showSetup() {
        this.ui.inputs.maxReps.value = '';
        this.ui.program.classList.add('hidden');
        this.ui.setup.classList.remove('hidden');
        if (this.state.currentWeek) {
            this.ui.inputs.exercise.value = this.state.currentWeek.exerciseType;
            if(this.state.currentWeek.targetReps) this.ui.inputs.targetReps.value = this.state.currentWeek.targetReps;
        }
    }

    _reopenLastWeek() {
        if (this.state.allWeeks.length > 0) this._displayWeek(this.state.allWeeks[this.state.allWeeks.length - 1]);
    }

    // GESTION DU FEEDBACK AVEC ÉCHEC DÉTAILLÉ
    _handleFeedback(dayNum, feedbackType) {
        if (!this.state.currentWeek) return;
        const day = this.state.currentWeek.program.find(d => d.day === dayNum);
        if (day) {
            day.feedback = feedbackType;
            // Si pas d'échec, on nettoie les détails d'échec potentiels
            if (feedbackType !== CONFIG.FEEDBACK.TROP_DIFFICILE) {
                delete day.actualSets;
                delete day.actualLastReps;
            }
            this._save();
            this._renderFeedbackButtons(dayNum, feedbackType);
            this._renderFailureInputs(dayNum, feedbackType); // Afficher/Masquer inputs
        }
    }

    _handleFailureDetails(dayNum, type, value) {
        if (!this.state.currentWeek) return;
        const day = this.state.currentWeek.program.find(d => d.day === dayNum);
        if (day) {
            if (type === 'sets') day.actualSets = parseInt(value);
            if (type === 'reps') day.actualLastReps = parseInt(value);
            this._save();
        }
    }

    _handleDeleteHistory(weekNum) {
        if(!confirm("Supprimer ?")) return;
        this.state.allWeeks = this.state.allWeeks.filter(w => w.weekNumber !== weekNum);
        this._save();
        this.state.allWeeks.length === 0 ? (this.ui.history.classList.add('hidden'), this._showSetup()) : this._showHistory();
    }

    // --- Rendering ---

    _refreshChart() {
        if(!this.state.currentWeek) return;
        const historySameType = this.state.allWeeks.filter(w => w.exerciseType === this.state.currentWeek.exerciseType);
        if (this.ui.display.chartContainer) {
            ChartService.render(historySameType, this.ui.display.chartContainer, this.state.chartMetric);
        }
    }

    _displayWeek(week) {
        this.state.currentWeek = week;
        this.ui.setup.classList.add('hidden');
        this.ui.program.classList.remove('hidden');
        this.ui.display.weekNum.textContent = week.weekNumber;
        this.ui.display.weekTitle.textContent = week.exerciseType.toUpperCase();
        this.ui.display.weekMax.textContent = week.maxReps;
        
        if (week.targetReps && week.targetReps > week.maxReps) {
            this.ui.display.goalContainer.classList.remove('hidden');
            this.ui.display.goalValue.textContent = week.targetReps;
            const prediction = TrainingModel.calculatePrediction(week.maxReps, week.targetReps);
            this.ui.display.predictionBadge.textContent = prediction ? `📅 ~${prediction}` : "Objectif proche !";
        } else if (week.targetReps) {
            this.ui.display.goalContainer.classList.remove('hidden');
            this.ui.display.goalValue.textContent = week.targetReps;
            this.ui.display.predictionBadge.textContent = "🎉 Atteint !";
        } else {
            this.ui.display.goalContainer.classList.add('hidden');
        }

        // Si des données détaillées d'échec sont présentes, l'explication sera adaptée
        // Note : le calcul se fait sur la semaine PRÉCÉDENTE pour générer l'actuelle
        this.ui.display.globalExp.innerHTML = week.globalAdvice || TrainingModel._generateGlobalAdvice(week.maxReps, null, {});

        this._refreshChart();

        this.ui.display.tableBody.innerHTML = week.program.map(day => {
            const isRest = day.rest > 0;
            return `<tr>
                <td><div class="day-label">J${day.day}</div><div class="day-type">${day.dayType}</div></td>
                <td><strong>${day.sets}</strong></td>
                <td><strong>${day.reps}</strong></td>
                <td class="${isRest ? 'cursor-pointer hover:text-primary' : ''}" ${isRest ? `onclick="window.app.timer.start(${day.rest})"` : ''}>${day.rest || '-'}s${isRest ? ' ⏱️' : ''}</td>
                <td><div class="explanation-cell">${day.explanation}</div></td>
            </tr>`;
        }).join('');

        this._renderDailyFeedbacks();
    }

    _renderDailyFeedbacks() {
        this.ui.display.feedback.innerHTML = '';
        this.state.currentWeek.program.forEach(day => {
            if (day.day === 1) return;
            const div = document.createElement('div');
            div.className = 'day-feedback-item';
            div.innerHTML = `
                <div class="day-feedback-header">Jour ${day.day}</div>
                <div class="day-feedback-buttons" id="feedback-btns-${day.day}">
                    ${this._btnHTML(day.day, 'trop_facile', '😊', 'Facile')}
                    ${this._btnHTML(day.day, 'parfait', '👍', 'Top')}
                    ${this._btnHTML(day.day, 'difficile_fini', '😅', 'Dur')}
                    ${this._btnHTML(day.day, 'trop_difficile', '😰', 'Échec')}
                </div>
                <!-- Conteneur pour les inputs d'échec -->
                <div id="failure-inputs-${day.day}" class="failure-inputs hidden" style="margin-top:1rem; padding-top:1rem; border-top:1px dashed var(--text-muted)">
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem">Détails de l'échec pour ajustement :</p>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem">
                        <div>
                            <label style="font-size:0.8rem; display:block">Séries Validées</label>
                            <input type="number" class="form-input" style="padding:0.4rem" placeholder="Ex: 2" 
                                value="${day.actualSets !== undefined ? day.actualSets : ''}"
                                onchange="window.app._handleFailureDetails(${day.day}, 'sets', this.value)">
                        </div>
                        <div>
                            <label style="font-size:0.8rem; display:block">Reps dernière série</label>
                            <input type="number" class="form-input" style="padding:0.4rem" placeholder="Ex: 8"
                                value="${day.actualLastReps !== undefined ? day.actualLastReps : ''}"
                                onchange="window.app._handleFailureDetails(${day.day}, 'reps', this.value)">
                        </div>
                    </div>
                </div>
            `;
            this.ui.display.feedback.appendChild(div);
            div.querySelectorAll('button').forEach(btn => 
                btn.addEventListener('click', (e) => this._handleFeedback(parseInt(e.currentTarget.dataset.day), e.currentTarget.dataset.feedback)));
            
            if (day.feedback) {
                this._renderFeedbackButtons(day.day, day.feedback);
                this._renderFailureInputs(day.day, day.feedback);
            }
        });
    }

    _renderFailureInputs(dayNum, feedbackType) {
        const container = document.getElementById(`failure-inputs-${dayNum}`);
        if (!container) return;
        if (feedbackType === CONFIG.FEEDBACK.TROP_DIFFICILE) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }

    _btnHTML(d, t, e, l) { return `<button class="btn-day-feedback" data-day="${d}" data-feedback="${t}"><span>${e}</span><span>${l}</span></button>`; }
    _renderFeedbackButtons(dayNum, activeType) {
        const c = document.getElementById(`feedback-btns-${dayNum}`);
        if(c) Array.from(c.children).forEach(b => b.classList.toggle('selected', b.dataset.feedback === activeType));
    }
    _showHistory() { /* ...code existant inchangé... */ 
        this.ui.history.classList.remove('hidden');
        this.ui.display.historyContent.innerHTML = '';
        if (this.state.allWeeks.length === 0) return this.ui.display.historyContent.innerHTML = '<p class="text-center">Vide.</p>';
        [...this.state.allWeeks].reverse().forEach(week => {
            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `<div><strong>S${week.weekNumber}</strong> (${week.exerciseType}) - Max: ${week.maxReps}</div>
                <div class="history-actions"><button class="btn-view-week" data-id="${week.weekNumber}">Voir</button><button class="btn-delete-week" data-id="${week.weekNumber}">Suppr</button></div>`;
            el.querySelector('.btn-view-week').addEventListener('click', () => { this._displayWeek(week); this.ui.history.classList.add('hidden'); });
            el.querySelector('.btn-delete-week').addEventListener('click', () => this._handleDeleteHistory(week.weekNumber));
            this.ui.display.historyContent.appendChild(el);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => window.app = new AppController());