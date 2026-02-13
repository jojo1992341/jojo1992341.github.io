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
historyContent: document.getElementById('historyContent'),
chartContainer: document.getElementById('progressionChart'),
goalContainer: document.getElementById('goalContainer'),
goalValue: document.getElementById('goalValue'),
predictionBadge: document.getElementById('predictionBadge')
}
};

// UI Service instantiation
this.uiService = new window.UIService(this.ui);

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
this.ui.inputs.targetReps.value = (last && last.targetReps) ? last.targetReps : '';
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
this.uiService.updateToggleButtons('#statsToggleGroup', e.target.dataset.statMetric);
}

// Analysis type toggle
if (e.target.matches('[data-analysis]')) {
this.filters.setFilter('analysisType', e.target.dataset.analysis);
this._updateAnalysisDisplay();
this.uiService.updateToggleButtons('#analysisToggleGroup', e.target.dataset.analysis);
}


});
}

_updateStatsDisplay() {
if (!this.state.currentWeek) return;
this.uiService.updateStatsDisplay(
this.state.currentWeek,
this.state.allWeeks,
this.filters.getFilter('statMetric'),
this._getPredictionText()
);
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
html = AnalysisService.generateOverview(this.state.currentWeek, this.state.allWeeks);
} else if (analysisType === 'optimization') {
html = AnalysisService.generateOptimization(this.state.currentWeek);
} else if (analysisType === 'alerts') {
html = AnalysisService.generateAlerts(this.state.currentWeek);
}

this.ui.display.globalExp.innerHTML = html;
}


_save() { StorageService.save({ allWeeks: this.state.allWeeks }); }

startSessionTimer(dayNum) {
if (!this.state.currentWeek) return;

const day = this.state.currentWeek.program.find(d => d.day === dayNum);
if (!day || day.day === 1 || day.feedback || !day.rest || day.rest <= 0) return;

const completedSeries = Math.min(day.sets, (day.timerSeriesDone || 0) + 1);
day.timerSeriesDone = completedSeries;
this._save();

this.timer.start(day.rest, {
contextText: `Série ${completedSeries} terminée`,
onImpossible: () => this._handleImpossibleFromTimer(day.day, completedSeries)
});
}

_handleImpossibleFromTimer(dayNum, completedSeries) {
if (!this.state.currentWeek) return;

const day = this.state.currentWeek.program.find(d => d.day === dayNum);
if (!day || day.feedback) return;

const repsRaw = prompt(`Série ${completedSeries + 1} incomplète. Combien de répétitions avez-vous réalisées ?`, '0');
if (repsRaw === null) return;

const reps = parseInt(repsRaw, 10);
if (Number.isNaN(reps) || reps < 0 || reps > day.reps) {
alert(`Valeur invalide. Entrez un nombre entre 0 et ${day.reps}.`);
return;
}

const completedSets = Math.max(0, completedSeries);
this._handleFeedback(dayNum, window.CONFIG.FEEDBACK.TROP_DIFFICILE);
this._handleFailureDetails(dayNum, 'sets', completedSets);
this._handleFailureDetails(dayNum, 'reps', reps);
this.uiService.updateFailureInputValues(dayNum, completedSets, reps);

day.timerSeriesDone = completedSets;
this._save();
}

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
this.uiService.toggleSetup(true);
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
day.timerSeriesDone = day.sets;
}
this._save();
this.uiService.renderFeedbackButtons(dayNum, feedbackType);
this.uiService.renderFailureInputs(dayNum, feedbackType); // Afficher/Masquer inputs
this.uiService.updateSessionCompletionIndicator(dayNum, true);
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
this.uiService.updateFailureInputValues(dayNum, day.actualSets ?? '', day.actualLastReps ?? '');
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
this.uiService.toggleSetup(false);
this.uiService.updateWeekHeader(week);

// Filters init
this.uiService.updateToggleButtons('#statsToggleGroup', this.filters.getFilter('statMetric'));
this.uiService.updateToggleButtons('#analysisToggleGroup', this.filters.getFilter('analysisType'));

// Updates
this._updateStatsDisplay();
this._updateAnalysisDisplay();
this._refreshChart();
this.uiService.renderProgramTable(week, {
onFeedback: (day, type) => this._handleFeedback(day, type),
onFailureDetails: (day, type, value) => this._handleFailureDetails(day, type, value)
});

}

_showHistory() {
this.uiService.showHistory(this.state.allWeeks, {
onView: (week) => { this._displayWeek(week); this.ui.history.classList.add('hidden'); },
onDelete: (weekNum) => this._handleDeleteHistory(weekNum)
});
}
}

