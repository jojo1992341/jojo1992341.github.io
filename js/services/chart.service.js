window.ChartService = class ChartService {
    static render(weeks, container, metric = 'max') {
        if (!container || weeks.length < 2) {
            container.innerHTML = '<p class="text-center text-muted" style="padding:2rem; font-size:0.9rem">Données insuffisantes.</p>';
            return;
        }

        const data = weeks.map((w, idx) => {
            let val = 0;
            if (metric === 'max') {
                val = w.maxReps;
            } else {
                if (w.totalVolume) {
                    // Si totalVolume est déjà calculé et stocké, on pourrait l'utiliser, 
                    // mais pour être sûr d'avoir la valeur réelle (post-feedback), on le recalcule.
                    // Cependant, w.totalVolume dans le modèle semble être le planifié.
                }
                val = w.program.reduce((acc, d) => {
                    if (d.day === 1) return acc; // Ignorer le test day pour le volume "d'entrainement" ? Ou l'inclure ? 
                    // Le user veut le nombre fait "en cas d'échec".

                    let dayVol = 0;
                    // Vérifier si des données d'exécution réelle existent (cas d'échec ou autre si implémenté futur)
                    if (d.actualSets !== undefined && d.actualLastReps !== undefined) {
                        dayVol = (d.actualSets * d.reps) + d.actualLastReps;
                    } else {
                        // Si pas d'info spécifique, on assume que c'est fait (planifié)
                        // Sauf si c'est 'pending' ? Le user veut voir ce qui est FAIT.
                        // Mais pour l'historique passé, on assume complété si pas marqué échoué ?
                        // Le code actuel utilisait le planifié. On garde ça par défaut.
                        dayVol = d.sets * d.reps;
                    }
                    return acc + dayVol;
                }, 0);
            }
            return { week: w.weekNumber, val, index: idx, weekData: w };
        });

        const maxVal = Math.max(...data.map(d => d.val)) * 1.15;
        const minVal = Math.min(...data.map(d => d.val)) * 0.85;
        const width = Math.max(600, container.clientWidth || 600);
        const height = Math.min(400, Math.max(250, window.innerWidth > 768 ? 300 : 250));
        const padding = { top: 40, right: 40, bottom: 60, left: 60 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        const xScale = (i) => padding.left + (i * plotWidth / (data.length - 1 || 1));
        const yScale = (val) => padding.top + plotHeight - ((val - minVal) / (maxVal - minVal) * plotHeight);

        const coords = data.map((d, i) => ({
            ...d,
            x: xScale(i),
            y: yScale(d.val)
        }));

        const color = metric === 'max' ? '#FF4444' : '#00D4FF';
        const label = metric === 'max' ? 'Max Reps' : 'Volume Total';

        const gridLines = this._generateGridLines(coords, padding, plotHeight, metric, maxVal, minVal);
        const pathD = this._generateSmoothPath(coords);
        const areaD = this._generateAreaPath(coords, padding, plotHeight);
        const points = this._generatePoints(coords, data, metric, color);
        const annotations = this._generateAnnotations(coords, data, color);
        const legend = this._generateLegend(metric, data, color);
        const stats = this._generateStats(data, metric);

        container.innerHTML = `
            <div style="position:relative;width:100%;padding-bottom:0;background:transparent">
                <svg id="progressChart" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
                    <defs>
                        <linearGradient id="areaGradient-${metric}" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color:${color};stop-opacity:0.25" />
                            <stop offset="100%" style="stop-color:${color};stop-opacity:0.02" />
                        </linearGradient>
                        <linearGradient id="lineGradient-${metric}" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:${color};stop-opacity:0.5" />
                            <stop offset="50%" style="stop-color:${color};stop-opacity:1" />
                            <stop offset="100%" style="stop-color:${color};stop-opacity:0.7" />
                        </linearGradient>
                    </defs>

                    <!-- Grille de fond -->
                    ${gridLines}

                    <!-- Zone sous la courbe (aire) -->
                    <path d="${areaD}" fill="url(#areaGradient-${metric})" stroke="none" opacity="0.8" />

                    <!-- Ligne de progression lissée -->
                    <path d="${pathD}" fill="none" stroke="url(#lineGradient-${metric})" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="chart-path" />

                    <!-- Ligne de tendance -->
                    ${this._generateTrendline(coords, color)}

                    <!-- Annotations (plateau, PR) -->
                    ${annotations}

                    <!-- Axes -->
                    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotHeight}" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
                    <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${width - padding.right}" y2="${padding.top + plotHeight}" stroke="rgba(255,255,255,0.15)" stroke-width="2" />

                    <!-- Labels axes Y -->
                    ${this._generateYLabels(minVal, maxVal, padding, plotHeight, height)}

                    <!-- Labels axes X -->
                    ${coords.map((c, i) => {
            if (i % Math.max(1, Math.floor(data.length / 6)) === 0 || i === data.length - 1) {
                return `<text x="${c.x}" y="${padding.top + plotHeight + 20}" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="600">S${c.week}</text>`;
            }
            return '';
        }).join('')}

                    <!-- Points de données avec glow au survol -->
                    <g class="chart-points">
                        ${points}
                    </g>

                    <!-- Label métrique -->
                    <text x="${width - padding.right - 5}" y="${padding.top + 15}" text-anchor="end" fill="var(--text-dim)" font-size="12" font-weight="700">${label}</text>
                </svg>

                <!-- Tooltip interactif -->
                <div id="chartTooltip" class="chart-tooltip hidden"></div>

                <!-- Légende et Statistiques -->
                ${legend}
                ${stats}
            </div>
        `;

        this._attachChartInteractions(container, coords, data, metric, color);
    }

    static _generateGridLines(coords, padding, plotHeight, metric, maxVal, minVal) {
        const gridCount = 5;
        let lines = '';

        for (let i = 0; i <= gridCount; i++) {
            const y = padding.top + (i * plotHeight / gridCount);
            const val = maxVal - (i / gridCount) * (maxVal - minVal);
            lines += `
                <line x1="${padding.left}" y1="${y}" x2="${coords[coords.length - 1].x}" y2="${y}"
                      stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="3,3" />
                <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="var(--text-ultra-dim)"
                      font-size="10" font-weight="500">${Math.round(val)}</text>
            `;
        }
        return lines;
    }

    static _generateSmoothPath(coords) {
        if (coords.length === 0) return '';
        if (coords.length === 1) {
            const c = coords[0];
            return `M ${c.x} ${c.y}`;
        }

        let path = `M ${coords[0].x} ${coords[0].y}`;

        for (let i = 1; i < coords.length; i++) {
            const prev = coords[i - 1];
            const curr = coords[i];
            const next = coords[i + 1];

            const cpx1 = prev.x + (curr.x - prev.x) / 2;
            const cpy1 = prev.y + (curr.y - prev.y) * 0.2;
            const cpx2 = curr.x - (next ? (next.x - curr.x) / 2 : 0);
            const cpy2 = curr.y - (next ? (next.y - curr.y) * 0.2 : 0);

            path += ` C ${cpx1} ${cpy1} ${cpx2} ${cpy2} ${curr.x} ${curr.y}`;
        }
        return path;
    }

    static _generateAreaPath(coords, padding, plotHeight) {
        if (coords.length === 0) return '';

        let path = this._generateSmoothPath(coords);
        const lastCoord = coords[coords.length - 1];
        const firstCoord = coords[0];

        path += ` L ${lastCoord.x} ${padding.top + plotHeight} L ${firstCoord.x} ${padding.top + plotHeight} Z`;
        return path;
    }

    static _generateYLabels(minVal, maxVal, padding, plotHeight, height) {
        let labels = '';
        const gridCount = 5;

        for (let i = 0; i <= gridCount; i++) {
            const y = padding.top + (i * plotHeight / gridCount);
            const val = maxVal - (i / gridCount) * (maxVal - minVal);
            labels += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="var(--text-ultra-dim)"
                      font-size="10" font-weight="500">${Math.round(val)}</text>`;
        }
        return labels;
    }

    static _generatePoints(coords, data, metric, color) {
        return coords.map((c, i) => {
            const delta = i > 0 ? c.val - coords[i - 1].val : 0;
            const isProgression = delta > 0;
            const isPlateau = Math.abs(delta) <= 1;
            const isRegression = delta < 0;

            let pointColor = color;
            let pointSize = 5.5;
            let strokeWidth = 2;

            if (isProgression) {
                pointColor = '#10B981';
            } else if (isRegression) {
                pointColor = '#EF4444';
            } else if (isPlateau) {
                pointColor = '#F59E0B';
            }

            return `
                <g class="chart-point" data-index="${i}" style="cursor:pointer">
                    <circle cx="${c.x}" cy="${c.y}" r="${pointSize}" fill="${pointColor}" stroke="rgba(255,255,255,0.8)"
                            stroke-width="${strokeWidth}" opacity="0.9" class="point-main"
                            style="filter:drop-shadow(0 0 0 rgba(${pointColor.substring(1).match(/.{1,2}/g).map(x => parseInt(x, 16)).slice(0, 3).join(',')}0.3));transition:all 0.3s ease"/>
                    <circle cx="${c.x}" cy="${c.y}" r="${pointSize + 4}" fill="none" stroke="${pointColor}"
                            stroke-width="1" opacity="0" class="point-halo"
                            style="transition:opacity 0.3s ease"/>
                </g>
            `;
        }).join('');
    }

    static _generateTrendline(coords, color) {
        if (coords.length < 2) return '';

        const xValues = coords.map((_, i) => i);
        const yValues = coords.map(c => c.val);

        const n = xValues.length;
        const sumX = xValues.reduce((a, b) => a + b);
        const sumY = yValues.reduce((a, b) => a + b);
        const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
        const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        const y1 = intercept;
        const y2 = slope * (n - 1) + intercept;

        const padding = { left: 60, top: 40 };
        const plotWidth = coords[coords.length - 1].x - padding.left;

        return `<line x1="${coords[0].x}" y1="${coords[0].y - (y1 - coords[0].val) * (coords[coords.length - 1].y - coords[0].y) / (yValues[yValues.length - 1] - yValues[0])}"
                      x2="${coords[coords.length - 1].x}" y2="${coords[coords.length - 1].y - (y2 - coords[coords.length - 1].val) * (coords[coords.length - 1].y - coords[0].y) / (yValues[yValues.length - 1] - yValues[0])}"
                      stroke="${color}" stroke-width="2" stroke-dasharray="5,5" opacity="0.4" />`;
    }

    static _generateAnnotations(coords, data, color) {
        let annotations = '';

        for (let i = 0; i < coords.length; i++) {
            const weekData = data[i].weekData;

            if (weekData.plateauInfo?.detected) {
                annotations += `
                    <g class="annotation-plateau">
                        <circle cx="${coords[i].x}" cy="${coords[i].y - 20}" r="12" fill="rgba(245, 158, 11, 0.2)" stroke="#F59E0B" stroke-width="2"/>
                        <text x="${coords[i].x}" y="${coords[i].y - 15}" text-anchor="middle" fill="#F59E0B" font-size="10" font-weight="bold">P</text>
                    </g>
                `;
            }

            if (i > 0) {
                const previousBest = Math.max(...data.slice(0, i).map(d => d.val));
                if (data[i].val <= previousBest) continue;
                annotations += `
                    <g class="annotation-pr">
                        <circle cx="${coords[i].x}" cy="${coords[i].y - 20}" r="12" fill="rgba(16, 185, 129, 0.2)" stroke="#10B981" stroke-width="2"/>
                        <text x="${coords[i].x}" y="${coords[i].y - 15}" text-anchor="middle" fill="#10B981" font-size="10" font-weight="bold">PR</text>
                    </g>
                `;
            }
        }

        return annotations;
    }

    static _generateLegend(metric, data, color) {
        const avgVal = Math.round(data.reduce((sum, d) => sum + d.val, 0) / data.length);
        const minVal = Math.min(...data.map(d => d.val));
        const maxVal = Math.max(...data.map(d => d.val));
        const progressionWeeks = data.filter((d, i) => i > 0 && d.val > data[i - 1].val).length;

        return `
            <div style="display:flex;gap:1.5rem;margin-top:1rem;flex-wrap:wrap;justify-content:space-between;font-size:0.9rem;color:var(--text-dim)">
                <div style="display:flex;align-items:center;gap:0.5rem">
                    <span style="width:16px;height:16px;background:${color};border-radius:3px;opacity:0.7"></span>
                    <span><strong>${metric === 'max' ? 'Max' : 'Volume'}</strong></span>
                </div>
                <div style="display:flex;gap:2rem">
                    <div><span style="font-size:0.75rem;opacity:0.7">MIN</span> <strong style="color:var(--text-main)">${minVal}</strong></div>
                    <div><span style="font-size:0.75rem;opacity:0.7">MOY</span> <strong style="color:var(--text-main)">${avgVal}</strong></div>
                    <div><span style="font-size:0.75rem;opacity:0.7">MAX</span> <strong style="color:var(--text-main)">${maxVal}</strong></div>
                    <div><span style="font-size:0.75rem;opacity:0.7">PROG</span> <strong style="color:#10B981">${progressionWeeks}/${data.length - 1}</strong></div>
                </div>
            </div>
        `;
    }

    static _generateStats(data, metric) {
        const totalProgress = data.length > 1 ? data[data.length - 1].val - data[0].val : 0;
        const progressPercent = data.length > 1 ? Math.round((totalProgress / data[0].val) * 100) : 0;
        const weeklyAvgProgress = data.length > 1 ? (totalProgress / (data.length - 1)).toFixed(1) : 0;

        const progressColor = totalProgress > 0 ? '#10B981' : (totalProgress < 0 ? '#EF4444' : '#F59E0B');
        const arrow = totalProgress > 0 ? '↗' : (totalProgress < 0 ? '↘' : '→');

        return `
            <div style="display:flex;gap:2rem;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.1);font-size:0.85rem">
                <div><span style="opacity:0.6">Progression Totale</span><br><strong style="color:${progressColor};font-size:1.1rem">${arrow} ${totalProgress > 0 ? '+' : ''}${totalProgress}</strong></div>
                <div><span style="opacity:0.6">Variation %</span><br><strong style="color:${progressColor};font-size:1.1rem">${progressPercent > 0 ? '+' : ''}${progressPercent}%</strong></div>
                <div><span style="opacity:0.6">Moyenne par Semaine</span><br><strong style="color:var(--text-main);font-size:1.1rem">${weeklyAvgProgress}</strong></div>
            </div>
        `;
    }

    static _attachChartInteractions(container, coords, data, metric, color) {
        const svg = container.querySelector('#progressChart');
        const tooltip = container.querySelector('#chartTooltip');

        if (!svg || !tooltip) return;

        const points = svg.querySelectorAll('.chart-point');

        points.forEach((point, i) => {
            const coord = coords[i];
            const d = data[i];
            const delta = i > 0 ? d.val - data[i - 1].val : 0;
            const deltaText = delta !== 0 ? `${delta > 0 ? '+' : ''}${delta}` : '—';

            point.addEventListener('mouseenter', (e) => {
                point.classList.add('active');

                const feedbackAvg = d.weekData.program ?
                    d.weekData.program.filter(p => p.feedback).length + ' jours notés' : 'N/A';

                tooltip.innerHTML = `
                    <div style="font-weight:700;margin-bottom:0.3rem">Semaine ${d.week}</div>
                    <div style="opacity:0.8;margin-bottom:0.2rem">${metric === 'max' ? 'Max' : 'Volume'}: <strong>${d.val}</strong></div>
                    <div style="opacity:0.8;font-size:0.85rem;color:${delta > 0 ? '#10B981' : (delta < 0 ? '#EF4444' : '#F59E0B')}">
                        Variation: ${deltaText}
                    </div>
                    <div style="opacity:0.6;font-size:0.8rem;margin-top:0.3rem">${feedbackAvg}</div>
                `;

                // Centrer le tooltip sur le point
                tooltip.style.left = coord.x + 'px';
                tooltip.style.top = (coord.y - 70) + 'px'; // Un peu plus bas pour être plus proche mais clair
                tooltip.classList.remove('hidden');
            });

            point.addEventListener('mouseleave', () => {
                point.classList.remove('active');
                tooltip.classList.add('hidden');
            });
        });
    }
}
