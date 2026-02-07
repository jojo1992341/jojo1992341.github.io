window.TimerService = class TimerService {
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
        if (this.ui.addBtn) this._bindEvents();
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
