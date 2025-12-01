
import React, { useState, useEffect } from 'react';
import { Settings, X, RotateCcw, Car, Map, Upload, Volume2, VolumeX, Music, Zap, Activity, Sliders, Wind, Rewind, Play, Pause, Trash2, Gamepad2, Move } from 'lucide-react';
import { GameParams, GameAssets, SynthConfig } from '../types';
import { ENGINES, CAR_PRESETS, TRACK_PRESETS } from '../constants';

interface UIOverlayProps {
    params: GameParams;
    onParamChange: (key: keyof GameParams, value: any) => void;
    onAssetChange: (key: keyof GameAssets, file: File | string) => void;
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    onClearTracks: () => void;
    isReplaying: boolean;
    setIsReplaying: (v: boolean) => void;
    onOpenMapMaker: () => void;
}

const NoteButton: React.FC<{ freq: number, label: string, isActive: boolean, onClick: (f: number) => void }> = ({ freq, label, isActive, onClick }) => (
    <button
        onClick={() => onClick(freq)}
        className={`
            flex-1 h-12 rounded-sm border-b-4 text-[10px] font-bold flex items-end justify-center pb-1
            transition-all active:scale-95
            ${isActive 
                ? 'bg-indigo-500 border-indigo-700 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]' 
                : 'bg-neutral-800 border-neutral-950 text-neutral-500 hover:bg-neutral-700'
            }
        `}
    >
        {label}
    </button>
);

const SynthSlider: React.FC<{ label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void }> = ({ label, value, min, max, step, onChange }) => (
    <div className="space-y-1">
        <div className="flex justify-between items-end">
            <label className="text-[10px] uppercase font-bold text-gray-500">{label}</label>
            <span className="text-xs font-mono text-indigo-400">{value.toFixed(step < 1 ? 2 : 0)}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </div>
);

const ControlGroup: React.FC<{ 
    label: string; 
    value: number; 
    min: number; 
    max: number; 
    step: number; 
    onChange: (val: number) => void;
}> = ({ label, value, min, max, step, onChange }) => (
    <div className="space-y-1 bg-[#222] p-3 rounded-xl border border-white/5 shadow-sm">
        <div className="flex justify-between text-sm mb-2">
            <label className="text-gray-300 font-medium">{label}</label>
            <span className="text-indigo-400 font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded border border-white/5">{value.toFixed(3)}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </div>
);

