
import React, { useEffect, useRef, useState } from 'react';
import { GameParams, GameAssets, InputState, CarState, TireMark, SmokeParticle, MapData, GhostRun, GhostFrame } from '../types';
import { PHYSICS, TILE_SIZE, TRACK_PARTS } from '../constants';
import { SoundEngine } from '../utils/SoundEngine';
import { createDriftSystem } from '../utils/ClippingSystem';

interface GameCanvasProps {
    params: GameParams;
    assets: GameAssets;
    inputState: InputState;
    setDebugInfo?: (info: string) => void;
    soundEngine: SoundEngine;
    isReplaying: boolean;
    mapData: MapData | null;
}

const REFERENCE_WIDTH = 390;
const REPLAY_MAX_FRAMES = 1800; // 30 seconds @ 60fps

// Extra particle type for Sparks
interface SparkParticle extends SmokeParticle {
    vx: number;
    vy: number;
    color: string;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ params, assets, inputState, setDebugInfo, soundEngine, isReplaying, mapData }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scaleFactor, setScaleFactor] = useState(1);
    
    // Advanced Scoring System
    const driftSystemRef = useRef<any>(null);
    
    // Replay State
    const replayDataRef = useRef<CarState[]>([]);
    const replayStateRef = useRef({
        index: 0,
        isPlaying: true,
        speed: 1.0,
        framesSinceLastUIUpdate: 0
    });

    // Ghost State
    const currentRunRef = useRef<GhostFrame[]>([]);
    const ghostRunRef = useRef<GhostRun | null>(null);

    // Mutable Car State
    // Base dimensions are 25x50. We scale this based on params.
    const carRef = useRef<CarState>({
        xPos: 0, yPos: 0, xSpeed: 0, ySpeed: 0, speed: 0,
        driftAngle: 0, angle: 0, angularVelocity: 0,
        isTurning: false, isReversing: false,
        width: 25, height: 50
    });
    
    const particlesRef = useRef({
        tireMarks: [] as TireMark[],
        smokeClouds: [] as SmokeParticle[],
        sparks: [] as SparkParticle[]
    });

    const assetsRef = useRef({
        carImage: new Image(),
        trackImage: new Image(),
        offscreenCanvas: document.createElement('canvas'),
        offscreenCtx: null as CanvasRenderingContext2D | null,
        // Map Caching
        mapCanvas: document.createElement('canvas'),
        mapCtx: null as CanvasRenderingContext2D | null,
        carLoaded: false,
        trackLoaded: false,
        mapRendered: false
    });

    // Update Car Dimensions when Scale changes
    useEffect(() => {
        carRef.current.width = 25 * params.carScale;
        carRef.current.height = 50 * params.carScale;
    }, [params.carScale]);

    // Initialize Drift System on Track Load
    useEffect(() => {
        let isCancelled = false;
        const initSystem = async () => {
            if (assets.trackUrl && !mapData) {
                // Initialize Detection for static images
                const sys = await createDriftSystem(assets.trackUrl);
                if (!isCancelled) driftSystemRef.current = sys;
            } else {
                // For Tile Maps, use basic scoring (no image analysis yet)
                const sys = await createDriftSystem(''); 
                if (!isCancelled) driftSystemRef.current = sys;
            }
        };
        initSystem();
        return () => { isCancelled = true; };
    }, [assets.trackUrl, mapData]);

    // Load Assets
    useEffect(() => {
        const carImg = assetsRef.current.carImage;
        assetsRef.current.carLoaded = false;
        carImg.src = assets.carUrl;
        carImg.onload = () => {
            assetsRef.current.carLoaded = true;
            assetsRef.current.offscreenCanvas.width = 25;
            assetsRef.current.offscreenCanvas.height = 50;
            assetsRef.current.offscreenCtx = assetsRef.current.offscreenCanvas.getContext('2d', { willReadFrequently: true });
        };
        carImg.onerror = () => { console.error("Failed to load car image"); };

        const trackImg = assetsRef.current.trackImage;
        assetsRef.current.trackLoaded = false;
        trackImg.src = assets.trackUrl;
        trackImg.onload = () => {
            assetsRef.current.trackLoaded = true;
        };
        trackImg.onerror = () => { console.error("Failed to load track image"); };
        
        // Load Audio
        if (assets.engineAudioUrl) {
            soundEngine.loadAudio(assets.engineAudioUrl, assets.turboAudioUrl);
        }
    }, [assets, soundEngine]);

    // Pre-render Map if mapData changes
    useEffect(() => {
        if (!mapData) {
            assetsRef.current.mapRendered = false;
            return;
        }

        const mCanvas = assetsRef.current.mapCanvas;
        mCanvas.width = mapData.width * TILE_SIZE;
        mCanvas.height = mapData.height * TILE_SIZE;
        const ctx = mCanvas.getContext('2d');
        if (!ctx) return;
        assetsRef.current.mapCtx = ctx;

        // Draw background
        ctx.fillStyle = '#1a1a1a'; // Asphalt base
        ctx.fillRect(0, 0, mCanvas.width, mCanvas.height);

        let loadedCount = 0;
        const totalTiles = mapData.tiles.length;
        
        if (totalTiles === 0) {
             assetsRef.current.mapRendered = true;
             return;
        }

        // We need to load images and draw them
        mapData.tiles.forEach(tile => {
            const part = TRACK_PARTS.find(p => p.id === tile.type);
            if (part) {
                const img = new Image();
                img.src = part.src;
                img.onload = () => {
                    ctx.save();
                    const cx = tile.x * TILE_SIZE + TILE_SIZE / 2;
                    const cy = tile.y * TILE_SIZE + TILE_SIZE / 2;
                    ctx.translate(cx, cy);
                    ctx.rotate((tile.rotation * Math.PI) / 180);
                    ctx.drawImage(img, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
                    ctx.restore();
                    
                    loadedCount++;
                    if (loadedCount >= totalTiles) {
                        assetsRef.current.mapRendered = true;
                    }
                };
            }
        });
        
    }, [mapData]);

    // Handle Replay Mode Transitions & Events
    useEffect(() => {
        if (isReplaying) {
            // Enter Replay: Reset to start
            replayStateRef.current.index = 0;
            replayStateRef.current.isPlaying = true;
            replayStateRef.current.speed = 1.0;
        } else {
            // Exit Replay: Snap to latest live state
            if (replayDataRef.current.length > 0) {
                 carRef.current = { ...replayDataRef.current[replayDataRef.current.length - 1] };
            }
        }

        const handleReplayControl = (e: CustomEvent) => {
            const { type, value } = e.detail;
            if (type === 'seek') {
                const frame = Math.floor(value * (replayDataRef.current.length - 1));
                replayStateRef.current.index = Math.max(0, Math.min(frame, replayDataRef.current.length - 1));
            } else if (type === 'togglePause') {
                replayStateRef.current.isPlaying = !replayStateRef.current.isPlaying;
            } else if (type === 'speed') {
                replayStateRef.current.speed = value;
            }
        };

        window.addEventListener('replay-control', handleReplayControl as EventListener);
        return () => {
            window.removeEventListener('replay-control', handleReplayControl as EventListener);
        };
    }, [isReplaying]);

    // Initialize Position & Listeners
    useEffect(() => {
        const resetCarPosition = () => {
            if (mapData) {
                carRef.current.xPos = (mapData.width * TILE_SIZE) / 2;
                carRef.current.yPos = (mapData.height * TILE_SIZE) / 2;
            } else if (window.innerWidth) {
                const initialScale = window.innerWidth / REFERENCE_WIDTH;
                const effectiveZoom = params.zoom * initialScale;
                carRef.current.xPos = (window.innerWidth / effectiveZoom) / 2;
                carRef.current.yPos = (window.innerHeight / effectiveZoom) / 2;
            }
        };
        resetCarPosition();

        const handleClear = () => {
            // --- GHOST LOGIC ---
            if (currentRunRef.current.length > 0) {
                const currentState = driftSystemRef.current ? (driftSystemRef.current as any)._lastState : null;
                const currentScore = currentState ? currentState.totalScore : 0;
                
                if (!ghostRunRef.current || currentScore > ghostRunRef.current.totalScore) {
                    ghostRunRef.current = {
                        frames: [...currentRunRef.current],
                        totalScore: currentScore
                    };
                }
            }

            // Reset Game
            particlesRef.current.tireMarks = [];
            particlesRef.current.smokeClouds = [];
            particlesRef.current.sparks = [];
            replayDataRef.current = []; 
            currentRunRef.current = []; 
            
            // Reset Scoring
            if (driftSystemRef.current) driftSystemRef.current.resetScore();

            // Reset Car
            resetCarPosition();
            carRef.current.speed = 0;
            carRef.current.driftAngle = 0;
            carRef.current.angle = 0;
        };

        window.addEventListener('game-reset-tracks', handleClear);
        return () => window.removeEventListener('game-reset-tracks', handleClear);
    }, [mapData, params.zoom]);

    // Main Game Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', { alpha: false }); // Alpha false for perf
        if (!canvas || !ctx) return;

        let animationFrameId: number;
        let then = performance.now();
        const interval = 1000 / PHYSICS.FPS;

        // --- PHYSICS UPDATE ---
        const updatePhysics = (effectiveZoom: number, effectiveWidth: number, effectiveHeight: number) => {
            if (isReplaying) {
                // --- REPLAY LOGIC ---
                const state = replayStateRef.current;
                const totalFrames = replayDataRef.current.length;

                if (totalFrames === 0) return;

                if (state.isPlaying) {
                    state.index += state.speed;
                    if (state.index >= totalFrames) {
                        state.index = 0; // Loop
                    }
                }

                const frameIndex = Math.floor(state.index);
                if (replayDataRef.current[frameIndex]) {
                    carRef.current = { ...replayDataRef.current[frameIndex] };
                    // Audio during replay
                    if (state.isPlaying) {
                        soundEngine.update(carRef.current.speed, carRef.current.driftAngle, carRef.current.speed > carRef.current.xSpeed, params);
                    }
                }

                // Update UI (Throttle to ~10fps)
                state.framesSinceLastUIUpdate++;
                if (state.framesSinceLastUIUpdate > 5) {
                    window.dispatchEvent(new CustomEvent('replay-update', {
                        detail: { 
                            current: frameIndex, 
                            total: totalFrames, 
                            isPlaying: state.isPlaying,
                            speed: state.speed
                        }
                    }));
                    state.framesSinceLastUIUpdate = 0;
                }
                return;
            }

            // --- LIVE LOGIC ---
            const car = carRef.current;
            
            // 1. Acceleration / Braking
            const throttle = inputState.up && !inputState.eBrake;
            
            if (throttle) if (car.speed < params.maxSpeed) car.speed += params.accelerationFactor;
            if (inputState.down) if (car.speed > params.maxReverseSpeed) car.speed -= params.decelerationFactor;

            // 2. Turning
            const isMoving = Math.abs(car.speed) > 0.1;
            if (inputState.left && isMoving) {
                car.isTurning = true;
                const dir = inputState.up ? 1 : (car.speed > 0 ? 1 : -1); 
                car.angularVelocity -= params.turnFactor * (inputState.up ? 1 : (car.speed / params.maxSpeed) * 2) * dir;
            }
            if (inputState.right && isMoving) {
                car.isTurning = true;
                const dir = inputState.up ? 1 : (car.speed > 0 ? 1 : -1);
                car.angularVelocity += params.turnFactor * (inputState.up ? 1 : (car.speed / params.maxSpeed) * 2) * dir;
            }

            // 3. Drift Physics
            car.isReversing = car.speed < 0;
            const angularDamping = 0.94;
            car.angularVelocity *= angularDamping;
            if (!car.isReversing) car.driftAngle += params.driftFactor * car.angularVelocity * params.oversteer;
            const driftDamping = 0.94;
            car.driftAngle *= driftDamping;
            car.angle += car.angularVelocity;
            
            // Friction
            const drag = inputState.eBrake ? params.eBrakeDecay : 0.98; 
            const lateralFriction = inputState.eBrake ? 0.15 : 1.0; 
            car.speed = car.speed * drag - (car.isReversing ? -1 : 1) * ((Math.abs(car.driftAngle) * car.speed) / 1000) * lateralFriction;

            // Velocity Vectors
            const turnDrag = (car.isTurning && !inputState.eBrake) ? 0.94 : 1.0;
            car.xSpeed = Math.sin((Math.PI / 180) * (car.angle - car.driftAngle)) * car.speed * turnDrag;
            car.ySpeed = Math.cos((Math.PI / 180) * (car.angle - car.driftAngle)) * car.speed * turnDrag;

            car.xPos += car.xSpeed;
            car.yPos -= car.ySpeed;

            // 5. Bounds wrapping (Dependent on Map Size)
            const mapW = mapData ? mapData.width * TILE_SIZE : effectiveWidth;
            const mapH = mapData ? mapData.height * TILE_SIZE : effectiveHeight;

            if (car.xPos > mapW) car.xPos = 0;
            else if (car.xPos < 0) car.xPos = mapW;

            if (car.yPos > mapH) car.yPos = 0;
            else if (car.yPos < 0) car.yPos = mapH;

            // Audio Update
            soundEngine.update(car.speed, car.driftAngle, throttle, params);

            // --- ADVANCED SCORING UPDATE ---
            if (driftSystemRef.current) {
                // Update system logic with correct car dimensions from carRef
                const newState = driftSystemRef.current.update(
                    car, 
                    mapData ? mapData.width * TILE_SIZE : effectiveWidth, // World Width
                    mapData ? mapData.height * TILE_SIZE : effectiveHeight, // World Height
                    1 / PHYSICS.FPS
                );
                
                // Sync to ref for render loop
                (driftSystemRef.current as any)._lastState = newState;
            }

            // 6. Record State for Replay
            replayDataRef.current.push({ ...car });
            if (replayDataRef.current.length > REPLAY_MAX_FRAMES) {
                replayDataRef.current.shift();
            }

             // Record Ghost Frame
             currentRunRef.current.push({
                x: car.xPos,
                y: car.yPos,
                angle: car.angle,
                driftAngle: car.driftAngle
            });
             if (currentRunRef.current.length > REPLAY_MAX_FRAMES) {
                currentRunRef.current.shift();
            }
        };

        const render = () => {
            const dpr = window.devicePixelRatio || 1;
            const effectiveZoom = params.zoom * scaleFactor;
            
            // Logical dimensions (CSS pixels)
            const logicalWidth = canvas.width / dpr;
            const logicalHeight = canvas.height / dpr;

            // Effective world dimensions
            const effectiveWidth = logicalWidth / effectiveZoom;
            const effectiveHeight = logicalHeight / effectiveZoom;
            
            updatePhysics(effectiveZoom, effectiveWidth, effectiveHeight);

            // --- RENDERING ---
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, logicalWidth, logicalHeight);

            const car = carRef.current;
            const scoreState = driftSystemRef.current ? (driftSystemRef.current as any)._lastState : null;
            const isClipping = scoreState && scoreState.isInClippingZone;

            // Determine Render Mode
            if (mapData) {
                // --- CAMERA FOLLOW MODE ---
                const cx = logicalWidth / 2;
                const cy = logicalHeight / 2;
                
                // Stack Transforms: DPR -> Zoom -> Center -> Car Position
                ctx.setTransform(dpr * effectiveZoom, 0, 0, dpr * effectiveZoom, cx * dpr, cy * dpr);
                ctx.translate(-car.xPos, -car.yPos);

                if (assetsRef.current.mapRendered) {
                     ctx.drawImage(assetsRef.current.mapCanvas, 0, 0);
                } else {
                    ctx.strokeStyle = '#333';
                    ctx.strokeRect(0, 0, mapData.width * TILE_SIZE, mapData.height * TILE_SIZE);
                }
            } else {
                // --- STATIC SCREEN MODE ---
                ctx.setTransform(dpr * effectiveZoom, 0, 0, dpr * effectiveZoom, 0, 0);
                
                if (assetsRef.current.trackLoaded) {
                    const img = assetsRef.current.trackImage;
                    const isPortrait = logicalHeight > logicalWidth;
                    const isLandscapeImage = img.width > img.height;
                    const shouldRotate = isPortrait && isLandscapeImage;

                    if (shouldRotate) {
                        const scale = Math.max(effectiveWidth / img.height, effectiveHeight / img.width);
                        const dw = img.width * scale;
                        const dh = img.height * scale;
                        ctx.save();
                        ctx.translate(effectiveWidth / 2, effectiveHeight / 2);
                        ctx.rotate(Math.PI / 2);
                        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
                        ctx.restore();
                    } else {
                        const scale = Math.max(effectiveWidth / img.width, effectiveHeight / img.height);
                        const dw = img.width * scale;
                        const dh = img.height * scale;
                        const dx = (effectiveWidth - dw) / 2;
                        const dy = (effectiveHeight - dh) / 2;
                        ctx.drawImage(img, dx, dy, dw, dh);
                    }
                }
            }

            // 2. Draw Particles
            if (!mapData) {
                ctx.setTransform(dpr * effectiveZoom, 0, 0, dpr * effectiveZoom, 0, 0);
            }
            
            const { tireMarks, smokeClouds, sparks } = particlesRef.current;

            if (!isReplaying && (Math.abs(car.speed) > 2 || Math.abs(car.driftAngle) > 5)) {
                const rad = (Math.PI / 180) * (car.angle + car.driftAngle);
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                // Adjust offsets based on car dimensions
                const offsetX = car.width * 0.4;
                const offsetY = car.height * 0.35;

                const bt1 = { x: car.xPos - sin * offsetY - cos * offsetX, y: car.yPos + cos * offsetY - sin * offsetX };
                const bt2 = { x: car.xPos - sin * offsetY + cos * offsetX, y: car.yPos + cos * offsetY + sin * offsetX };

                tireMarks.push({ ...bt1, opacity: params.tireMarkOpacity, size: 4 * params.carScale });
                tireMarks.push({ ...bt2, opacity: params.tireMarkOpacity, size: 4 * params.carScale });

                // Basic Smoke
                if (Math.random() < 0.3 * params.smokeAmount) {
                    smokeClouds.push({ ...bt1, opacity: params.tireMarkOpacity * params.smokeAmount, size: 10 * params.carScale });
                    smokeClouds.push({ ...bt2, opacity: params.tireMarkOpacity * params.smokeAmount, size: 10 * params.carScale });
                }

                // Sparks (If Clipping)
                if (isClipping && Math.random() < 0.5) {
                    const sparkAngle = rad + Math.PI + (Math.random() - 0.5); // Shoot back
                    const sparkSpeed = Math.random() * 5 + 2;
                    sparks.push({
                        x: car.xPos - sin * offsetY - cos * offsetX,
                        y: car.yPos + cos * offsetY - sin * offsetX,
                        opacity: 1.0,
                        size: (Math.random() * 2 + 1) * params.carScale,
                        vx: Math.cos(sparkAngle) * sparkSpeed,
                        vy: Math.sin(sparkAngle) * sparkSpeed,
                        color: Math.random() > 0.5 ? '#facc15' : '#f87171' // Yellow or Orange
                    });
                }
            }

            // Render Tire Marks
            ctx.fillStyle = `rgba(0, 0, 0, 1)`;
            particlesRef.current.tireMarks = tireMarks.filter(mark => mark.opacity > 0.01);
            particlesRef.current.tireMarks.forEach(mark => {
                ctx.globalAlpha = mark.opacity;
                ctx.fillRect(mark.x, mark.y, mark.size / effectiveZoom, mark.size / effectiveZoom);
                mark.opacity -= params.tireMarkDecay;
            });
            ctx.globalAlpha = 1.0;

            // Render Smoke
            particlesRef.current.smokeClouds = smokeClouds.filter(s => s.opacity > 0.01);
            if (particlesRef.current.smokeClouds.length > PHYSICS.MAX_SMOKE_PARTICLES) {
                 particlesRef.current.smokeClouds.splice(0, particlesRef.current.smokeClouds.length - PHYSICS.MAX_SMOKE_PARTICLES);
            }
            particlesRef.current.smokeClouds.forEach(smoke => {
                // If clipping, smoke gets a bluish tint for "Perfect Drift"
                ctx.fillStyle = isClipping 
                    ? `rgba(200, 240, 255, ${smoke.opacity})` 
                    : `rgba(210, 210, 210, ${smoke.opacity})`;
                
                ctx.beginPath();
                const growthFactor = 1 + (1 - smoke.opacity / (params.tireMarkOpacity * params.smokeAmount)) * 2;
                const radius = Math.max((smoke.size * growthFactor) / effectiveZoom, 0.1);
                ctx.arc(smoke.x, smoke.y, radius, 0, Math.PI * 2);
                ctx.fill();
                smoke.opacity -= params.smokeDecay;
            });

            // Render Sparks
            particlesRef.current.sparks = sparks.filter(s => s.opacity > 0.05);
            particlesRef.current.sparks.forEach(spark => {
                ctx.fillStyle = spark.color;
                ctx.globalAlpha = spark.opacity;
                ctx.beginPath();
                ctx.arc(spark.x, spark.y, spark.size / effectiveZoom, 0, Math.PI * 2);
                ctx.fill();
                
                spark.x += spark.vx;
                spark.y += spark.vy;
                spark.opacity -= 0.05;
            });
            ctx.globalAlpha = 1.0;

             // 3. Draw GHOST Car
             if (!isReplaying && ghostRunRef.current && assetsRef.current.carLoaded) {
                const ghostFrameIndex = Math.floor(replayDataRef.current.length); 
                if (ghostFrameIndex < ghostRunRef.current.frames.length) {
                    const g = ghostRunRef.current.frames[ghostFrameIndex];
                    const offCv = assetsRef.current.offscreenCanvas;
                    ctx.save();
                    ctx.translate(g.x, g.y);
                    ctx.rotate((g.angle + g.driftAngle) * Math.PI / 180);
                    ctx.globalAlpha = 0.4;
                    ctx.filter = 'grayscale(100%) brightness(150%)'; 
                    // Draw image centered
                    ctx.drawImage(offCv, -car.width / 2, -car.height / 2, car.width, car.height);
                    ctx.restore();
                    ctx.globalAlpha = 1.0;
                    ctx.filter = 'none';
                }
           }

            // 4. Draw Player Car
            if (assetsRef.current.carLoaded && assetsRef.current.offscreenCtx) {
                const offCtx = assetsRef.current.offscreenCtx;
                const offCv = assetsRef.current.offscreenCanvas;
                
                // Resize offscreen canvas if needed (if carScale changed significantly)
                if (offCv.width !== Math.ceil(car.width) || offCv.height !== Math.ceil(car.height)) {
                    offCv.width = Math.ceil(car.width);
                    offCv.height = Math.ceil(car.height);
                }

                offCtx.clearRect(0, 0, offCv.width, offCv.height);
                offCtx.globalCompositeOperation = 'source-over';
                offCtx.filter = `hue-rotate(${params.carHue}deg)`;
                // Draw car to fill the offscreen canvas
                offCtx.drawImage(assetsRef.current.carImage, 0, 0, offCv.width, offCv.height);
                offCtx.filter = 'none';

                ctx.save();
                ctx.translate(car.xPos, car.yPos);
                ctx.rotate((car.angle + car.driftAngle) * Math.PI / 180);
                // Draw offscreen canvas centered
                ctx.drawImage(offCv, -car.width / 2, -car.height / 2, car.width, car.height);
                ctx.restore();
            }

            // 5. HUD & UI Overlay (Canvas Level)
            if (isReplaying) {
                // Replay UI...
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
                ctx.fillStyle = 'rgba(0, 20, 0, 0.1)'; 
                ctx.fillRect(0, 0, logicalWidth, logicalHeight);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                for (let i = 0; i < logicalHeight; i += 4) { ctx.fillRect(0, i, logicalWidth, 1); }
                ctx.shadowColor = 'black'; ctx.shadowBlur = 2; ctx.font = 'bold 24px monospace'; ctx.fillStyle = 'white';
                if (replayStateRef.current.isPlaying) ctx.fillText("▶ PLAY", 40, 60);
                else ctx.fillText("❚❚ PAUSE", 40, 60);
                ctx.font = '16px monospace';
                ctx.fillText(`FRAME: ${Math.floor(replayStateRef.current.index)} / ${replayDataRef.current.length}`, 40, 90);
                ctx.fillText(`SPEED: ${replayStateRef.current.speed}x`, 40, 110);
            } else {
                // SCORE HUD
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
                const s = driftSystemRef.current ? (driftSystemRef.current as any)._lastState : { currentScore: 0, totalScore: 0, multiplier: 1, isInClippingZone: false, combo: 0 };

                // Current Chain
                if (s && s.currentScore > 0) {
                     ctx.textAlign = 'center';
                     ctx.shadowColor = 'rgba(0,0,0,0.8)';
                     ctx.shadowBlur = 4;
                     
                     const currentPts = Math.floor(s.currentScore);
                     
                     ctx.font = 'bold italic 48px Inter, sans-serif';
                     ctx.fillStyle = s.isInClippingZone ? '#22d3ee' : '#facc15'; 
                     ctx.fillText(`${currentPts}`, logicalWidth / 2, 80);
                     
                     ctx.font = 'bold 24px Inter, sans-serif';
                     ctx.fillStyle = 'white';
                     ctx.fillText(`x${s.multiplier.toFixed(1)} ${s.isInClippingZone ? 'PERFECT!' : ''}`, logicalWidth / 2, 110);
                     
                     if (s.combo > 0) {
                         ctx.fillStyle = s.isInClippingZone ? '#facc15' : '#a3a3a3';
                         ctx.font = 'bold 16px Inter, sans-serif';
                         ctx.fillText(`COMBO x${s.combo}`, logicalWidth / 2, 135);
                     }
                }

                // Total Score
                ctx.textAlign = 'left';
                ctx.shadowColor = 'rgba(0,0,0,1)';
                ctx.shadowBlur = 2;
                ctx.font = 'bold 20px monospace';
                ctx.fillStyle = 'white';
                const scoreDisplay = s ? s.totalScore : 0;
                ctx.fillText(`SCORE: ${scoreDisplay.toString().padStart(6, '0')}`, 20, 40);
                
                // Rec Indicator
                ctx.textAlign = 'right';
                ctx.font = 'bold 16px monospace';
                ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.fillText("● REC", logicalWidth - 20, 40);
            }
        };

        const loop = (now: number) => {
            animationFrameId = requestAnimationFrame(loop);
            const delta = now - then;
            if (delta > interval) {
                then = now - (delta % interval);
                render();
            }
        };

        const handleResize = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            const newScaleFactor = window.innerWidth / REFERENCE_WIDTH;
            setScaleFactor(newScaleFactor);
            if (!mapData) {
                 const zoom = params.zoom * newScaleFactor;
                 if (carRef.current.xPos > window.innerWidth / zoom) carRef.current.xPos = 0;
            }
        };
        
        window.addEventListener('resize', handleResize);
        handleResize();

        loop(performance.now());

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
        };
    }, [params, scaleFactor, assets, soundEngine, isReplaying, mapData]); 

    // Input Listeners... (kept same)
    useEffect(() => {
        const handleKey = (e: KeyboardEvent, isDown: boolean) => {
            if (isReplaying) return;
            const key = e.key;
            if (!isDown && (key === 'ArrowUp' || key === 'w')) {
                soundEngine.triggerTurbo(params);
            }
            switch(key) {
                case 'ArrowUp': inputState.up = isDown; break;
                case 'w': inputState.up = isDown; break;
                case 'ArrowDown': inputState.down = isDown; break;
                case 's': inputState.down = isDown; break;
                case 'ArrowLeft': inputState.left = isDown; break;
                case 'a': inputState.left = isDown; break;
                case 'ArrowRight': inputState.right = isDown; break;
                case 'd': inputState.right = isDown; break;
                case 'e': inputState.eBrake = isDown; break;
                case 'Shift': inputState.eBrake = isDown; break;
            }
            if (isDown) soundEngine.init();
        };
        const down = (e: KeyboardEvent) => handleKey(e, true);
        const up = (e: KeyboardEvent) => handleKey(e, false);
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        };
    }, [inputState, soundEngine, params, isReplaying]);

    return (
        <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-black">
            <canvas 
                ref={canvasRef}
                className="block w-full h-full relative z-10 touch-none"
                style={{ width: '100%', height: '100%' }}
            />
        </div>
    );
};
