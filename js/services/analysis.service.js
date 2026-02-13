/**
 * ANALYSIS SERVICE
 * Responsable de la génération des textes d'analyse et de coaching.
 * Logique purifiée, séparée du contrôleur.
 */
window.AnalysisService = class AnalysisService {

    /**
     * Génère l'analyse globale de la semaine.
     * @param {Object} currentWeek - La semaine actuelle.
     * @param {Array} allWeeks - L'historique complet des semaines.
     * @returns {string} HTML de l'analyse.
     */
    static generateOverview(currentWeek, allWeeks) {
        if (!currentWeek) return '';

        let html = `<p><strong>Situation actuelle :</strong> ${currentWeek.globalAdvice || ''}</p>`;

        if (currentWeek.algorithmSelection?.name) {
            html += `<div style="margin-top: 1rem; background: rgba(0, 212, 255, 0.08); border: 1px solid rgba(0, 212, 255, 0.25); border-radius: 10px; padding: 0.9rem;">
                <p style="margin:0; font-size: 0.85rem;"><strong>🧠 Algorithme sélectionné cette semaine :</strong> ${currentWeek.algorithmSelection.name}</p>
                <p style="margin:0.3rem 0 0; font-size: 0.75rem; color: var(--text-muted);">${currentWeek.algorithmSelection.rationale || ''}</p>
            </div>`;
        }

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

    /**
     * Génère l'analyse d'optimisation et les ajustements futurs.
     * @param {Object} currentWeek - La semaine actuelle.
     * @returns {string} HTML de l'analyse.
     */
    static generateOptimization(currentWeek) {
        if (!currentWeek) return '';

        let html = '<div style="background: rgba(0, 212, 255, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #00D4FF;">';

        if (currentWeek.fractionnementApplique) {
            html += '<p><strong>📊 Stratégie appliquée : Fractionnement</strong><br>J\'ai augmenté le nombre de séries et réduit les répétitions pour contourner votre seuil d\'échec. Cette approche accumule le volume progressivement et favorise l\'adaptation neuromusculaire.</p>';
        }

        const weeklyAvgProgress = currentWeek.adaptationMetrics?.delta ? Math.round(currentWeek.adaptationMetrics.delta * 100) : 0;
        if (weeklyAvgProgress > 5) {
            html += `<p><strong>🚀 Progression solide</strong><br>Vous progressez bien (+${weeklyAvgProgress}%). J\'augmente légèrement l\'intensité pour continuer sur cette lancée sans risquer de plateau.</p>`;
        } else if (weeklyAvgProgress < -3) {
            html += `<p><strong>⚡ Besoin d\'ajustement</strong><br>La baisse est notable (${weeklyAvgProgress}%). Je réduis temporairement le volume pour favoriser la récupération et relancer la progression.</p>`;
        }

        const intensePerf = currentWeek.dayTypePerformance?.['Intense'];
        if (intensePerf?.easyRate > 0.5) {
            html += '<p><strong>💪 Jours intenses maitrisés</strong><br>Vous dominez les jours difficiles. J\'augmente progressivement l\'intensité pour créer une nouvelle stimulation.</p>';
        }

        const moderatePerf = currentWeek.dayTypePerformance?.['Modéré'];
        if (moderatePerf?.failureRate > 0.5) {
            html += '<p><strong>🎯 Recalibrage nécessaire</strong><br>Les jours modérés sont trop exigeants. J\'ajuste l\'intensité et le repos pour trouver le bon équilibre.</p>';
        }

        html += '</div>';
        return html;
    }

    /**
     * Génère les alertes critiques et informations de plateau.
     * @param {Object} currentWeek - La semaine actuelle.
     * @returns {string} HTML des alertes.
     */
    static generateAlerts(currentWeek) {
        if (!currentWeek) return '';

        let html = '';

        if (currentWeek.consecutiveFailures >= 2) {
            html += `<div style="background: rgba(239, 68, 68, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #EF4444; margin-bottom: 1rem;">
                <p><strong>⚠️ Alerte : Échecs en cascade</strong><br>Vous subissez l\'échec technique depuis ${currentWeek.consecutiveFailures} semaines consécutives. C\'est un signal que le programme dépasse votre capacité actuelle. J\'ai réduit l\'intensité et augmenté le repos.</p>
            </div>`;
        }

        if (currentWeek.plateauInfo?.detected) {
            html += `<div style="background: rgba(245, 158, 11, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #F59E0B; margin-bottom: 1rem;">
                <p><strong>⚠️ Plateau détecté</strong><br>Vous stagniez depuis plus de 3 semaines. ${currentWeek.plateauInfo.suggestion} Envisagez une décharge ou une variation d\'exercice.</p>
            </div>`;
        } else if (currentWeek.plateauInfo?.suggestion) {
            html += `<div style="background: rgba(245, 158, 11, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #F59E0B; margin-bottom: 1rem;">
                <p><strong>ℹ️ Vigilance</strong><br>${currentWeek.plateauInfo.suggestion}</p>
            </div>`;
        }

        if (currentWeek.criticalFailure) {
            html += `<div style="background: rgba(239, 68, 68, 0.08); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #EF4444;">
                <p><strong>⚠️ Échec critique</strong><br>Vous avez réalisé moins de 60% du volume prévu la semaine passée. C\'est le signe que vous avez atteint un plateau technique majeur. Restez patient : les adaptations que j\'ai mises en place vont progressivement vous permettre de dépasser ce seuil.</p>
            </div>`;
        }

        if (!html) {
            html = '<p style="color: #10B981; font-weight: 600;">✓ Aucune alerte pour cette semaine. Continuez ainsi !</p>';
        }

        return html;
    }
}
