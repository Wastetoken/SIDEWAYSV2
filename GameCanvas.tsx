

import React, { useEffect, useRef, useState } from 'react';
import { GameParams, GameAssets, InputState, CarState, TireMark, SmokeParticle, MapData } from '../types';
import { PHYSICS, TILE_SIZE, TRACK_PARTS } from '../constants';
import { SoundEngine } from '../utils/SoundEngine';

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

export const GameCanvas: React.FC<GameCanvasProps> = ({ params, assets, inputState, setDebugInfo, soundEngine, isReplaying, mapData }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scaleFactor, setScaleFactor] = useState(1);
    
    // Replay State
    const replayDataRef = useRef<CarState[]>([]);
    const replayStateRef = useRef({
        index: 0,
        isPlaying: true,
        speed: 1.0,
        framesSinceLastUIUpdate: 0
    });

    // Mutable Game State
    const carRef = useRef<CarState>({
        xPos: 0, yPos: 0, xSpeed: 0, ySpeed: 0, speed: 0,
        driftAngle: 0, angle: 0, angularVelocity: 0,
        isTurning: false, isReversing: false,
        width: 25, height: 50
    });
    
    const particlesRef = useRef({
        tireMarks: [] as TireMark[],
        smokeClouds: [] as SmokeParticle[]
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

        const trackImg = assetsRef.current.trackImage;
        assetsRef.current.trackLoaded = false;
        trackImg.src = assets.trackUrl;
        trackImg.onload = () => {
            assetsRef.current.trackLoaded = true;
        };
        
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
        // If we have mapData, start in the center of the map
        if (mapData) {
            carRef.current.xPos = (mapData.width * TILE_SIZE) / 2;
            carRef.current.yPos = (mapData.height * TILE_SIZE) / 2;
        } else if (window.innerWidth) {
            const initialScale = window.innerWidth / REFERENCE_WIDTH;
            const effectiveZoom = params.zoom * initialScale;
            carRef.current.xPos = (window.innerWidth / effectiveZoom) / 2;
            carRef.current.yPos = (window.innerHeight / effectiveZoom) / 2;
        }

        const handleClear = () => {
            particlesRef.current.tireMarks = [];
            particlesRef.current.smokeClouds = [];
            replayDataRef.current = []; // Clear replay on track reset
        };

        window.addEventListener('game-reset-tracks', handleClear);
        return () => window.removeEventListener('game-reset-tracks', handleClear);
    }, [mapData]); // Reset position when map changes

    // Main Game Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', { alpha: false }); // Alpha false for perf, we draw full bg
        if (!canvas || !ctx) return;

        let animationFrameId: number;
        let then = performance.now();
        const interval = 1000 / PHYSICS.FPS;

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
                    // Audio during replay (Optional: can be jarring if skipping, maybe dampen volume?)
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
            // If E-Brake is held, throttle is cut
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
            
            // Damping (Angular Drag)
            const angularDamping = 0.94;
            car.angularVelocity *= angularDamping;

            // Initiate Drift
            if (!car.isReversing) car.driftAngle += params.driftFactor * car.angularVelocity * params.oversteer;
            
            // Drift Restoration (Straightening out)
            const driftDamping = 0.94;
            car.driftAngle *= driftDamping;
            
            // Apply Rotation
            car.angle += car.angularVelocity;
            
            // --- FRICTION & DRAG LOGIC ---
            const drag = inputState.eBrake ? params.eBrakeDecay : 0.98; 
            const lateralFriction = inputState.eBrake ? 0.15 : 1.0; 

            car.speed = car.speed * drag - (car.isReversing ? -1 : 1) * ((Math.abs(car.driftAngle) * car.speed) / 1000) * lateralFriction;

            // 4. Velocity Vectors
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

            // 6. Record State for Replay
            replayDataRef.current.push({ ...car });
            if (replayDataRef.current.length > REPLAY_MAX_FRAMES) {
                replayDataRef.current.shift();
            }
        };

        const render = () => {
            const effectiveZoom = params.zoom * scaleFactor;
            const effectiveWidth = canvas.width / effectiveZoom;
            const effectiveHeight = canvas.height / effectiveZoom;
            
            updatePhysics(effectiveZoom, effectiveWidth, effectiveHeight);

            // --- RENDERING ---
            // Clear screen
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const car = carRef.current;

            // Determine Render Mode
            // 1. Map Mode: Large world, camera follows car
            // 2. Static Mode: Screen-sized world, camera fixed, car moves
            if (mapData) {
                // --- CAMERA FOLLOW MODE ---
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                
                // Camera Translation: Move world so Car is at 0,0, then move 0,0 to cx,cy
                ctx.setTransform(effectiveZoom, 0, 0, effectiveZoom, cx, cy);
                ctx.translate(-car.xPos, -car.yPos);

                // Draw Custom Map
                if (assetsRef.current.mapRendered) {
                     ctx.drawImage(assetsRef.current.mapCanvas, 0, 0);
                } else {
                    // Loading placeholder
                    ctx.strokeStyle = '#333';
                    ctx.strokeRect(0, 0, mapData.width * TILE_SIZE, mapData.height * TILE_SIZE);
                }
            } else {
                // --- STATIC SCREEN MODE ---
                ctx.setTransform(effectiveZoom, 0, 0, effectiveZoom, 0, 0);
                
                // Draw Static Background
                if (assetsRef.current.trackLoaded) {
                    const img = assetsRef.current.trackImage;
                    const isPortrait = effectiveHeight > effectiveWidth;
                    const isLandscapeImage = img.width > img.height;
                    
                    // Auto-rotate if device is portrait but image is landscape
                    // This fixes the "Sideways" look and prevents "Stretching" (excessive zoom)
                    const shouldRotate = isPortrait && isLandscapeImage;

                    if (shouldRotate) {
                        // Rotated "Cover" logic
                        // When rotated 90deg, the image Width must cover the screen Height, etc.
                        const scale = Math.max(effectiveWidth / img.height, effectiveHeight / img.width);
                        
                        const dw = img.width * scale;
                        const dh = img.height * scale;
                        
                        // Save context, translate to center, rotate, then draw centered
                        ctx.save();
                        ctx.translate(effectiveWidth / 2, effectiveHeight / 2);
                        ctx.rotate(Math.PI / 2);
                        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
                        ctx.restore();
                    } else {
                        // Standard Aspect Fill
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
            // Ensure the transform is set for entities in case we are in static mode (bg used save/restore)
            if (!mapData) {
                ctx.setTransform(effectiveZoom, 0, 0, effectiveZoom, 0, 0);
            }
            
            const { tireMarks, smokeClouds } = particlesRef.current;

            if (!isReplaying && (Math.abs(car.speed) > 2 || Math.abs(car.driftAngle) > 5)) {
                const rad = (Math.PI / 180) * (car.angle + car.driftAngle);
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const offsetX = 10;
                const offsetY = 15;

                const bt1 = { x: car.xPos - sin * offsetY - cos * offsetX, y: car.yPos + cos * offsetY - sin * offsetX };
                const bt2 = { x: car.xPos - sin * offsetY + cos * offsetX, y: car.yPos + cos * offsetY + sin * offsetX };

                tireMarks.push({ ...bt1, opacity: params.tireMarkOpacity, size: 4 });
                tireMarks.push({ ...bt2, opacity: params.tireMarkOpacity, size: 4 });

                if (Math.random() < 0.3 * params.smokeAmount) {
                    smokeClouds.push({ ...bt1, opacity: params.tireMarkOpacity * params.smokeAmount, size: 10 });
                    smokeClouds.push({ ...bt2, opacity: params.tireMarkOpacity * params.smokeAmount, size: 10 });
                }
            }

            ctx.fillStyle = `rgba(0, 0, 0, 1)`;
            particlesRef.current.tireMarks = tireMarks.filter(mark => mark.opacity > 0.01);
            particlesRef.current.tireMarks.forEach(mark => {
                ctx.globalAlpha = mark.opacity;
                ctx.fillRect(mark.x, mark.y, mark.size / effectiveZoom, mark.size / effectiveZoom);
                mark.opacity -= params.tireMarkDecay;
            });
            ctx.globalAlpha = 1.0;

            particlesRef.current.smokeClouds = smokeClouds.filter(s => s.opacity > 0.01);
            if (particlesRef.current.smokeClouds.length > PHYSICS.MAX_SMOKE_PARTICLES) {
                 particlesRef.current.smokeClouds.splice(0, particlesRef.current.smokeClouds.length - PHYSICS.MAX_SMOKE_PARTICLES);
            }
            particlesRef.current.smokeClouds.forEach(smoke => {
                ctx.fillStyle = `rgba(210, 210, 210, ${smoke.opacity})`;
                ctx.beginPath();
                const growthFactor = 1 + (1 - smoke.opacity / (params.tireMarkOpacity * params.smokeAmount)) * 2;
                const radius = Math.max((smoke.size * growthFactor) / effectiveZoom, 0.1);
                ctx.arc(smoke.x, smoke.y, radius, 0, Math.PI * 2);
                ctx.fill();
                smoke.opacity -= params.smokeDecay;
            });

            // 3. Draw Car
            if (assetsRef.current.carLoaded && assetsRef.current.offscreenCtx) {
                const offCtx = assetsRef.current.offscreenCtx;
                const offCv = assetsRef.current.offscreenCanvas;
                
                offCtx.clearRect(0, 0, offCv.width, offCv.height);
                offCtx.globalCompositeOperation = 'source-over';
                
                // Use filter directly on drawImage
                offCtx.filter = `hue-rotate(${params.carHue}deg)`;
                offCtx.drawImage(assetsRef.current.carImage, 0, 0, car.width, car.height);
                offCtx.filter = 'none';

                ctx.save();
                ctx.translate(car.xPos, car.yPos);
                ctx.rotate((car.angle + car.driftAngle) * Math.PI / 180);
                ctx.drawImage(offCv, -car.width / 2, -car.height / 2);
                ctx.restore();
            }

            // 4. Replay UI Overlay (Canvas Level)
            if (isReplaying) {
                // VCR Filter
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.fillStyle = 'rgba(0, 20, 0, 0.1)'; // Slight tint
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Scanlines
                ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                for (let i = 0; i < canvas.height; i += 4) {
                    ctx.fillRect(0, i, canvas.width, 1);
                }

                // Text Overlay
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 2;
                ctx.font = 'bold 24px monospace';
                ctx.fillStyle = 'white';
                
                if (replayStateRef.current.isPlaying) {
                    ctx.fillText("▶ PLAY", 40, 60);
                } else {
                    ctx.fillText("❚❚ PAUSE", 40, 60);
                }

                ctx.font = '16px monospace';
                const frame = Math.floor(replayStateRef.current.index);
                const total = replayDataRef.current.length;
                ctx.fillText(`FRAME: ${frame} / ${total}`, 40, 90);
                ctx.fillText(`SPEED: ${replayStateRef.current.speed}x`, 40, 110);
            } else {
                // REC Indicator when live
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.font = 'bold 16px monospace';
                ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.fillText("● REC", canvas.width - 80, 60);
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
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const newScaleFactor = window.innerWidth / REFERENCE_WIDTH;
            setScaleFactor(newScaleFactor);
            // Don't reset position on resize anymore if map is active
            if (!mapData) {
                 const zoom = params.zoom * newScaleFactor;
                 if (carRef.current.xPos > canvas.width / zoom) carRef.current.xPos = 0;
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

    // Input Listeners (Keyboard)
    useEffect(() => {
        const handleKey = (e: KeyboardEvent, isDown: boolean) => {
            // Ignore game inputs if in replay mode
            if (isReplaying) return;

            const key = e.key;
            
            // Detect Turbo Trigger on Release (Gas keys)
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
            />
        </div>
    );
};
