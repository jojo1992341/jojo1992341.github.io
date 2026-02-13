/**
 * UI SERVICE
 * Responsable de la manipulation du DOM et du rendu de l'interface.
 * Découple la logique d'affichage du contrôleur principal.
 */
window.UIService = class UIService {
    constructor(uiElements) {
        this.ui = uiElements;
    }

    updateToggleButtons(groupSelector, activeValue) {
        const group = document.querySelector(groupSelector);
        if (!group) return;
        group.querySelectorAll('.chart-toggle').forEach(btn => {
            const attr = btn.dataset.statMetric || btn.dataset.analysis || btn.dataset.tableFilter || btn.dataset.feedbackFilter;
            btn.classList.toggle('active', attr === activeValue);
            btn.setAttribute('aria-pressed', attr === activeValue ? 'true' : 'false');
        });
    }

    updateStatsDisplay(currentWeek, allWeeks, metricFilter, predictionText) {
        if (!currentWeek || !this.ui.display.statsContainer) return;

        let html = '';

        if (metricFilter === 'max') {
            html = `<p class="week-stat">Performance max: <strong id="weekMax">${currentWeek.maxReps}</strong> répétitions</p>`;
        } else if (metricFilter === 'progression') {
            const prevWeeks = allWeeks.filter(w => w.exerciseType === currentWeek.exerciseType);
            const prev = prevWeeks.length > 1 ? prevWeeks[prevWeeks.length - 2] : null;
            const delta = prev ? currentWeek.maxReps - prev.maxReps : 0;
            const arrow = delta > 0 ? '↗' : (delta < 0 ? '↘' : '→');
            const color = delta > 0 ? 'color: #10B981' : (delta < 0 ? 'color: #EF4444' : 'color: #F59E0B');
            html = `<p class="week-stat" style="${color}">Progression: <strong>${arrow} ${delta > 0 ? '+' : ''}${delta}</strong> vs semaine précédente</p>`;
        } else if (metricFilter === 'volume') {
            const volume = currentWeek.program.reduce((acc, d) => {
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

        if (currentWeek.targetReps && currentWeek.targetReps > currentWeek.maxReps) {
            html += `<div class="week-stat goal-stat" style="margin-top: 0.5rem">
                <span aria-hidden="true">🎯</span> Objectif: <strong>${currentWeek.targetReps}</strong>
                <span class="prediction-badge">${predictionText}</span>
            </div>`;
        } else if (currentWeek.targetReps) {
            html += `<div class="week-stat goal-stat" style="margin-top: 0.5rem">
                <span aria-hidden="true">🎯</span> Objectif: <strong>${currentWeek.targetReps}</strong>
                <span class="prediction-badge" style="border-color: #10B981; color: #10B981">🎉 Atteint !</span>
            </div>`;
        }

        this.ui.display.statsContainer.innerHTML = html;
    }

    updateTableDisplay(currentWeek, filter) {
        if (!currentWeek || !this.ui.display.tableBody) return;

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

    renderProgramTable(currentWeek, feedbackHandlers = null) {
        if (!currentWeek || !this.ui.display.tableBody) return;

        this.ui.display.tableBody.innerHTML = currentWeek.program.map(day => {
            const isRest = day.rest > 0;
            const isTestDay = day.day === 1;
            const dayLabel = day.calendarDay ? `J${day.calendarDay}` : `J${day.day}`;
            const sessionLabel = day.timeOfDay ? `<div class="day-type">${day.timeOfDay}</div>` : '';
            const intensityBadge = day.intensity ? `<span class="intensity-badge" title="Intensité: ${day.intensity}%">${day.intensity}%</span>` : '';
            const fractionnementBadge = day.fractionnementApplique ? `<span class="fractionn-badge" title="Fractionnement appliqué après un échec">📊 Frac.</span>` : '';
            const clickHint = isTestDay ? '' : '<div class="day-type" style="opacity:0.7">Cliquez pour suivi 📝</div>';

            const isCompleted = !isTestDay && !!day.feedback;
            const restCellHtml = isCompleted
                ? `<td class="session-status-cell" style="color:#10B981; font-weight:700;" title="Séance complétée">✓</td>`
                : `<td class="${isRest ? 'cursor-pointer hover:text-primary' : ''}" ${isRest ? `onclick="event.stopPropagation(); window.app.startSessionTimer(${day.day})"` : 'style="color: var(--text-muted)"'} title="${isRest ? 'Cliquez pour démarrer le minuteur' : 'Pas de repos ce jour'}">${day.rest || '-'}s${isRest ? ' ⏱️' : ''}</td>`;

            const trainingRow = `<tr data-day-type="${day.dayType}" ${isTestDay ? '' : `class="session-row" data-session-day="${day.day}"`}>
                <td><div class="day-label">${dayLabel}</div>${sessionLabel}<div class="day-type">${day.dayType}</div>${clickHint}${intensityBadge}${fractionnementBadge}</td>
                <td><strong>${day.sets}</strong></td>
                <td><strong>${day.reps}</strong></td>
                ${restCellHtml}
                <td><div class="explanation-cell">${day.explanation}</div></td>
            </tr>`;

            if (isTestDay) return trainingRow;

            return `${trainingRow}
            <tr class="feedback-inline-row hidden" data-feedback-row="${day.day}" data-day-type="${day.dayType}">
                <td colspan="5" style="padding: 1rem 1.25rem; background: rgba(255,255,255,0.02); border-top: 1px dashed rgba(255,255,255,0.12);">
                    <div class="day-feedback-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
                        <span><strong>Suivi ${dayLabel}${day.timeOfDay ? ` (${day.timeOfDay})` : ''}</strong> - ${day.dayType}</span>
                        <span style="font-size:0.75rem; color: var(--text-muted);">${day.sets} × ${day.reps} reps</span>
                    </div>
                    <div class="day-feedback-buttons" id="feedback-btns-${day.day}">
                        ${this._btnHTML(day.day, 'trop_facile', '😊', 'Trop Facile', 'Je maîtrise bien cet exercice')}
                        ${this._btnHTML(day.day, 'parfait', '👍', 'Parfait', 'Difficulté idéale')}
                        ${this._btnHTML(day.day, 'difficile_fini', '😅', 'Difficile', 'J\'ai terminé mais c\'était dur')}
                        ${this._btnHTML(day.day, 'trop_difficile', '😰', 'Impossible', 'J\'ai échoué avant la fin')}
                    </div>
                    <div id="failure-inputs-${day.day}" class="failure-inputs hidden" style="margin-top:1rem; padding-top:1rem; border-top:1px dashed var(--text-muted)">
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.75rem">
                            <strong>📊 Détails de l'échec</strong><br>
                            Entrez combien de séries vous avez complètement réalisées et combien de répétitions vous avez faites à la dernière série (partiellement complétée).
                        </p>
                        <div>
                            <div>
                                <label style="font-size:0.8rem; display:block; margin-bottom:0.3rem; color:var(--text-dim); font-weight:600">Séries Complètement Réalisées</label>
                                <input type="number" class="form-input failure-sets-input" data-day="${day.day}" style="padding:0.5rem; background:rgba(15,52,96,0.8)" placeholder="Ex: 2" min="0" max="${day.sets}" value="${day.actualSets !== undefined ? day.actualSets : ''}">
                                <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem">Sur ${day.sets} prévues</p>
                            </div>
                            <div>
                                <label style="font-size:0.8rem; display:block; margin-bottom:0.3rem; color:var(--text-dim); font-weight:600">Reps à la Dernière Série</label>
                                <input type="number" class="form-input failure-reps-input" data-day="${day.day}" style="padding:0.5rem; background:rgba(15,52,96,0.8)" placeholder="Ex: 8" min="0" max="${day.reps}" value="${day.actualLastReps !== undefined ? day.actualLastReps : ''}">
                                <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem">Avant l'échec (${day.reps} prévues)</p>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>`;
        }).join('');

        if (!feedbackHandlers) return;

        this.ui.display.tableBody.querySelectorAll('.session-row').forEach(row => {
            row.addEventListener('click', () => {
                const dayNum = parseInt(row.dataset.sessionDay);
                this.toggleInlineFeedback(dayNum);
            });
        });

        this.ui.display.tableBody.querySelectorAll('.btn-day-feedback').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                feedbackHandlers.onFeedback(parseInt(e.currentTarget.dataset.day), e.currentTarget.dataset.feedback);
            });
        });

        this.ui.display.tableBody.querySelectorAll('.failure-sets-input').forEach(input => {
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('change', (e) => feedbackHandlers.onFailureDetails(parseInt(e.target.dataset.day), 'sets', e.target.value));
        });

        this.ui.display.tableBody.querySelectorAll('.failure-reps-input').forEach(input => {
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('change', (e) => feedbackHandlers.onFailureDetails(parseInt(e.target.dataset.day), 'reps', e.target.value));
        });

        currentWeek.program.forEach(day => {
            if (day.day === 1) return;
            if (day.feedback) {
                this.renderFeedbackButtons(day.day, day.feedback);
                this.renderFailureInputs(day.day, day.feedback);
            }
        });
    }

    toggleInlineFeedback(dayNum) {
        const target = document.querySelector(`tr[data-feedback-row="${dayNum}"]`);
        if (!target) return;

        const allRows = this.ui.display.tableBody.querySelectorAll('.feedback-inline-row');
        allRows.forEach(row => {
            if (row === target) return;
            row.classList.add('hidden');
        });

        target.classList.toggle('hidden');
    }

    updateSessionCompletionIndicator(dayNum, isCompleted) {
        const row = this.ui.display.tableBody?.querySelector(`tr.session-row[data-session-day="${dayNum}"]`);
        if (!row) return;

        const restCell = row.children[3];
        if (!restCell) return;

        if (isCompleted) {
            restCell.className = 'session-status-cell';
            restCell.style.color = '#10B981';
            restCell.style.fontWeight = '700';
            restCell.textContent = '✓';
            restCell.title = 'Séance complétée';
            restCell.removeAttribute('onclick');
        }
    }

    updateFeedbackDisplay(currentWeek, filter) {
        if (!currentWeek || !this.ui.display.feedback) return;

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

        this.updateFeedbackStats(currentWeek);
    }

    updateFeedbackStats(currentWeek) {
        if (!this.ui.display.feedbackStats || !currentWeek) return;

        let completed = 0, failed = 0, pending = 0;

        currentWeek.program.forEach(day => {
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
            <div><span>✓ Complétés :</span> <strong>${completed}/${currentWeek.program.length - 1}</strong></div>
            <div><span>❌ Échoués :</span> <strong style="color: #EF4444">${failed}</strong></div>
            <div><span>⏳ En attente :</span> <strong style="color: #F59E0B">${pending}</strong></div>
        `;
    }

    renderDailyFeedbacks(currentWeek, feedbackHandlers) {
        if (!this.ui.display.feedback) return;
        this.ui.display.feedback.innerHTML = '';

        currentWeek.program.forEach(day => {
            if (day.day === 1) return;
            const dayTitle = day.calendarDay ? `Jour ${day.calendarDay}${day.timeOfDay ? ` (${day.timeOfDay})` : ''}` : `Jour ${day.day}`;
            const div = document.createElement('div');
            div.className = 'day-feedback-item';
            div.innerHTML = `
                <div class="day-feedback-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <span><strong>${dayTitle}</strong> - ${day.dayType}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${day.sets} × ${day.reps} reps</span>
                </div>
                <div class="day-feedback-buttons" id="feedback-btns-${day.day}">
                    ${this._btnHTML(day.day, 'trop_facile', '😊', 'Trop Facile', 'Je maîtrise bien cet exercice')}
                    ${this._btnHTML(day.day, 'parfait', '👍', 'Parfait', 'Difficulté idéale')}
                    ${this._btnHTML(day.day, 'difficile_fini', '😅', 'Difficile', 'J\'ai terminé mais c\'était dur')}
                    ${this._btnHTML(day.day, 'trop_difficile', '😰', 'Impossible', 'J\'ai échoué avant la fin')}
                </div>
                <div id="failure-inputs-${day.day}" class="failure-inputs hidden" style="margin-top:1rem; padding-top:1rem; border-top:1px dashed var(--text-muted)">
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.75rem">
                        <strong>📊 Détails de l'échec</strong><br>
                        Entrez combien de séries vous avez complètement réalisées et combien de répétitions vous avez faites à la dernière série (partiellement complétée).
                    </p>
                    <div>
                        <div>
                            <label style="font-size:0.8rem; display:block; margin-bottom:0.3rem; color:var(--text-dim); font-weight:600">Séries Complètement Réalisées</label>
                            <input type="number" class="form-input failure-sets-input" data-day="${day.day}" style="padding:0.5rem; background:rgba(15,52,96,0.8)" placeholder="Ex: 2" min="0" max="${day.sets}"
                                value="${day.actualSets !== undefined ? day.actualSets : ''}">
                            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem">Sur ${day.sets} prévues</p>
                        </div>
                        <div>
                            <label style="font-size:0.8rem; display:block; margin-bottom:0.3rem; color:var(--text-dim); font-weight:600">Reps à la Dernière Série</label>
                            <input type="number" class="form-input failure-reps-input" data-day="${day.day}" style="padding:0.5rem; background:rgba(15,52,96,0.8)" placeholder="Ex: 8" min="0" max="${day.reps}"
                                value="${day.actualLastReps !== undefined ? day.actualLastReps : ''}">
                            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem">Avant l'échec (${day.reps} prévues)</p>
                        </div>
                    </div>
                </div>
            `;
            this.ui.display.feedback.appendChild(div);

            // Event Listeners for buttons using delegated handlers
            div.querySelectorAll('.btn-day-feedback').forEach(btn =>
                btn.addEventListener('click', (e) => feedbackHandlers.onFeedback(parseInt(e.currentTarget.dataset.day), e.currentTarget.dataset.feedback)));

            // Event Listeners for inputs
            div.querySelector('.failure-sets-input').addEventListener('change', (e) =>
                feedbackHandlers.onFailureDetails(parseInt(e.target.dataset.day), 'sets', e.target.value));

            div.querySelector('.failure-reps-input').addEventListener('change', (e) =>
                feedbackHandlers.onFailureDetails(parseInt(e.target.dataset.day), 'reps', e.target.value));

            if (day.feedback) {
                this.renderFeedbackButtons(day.day, day.feedback);
                this.renderFailureInputs(day.day, day.feedback);
            }
        });

        this.updateFeedbackStats(currentWeek);
    }

    _btnHTML(d, t, e, l, tooltip) {
        return `<button class="btn-day-feedback" data-day="${d}" data-feedback="${t}" title="${tooltip}"><span>${e}</span><span>${l}</span></button>`;
    }

    renderFeedbackButtons(dayNum, activeType) {
        const c = document.getElementById(`feedback-btns-${dayNum}`);
        if (c) Array.from(c.children).forEach(b => b.classList.toggle('selected', b.dataset.feedback === activeType));
    }

    renderFailureInputs(dayNum, feedbackType) {
        const container = document.getElementById(`failure-inputs-${dayNum}`);
        if (!container) return;
        if (feedbackType === window.CONFIG.FEEDBACK.TROP_DIFFICILE) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }

    showHistory(allWeeks, callbacks) {
        this.ui.history.classList.remove('hidden');
        this.ui.display.historyContent.innerHTML = '';
        if (allWeeks.length === 0) return this.ui.display.historyContent.innerHTML = '<p class="text-center">Vide.</p>';

        [...allWeeks].reverse().forEach(week => {
            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `<div><strong>S${week.weekNumber}</strong> (${week.exerciseType}) - Max: ${week.maxReps}</div>
                <div class="history-actions"><button class="btn-view-week" data-id="${week.weekNumber}">Voir</button><button class="btn-delete-week" data-id="${week.weekNumber}">Suppr</button></div>`;

            el.querySelector('.btn-view-week').addEventListener('click', () => {
                callbacks.onView(week);
                this.ui.history.classList.add('hidden');
            });

            el.querySelector('.btn-delete-week').addEventListener('click', () => callbacks.onDelete(week.weekNumber));

            this.ui.display.historyContent.appendChild(el);
        });
    }

    toggleSetup(show) {
        if (show) {
            this.ui.program.classList.add('hidden');
            this.ui.setup.classList.remove('hidden');
        } else {
            this.ui.setup.classList.add('hidden');
            this.ui.program.classList.remove('hidden');
        }
    }

    updateWeekHeader(week) {
        this.ui.display.weekNum.textContent = week.weekNumber;
        this.ui.display.weekTitle.textContent = week.exerciseType.toUpperCase();
    }
}
