
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Save, Eraser, RotateCw, Grid as GridIcon, Move, ZoomIn, ZoomOut, MousePointer2, Brush, Hand, Trash2, Undo2, Redo2 } from 'lucide-react';
import { TRACK_PARTS, GRID_SIZE, TILE_SIZE } from '../constants';
import { MapTile, MapData } from '../types';

interface MapEditorProps {
    initialData: MapData | null;
    onSave: (data: MapData) => void;
    onClose: () => void;
}

type ToolType = 'select' | 'brush' | 'eraser' | 'hand';

export const MapEditor: React.FC<MapEditorProps> = ({ initialData, onSave, onClose }) => {
    // History State
    const [history, setHistory] = useState<MapTile[][]>([initialData?.tiles || []]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const tiles = history[historyIndex];

    const [selectedTool, setSelectedTool] = useState<ToolType>('brush');
    const [selectedPartId, setSelectedPartId] = useState<string>(TRACK_PARTS[0].id);
    
    // Selection State
    const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);

    // Viewport State
    const [scale, setScale] = useState(0.5); 
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    
    // Ghost Tile State
    const [ghostTile, setGhostTile] = useState<{x: number, y: number, type: string} | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);

    const totalSize = GRID_SIZE * TILE_SIZE; 

    // Undo / Redo Logic
    const pushHistory = (newTiles: MapTile[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newTiles);
        if (newHistory.length > 20) newHistory.shift(); // Limit to 20 steps
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setSelectedTileIndex(null);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setSelectedTileIndex(null);
        }
    };

    // Correctly map screen coordinates to world coordinates (taking zoom/pan into account)
    const screenToWorld = useCallback((screenX: number, screenY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        
        // The container is centered. We need to offset the mouse position relative to the center.
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // Calculate offset from center of viewport
        const offsetX = screenX - rect.left - centerX;
        const offsetY = screenY - rect.top - centerY;
        
        // Apply Pan and Scale
        // World 0,0 is at the center of the grid.
        // Formula: (ScreenOffset - Pan) / Scale
        const worldX = (offsetX - pan.x) / scale;
        const worldY = (offsetY - pan.y) / scale;
        
        return { x: worldX, y: worldY };
    }, [scale, pan]);

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            // Zoom
            const delta = -e.deltaY * 0.001;
            const newScale = Math.min(Math.max(scale + delta, 0.1), 2.0);
            setScale(newScale);
        } else {
            // Pan
            setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
        }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        // Hand tool or Middle Click -> Drag
        if (selectedTool === 'hand' || e.button === 1) {
            e.preventDefault();
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            return;
        }
        
        // Left click interaction
        if (e.button === 0) {
             handleInteraction(e.clientX, e.clientY, false);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
            return;
        } 
        
        // Update Ghost Tile
        const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY);
        // Offset to map to grid indices (0,0 is top-left of the massive grid)
        const gridPixelX = worldX + totalSize / 2;
        const gridPixelY = worldY + totalSize / 2;

        // Check bounds
        if (gridPixelX >= 0 && gridPixelX < totalSize && gridPixelY >= 0 && gridPixelY < totalSize) {
             const tileX = Math.floor(gridPixelX / TILE_SIZE);
             const tileY = Math.floor(gridPixelY / TILE_SIZE);
             setGhostTile({ x: tileX, y: tileY, type: selectedPartId });

             // Drag Painting
             if (e.buttons === 1) {
                 if (selectedTool === 'brush' || selectedTool === 'eraser') {
                     handleInteraction(e.clientX, e.clientY, true);
                 }
             }
        } else {
            setGhostTile(null);
        }
    };

    const handlePointerUp = () => {
        setIsDragging(false);
    };

    const handleInteraction = (clientX: number, clientY: number, isDrag: boolean) => {
        const { x: worldX, y: worldY } = screenToWorld(clientX, clientY);
        const gridPixelX = worldX + totalSize / 2;
        const gridPixelY = worldY + totalSize / 2;

        if (gridPixelX < 0 || gridPixelX >= totalSize || gridPixelY < 0 || gridPixelY >= totalSize) return;

        const tileX = Math.floor(gridPixelX / TILE_SIZE);
        const tileY = Math.floor(gridPixelY / TILE_SIZE);

        const existingIndex = tiles.findIndex(t => t.x === tileX && t.y === tileY);

        // --- SELECT TOOL ---
        if (selectedTool === 'select') {
            if (!isDrag) {
                if (existingIndex !== -1) {
                    setSelectedTileIndex(existingIndex);
                } else {
                    setSelectedTileIndex(null);
                }
            }
            return;
        }

        // --- ERASER ---
        if (selectedTool === 'eraser') {
            if (existingIndex !== -1) {
                const newTiles = [...tiles];
                newTiles.splice(existingIndex, 1);
                pushHistory(newTiles);
            }
            return;
        }

        // --- BRUSH ---
        if (selectedTool === 'brush') {
            // If dragging, don't re-place same tile
            if (isDrag && existingIndex !== -1 && tiles[existingIndex].type === selectedPartId) return;

            if (existingIndex !== -1) {
                // Replace if different
                if (tiles[existingIndex].type !== selectedPartId) {
                    const newTiles = [...tiles];
                    newTiles[existingIndex] = { ...tiles[existingIndex], type: selectedPartId, rotation: 0 };
                    pushHistory(newTiles);
                } else if (!isDrag) {
                    // Rotate if clicking existing with same tool
                    const newTiles = [...tiles];
                    newTiles[existingIndex] = { ...tiles[existingIndex], rotation: (tiles[existingIndex].rotation + 90) % 360 };
                    pushHistory(newTiles);
                }
            } else {
                // Place new
                const newTiles = [...tiles, { x: tileX, y: tileY, type: selectedPartId, rotation: 0 }];
                pushHistory(newTiles);
            }
        }
    };

    // --- SELECTION ACTIONS ---
    const handleSelectedRotate = () => {
        if (selectedTileIndex === null) return;
        const newTiles = [...tiles];
        const tile = newTiles[selectedTileIndex];
        newTiles[selectedTileIndex] = { ...tile, rotation: (tile.rotation + 90) % 360 };
        pushHistory(newTiles);
    };

    const handleSelectedDelete = () => {
        if (selectedTileIndex === null) return;
        const newTiles = [...tiles];
        newTiles.splice(selectedTileIndex, 1);
        pushHistory(newTiles);
        setSelectedTileIndex(null);
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleUndo();
            }
            if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleRedo();
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedTool === 'select' && selectedTileIndex !== null) {
                    handleSelectedDelete();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [historyIndex, selectedTool, selectedTileIndex]);

    return (
        <div className="absolute inset-0 z-50 bg-[#050505] flex flex-col animate-in fade-in duration-300 select-none overflow-hidden font-sans">
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-[#111] border-b border-white/5 shadow-md z-30">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-600 rounded-md">
                        <GridIcon size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Map Editor</h2>
                        <div className="flex gap-2 text-[10px] text-gray-500">
                            <span>{tiles.length} TILES</span>
                            <span>•</span>
                            <span>GRID: {GRID_SIZE}x{GRID_SIZE}</span>
                        </div>
                    </div>
                    
                    <div className="h-8 w-px bg-white/10 mx-2" />

                    <div className="flex gap-1">
                        <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 rounded hover:bg-white/10 disabled:opacity-30 text-gray-400">
                            <Undo2 size={18} />
                        </button>
                        <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-2 rounded hover:bg-white/10 disabled:opacity-30 text-gray-400">
                            <Redo2 size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-md text-xs font-bold text-gray-400 hover:bg-white/5 hover:text-white transition-colors">EXIT</button>
                    <button 
                        onClick={() => onSave({ width: GRID_SIZE, height: GRID_SIZE, tiles })}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold shadow-lg transition-all active:scale-95"
                    >
                        <Save size={16} /> SAVE MAP
                    </button>
                </div>
            </div>

            <div className="flex-1 flex relative overflow-hidden">
                {/* TOOLBAR SIDEBAR */}
                <div className="w-16 bg-[#111] border-r border-white/5 flex flex-col items-center py-4 gap-4 z-20">
                    {[
                        { id: 'select', icon: MousePointer2, label: 'Select' },
                        { id: 'brush', icon: Brush, label: 'Brush' },
                        { id: 'eraser', icon: Eraser, label: 'Eraser' },
                        { id: 'hand', icon: Hand, label: 'Pan' },
                    ].map((tool) => (
                        <button
                            key={tool.id}
                            onClick={() => setSelectedTool(tool.id as ToolType)}
                            title={tool.label}
                            className={`
                                w-10 h-10 rounded-xl flex items-center justify-center transition-all
                                ${selectedTool === tool.id 
                                    ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.5)]' 
                                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}
                            `}
                        >
                            <tool.icon size={20} />
                        </button>
                    ))}
                </div>

                {/* MAIN VIEWPORT */}
                <div 
                    ref={containerRef}
                    className="flex-1 relative cursor-crosshair overflow-hidden bg-[#080808]"
                    onWheel={handleWheel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onContextMenu={(e) => e.preventDefault()}
                >
                     {/* World Transform Container */}
                     <div 
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                            transformOrigin: 'center center',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {/* The Grid Canvas */}
                        <div 
                            className="relative bg-[#111] shadow-2xl border border-white/10 transition-transform"
                            style={{
                                width: totalSize,
                                height: totalSize,
                                // Brighter grid lines
                                backgroundImage: `linear-gradient(#2a2a2a 1px, transparent 1px), linear-gradient(90deg, #2a2a2a 1px, transparent 1px)`,
                                backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`
                            }}
                        >
                            {/* Center Marker */}
                             <div 
                                className="absolute bg-red-500/50 rounded-full z-0 pointer-events-none"
                                style={{
                                    left: totalSize / 2 - 10,
                                    top: totalSize / 2 - 10,
                                    width: 20,
                                    height: 20
                                }}
                             />

                            {/* Tiles */}
                            {tiles.map((tile, i) => {
                                const part = TRACK_PARTS.find(p => p.id === tile.type);
                                const isSelected = i === selectedTileIndex && selectedTool === 'select';
                                if (!part) return null;
                                return (
                                    <div 
                                        key={i}
                                        className={`absolute transition-transform duration-75 pointer-events-none`} // CRITICAL: pointer-events-none allows clicks to pass to grid calculator
                                        style={{
                                            left: tile.x * TILE_SIZE,
                                            top: tile.y * TILE_SIZE,
                                            width: TILE_SIZE,
                                            height: TILE_SIZE,
                                            zIndex: isSelected ? 10 : 1
                                        }}
                                    >
                                        <img 
                                            src={part.src} 
                                            className="w-full h-full object-cover select-none"
                                            style={{ transform: `rotate(${tile.rotation}deg)` }}
                                            draggable={false}
                                        />
                                        {isSelected && (
                                            <div className="absolute inset-0 border-4 border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.5)] bg-indigo-500/10 animate-pulse" />
                                        )}
                                    </div>
                                );
                            })}
                            
                            {/* Ghost Cursor */}
                            {ghostTile && selectedTool === 'brush' && (
                                <div 
                                    className="absolute pointer-events-none opacity-50 z-20"
                                    style={{
                                        left: ghostTile.x * TILE_SIZE,
                                        top: ghostTile.y * TILE_SIZE,
                                        width: TILE_SIZE,
                                        height: TILE_SIZE
                                    }}
                                >
                                     <img 
                                        src={TRACK_PARTS.find(p => p.id === ghostTile.type)?.src} 
                                        className="w-full h-full object-cover"
                                     />
                                </div>
                            )}
                             {ghostTile && selectedTool === 'eraser' && (
                                <div 
                                    className="absolute pointer-events-none bg-red-500/30 z-20 border-2 border-red-500"
                                    style={{
                                        left: ghostTile.x * TILE_SIZE,
                                        top: ghostTile.y * TILE_SIZE,
                                        width: TILE_SIZE,
                                        height: TILE_SIZE
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Hover HUD controls */}
                    <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
                        <button onClick={() => setPan({x: 0, y: 0})} className="p-3 bg-black/80 rounded-full text-white border border-white/10 hover:bg-indigo-600" title="Center View"><Move size={20}/></button>
                        <button onClick={() => setScale(s => Math.min(s * 1.2, 2.0))} className="p-3 bg-black/80 rounded-full text-white border border-white/10 hover:bg-indigo-600"><ZoomIn size={20}/></button>
                        <button onClick={() => setScale(s => Math.max(s / 1.2, 0.1))} className="p-3 bg-black/80 rounded-full text-white border border-white/10 hover:bg-indigo-600"><ZoomOut size={20}/></button>
                    </div>

                    {/* Selection Context Menu (Floating) */}
                    {selectedTool === 'select' && selectedTileIndex !== null && (
                         <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-[#111] border border-white/10 rounded-full p-2 flex gap-2 shadow-xl animate-in fade-in slide-in-from-top-2">
                             <button onClick={handleSelectedRotate} className="p-2 hover:bg-white/10 rounded-full text-indigo-400" title="Rotate">
                                 <RotateCw size={20} />
                             </button>
                             <div className="w-px bg-white/10" />
                             <button onClick={handleSelectedDelete} className="p-2 hover:bg-white/10 rounded-full text-red-400" title="Delete">
                                 <Trash2 size={20} />
                             </button>
                         </div>
                    )}
                </div>
            </div>

            {/* ASSET PICKER (Bottom) */}
            {selectedTool === 'brush' && (
                <div className="bg-[#111] border-t border-white/5 p-4 z-30">
                    <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
                        {TRACK_PARTS.map((part) => (
                            <button
                                key={part.id}
                                onClick={() => setSelectedPartId(part.id)}
                                className={`
                                    flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-xl border transition-all relative overflow-hidden group
                                    ${selectedPartId === part.id
                                        ? 'bg-indigo-600/10 border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.2)]' 
                                        : 'bg-[#1a1a1a] border-white/5 hover:bg-[#222]'
                                    }
                                `}
                            >
                                <div className="w-10 h-10 mb-2 relative">
                                    <img src={part.src} className="w-full h-full object-contain drop-shadow-lg" />
                                </div>
                                <span className={`text-[9px] font-bold uppercase text-center leading-tight px-1 ${selectedPartId === part.id ? 'text-indigo-400' : 'text-gray-500'}`}>
                                    {part.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