export const UIOverlay: React.FC<UIOverlayProps> = ({ 
    params, 
    onParamChange, 
    onAssetChange,
    isOpen, 
    setIsOpen,
    onClearTracks,
    isReplaying,
    setIsReplaying,
    onOpenMapMaker
}) => {
    const [activeTab, setActiveTab] = useState<'garage' | 'tracks' | 'controls' | 'tuning' | 'audio' | 'synth'>('garage');
    
    // Replay UI State
    const [replayProgress, setReplayProgress] = useState(0);
    const [replayIsPaused, setReplayIsPaused] = useState(false);
    const [replaySpeed, setReplaySpeed] = useState(1.0);

    // Slot Management State (Local for UI, but applied to Game)
    const [carSlots, setCarSlots] = useState<(typeof CAR_PRESETS[0] | null)[]>([]);
    const [trackSlots, setTrackSlots] = useState<(typeof TRACK_PRESETS[0] | null)[]>([]);

    // Initialize Slots
    useEffect(() => {
        // Cars: 20 Slots. Fill first ones with presets.
        const cSlots = new Array(20).fill(null);
        CAR_PRESETS.forEach((car, i) => { if(i < 20) cSlots[i] = car; });
        setCarSlots(cSlots);

        // Tracks: 20 Slots. Fill first ones with presets.
        const tSlots = new Array(20).fill(null);
        TRACK_PRESETS.forEach((track, i) => { if(i < 20) tSlots[i] = track; });
        setTrackSlots(tSlots);
    }, []);

    const handleCarUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        if (e.target.files && e.target.files[0]) {
            const url = URL.createObjectURL(e.target.files[0]);
            const newCar = {
                id: `custom_car_${Date.now()}`,
                name: 'Custom Car',
                url: url,
                hue: 0
            };
            const newSlots = [...carSlots];
            newSlots[index] = newCar;
            setCarSlots(newSlots);
            onAssetChange('carUrl', url);
        }
    };

    const handleTrackUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        if (e.target.files && e.target.files[0]) {
            const url = URL.createObjectURL(e.target.files[0]);
            const newTrack = {
                id: `custom_track_${Date.now()}`,
                name: 'Custom Track',
                url: url,
                physics: {} // Default physics (current params) or standard
            };
            const newSlots = [...trackSlots];
            newSlots[index] = newTrack;
            setTrackSlots(newSlots);
            onAssetChange('trackUrl', url);
        }
    };

    const handleDeleteSlot = (type: 'car' | 'track', index: number) => {
        if (type === 'car') {
            const newSlots = [...carSlots];
            newSlots[index] = null;
            setCarSlots(newSlots);
        } else {
            const newSlots = [...trackSlots];
            newSlots[index] = null;
            setTrackSlots(newSlots);
        }
    };

    const handleTrackSelect = (track: typeof TRACK_PRESETS[0]) => {
        onAssetChange('trackUrl', track.url);
        
        // Apply Physics Presets
        if (track.physics) {
            Object.entries(track.physics).forEach(([key, value]) => {
                onParamChange(key as keyof GameParams, value);
            });
        }
    };

    // Listen for updates from GameCanvas
    useEffect(() => {
        const handleUpdate = (e: CustomEvent) => {
            const { current, total, isPlaying, speed } = e.detail;
            setReplayProgress(current / total);
            setReplayIsPaused(!isPlaying);
            setReplaySpeed(speed);
        };
        window.addEventListener('replay-update', handleUpdate as EventListener);
        return () => window.removeEventListener('replay-update', handleUpdate as EventListener);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, key: keyof GameAssets) => {
        if (e.target.files && e.target.files[0]) {
            onAssetChange(key, e.target.files[0]);
        }
    };

    const updateSynth = (key: keyof SynthConfig, value: any) => {
        onParamChange('synthConfig', { ...params.synthConfig, [key]: value });
    };

    const handleReplayAction = (type: string, value?: number) => {
        window.dispatchEvent(new CustomEvent('replay-control', { detail: { type, value } }));
    };

    const HeaderButton = ({ onClick, icon: Icon, label }: { onClick: () => void, icon: any, label: string }) => (
        <button 
            onClick={onClick}
            title={label}
            className="
                relative group w-12 h-12 rounded-full
                bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]
                border border-[#222]
                shadow-[0_4px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15)]
                active:shadow-[inset_0_3px_8px_rgba(0,0,0,0.8)]
                active:scale-95 active:translate-y-px
                flex items-center justify-center
                transition-all duration-100 ease-out
            "
        >
            <Icon size={20} className="text-neutral-400 drop-shadow-sm group-active:text-indigo-400 transition-colors" />
        </button>
    );

    const NOTES = [
        { l: 'C', f: 65.41 }, { l: 'C#', f: 69.30 }, { l: 'D', f: 73.42 }, { l: 'D#', f: 77.78 },
        { l: 'E', f: 82.41 }, { l: 'F', f: 87.31 }, { l: 'F#', f: 92.50 }, { l: 'G', f: 98.00 },
        { l: 'G#', f: 103.83 }, { l: 'A', f: 110.00 }, { l: 'A#', f: 116.54 }, { l: 'B', f: 123.47 }
    ];

    return (
        <>
            <style>{`
                input[type=range] { -webkit-appearance: none; background: transparent; }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%;
                    background: #d4d4d4;
                    border: 2px solid #171717;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.5);
                    margin-top: -6px; cursor: pointer;
                }
                input[type=range]::-webkit-slider-runnable-track {
                    width: 100%; height: 4px; cursor: pointer; background: #404040;
                    border-radius: 2px;
                }
                input[type=range]:focus { outline: none; }
                
                /* Custom Scrollbar */
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: #1a1a1a; }
                ::-webkit-scrollbar-thumb { background: #404040; border-radius: 3px; }
            `}</style>

            {/* HEADER - Only show if NOT replaying */}
            {!isReplaying && (
                <div 
                    className="absolute top-0 left-0 right-0 z-30 p-4 flex justify-between items-start animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none"
                    style={{
                        paddingTop: 'max(1rem, env(safe-area-inset-top))',
                        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
                        paddingRight: 'max(1rem, env(safe-area-inset-right))'
                    }}
                >
                    <div className="pointer-events-auto pt-1 pl-1">
                       <h1 className="text-2xl font-black italic tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" 
                           style={{ textShadow: '0px 2px 0px #000, 0px 4px 10px rgba(0,0,0,0.5)' }}>
                           DRIFT.JS
                       </h1>
                    </div>
                    
                    <div className="flex gap-3 pointer-events-auto">
                        <HeaderButton onClick={() => setIsReplaying(true)} icon={Rewind} label="Instant Replay" />
                        <HeaderButton onClick={onClearTracks} icon={RotateCcw} label="Clear Tire Marks" />
                        <HeaderButton onClick={() => setIsOpen(true)} icon={Settings} label="Settings" />
                    </div>
                </div>
            )}

            {/* REPLAY CONTROL BAR */}
            {isReplaying && (
                <div 
                    className="absolute bottom-0 left-0 right-0 z-50 p-6 pb-8 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col gap-4 animate-in slide-in-from-bottom-10 duration-300"
                    style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
                >
                    {/* Progress Bar */}
                    <div className="w-full relative h-6 flex items-center group">
                         <div className="absolute inset-x-0 h-1 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 transition-all duration-75" style={{ width: `${replayProgress * 100}%` }}></div>
                         </div>
                         <input 
                            type="range" 
                            min={0} max={1} step={0.001} 
                            value={replayProgress} 
                            onChange={(e) => handleReplayAction('seek', parseFloat(e.target.value))}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                         />
                    </div>

                    <div className="flex items-center justify-between max-w-lg mx-auto w-full">
                        {/* Play/Pause */}
                        <div className="flex gap-4">
                            <button 
                                onClick={() => handleReplayAction('togglePause')}
                                className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                            >
                                {replayIsPaused ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}
                            </button>

                            {/* Speed Control */}
                            <div className="flex bg-white/10 rounded-full p-1 border border-white/10">
                                {[0.5, 1.0, 2.0].map(s => (
                                    <button 
                                        key={s}
                                        onClick={() => handleReplayAction('speed', s)}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${replaySpeed === s ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {s}x
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsReplaying(false)}
                            className="px-6 py-2 rounded-full border border-white/20 bg-black/40 text-white font-bold text-sm hover:bg-white/10 transition-colors uppercase tracking-wider flex items-center gap-2"
                        >
                            <X size={16} /> Exit Replay
                        </button>
                    </div>
                </div>
            )}

            {/* SETTINGS MODAL */}
            {isOpen && (
                <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-end transition-opacity">
                    <div 
                        className="w-full max-w-md bg-[#121212] h-full shadow-2xl flex flex-col border-l border-white/5 animate-in slide-in-from-right duration-200"
                        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
                    >
                        {/* Modal Header - Fixed */}
                        <div className="bg-[#121212]/95 backdrop-blur z-10 p-4 border-b border-white/10 flex justify-between items-center shadow-md">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                                <Settings size={20} className="text-indigo-500"/> Settings
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Tabs - Fixed */}
                        <div className="p-4 pb-0 bg-[#121212]">
                            <div className="flex p-1 gap-1 bg-[#0a0a0a] rounded-lg border border-white/5 overflow-x-auto">
                                {['garage', 'tracks', 'controls', 'tuning', 'audio', 'synth'].map((tab) => (
                                    <button 
                                        key={tab}
                                        onClick={() => setActiveTab(tab as any)}
                                        className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded transition-all whitespace-nowrap ${activeTab === tab 
                                            ? 'bg-neutral-800 text-white shadow-sm' 
                                            : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">

                            {/* --- GARAGE TAB --- */}
                            {activeTab === 'garage' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">My Vehicles ({carSlots.filter(Boolean).length}/20)</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {carSlots.map((car, index) => (
                                            <div key={index} className="relative group">
                                                {car ? (
                                                    <button
                                                        onClick={() => {
                                                            onAssetChange('carUrl', car.url);
                                                            if (car.hue !== undefined) onParamChange('carHue', car.hue);
                                                        }}
                                                        className="relative w-full aspect-square bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden hover:border-white/20 active:scale-95 transition-all flex items-center justify-center p-2"
                                                    >
                                                        <img src={car.url} alt={car.name} className="w-full h-full object-contain" style={{ filter: `hue-rotate(${car.hue}deg)` }}/>
                                                        {/* If it's a custom car (index >= 7), show delete option */}
                                                        {index >= 7 && (
                                                            <div 
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteSlot('car', index); }}
                                                                className="absolute top-1 right-1 p-1 bg-red-500/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <X size={10} className="text-white" />
                                                            </div>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <label className="w-full aspect-square bg-[#111] rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-indigo-500/50 transition-all">
                                                        <Upload size={16} className="text-gray-600 mb-1" />
                                                        <span className="text-[9px] text-gray-600 font-bold">ADD</span>
                                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCarUpload(e, index)} />
                                                    </label>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                             {/* --- TRACKS TAB --- */}
                             {activeTab === 'tracks' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex justify-between items-center px-1">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Track List ({trackSlots.filter(Boolean).length}/20)</h3>
                                        <button onClick={onOpenMapMaker} className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded font-bold transition-colors">
                                            OPEN EDITOR
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        {trackSlots.map((track, index) => (
                                            <div key={index} className="relative group">
                                                {track ? (
                                                    <button
                                                        onClick={() => handleTrackSelect(track)}
                                                        className="relative w-full aspect-video bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden hover:border-white/20 active:scale-95 transition-all group"
                                                    >
                                                        <img src={track.url} alt={track.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                                        <div className="absolute inset-0 flex items-end p-2 bg-gradient-to-t from-black/90 to-transparent">
                                                            <span className="text-[10px] font-bold text-white uppercase truncate w-full text-left">{track.name}</span>
                                                        </div>
                                                        {/* Custom track delete */}
                                                        {index >= 11 && (
                                                             <div 
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteSlot('track', index); }}
                                                                className="absolute top-1 right-1 p-1 bg-red-500/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <Trash2 size={12} className="text-white" />
                                                            </div>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <label className="w-full aspect-video bg-[#111] rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-indigo-500/50 transition-all">
                                                        <Upload size={16} className="text-gray-600 mb-1" />
                                                        <span className="text-[9px] text-gray-600 font-bold">UPLOAD TRACK</span>
                                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleTrackUpload(e, index)} />
                                                    </label>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* --- CONTROLS TAB --- */}
                            {activeTab === 'controls' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-400 px-1">
                                            <Gamepad2 size={16} className="text-indigo-400" /> Touch Controls
                                        </label>
                                        <ControlGroup label="Button Size" value={params.uiScale} min={0.5} max={1.5} step={0.1} onChange={(v) => onParamChange('uiScale', v)} />
                                        <ControlGroup label="Safe Area (Margin)" value={params.uiSafeArea} min={0} max={100} step={2} onChange={(v) => onParamChange('uiSafeArea', v)} />
                                        <ControlGroup label="Button Opacity" value={params.uiOpacity} min={0.1} max={1.0} step={0.1} onChange={(v) => onParamChange('uiOpacity', v)} />
                                    </div>
                                    
                                    <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-xl">
                                        <p className="text-xs text-indigo-300 flex items-start gap-2">
                                            <Move size={14} className="mt-0.5 shrink-0" />
                                            <span>
                                                Changes are saved automatically. Close settings to lock controls in place. 
                                                <br/><br/>
                                                Use <strong>Safe Area</strong> to fix cutoff buttons on devices with rounded corners or notches.
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            )}
                            
                            {/* --- SYNTH TAB --- */}
                            {activeTab === 'synth' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    
                                    {/* Enable/Disable Synth */}
                                    <div className="flex items-center justify-between bg-indigo-900/20 p-4 rounded-xl border border-indigo-500/30">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${params.useCustomSynth ? 'bg-indigo-500 text-white' : 'bg-neutral-800 text-gray-500'}`}>
                                                <Activity size={20} />
                                            </div>
                                            <div className="leading-tight">
                                                <h3 className="font-bold text-indigo-100">Custom Synthesizer</h3>
                                                <p className="text-xs text-indigo-300/70">Procedural Engine Audio</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => onParamChange('useCustomSynth', !params.useCustomSynth)}
                                            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                                params.useCustomSynth 
                                                ? 'bg-indigo-500 border-indigo-400 text-white shadow-[0_0_10px_rgba(99,102,241,0.4)]' 
                                                : 'bg-transparent border-neutral-600 text-neutral-500'
                                            }`}
                                        >
                                            {params.useCustomSynth ? 'ENABLED' : 'DISABLED'}
                                        </button>
                                    </div>

                                    {/* Keyboard */}
                                    <div className={`space-y-2 transition-opacity duration-200 ${!params.useCustomSynth ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <label className="text-xs font-bold text-gray-500 uppercase px-1">Base Tone (Key)</label>
                                        <div className="flex gap-0.5 bg-black p-1 rounded border border-white/10">
                                            {NOTES.map((n) => (
                                                <NoteButton 
                                                    key={n.l} 
                                                    label={n.l} 
                                                    freq={n.f} 
                                                    isActive={Math.abs(params.synthConfig.basePitch - n.f) < 1}
                                                    onClick={(freq) => updateSynth('basePitch', freq)} 
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Oscillators */}
                                    <div className={`space-y-4 p-4 bg-[#1a1a1a] rounded-xl border border-white/5 ${!params.useCustomSynth ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase border-b border-white/5 pb-2">
                                            <Zap size={14} className="text-yellow-500"/> Oscillators
                                        </h3>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] text-gray-500 uppercase">Osc 1 Wave</label>
                                                <select 
                                                    value={params.synthConfig.osc1Wave}
                                                    onChange={(e) => updateSynth('osc1Wave', e.target.value)}
                                                    className="w-full bg-black text-xs text-white p-2 rounded border border-white/10 outline-none focus:border-indigo-500"
                                                >
                                                    <option value="sawtooth">Sawtooth</option>
                                                    <option value="square">Square</option>
                                                    <option value="sine">Sine</option>
                                                    <option value="triangle">Triangle</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] text-gray-500 uppercase">Osc 2 Wave</label>
                                                <select 
                                                    value={params.synthConfig.osc2Wave}
                                                    onChange={(e) => updateSynth('osc2Wave', e.target.value)}
                                                    className="w-full bg-black text-xs text-white p-2 rounded border border-white/10 outline-none focus:border-indigo-500"
                                                >
                                                    <option value="sawtooth">Sawtooth</option>
                                                    <option value="square">Square</option>
                                                    <option value="sine">Sine</option>
                                                    <option value="triangle">Triangle</option>
                                                </select>
                                            </div>
                                        </div>

                                        <SynthSlider label="Osc Mix (Blend)" value={params.synthConfig.oscMix} min={0} max={1} step={0.01} onChange={(v) => updateSynth('oscMix', v)} />
                                        <SynthSlider label="Osc 2 Detune" value={params.synthConfig.osc2Detune} min={-50} max={50} step={1} onChange={(v) => updateSynth('osc2Detune', v)} />
                                    </div>

                                    {/* FX & LFO */}
                                    <div className={`space-y-4 p-4 bg-[#1a1a1a] rounded-xl border border-white/5 ${!params.useCustomSynth ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase border-b border-white/5 pb-2">
                                            <Sliders size={14} className="text-cyan-500"/> Modulation & FX
                                        </h3>
                                        
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-gray-500 uppercase">LFO Shape</label>
                                            <select 
                                                value={params.synthConfig.lfoShape}
                                                onChange={(e) => updateSynth('lfoShape', e.target.value)}
                                                className="w-full bg-black text-xs text-white p-2 rounded border border-white/10 outline-none focus:border-indigo-500"
                                            >
                                                <option value="sawtooth">The Line (Sawtooth)</option>
                                                <option value="square">Square (Hard Chop)</option>
                                                <option value="sine">Sine (Smooth)</option>
                                                <option value="triangle">Triangle</option>
                                            </select>
                                        </div>

                                        <SynthSlider label="LFO Rate (Idle Chop)" value={params.synthConfig.lfoRate} min={1} max={15} step={0.1} onChange={(v) => updateSynth('lfoRate', v)} />
                                        
                                        <div className="h-px bg-white/5 my-2"></div>
                                        <SynthSlider label="Synth Master Volume" value={params.synthConfig.synthMasterVolume || 1.0} min={0} max={2} step={0.1} onChange={(v) => updateSynth('synthMasterVolume', v)} />
                                        <SynthSlider label="Distortion" value={params.synthConfig.distortion} min={0} max={100} step={1} onChange={(v) => updateSynth('distortion', v)} />
                                        <SynthSlider label="Filter Cutoff" value={params.synthConfig.filterCutoff} min={100} max={5000} step={50} onChange={(v) => updateSynth('filterCutoff', v)} />
                                    </div>

                                     {/* Tire Synth */}
                                     <div className="space-y-4 p-4 bg-[#1a1a1a] rounded-xl border border-white/5">
                                        <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase border-b border-white/5 pb-2">
                                            <Activity size={14} className="text-orange-500"/> Tire Synth
                                        </h3>
                                        <SynthSlider label="Squeal Frequency" value={params.synthConfig.tireBasePitch} min={400} max={1500} step={10} onChange={(v) => updateSynth('tireBasePitch', v)} />
                                        <SynthSlider label="Squeal Sharpness (Q)" value={params.synthConfig.tireFilterQ} min={1} max={30} step={1} onChange={(v) => updateSynth('tireFilterQ', v)} />
                                     </div>
                                </div>
                            )}

                            {/* --- AUDIO TAB --- */}
                            {activeTab === 'audio' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center justify-between bg-[#222] p-4 rounded-xl border border-white/5">
                                        <span className="font-bold text-gray-300 flex items-center gap-2">
                                            {params.isMuted ? <VolumeX className="text-red-500" /> : <Volume2 className="text-green-500" />}
                                            Master Audio
                                        </span>
                                        <button 
                                            onClick={() => onParamChange('isMuted', !params.isMuted)}
                                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${params.isMuted ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}
                                        >
                                            {params.isMuted ? 'MUTED' : 'ACTIVE'}
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">Volume Mixer</h3>
                                        <ControlGroup label="Engine Volume" value={params.engineVolume} min={0} max={1} step={0.05} onChange={(v) => onParamChange('engineVolume', v)} />
                                        <ControlGroup label="Tire Screech" value={params.tireVolume} min={0} max={1} step={0.05} onChange={(v) => onParamChange('tireVolume', v)} />
                                        <ControlGroup label="Turbo Blowoff" value={params.turboVolume} min={0} max={1} step={0.05} onChange={(v) => onParamChange('turboVolume', v)} />
                                    </div>
                                    <div className={`space-y-2 bg-[#222] p-3 rounded-xl border border-white/5 shadow-inner transition-opacity`}>
                                        <label className="flex items-center justify-between text-sm font-semibold text-gray-300">
                                            <span className="flex items-center gap-2"><Music size={16} className="text-indigo-400" /> Engine Loop (Sample Mode)</span>
                                            <span className="text-[10px] text-gray-500 bg-black/40 px-2 py-0.5 rounded">MP3 / WAV</span>
                                        </label>
                                        <label className="flex items-center justify-center w-full h-10 border border-dashed border-white/20 rounded-lg cursor-pointer hover:bg-white/5 hover:border-indigo-500/50 transition-all group">
                                            <div className="flex items-center gap-2 text-xs text-gray-400 group-hover:text-indigo-400"><Upload size={14} /> Upload Engine Audio</div>
                                            <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileSelect(e, 'engineAudioUrl')} />
                                        </label>
                                        
                                        <div className="h-2"></div>

                                        <label className="flex items-center justify-between text-sm font-semibold text-gray-300">
                                            <span className="flex items-center gap-2"><Wind size={16} className="text-cyan-400" /> Turbo Blowoff (Release)</span>
                                            <span className="text-[10px] text-gray-500 bg-black/40 px-2 py-0.5 rounded">MP3 / WAV</span>
                                        </label>
                                        <label className="flex items-center justify-center w-full h-10 border border-dashed border-white/20 rounded-lg cursor-pointer hover:bg-white/5 hover:border-cyan-500/50 transition-all group">
                                            <div className="flex items-center gap-2 text-xs text-gray-400 group-hover:text-cyan-400"><Upload size={14} /> Upload Turbo Audio</div>
                                            <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileSelect(e, 'turboAudioUrl')} />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* --- TUNING TAB --- */}
                            {activeTab === 'tuning' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    {/* Engine Type */}
                                    <div className="relative">
                                         <select 
                                            value={params.engineType} 
                                            onChange={(e) => onParamChange('engineType', e.target.value)}
                                            className="w-full h-20 bg-[#1a1a1a] border border-white/20 rounded-lg text-xs font-bold text-gray-400 p-2 appearance-none outline-none focus:border-indigo-500 text-center"
                                         >
                                            {Object.entries(ENGINES).map(([key, data]) => (
                                                <option key={key} value={key}>{data.label}</option>
                                            ))}
                                         </select>
                                         <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-1">
                                             <Zap size={20} className="text-yellow-500 opacity-80" />
                                             <span className="text-[10px] text-gray-500">Engine Type</span>
                                         </div>
                                    </div>

                                    <hr className="border-white/5" />

                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-400 px-1"><Car size={16} className="text-indigo-400" /> Performance</label>
                                        <ControlGroup label="Max Speed" value={params.maxSpeed} min={5} max={25} step={0.5} onChange={(v) => onParamChange('maxSpeed', v)} />
                                        <ControlGroup label="Acceleration" value={params.accelerationFactor} min={0.05} max={1} step={0.01} onChange={(v) => onParamChange('accelerationFactor', v)} />
                                        <ControlGroup label="Reverse Speed (Negative)" value={params.maxReverseSpeed} min={-10} max={-2} step={0.5} onChange={(v) => onParamChange('maxReverseSpeed', v)} />
                                        <ControlGroup label="Braking Power" value={params.decelerationFactor} min={0.01} max={0.5} step={0.01} onChange={(v) => onParamChange('decelerationFactor', v)} />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-400 px-1"><Activity size={16} className="text-cyan-400" /> Handling</label>
                                        <ControlGroup label="Drift Factor (Loose vs Tight)" value={params.driftFactor} min={0.1} max={3.0} step={0.05} onChange={(v) => onParamChange('driftFactor', v)} />
                                        <ControlGroup label="Turn Speed" value={params.turnFactor} min={0.05} max={0.5} step={0.01} onChange={(v) => onParamChange('turnFactor', v)} />
                                        <ControlGroup label="Traction Loss (Oversteer)" value={params.oversteer} min={0.5} max={2.0} step={0.05} onChange={(v) => onParamChange('oversteer', v)} />
                                        <ControlGroup label="E-Brake Decay (Ice <-> Stop)" value={params.eBrakeDecay} min={0.9} max={0.999} step={0.001} onChange={(v) => onParamChange('eBrakeDecay', v)} />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-400 px-1"><Zap size={16} className="text-yellow-400" /> Visuals</label>
                                        <ControlGroup label="Car Size" value={params.carScale} min={0.5} max={2.0} step={0.1} onChange={(v) => onParamChange('carScale', v)} />
                                        <ControlGroup label="Camera Zoom" value={params.zoom} min={0.1} max={2.5} step={0.05} onChange={(v) => onParamChange('zoom', v)} />
                                        <ControlGroup label="Smoke Density" value={params.smokeAmount} min={0} max={5} step={0.1} onChange={(v) => onParamChange('smokeAmount', v)} />
                                        <ControlGroup label="Smoke Decay (Fade Speed)" value={params.smokeDecay} min={0.005} max={0.1} step={0.005} onChange={(v) => onParamChange('smokeDecay', v)} />
                                        <ControlGroup label="Tire Mark Opacity" value={params.tireMarkOpacity} min={0} max={1} step={0.1} onChange={(v) => onParamChange('tireMarkOpacity', v)} />
                                        <ControlGroup label="Tire Mark Decay" value={params.tireMarkDecay} min={0.001} max={0.1} step={0.001} onChange={(v) => onParamChange('tireMarkDecay', v)} />
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
