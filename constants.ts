
import { GameParams } from './types';

export const ASSETS = {
    CAR_IMAGE: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/C1.png',
    TRACK_BG: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/drift-course.webp',
    ENGINE_AUDIO: '',
    TURBO_AUDIO: '' 
};

export const PHYSICS = {
    MAX_SMOKE_PARTICLES: 500,
    FPS: 60,
};

// Map Maker Constants
export const TILE_SIZE = 256; 
export const GRID_SIZE = 64; // Massive grid for infinite feel

// Added 'solid' property for collision detection
export const TRACK_PARTS = [
    { id: 'straight', name: 'Straight', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/straight.png', solid: false },
    { id: 'curve', name: 'Curve', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/turn-1.png', solid: false },
    { id: 'u_turn', name: 'U-Turn', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/u-turn.png', solid: false },
    { id: 'hairpin', name: 'Double U', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/double-u-turn.png', solid: false },
    { id: 'chicane', name: 'Chicane', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/large-s.png', solid: false },
    { id: 'start', name: 'Start', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/start.png', solid: false },
    { id: 'grass', name: 'Grass', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/generic.png', solid: false }, 
    { id: 'cross', name: 'Cross', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/cross.png', solid: false },
    { id: 'check_corner', name: 'Corner Check', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/check-mark-corner.png', solid: false },
    { id: 'eight', name: 'Figure 8', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/eight-infinite.png', solid: false },
    { id: 'm_curve', name: 'M Curve', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/m-curve.png', solid: false },
    { id: 'road_1', name: 'Road 1', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/road-1.png', solid: false },
    { id: 'bumpers', name: 'Bumpers', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/road-with-bumpers.png', solid: false },
    { id: 'border', name: 'Border', src: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/track-border-1.png', solid: true }
];

export const CAR_PRESETS = [
    { id: 'c1', name: '911 GT3 Stock', url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/C1.png', hue: 0 },
    { id: 'c2', name: 'Crimson GT', url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/C2.png', hue: 0 },
    { id: 'c3', name: 'Street King', url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/C3.png', hue: 0 },
    { id: 'c4', name: 'Blue Thunder', url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/C4.png', hue: 0 },
    { id: 'c5', name: 'Cavertc Red', url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/C5.png', hue: 0 },
    { id: 'c6', name: 'Stealth Ops', url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/C6.png', hue: 0 },
    { id: 'c7', name: 'Night Runner', url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/C7.png', hue: 0 }
];

export const ENGINES = {
    LS7: { label: 'Corvette LS7 V8', cylinders: 8, basePitch: 0.6, roughness: 1.0 },
    SR20: { label: 'Nissan SR20DET', cylinders: 4, basePitch: 1.0, roughness: 0.4 },
    RB26: { label: 'Nissan RB26DETT', cylinders: 6, basePitch: 1.2, roughness: 0.1 },
    '2JZ': { label: 'Toyota 2JZ-GTE', cylinders: 6, basePitch: 1.1, roughness: 0.2 },
    KA24: { label: 'Nissan KA24DE', cylinders: 4, basePitch: 0.8, roughness: 0.7 }
};

export interface TrackPreset {
    id: string;
    name: string;
    url: string;
    physics: Partial<GameParams>;
}

export const TRACK_PRESETS: TrackPreset[] = [
    {
        id: 'standard',
        name: 'Standard Track',
        url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/drift-course.webp',
        physics: {
            maxSpeed: 5.000, accelerationFactor: 0.100, maxReverseSpeed: -4.000, driftFactor: 1.450, turnFactor: 0.200, oversteer: 1.200, decelerationFactor: 0.100, eBrakeDecay: 0.995, zoom: 0.400, smokeAmount: 1.000, smokeDecay: 0.030, tireMarkOpacity: 0.750, tireMarkDecay: 0.040
        }
    },
    {
        id: 'donut_1',
        name: '1-Piece Donut',
        url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/donutone.png',
        physics: {
            maxSpeed: 5.000, accelerationFactor: 0.250, maxReverseSpeed: -4.000, driftFactor: 1.500, turnFactor: 0.260, oversteer: 1.150, decelerationFactor: 0.100, eBrakeDecay: 0.995, zoom: 1.300, smokeAmount: 1.000, smokeDecay: 0.030, tireMarkOpacity: 0.750, tireMarkDecay: 0.040
        }
    },
    {
        id: 'donut_3',
        name: '3-Piece Donut',
        url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/Donut.png',
        physics: {
            maxSpeed: 5.000, accelerationFactor: 0.120, maxReverseSpeed: -4.000, driftFactor: 1.400, turnFactor: 0.190, oversteer: 1.000, decelerationFactor: 0.100, eBrakeDecay: 0.995, zoom: 0.400, smokeAmount: 1.000, smokeDecay: 0.030, tireMarkOpacity: 0.750, tireMarkDecay: 0.040
        }
    },
    {
        id: 'donut_extended',
        name: '3-Piece Extended',
        url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/SIDEWAYS%20-%20MAP%20-%20FULL.png',
        physics: {
             maxSpeed: 5.000, accelerationFactor: 0.120, maxReverseSpeed: -4.000, driftFactor: 1.400, turnFactor: 0.190, oversteer: 1.000, decelerationFactor: 0.100, eBrakeDecay: 0.995, zoom: 0.400, smokeAmount: 1.000, smokeDecay: 0.030, tireMarkOpacity: 0.750, tireMarkDecay: 0.040
        }
    },
    {
        id: 'mountain_1',
        name: 'Mountain 1',
        url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/Image-Pack-1.jpg',
        physics: {
            maxSpeed: 5.000, accelerationFactor: 0.70, maxReverseSpeed: -4.000, driftFactor: 1.500, turnFactor: 0.160, oversteer: 1.150, decelerationFactor: 0.100, eBrakeDecay: 0.995, zoom: 0.300, smokeAmount: 1.000, smokeDecay: 0.030, tireMarkOpacity: 0.750, tireMarkDecay: 0.040
        }
    },
    {
        id: 'mountain_2',
        name: 'Mountain 2',
        url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/Image-Pack-3.jpg',
        physics: {
            maxSpeed: 5.000, accelerationFactor: 0.70, maxReverseSpeed: -4.000, driftFactor: 1.500, turnFactor: 0.160, oversteer: 1.150, decelerationFactor: 0.100, eBrakeDecay: 0.995, zoom: 0.300, smokeAmount: 1.000, smokeDecay: 0.030, tireMarkOpacity: 0.750, tireMarkDecay: 0.040
        }
    },
    {
        id: 'mountain_3',
        name: 'Mountain 3',
        url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/Image-Pack-4.jpg',
        physics: {
            maxSpeed: 5.000, accelerationFactor: 0.70, maxReverseSpeed: -4.000, driftFactor: 1.500, turnFactor: 0.160, oversteer: 1.150, decelerationFactor: 0.100, eBrakeDecay: 0.995, zoom: 0.300, smokeAmount: 1.000, smokeDecay: 0.030, tireMarkOpacity: 0.750, tireMarkDecay: 0.040
        }
    },
    {
        id: 'mountain_4',
        name: 'Mountain 4',
        url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/Image-Pack-5.jpg',
        physics: {
            maxSpeed: 5.000, accelerationFactor: 0.70, maxReverseSpeed: -4.000, driftFactor: 1.500, turnFactor: 0.160, oversteer: 1.150, decelerationFactor: 0.100, eBrakeDecay: 0.995, zoom: 0.300, smokeAmount: 1.000, smokeDecay: 0.030, tireMarkOpacity: 0.750, tireMarkDecay: 0.040
        }
    },
    {
        id: 'mountain_5',
        name: 'Mountain 5',
        url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/Image-Pack-6.jpg',
        physics: {
            maxSpeed: 5.000, accelerationFactor: 0.70, maxReverseSpeed: -4.000, driftFactor: 1.500, turnFactor: 0.160, oversteer: 1.150, decelerationFactor: 0.100, eBrakeDecay: 0.995, zoom: 0.300, smokeAmount: 1.000, smokeDecay: 0.030, tireMarkOpacity: 0.750, tireMarkDecay: 0.040
        }
    },
    {
        id: 'mountain_6',
        name: 'Mountain 6',
        url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/Image-Pack-7.jpg',
        physics: {
            maxSpeed: 5.000, accelerationFactor: 0.70, maxReverseSpeed: -4.000, driftFactor: 1.500, turnFactor: 0.160, oversteer: 1.150, decelerationFactor: 0.100, eBrakeDecay: 0.995, zoom: 0.300, smokeAmount: 1.000, smokeDecay: 0.030, tireMarkOpacity: 0.750, tireMarkDecay: 0.040
        }
    },
     {
        id: 'drift_crowd',
        name: 'Drift Crowd',
        url: 'https://pub-dcb143f570ec45b0bb144e4fffa50137.r2.dev/Drift-Crowd.png',
        physics: {
             maxSpeed: 5.000, accelerationFactor: 0.200, maxReverseSpeed: -4.000, driftFactor: 1.450, turnFactor: 0.200, oversteer: 1.200, decelerationFactor: 0.100, eBrakeDecay: 0.995, zoom: 0.500, smokeAmount: 1.000, smokeDecay: 0.030, tireMarkOpacity: 0.750, tireMarkDecay: 0.040
        }
    }
];
