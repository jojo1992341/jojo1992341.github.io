window.AudioService = class AudioService {
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
