
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UIOverlay } from './components/UIOverlay';
import { MobileControls } from './components/MobileControls';
import { MapEditor } from './components/MapEditor';
import { GameParams, GameAssets, DEFAULT_PARAMS, PORTRAIT_PARAMS, InputState, MapData } from './types';
import { ASSETS } from './constants';
import { SoundEngine } from './utils/SoundEngine';

// Shared input state
const inputState: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  brake: false,
  eBrake: false
};

export default function App() {
  const [params, setParams] = useState<GameParams>(DEFAULT_PARAMS);
  const [assets, setAssets] = useState<GameAssets>({
    carUrl: ASSETS.CAR_IMAGE,
    trackUrl: ASSETS.TRACK_BG,
    engineAudioUrl: ASSETS.ENGINE_AUDIO,
    turboAudioUrl: ASSETS.TURBO_AUDIO
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  // Map Maker State
  const [isMapEditorOpen, setIsMapEditorOpen] = useState(false);
  const [customMapData, setCustomMapData] = useState<MapData | null>(null);

  const soundEngineRef = useRef<SoundEngine>(new SoundEngine());

  // Detect orientation and set params dynamically
  useEffect(() => {
    const handleOrientationCheck = () => {
      if (window.innerHeight > window.innerWidth) {
        // Portrait
        setParams(prev => ({ ...prev, ...PORTRAIT_PARAMS }));
      } else {
        setParams(prev => ({ ...prev, ...DEFAULT_PARAMS }));
      }
    };
    
    handleOrientationCheck();
    
    window.addEventListener('resize', handleOrientationCheck);
    return () => window.removeEventListener('resize', handleOrientationCheck);
  }, []);

  const handleParamChange = useCallback((key: keyof GameParams, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAssetChange = useCallback((key: keyof GameAssets, value: File | string) => {
    // Initialize Audio Engine immediately on user interaction
    soundEngineRef.current.init();

    let url: string;
    if (typeof value === 'string') {
        url = value;
    } else {
        url = URL.createObjectURL(value);
    }

    setAssets(prev => ({ ...prev, [key]: url }));
    
    // If changing track, ensure we clear custom map data
    if (key === 'trackUrl') {
        setCustomMapData(null);
    }

    // UX Improvement: If uploading engine audio, automatically disable synth so they can hear it
    if (key === 'engineAudioUrl') {
        setParams(prev => ({ ...prev, useCustomSynth: false }));
    }
  }, []);

  const handleInput = useCallback((key: keyof InputState, active: boolean) => {
    // Turbo Logic: If we are releasing 'up', and we were previously pressing it
    if (key === 'up' && !active && inputState.up) {
       soundEngineRef.current.triggerTurbo(params);
    }

    inputState[key] = active;
    
    // Initialize Audio Context on first user interaction
    if (active) {
        soundEngineRef.current.init();
    }
  }, [params]);

  const handleReset = useCallback(() => {
    window.dispatchEvent(new CustomEvent('game-reset-tracks'));
  }, []);

  const handleMapSave = (data: MapData) => {
      setCustomMapData(data);
      setIsMapEditorOpen(false);
      setIsSettingsOpen(false); // Close settings to show game
      // Trigger a reset to clear old tire marks on new map
      setTimeout(() => window.dispatchEvent(new CustomEvent('game-reset-tracks')), 100);
  };

  return (
    <div className="relative w-full h-[100dvh] bg-neutral-900 overflow-hidden text-white touch-none">
      {/* Game Layer */}
      <GameCanvas 
        params={params} 
        assets={assets}
        inputState={inputState} 
        setDebugInfo={setDebugInfo}
        soundEngine={soundEngineRef.current}
        isReplaying={isReplaying}
        mapData={customMapData}
      />

      {/* UI Layer */}
      <UIOverlay 
        params={params}
        onParamChange={handleParamChange}
        onAssetChange={handleAssetChange}
        isOpen={isSettingsOpen}
        setIsOpen={setIsSettingsOpen}
        onClearTracks={handleReset}
        isReplaying={isReplaying}
        setIsReplaying={setIsReplaying}
        onOpenMapMaker={() => setIsMapEditorOpen(true)}
      />

      {/* Map Editor Layer */}
      {isMapEditorOpen && (
          <MapEditor 
              initialData={customMapData}
              onSave={handleMapSave}
              onClose={() => setIsMapEditorOpen(false)}
          />
      )}

      {/* Mobile Controls Layer - Full screen overlay for corner positioning. Hidden during Replay and Editor. */}
      {!isReplaying && !isMapEditorOpen && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <MobileControls 
            onInput={handleInput} 
            scale={params.uiScale}
            safeArea={params.uiSafeArea}
            opacity={params.uiOpacity}
          />
        </div>
      )}
    </div>
  );
}
