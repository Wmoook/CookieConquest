// Audio Manager - Sound effects for the game
class AudioManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.5;
        
        // Use Web Audio API for low-latency sound
        this.audioContext = null;
        this.gainNode = null;
    }
    
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }
    
    // Generate simple beep sounds
    playTone(frequency, duration, type = 'sine') {
        if (!this.enabled || !this.audioContext) return;
        
        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const oscillator = this.audioContext.createOscillator();
        const envelope = this.audioContext.createGain();
        
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        
        envelope.gain.setValueAtTime(0, this.audioContext.currentTime);
        envelope.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
        envelope.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.connect(envelope);
        envelope.connect(this.audioContext.destination);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    playClick() {
        this.playTone(800, 0.05, 'square');
    }
    
    playPerfectClick() {
        this.playTone(1200, 0.1, 'sine');
        setTimeout(() => this.playTone(1600, 0.1, 'sine'), 50);
    }
    
    playCritClick() {
        this.playTone(600, 0.08, 'sawtooth');
        setTimeout(() => this.playTone(900, 0.08, 'sawtooth'), 30);
        setTimeout(() => this.playTone(1200, 0.1, 'sawtooth'), 60);
    }
    
    playPurchase() {
        this.playTone(400, 0.1, 'triangle');
        setTimeout(() => this.playTone(600, 0.15, 'triangle'), 100);
    }
    
    playSabotage() {
        this.playTone(200, 0.2, 'sawtooth');
        setTimeout(() => this.playTone(150, 0.3, 'sawtooth'), 100);
    }
    
    playBlocked() {
        this.playTone(300, 0.1, 'square');
        setTimeout(() => this.playTone(500, 0.15, 'square'), 80);
    }
    
    playVictory() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.3, 'sine'), i * 150);
        });
    }
    
    playDefeat() {
        this.playTone(400, 0.3, 'sawtooth');
        setTimeout(() => this.playTone(300, 0.4, 'sawtooth'), 200);
    }
    
    playNotification() {
        this.playTone(880, 0.1, 'sine');
        setTimeout(() => this.playTone(1100, 0.1, 'sine'), 100);
    }
    
    playCountdown() {
        this.playTone(440, 0.1, 'sine');
    }
    
    playBakeoff() {
        const notes = [523, 659, 784, 659, 784, 1047];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.15, 'square'), i * 100);
        });
    }
    
    playGoldenCookie() {
        this.playTone(1047, 0.2, 'sine');
        setTimeout(() => this.playTone(1319, 0.2, 'sine'), 100);
        setTimeout(() => this.playTone(1568, 0.3, 'sine'), 200);
    }
    
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
    }
    
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// Global audio instance
window.audioManager = new AudioManager();
