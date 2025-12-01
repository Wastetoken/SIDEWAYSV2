
import React, { useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { InputState } from '../types';

interface MobileControlsProps {
    onInput: (key: keyof InputState, active: boolean) => void;
    scale?: number;
    safeArea?: number;
    opacity?: number;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ 
    onInput, 
    scale = 1.0, 
    safeArea = 52, 
    opacity = 1.0 
}) => {
    // Track active inputs to handle multi-touch and sliding
    const activeCmdsRef = useRef<Set<string>>(new Set());

    const handleTouch = (e: React.TouchEvent) => {
        // Identify buttons under all active touches
        const currentCmds = new Set<string>();
        
        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            // Locate the element under the finger
            const el = document.elementFromPoint(t.clientX, t.clientY);
            // Traverse up to find the button wrapper with the command data
            const btn = el?.closest('[data-cmd]');
            if (btn) {
                const cmd = btn.getAttribute('data-cmd');
                if (cmd) currentCmds.add(cmd);
            }
        }

        // 1. Deactivate commands that are no longer touched
        activeCmdsRef.current.forEach(cmd => {
            if (!currentCmds.has(cmd)) {
                onInput(cmd as keyof InputState, false);
            }
        });

        // 2. Activate new commands (Slide into)
        currentCmds.forEach(cmd => {
            if (!activeCmdsRef.current.has(cmd)) {
                onInput(cmd as keyof InputState, true);
            }
        });

        activeCmdsRef.current = currentCmds;
    };

    // Keep mouse handlers for desktop testing
    const bindMouse = (cmd: keyof InputState) => ({
        onMouseDown: () => onInput(cmd, true),
        onMouseUp: () => onInput(cmd, false),
        onMouseLeave: () => onInput(cmd, false),
    });

    const ControlButton = ({ icon: Icon, cmd, label, size = 'default' }: { icon: any, cmd: keyof InputState, label: string, size?: 'default' | 'small' }) => {
        // Dynamic sizing logic using calc
        // Base sizes: Default ~100px (18vmin previously), Small ~80px
        const baseSizeVal = size === 'small' ? 14 : 18;
        const iconSizeVal = size === 'small' ? 24 : 32;
        
        // We use inline styles for dynamic properties to avoid massive tailwind classes
        const buttonStyle = {
            width: `calc(${baseSizeVal}vmin * ${scale})`,
            height: `calc(${baseSizeVal}vmin * ${scale})`,
            minWidth: `${(size === 'small' ? 60 : 80) * scale}px`, // Minimum pixel size fallback
            minHeight: `${(size === 'small' ? 60 : 80) * scale}px`
        };

        return (
            <div 
                data-cmd={cmd}
                style={buttonStyle}
                className="relative group flex items-center justify-center touch-none select-none"
            >
                 {/* Housing / Base Plate */}
                <div className="absolute inset-1 rounded-full bg-gradient-to-br from-neutral-950 to-neutral-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.1)] pointer-events-none" />
                
                {/* The Physical Button */}
                <button
                    {...bindMouse(cmd)}
                    aria-label={label}
                    className={`
                        relative w-full h-full
                        rounded-full
                        transition-all duration-100 ease-out
                        
                        /* Initial State */
                        active:scale-[0.95] active:translate-y-[2px]
                        
                        /* Material Finish */
                        bg-gradient-to-b from-[#3a3a3a] via-[#262626] to-[#161616]
                        
                        /* Borders */
                        border-[1px] border-[#111]
                        
                        /* Lighting */
                        shadow-[
                            inset_0_1px_0_rgba(255,255,255,0.2),
                            inset_0_8px_10px_rgba(255,255,255,0.03),
                            inset_0_-5px_10px_rgba(0,0,0,0.6),
                            0_12px_20px_rgba(0,0,0,0.6),
                            0_4px_6px_rgba(0,0,0,0.4)
                        ]
                        
                        /* Active State */
                        active:shadow-[
                            inset_0_5px_15px_rgba(0,0,0,0.8),
                            0_1px_2px_rgba(0,0,0,0.5)
                        ]

                        flex items-center justify-center
                        z-10 outline-none touch-none pointer-events-auto
                    `}
                >
                    <div className="absolute inset-2 rounded-full border border-white/5 opacity-40 pointer-events-none" />
                    {typeof Icon === 'string' ? (
                        <span 
                            className="text-neutral-500 font-black group-active:text-red-500 drop-shadow-[0_1px_1px_rgba(255,255,255,0.15)] group-active:drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]"
                            style={{ fontSize: `calc(${iconSizeVal}px * ${scale})` }}
                        >
                            {Icon}
                        </span>
                    ) : (
                        <Icon 
                            strokeWidth={2.5}
                            style={{ 
                                width: `calc(${iconSizeVal}px * ${scale})`, 
                                height: `calc(${iconSizeVal}px * ${scale})` 
                            }}
                            className="
                                text-neutral-500 
                                drop-shadow-[0_1px_1px_rgba(255,255,255,0.15)] 
                                transition-all duration-100
                                group-active:text-cyan-400 
                                group-active:drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]
                            " 
                        />
                    )}
                </button>
            </div>
        );
    };

    return (
        <div style={{ opacity }} className="transition-opacity duration-300">
            {/* Left Hand: Steering */}
            <div 
                className="absolute flex gap-2 pointer-events-auto touch-none"
                style={{
                    bottom: `calc(${safeArea}px + env(safe-area-inset-bottom))`,
                    left: `calc(${safeArea}px + env(safe-area-inset-left))`
                }}
                onTouchStart={handleTouch}
                onTouchMove={handleTouch}
                onTouchEnd={handleTouch}
            >
                <ControlButton icon={ArrowLeft} cmd="left" label="Turn Left" />
                <ControlButton icon={ArrowRight} cmd="right" label="Turn Right" />
            </div>

            {/* Right Hand: Gas/Brake + E-Brake */}
            <div 
                className="absolute pointer-events-auto flex gap-1 items-end touch-none"
                style={{
                    bottom: `calc(${safeArea}px + env(safe-area-inset-bottom))`,
                    right: `calc(${safeArea}px + env(safe-area-inset-right))`
                }}
                onTouchStart={handleTouch}
                onTouchMove={handleTouch}
                onTouchEnd={handleTouch}
            >
                {/* Brake/Reverse on the left of the cluster */}
                <ControlButton icon={ArrowDown} cmd="down" label="Brake / Reverse" />

                {/* Gas and E-Brake Stacked Vertically for Slide-Toggle */}
                <div className="flex flex-col gap-1">
                    <div className="flex justify-center">
                         <ControlButton icon="E" cmd="eBrake" label="E-Brake" size="small" />
                    </div>
                    <ControlButton icon={ArrowUp} cmd="up" label="Gas" />
                </div>
            </div>
        </div>
    );
};
