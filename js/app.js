// Les dépendances sont maintenant globales via window :
// window.CONFIG, window.AudioService, etc.

window.AppController = class AppController {
    constructor() {
        this.state = { allWeeks: [], currentWeek: null, chartMetric: 'max' };
        this.audio = new window.AudioService();
        this.timer = new window.TimerService(this.audio);
        this.filters = new window.FilterService();

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
                statsContainer: document.getElementById('statsContainer'),
                tableBody: document.getElementById('programTableBody'),
                feedback: document.getElementById('dailyFeedbackContainer'),
                feedbackStats: document.getElementById('feedbackStats'),
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
            window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
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
            if (last && last.targetReps) this.ui.inputs.targetReps.value = last.targetReps;
            else this.ui.inputs.targetReps.value = '';
        });

        document.addEventListener('click', (e) => {
            // Main chart metric toggle
            if (e.target.matches('[data-metric]')) {
                this.state.chartMetric = e.target.dataset.metric;
                this._refreshChart();
                document.querySelectorAll('[data-metric]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            }

            // Stats metric toggle
            if (e.target.matches('[data-stat-metric]')) {
                this.filters.setFilter('statMetric', e.target.dataset.statMetric);
                this._updateStatsDisplay();
                this._updateToggleButtons('#statsToggleGroup', e.target.dataset.statMetric);
            }

            // Analysis type toggle
            if (e.target.matches('[data-analysis]')) {
                this.filters.setFilter('analysisType', e.target.dataset.analysis);
                this._updateAnalysisDisplay();
                this._updateToggleButtons('#analysisToggleGroup', e.target.dataset.analysis);
            }

            // Table filter toggle
            if (e.target.matches('[data-table-filter]')) {
                this.filters.setFilter('tableFilter', e.target.dataset.tableFilter);
                this._updateTableDisplay();
                this._updateToggleButtons('#tableToggleGroup', e.target.dataset.tableFilter);
            }

            // Feedback filter toggle
            if (e.target.matches('[data-feedback-filter]')) {
                this.filters.setFilter('feedbackFilter', e.target.dataset.feedbackFilter);
                this._updateFeedbackDisplay();
                this._updateToggleButtons('#feedbackToggleGroup', e.target.dataset.feedbackFilter);
            }
        });
    }

    _updateToggleButtons(groupSelector, activeValue) {
        const group = document.querySelector(groupSelector);
        if (!group) return;
        group.querySelectorAll('.chart-toggle').forEach(btn => {
            const attr = btn.dataset.statMetric || btn.dataset.analysis || btn.dataset.tableFilter || btn.dataset.feedbackFilter;
            btn.classList.toggle('active', attr === activeValue);
            btn.setAttribute('aria-pressed', attr === activeValue ? 'true' : 'false');
        });
    }

    _updateStatsDisplay() {
        if (!this.state.currentWeek || !this.ui.display.statsContainer) return;

        const metric = this.filters.getFilter('statMetric');
        let html = '';

        if (metric === 'max') {
            html = `<p class="week-stat">Performance max: <strong id="weekMax">${this.state.currentWeek.maxReps}</strong> répétitions</p>`;
        } else if (metric === 'progression') {
            const prevWeeks = this.state.allWeeks.filter(w => w.exerciseType === this.state.currentWeek.exerciseType);
            const prev = prevWeeks.length > 1 ? prevWeeks[prevWeeks.length - 2] : null;
            const delta = prev ? this.state.currentWeek.maxReps - prev.maxReps : 0;
            const arrow = delta > 0 ? '↗' : (delta < 0 ? '↘' : '→');
            const color = delta > 0 ? 'color: #10B981' : (delta < 0 ? 'color: #EF4444' : 'color: #F59E0B');
            html = `<p class="week-stat" style="${color}">Progression: <strong>${arrow} ${delta > 0 ? '+' : ''}${delta}</strong> vs semaine précédente</p>`;
        } else if (metric === 'volume') {
            const volume = this.state.currentWeek.program.reduce((acc, d) => {
                if (d.day === 1) return acc;
                let dayVol = 0;
                if (d.actualSets !== undefined && d.actualLastReps !== undefined) {
                    dayVol = (d.actualSets * d.reps) + d.actualLastReps;
                } else {
                    dayVol = d.sets * d.reps;
                }
                return acc + dayVol;
            }, 0);
            html = `<p class="week-stat">Volume total: <strong>${volume}</strong> répétitions</p>`;
        }

        if (this.state.currentWeek.targetReps && this.state.currentWeek.targetReps > this.state.currentWeek.maxReps) {
            html += `<div class="week-stat goal-stat" style="margin-top: 0.5rem">
                <span aria-hidden="true">🎯</span> Objectif: <strong>${this.state.currentWeek.targetReps}</strong>
                <span class="prediction-badge">${this._getPredictionText()}</span>
            </div>`;
        } else if (this.state.currentWeek.targetReps) {
            html += `<div class="week-stat goal-stat" style="margin-top: 0.5rem">
                <span aria-hidden="true">🎯</span> Objectif: <strong>${this.state.currentWeek.targetReps}</strong>
                <span class="prediction-badge" style="border-color: #10B981; color: #10B981">🎉 Atteint !</span>
            </div>`;
        }

        this.ui.display.statsContainer.innerHTML = html;
    }

    _getPredictionText() {
        const week = this.state.currentWeek;
        if (!week.targetReps || week.targetReps <= week.maxReps) return "Objectif proche !";

        const weeklyGrowth = 1.05;
        const weeksNeeded = Math.ceil(Math.log(week.targetReps / week.maxReps) / Math.log(weeklyGrowth));
        if (weeksNeeded > 52) return "📅 > 1 an";

        const today = new Date();
        const futureDate = new Date(today.setDate(today.getDate() + (weeksNeeded * 7)));
        return `📅 ~${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(futureDate)}`;
    }

    _updateAnalysisDisplay() {
        if (!this.state.currentWeek || !this.ui.display.globalExp) return;

        const analysisType = this.filters.getFilter('analysisType');
        let html = '';

        if (analysisType === 'overview') {
            html = this._generateOverviewAnalysis();
        } else if (analysisType === 'optimization') {
            html = this._generateOptimizationAnalysis();
        } else if (analysisType === 'alerts') {
            html = this._generateAlertsAnalysis();
        }

        this.ui.display.globalExp.innerHTML = html;
    }

    _generateOverviewAnalysis() {
        const week = this.state.currentWeek;
        const prevWeeks = this.state.allWeeks.filter(w => w.exerciseType === week.exerciseType);
        const prev = prevWeeks.length > 1 ? prevWeeks[prevWeeks.length - 2] : null;

        let html = `<p><strong>Situation actuelle :</strong> ${week.globalAdvice}</p>`;

        if (week.dayTypePerformance) {
            html += '<div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed var(--text-muted);">';
            html += '<h4 style="font-size: 0.9rem; color: var(--text-dim); margin-bottom: 1rem; text-transform: uppercase;">Performance par Type de Jour</h4>';
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">';

            ['Léger', 'Modéré', 'Intense'].forEach(type => {
                const perf = week.dayTypePerformance[type];
                if (perf && perf.total > 0) {
                    const failurePct = Math.round(perf.failureRate * 100);
                    const easyPct = Math.round(perf.easyRate * 100);
                    const perfectPct = Math.round((perf.perfect / perf.total) * 100);
                    const hardPct = Math.round((perf.hard / perf.total) * 100);

                    let statusColor = 'var(--success)';
                    let statusText = '✓ Adapté';
                    if (failurePct > 30) {
                        statusColor = 'var(--danger)';
                        statusText = '⚠️ Trop difficile';
                    } else if (easyPct > 40) {
                        statusColor = 'var(--warning)';
                        statusText = '↑ Trop facile';
                    }

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

        return html;
    }

    _generateOptimizationAnalysis() {
        const week = this.state.currentWeek;
        let html = '<div style="background: rgba(0, 212, 255, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #00D4FF;">';

        if (week.fractionnementApplique) {
            html += '<p><strong>📊 Stratégie appliquée : Fractionnement</strong><br>J\'ai augmenté le nombre de séries et réduit les répétitions pour contourner votre seuil d\'échec. Cette approche accumule le volume progressivement et favorise l\'adaptation neuromusculaire.</p>';
        }

        const weeklyAvgProgress = week.adaptationMetrics?.delta ? Math.round(week.adaptationMetrics.delta * 100) : 0;
        if (weeklyAvgProgress > 5) {
            html += `<p><strong>🚀 Progression solide</strong><br>Vous progressez bien (+${weeklyAvgProgress}%). J\'augmente légèrement l\'intensité pour continuer sur cette lancée sans risquer de plateau.</p>`;
        } else if (weeklyAvgProgress < -3) {
            html += `<p><strong>⚡ Besoin d\'ajustement</strong><br>La baisse est notable (${weeklyAvgProgress}%). Je réduis temporairement le volume pour favoriser la récupération et relancer la progression.</p>`;
        }

        const intensePerf = week.dayTypePerformance?.['Intense'];
        if (intensePerf?.easyRate > 0.5) {
            html += '<p><strong>💪 Jours intenses maitrisés</strong><br>Vous dominez les jours difficiles. J\'augmente progressivement l\'intensité pour créer une nouvelle stimulation.</p>';
        }

        const moderatePerf = week.dayTypePerformance?.['Modéré'];
        if (moderatePerf?.failureRate > 0.5) {
            html += '<p><strong>🎯 Recalibrage nécessaire</strong><br>Les jours modérés sont trop exigeants. J\'ajuste l\'intensité et le repos pour trouver le bon équilibre.</p>';
        }

        html += '</div>';
        return html;
    }

    _generateAlertsAnalysis() {
        const week = this.state.currentWeek;
        let html = '';

        if (week.consecutiveFailures >= 2) {
            html += `<div style="background: rgba(239, 68, 68, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #EF4444; margin-bottom: 1rem;">
                <p><strong>⚠️ Alerte : Échecs en cascade</strong><br>Vous subissez l\'échec technique depuis ${week.consecutiveFailures} semaines consécutives. C\'est un signal que le programme dépasse votre capacité actuelle. J\'ai réduit l\'intensité et augmenté le repos.</p>
            </div>`;
        }

        if (week.plateauInfo?.detected) {
            html += `<div style="background: rgba(245, 158, 11, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #F59E0B; margin-bottom: 1rem;">
                <p><strong>⚠️ Plateau détecté</strong><br>Vous stagniez depuis plus de 3 semaines. ${week.plateauInfo.suggestion} Envisagez une décharge ou une variation d\'exercice.</p>
            </div>`;
        } else if (week.plateauInfo?.suggestion) {
            html += `<div style="background: rgba(245, 158, 11, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #F59E0B; margin-bottom: 1rem;">
                <p><strong>ℹ️ Vigilance</strong><br>${week.plateauInfo.suggestion}</p>
            </div>`;
        }

        if (week.criticalFailure) {
            html += `<div style="background: rgba(239, 68, 68, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #EF4444;">
                <p><strong>⚠️ Échec critique</strong><br>Vous avez réalisé moins de 60% du volume prévu la semaine passée. C\'est le signe que vous avez atteint un plateau technique majeur. Restez patient : les adaptations que j\'ai mises en place vont progressivement vous permettre de dépasser ce seuil.</p>
            </div>`;
        }

        if (!html) {
            html = '<p style="color: #10B981; font-weight: 600;">✓ Aucune alerte pour cette semaine. Continuez ainsi !</p>';
        }

        return html;
    }

    _updateTableDisplay() {
        if (!this.state.currentWeek || !this.ui.display.tableBody) return;

        const filter = this.filters.getFilter('tableFilter');
        const rows = this.ui.display.tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const dayType = row.dataset.dayType;
            let shouldShow = true;

            if (filter === 'leger') shouldShow = dayType === 'Léger';
            else if (filter === 'modere') shouldShow = dayType === 'Modéré';
            else if (filter === 'intense') shouldShow = dayType === 'Intense';

            row.style.display = shouldShow ? '' : 'none';
            row.style.animation = shouldShow ? 'fadeInUp 0.3s ease-out' : 'none';
        });
    }

    _updateFeedbackDisplay() {
        if (!this.state.currentWeek || !this.ui.display.feedback) return;

        const filter = this.filters.getFilter('feedbackFilter');
        const items = this.ui.display.feedback.querySelectorAll('.day-feedback-item');

        items.forEach(item => {
            const buttons = item.querySelectorAll('.btn-day-feedback.selected');
            const hasCompleted = buttons.length > 0;
            const feedback = buttons.length > 0 ? buttons[0].dataset.feedback : null;

            let shouldShow = true;

            if (filter === 'completed') {
                shouldShow = hasCompleted && feedback !== window.CONFIG.FEEDBACK.TROP_DIFFICILE;
            } else if (filter === 'failed') {
                shouldShow = feedback === window.CONFIG.FEEDBACK.TROP_DIFFICILE;
            } else if (filter === 'pending') {
                shouldShow = !hasCompleted;
            }

            item.style.display = shouldShow ? '' : 'none';
            item.style.animation = shouldShow ? 'fadeInUp 0.3s ease-out' : 'none';
        });

        this._updateFeedbackStats();
    }

    _updateFeedbackStats() {
        if (!this.ui.display.feedbackStats || !this.state.currentWeek) return;

        let completed = 0, failed = 0, pending = 0;

        this.state.currentWeek.program.forEach(day => {
            if (day.day === 1) return;
            if (!day.feedback) {
                pending++;
            } else if (day.feedback === window.CONFIG.FEEDBACK.TROP_DIFFICILE) {
                failed++;
            } else {
                completed++;
            }
        });

        this.ui.display.feedbackStats.innerHTML = `
            <div><span>✓ Complétés :</span> <strong>${completed}/${this.state.currentWeek.program.length - 1}</strong></div>
            <div><span>❌ Échoués :</span> <strong style="color: #EF4444">${failed}</strong></div>
            <div><span>⏳ En attente :</span> <strong style="color: #F59E0B">${pending}</strong></div>
        `;
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
            if (!confirm("Écraser les données ?")) return;
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
            if (this.state.currentWeek.targetReps) this.ui.inputs.targetReps.value = this.state.currentWeek.targetReps;
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
            if (feedbackType !== window.CONFIG.FEEDBACK.TROP_DIFFICILE) {
                delete day.actualSets;
                delete day.actualLastReps;
            }
            this._save();
            this._renderFeedbackButtons(dayNum, feedbackType);
            this._renderFailureInputs(dayNum, feedbackType); // Afficher/Masquer inputs
            this._updateStatsDisplay(); // Mettre à jour les stats
            this._refreshChart();       // Mettre à jour le graphique
        }
    }

    _handleFailureDetails(dayNum, type, value) {
        if (!this.state.currentWeek) return;
        const day = this.state.currentWeek.program.find(d => d.day === dayNum);
        if (day) {
            if (type === 'sets') day.actualSets = parseInt(value);
            if (type === 'reps') day.actualLastReps = parseInt(value);
            this._save();
            this._updateStatsDisplay(); // Mettre à jour les stats
            this._refreshChart();       // Mettre à jour le graphique
        }
    }

    _handleDeleteHistory(weekNum) {
        if (!confirm("Supprimer ?")) return;
        this.state.allWeeks = this.state.allWeeks.filter(w => w.weekNumber !== weekNum);
        this._save();
        this.state.allWeeks.length === 0 ? (this.ui.history.classList.add('hidden'), this._showSetup()) : this._showHistory();
    }

    // --- Rendering ---

    _refreshChart() {
        if (!this.state.currentWeek) return;
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

        // Initialize all toggles with saved filter values
        this._updateToggleButtons('#statsToggleGroup', this.filters.getFilter('statMetric'));
        this._updateToggleButtons('#analysisToggleGroup', this.filters.getFilter('analysisType'));
        this._updateToggleButtons('#tableToggleGroup', this.filters.getFilter('tableFilter'));
        this._updateToggleButtons('#feedbackToggleGroup', this.filters.getFilter('feedbackFilter'));

        // Update all sections with filters applied
        this._updateStatsDisplay();
        this._updateAnalysisDisplay();
        this._refreshChart();

        this.ui.display.tableBody.innerHTML = week.program.map(day => {
            const isRest = day.rest > 0;
            const intensityBadge = day.intensity ? `<span class="intensity-badge" title="Intensité: ${day.intensity}%">${day.intensity}%</span>` : '';
            const fractionnementBadge = day.fractionnementApplique ? `<span class="fractionn-badge" title="Fractionnement appliqué après un échec">📊 Frac.</span>` : '';
            return `<tr data-day-type="${day.dayType}">
                <td><div class="day-label">J${day.day}</div><div class="day-type">${day.dayType}</div>${intensityBadge}${fractionnementBadge}</td>
                <td><strong>${day.sets}</strong></td>
                <td><strong>${day.reps}</strong></td>
                <td class="${isRest ? 'cursor-pointer hover:text-primary' : ''}" ${isRest ? `onclick="window.app.timer.start(${day.rest})"` : 'style="color: var(--text-muted)"'} title="${isRest ? 'Cliquez pour démarrer le minuteur' : 'Pas de repos ce jour'}">${day.rest || '-'}s${isRest ? ' ⏱️' : ''}</td>
                <td><div class="explanation-cell">${day.explanation}</div></td>
            </tr>`;
        }).join('');

        this._updateTableDisplay();
        this._renderDailyFeedbacks();
    }

    _renderDailyFeedbacks() {
        this.ui.display.feedback.innerHTML = '';
        this.state.currentWeek.program.forEach(day => {
            if (day.day === 1) return;
            const div = document.createElement('div');
            div.className = 'day-feedback-item';
            div.innerHTML = `
                <div class="day-feedback-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <span><strong>Jour ${day.day}</strong> - ${day.dayType}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${day.sets} × ${day.reps} reps</span>
                </div>
                <div class="day-feedback-buttons" id="feedback-btns-${day.day}">
                    ${this._btnHTML(day.day, 'trop_facile', '😊', 'Trop Facile', 'Je maîtrise bien cet exercice')}
                    ${this._btnHTML(day.day, 'parfait', '👍', 'Parfait', 'Difficulté idéale')}
                    ${this._btnHTML(day.day, 'difficile_fini', '😅', 'Difficile', 'J\'ai terminé mais c\'était dur')}
                    ${this._btnHTML(day.day, 'trop_difficile', '😰', 'Impossible', 'J\'ai échoué avant la fin')}
                </div>
                <!-- Conteneur pour les inputs d'échec -->
                <div id="failure-inputs-${day.day}" class="failure-inputs hidden" style="margin-top:1rem; padding-top:1rem; border-top:1px dashed var(--text-muted)">
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.75rem">
                        <strong>📊 Détails de l'échec</strong><br>
                        Entrez combien de séries vous avez complètement réalisées et combien de répétitions vous avez faites à la dernière série (partiellement complétée). Ces informations permettent au programme de s'adapter précisément.
                    </p>
                    <div>
                        <div>
                            <label style="font-size:0.8rem; display:block; margin-bottom:0.3rem; color:var(--text-dim); font-weight:600">Séries Complètement Réalisées</label>
                            <input type="number" class="form-input" style="padding:0.5rem; background:rgba(15,52,96,0.8)" placeholder="Ex: 2" min="0" max="${day.sets}"
                                value="${day.actualSets !== undefined ? day.actualSets : ''}"
                                onchange="window.app._handleFailureDetails(${day.day}, 'sets', this.value)">
                            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem">Sur ${day.sets} prévues</p>
                        </div>
                        <div>
                            <label style="font-size:0.8rem; display:block; margin-bottom:0.3rem; color:var(--text-dim); font-weight:600">Reps à la Dernière Série</label>
                            <input type="number" class="form-input" style="padding:0.5rem; background:rgba(15,52,96,0.8)" placeholder="Ex: 8" min="0" max="${day.reps}"
                                value="${day.actualLastReps !== undefined ? day.actualLastReps : ''}"
                                onchange="window.app._handleFailureDetails(${day.day}, 'reps', this.value)">
                            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem">Avant l'échec (${day.reps} prévues)</p>
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

        this._updateFeedbackStats();
    }

    _renderFailureInputs(dayNum, feedbackType) {
        const container = document.getElementById(`failure-inputs-${dayNum}`);
        if (!container) return;
        if (feedbackType === window.CONFIG.FEEDBACK.TROP_DIFFICILE) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }


    _btnHTML(d, t, e, l, tooltip) {
        return `<button class="btn-day-feedback" data-day="${d}" data-feedback="${t}" title="${tooltip}"><span>${e}</span><span>${l}</span></button>`;
    }
    _renderFeedbackButtons(dayNum, activeType) {
        const c = document.getElementById(`feedback-btns-${dayNum}`);
        if (c) Array.from(c.children).forEach(b => b.classList.toggle('selected', b.dataset.feedback === activeType));
    }
    _showHistory() {
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
