
export interface SynthConfig {
    // Engine Oscillator 1
    osc1Wave: 'sawtooth' | 'square' | 'sine' | 'triangle';
    osc1Detune: number; // -1200 to 1200 cents
    
    // Engine Oscillator 2
    osc2Wave: 'sawtooth' | 'square' | 'sine' | 'triangle';
    osc2Detune: number;
    oscMix: number; // 0 to 1 (blend between osc1 and osc2)

    // Modulation (The "Chop")
    lfoShape: 'sine' | 'square' | 'sawtooth' | 'triangle'; // The user asked for "The Line" (Sawtooth)
    lfoRate: number; // Hz (Idle speed)
    lfoDepth: number; // 0 to 1 (How deep the chop is)

    // FX
    distortion: number; // 0 to 100
    filterCutoff: number; // Hz
    filterResonance: number; // Q factor

    // Global
    basePitch: number; // Hz (Set by the 12 keys)
    synthMasterVolume: number; // Dedicated volume for synth layer
    
    // Tires
    tireBasePitch: number;
    tireFilterQ: number;
}

export interface MapTile {
    x: number; // Grid X
    y: number; // Grid Y
    type: string; // ID from TRACK_PARTS
    rotation: number; // 0, 90, 180, 270
}

export interface MapData {
    width: number;
    height: number;
    tiles: MapTile[];
}

export interface GameParams {
    maxSpeed: number;
    maxReverseSpeed: number;
    accelerationFactor: number;
    decelerationFactor: number;
    driftFactor: number;
    turnFactor: number;
    oversteer: number;
    smokeAmount: number;
    tireMarkOpacity: number;
    smokeDecay: number;
    tireMarkDecay: number;
    zoom: number;
    carHue: number;
    carScale: number; // New: Scale of the car (0.5 to 2.0)
    // E-Brake Settings
    eBrakeDecay: number; // 0.90 (Stop) to 0.999 (Ice)

    // Audio Settings
    isMuted: boolean;
    engineVolume: number;
    tireVolume: number;
    turboVolume: number; 
    useCustomSynth: boolean; // Toggle between sample and synth
    synthConfig: SynthConfig;
    engineType: 'LS7' | 'SR20' | 'RB26' | '2JZ' | 'KA24';

    // UI Settings
    uiScale: number;      // 0.5 to 1.5
    uiSafeArea: number;   // Padding from edge in px
    uiOpacity: number;    // 0.1 to 1.0
}

export interface GameAssets {
    carUrl: string;
    trackUrl: string;
    engineAudioUrl: string;
    turboAudioUrl: string; 
}

export interface TrackPreset {
    id: string;
    name: string;
    url: string;
    physics: Partial<GameParams>;
}

export const DEFAULT_SYNTH_CONFIG: SynthConfig = {
    osc1Wave: 'sawtooth',
    osc1Detune: 0,
    osc2Wave: 'square',
    osc2Detune: 15,
    oscMix: 0.5,
    lfoShape: 'sawtooth', // Default to "The Line" for aggressive idle
    lfoRate: 6, 
    lfoDepth: 0, // DISABLED to prevent clipping (Was 0.6)
    distortion: 20,
    filterCutoff: 2000,
    filterResonance: 1,
    basePitch: 110, 
    synthMasterVolume: 1.0,
    tireBasePitch: 800,
    tireFilterQ: 10
};

export const DEFAULT_PARAMS: GameParams = {
    maxSpeed: 5.0,
    maxReverseSpeed: -4.0,
    accelerationFactor: 0.1,
    decelerationFactor: 0.1,
    driftFactor: 1.45,
    turnFactor: 0.2,
    oversteer: 1.2,
    smokeAmount: 1,
    tireMarkOpacity: 0.75,
    smokeDecay: 0.03,
    tireMarkDecay: 0.04,
    zoom: 0.4,
    carHue: 0,
    carScale: 1.0,
    eBrakeDecay: 0.995, 
    isMuted: false,
    engineVolume: 0.5,
    tireVolume: 0.4,
    turboVolume: 0.6, 
    useCustomSynth: true, 
    synthConfig: DEFAULT_SYNTH_CONFIG,
    engineType: 'LS7',
    
    // UI Defaults
    uiScale: 1.0,
    uiSafeArea: 52, // Default safe area
    uiOpacity: 1.0
};

export const PORTRAIT_PARAMS: GameParams = {
    ...DEFAULT_PARAMS,
    zoom: 0.3
};

export interface InputState {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    brake: boolean;
    eBrake: boolean;
}

export interface Point {
    x: number;
    y: number;
}

export interface TireMark extends Point {
    opacity: number;
    size: number;
}

export interface SmokeParticle extends Point {
    opacity: number;
    size: number;
}

export interface CarState {
    xPos: number;
    yPos: number;
    xSpeed: number;
    ySpeed: number;
    speed: number;
    driftAngle: number;
    angle: number;
    angularVelocity: number;
    isTurning: boolean;
    isReversing: boolean;
    width: number;
    height: number;
}

// Ghost System Types
export interface GhostFrame {
    x: number;
    y: number;
    angle: number;
    driftAngle: number;
}

export interface GhostRun {
    frames: GhostFrame[];
    totalScore: number;
}
