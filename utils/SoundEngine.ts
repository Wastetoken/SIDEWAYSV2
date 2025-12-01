
import { SynthConfig } from '../types';

export class SoundEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private compressor: DynamicsCompressorNode | null = null;
    
    // --- Channels ---
    private engineChannel: GainNode | null = null; // Sample Channel
    private turboChannel: GainNode | null = null;
    private tireChannel: GainNode | null = null;
    private synthChannel: GainNode | null = null; // Synth Master Output

    // --- Sources ---
    private engineSource: AudioBufferSourceNode | null = null;
    private engineBuffer: AudioBuffer | null = null;
    private currentEngineUrl: string = '';

    private turboBuffer: AudioBuffer | null = null;
    private currentTurboUrl: string = '';

    private tireSource: AudioBufferSourceNode | null = null;
    private tireFilter: BiquadFilterNode | null = null;

    // --- Synth Nodes ---
    private osc1: OscillatorNode | null = null;
    private osc1Gain: GainNode | null = null;
    private osc2: OscillatorNode | null = null;
    private osc2Gain: GainNode | null = null;
    
    private lfo: OscillatorNode | null = null;
    private lfoGain: GainNode | null = null;
    private filter: BiquadFilterNode | null = null;
    private distortion: WaveShaperNode | null = null;
    private mixer: GainNode | null = null;
    private chopGain: GainNode | null = null; 

    private isInitialized = false;
    private pendingLoad: { engine: string, turbo?: string } | null = null;
    private currentDistortionAmount: number = -1;

    constructor() {}

    init() {
        if (this.isInitialized && this.ctx) {
             if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(e => console.warn("Audio resume failed", e));
             }
             return;
        }

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.ctx = new AudioContextClass();
        } catch (e) {
            console.error("Web Audio API not supported", e);
            return;
        }
        
        // Master Bus with Limiter (Safety Net)
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -2; // Start compressing earlier
        this.compressor.knee.value = 10;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;
        
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8; // More headroom on master
        
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        // 1. Engine Sample Channel
        this.engineChannel = this.ctx.createGain();
        this.engineChannel.gain.value = 0; // Start Silent
        this.engineChannel.connect(this.masterGain);

        // 2. Turbo Channel
        this.turboChannel = this.ctx.createGain();
        this.turboChannel.gain.value = 1.0;
        this.turboChannel.connect(this.masterGain);

        // 3. Tire Channel
        this.tireChannel = this.ctx.createGain();
        this.tireChannel.gain.value = 0; // Start Silent
        this.tireChannel.connect(this.masterGain);

        // 4. Synth Channel (Master Synth Output)
        this.synthChannel = this.ctx.createGain();
        this.synthChannel.gain.value = 0; // Start Silent!
        this.synthChannel.connect(this.masterGain);

        // Initialize Tire Synthesis (Pink Noise)
        this.initTireSynth();

        // Initialize Synth Graph
        this.initSynthGraph();

        this.isInitialized = true;

        // Process any pending audio loads that happened before user interaction
        if (this.pendingLoad) {
            this.loadAudio(this.pendingLoad.engine, this.pendingLoad.turbo);
            this.pendingLoad = null;
        }
    }

    private initTireSynth() {
        if (!this.ctx || !this.tireChannel) return;

        const bufferSize = this.ctx.sampleRate * 2; 
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate Pink Noise (1/f)
        let b0, b1, b2, b3, b4, b5, b6;
        b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            data[i] *= 0.11; 
            b6 = white * 0.115926;
        }

        this.tireSource = this.ctx.createBufferSource();
        this.tireSource.buffer = buffer;
        this.tireSource.loop = true;

        this.tireFilter = this.ctx.createBiquadFilter();
        this.tireFilter.type = 'bandpass';
        this.tireFilter.frequency.value = 800;
        this.tireFilter.Q.value = 1;

        this.tireSource.connect(this.tireFilter);
        this.tireFilter.connect(this.tireChannel);
        this.tireSource.start();
    }

    private initSynthGraph() {
        if (!this.ctx || !this.synthChannel) return;

        this.osc1 = this.ctx.createOscillator();
        this.osc2 = this.ctx.createOscillator();
        this.lfo = this.ctx.createOscillator();
        
        this.osc1Gain = this.ctx.createGain();
        this.osc2Gain = this.ctx.createGain();
        
        this.lfoGain = this.ctx.createGain(); // Controls depth of modulation
        
        this.mixer = this.ctx.createGain();
        this.distortion = this.ctx.createWaveShaper();
        this.filter = this.ctx.createBiquadFilter();
        
        // Dedicated Gain Node for the "Chop"
        this.chopGain = this.ctx.createGain(); 
        this.chopGain.gain.value = 1.0; 

        // Graph Connections
        this.osc1.connect(this.osc1Gain);
        this.osc2.connect(this.osc2Gain);
        
        // MIXER: Sums inputs. We control gain on inputs to prevent clipping.
        this.osc1Gain.connect(this.mixer);
        this.osc2Gain.connect(this.mixer);
        
        this.mixer.connect(this.distortion);
        this.distortion.connect(this.filter);
        this.filter.connect(this.chopGain); 
        this.chopGain.connect(this.synthChannel); 

        // LFO Modulation Routing
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.chopGain.gain);

        this.osc1.start();
        this.osc2.start();
        this.lfo.start();
    }

    private makeDistortionCurve(amount: number) {
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const k = amount; 
        
        // Normalize amount 0-100 to efficient K
        // Standard Soft Clipping Curve
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            if (k === 0) {
                curve[i] = x;
            } else {
                curve[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
            }
        }
        return curve;
    }

    async loadAudio(engineUrl: string, turboUrl?: string) {
        // Queue request if context not ready (avoids race conditions)
        if (!this.ctx) {
            this.pendingLoad = { engine: engineUrl, turbo: turboUrl };
            return;
        }

        const fetchAndDecode = async (url: string): Promise<AudioBuffer | null> => {
            if (!url) return null;
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                
                // Robust Decode: Handles both Promise-based (modern) and Callback-based (older iOS/WebKit) APIs
                return await new Promise<AudioBuffer>((resolve, reject) => {
                    const res = this.ctx!.decodeAudioData(
                        arrayBuffer, 
                        (decoded) => resolve(decoded),
                        (err) => reject(err)
                    );
                    // If returns a Promise (Standard), use it
                    if (res && typeof res.then === 'function') {
                        res.then(resolve).catch(reject);
                    }
                });

            } catch (err) {
                console.warn(`[Drift.js] Audio load failed for ${url}:`, err);
                return null;
            }
        };

        // Load Engine Loop
        if (engineUrl && engineUrl !== this.currentEngineUrl) {
            const buffer = await fetchAndDecode(engineUrl);
            if (buffer) {
                this.engineBuffer = buffer;
                this.currentEngineUrl = engineUrl;
                this.restartEngineLoop();
            }
        }

        // Load Turbo One-Shot
        if (turboUrl && turboUrl !== this.currentTurboUrl) {
            const buffer = await fetchAndDecode(turboUrl);
            if (buffer) {
                this.turboBuffer = buffer;
                this.currentTurboUrl = turboUrl;
            }
        }
    }

    private restartEngineLoop() {
        if (!this.ctx || !this.engineBuffer || !this.engineChannel) return;
        
        // Stop previous source safely
        if (this.engineSource) { 
            try { this.engineSource.stop(); } catch(e) {} 
            this.engineSource.disconnect();
        }
        
        this.engineSource = this.ctx.createBufferSource();
        this.engineSource.buffer = this.engineBuffer;
        this.engineSource.loop = true;
        
        // --- SMART SAMPLING LOGIC ---
        // If the clip is long (> 1.0s), it's likely a recording, not a prepared loop.
        // We "sample" a small chunk from the middle to create a tone.
        if (this.engineBuffer.duration > 1.0) {
            const center = this.engineBuffer.duration / 2;
            // Create a 0.6s loop from the center
            this.engineSource.loopStart = center - 0.3;
            this.engineSource.loopEnd = center + 0.3;
            // Start exactly at the loop point
            this.engineSource.start(0, this.engineSource.loopStart);
        } else {
            // It's a short sample, use the whole thing
            this.engineSource.loopStart = 0;
            this.engineSource.loopEnd = this.engineBuffer.duration;
            this.engineSource.start(0);
        }

        this.engineSource.connect(this.engineChannel);
    }

    triggerTurbo(params: any) {
        if (!this.ctx || !this.turboBuffer || !this.turboChannel || params.isMuted) return;
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});

        try {
            const source = this.ctx.createBufferSource();
            source.buffer = this.turboBuffer;
            
            const shotGain = this.ctx.createGain();
            shotGain.gain.value = params.turboVolume;
            
            source.connect(shotGain);
            shotGain.connect(this.turboChannel);
            source.start();
        } catch(e) {
            console.warn("Turbo trigger failed", e);
        }
    }

    update(speed: number, driftAngle: number, isAccelerating: boolean, params: any) {
        if (!this.isInitialized || !this.ctx) return;
        
        // Robust resume
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        const isMuted = params.isMuted;
        this.masterGain!.gain.setTargetAtTime(isMuted ? 0 : 0.8, this.ctx.currentTime, 0.1);
        if (isMuted) return;

        const speedRatio = Math.abs(speed) / params.maxSpeed;

        // --- ENGINE LOGIC ---
        if (params.useCustomSynth) {
            // SYNTH MODE
            this.engineChannel!.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            this.updateSynth(speedRatio, isAccelerating, params);
        } else {
            // SAMPLE MODE
            this.synthChannel!.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            
            if (this.engineSource) {
                const pitch = 0.6 + (speedRatio * 1.8);
                this.engineSource.playbackRate.setTargetAtTime(pitch, this.ctx.currentTime, 0.1);

                // Idle Logic: Engines don't go silent, they idle.
                // If not accelerating, drop to 25% volume.
                const targetVol = isAccelerating ? params.engineVolume : (params.engineVolume * 0.25); 
                this.engineChannel!.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.2);
            }
        }

        // --- TIRE LOGIC ---
        const drift = Math.abs(driftAngle);
        const slideThreshold = 0.3;
        let tireVol = 0;
        
        if (Math.abs(speed) > 1 && drift > slideThreshold) {
            tireVol = Math.min((drift - slideThreshold) * 2.5, 1.0) * params.tireVolume;
        }

        if (this.tireChannel && this.tireFilter) {
            this.tireChannel.gain.setTargetAtTime(tireVol, this.ctx.currentTime, 0.1);
            const sweep = 600 + (Math.abs(speed) * 100);
            this.tireFilter.frequency.setTargetAtTime(sweep, this.ctx.currentTime, 0.1);
            const q = 1 + (drift * 5);
            this.tireFilter.Q.setTargetAtTime(q, this.ctx.currentTime, 0.1);
        }
    }

    private updateSynth(speedRatio: number, isAccelerating: boolean, params: any) {
        if (!this.synthChannel) return;
        const conf = params.synthConfig;

        // 0. Distortion Curve Update
        if (conf.distortion !== this.currentDistortionAmount && this.distortion) {
            this.distortion.curve = this.makeDistortionCurve(conf.distortion);
            this.currentDistortionAmount = conf.distortion;
        }

        // 1. Volume Gating (Throttle Control)
        // Idle at 15% volume for synth
        const throttle = isAccelerating ? 1.0 : 0.15;
        const masterVol = throttle * params.engineVolume * (conf.synthMasterVolume || 1.0);
        this.synthChannel.gain.setTargetAtTime(masterVol, this.ctx!.currentTime, 0.1);

        // 2. Update Waveforms
        if (this.osc1?.type !== conf.osc1Wave) this.osc1!.type = conf.osc1Wave;
        if (this.osc2?.type !== conf.osc2Wave) this.osc2!.type = conf.osc2Wave;
        if (this.lfo?.type !== conf.lfoShape) this.lfo!.type = conf.lfoShape;

        // 3. Osc Mix (Gain Staging - CRITICAL HEADROOM FIX)
        // We multiply by 0.6 to ensure the summed signal (1.2 max without this) stays around 0.7
        // This leaves headroom for filter resonance and LFO math.
        if (this.osc1Gain && this.osc2Gain) {
            this.osc1Gain.gain.setTargetAtTime((1 - conf.oscMix) * 0.6, this.ctx!.currentTime, 0.1);
            this.osc2Gain.gain.setTargetAtTime(conf.oscMix * 0.6, this.ctx!.currentTime, 0.1);
        }

        // 4. Pitch Mapping
        const pitch = conf.basePitch + (speedRatio * conf.basePitch * 2);
        this.osc1!.frequency.setTargetAtTime(pitch, this.ctx!.currentTime, 0.1);
        this.osc2!.frequency.setTargetAtTime(pitch * (1 + conf.osc2Detune/1000), this.ctx!.currentTime, 0.1);

        // 5. LFO (The Chop)
        const lfoRate = conf.lfoRate + (speedRatio * 10);
        this.lfo!.frequency.setTargetAtTime(lfoRate, this.ctx!.currentTime, 0.1);
        
        // Force LFO Depth to 0 to prevent clipping as requested
        this.lfoGain!.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.1);
        this.chopGain!.gain.setTargetAtTime(1.0, this.ctx!.currentTime, 0.1);
    }
}
