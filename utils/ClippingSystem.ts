
import { CarState } from '../types';

export interface ClippingZoneConfig {
  clippingColor: { r: number; g: number; b: number };
  colorTolerance: number;
  pointMultiplier: number;
  detectionRadius: number;
}

export class ClippingZoneDetector {
  private trackImage: HTMLImageElement | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private config: ClippingZoneConfig;
  private imageData: ImageData | null = null;

  constructor(config: Partial<ClippingZoneConfig> = {}) {
    this.config = {
      clippingColor: config.clippingColor || { r: 255, g: 255, b: 255 },
      colorTolerance: config.colorTolerance || 50,
      pointMultiplier: config.pointMultiplier || 2.5,
      detectionRadius: config.detectionRadius || 20,
    };
  }

  /**
   * Load track image and prepare for pixel sampling
   */
  async loadTrack(trackUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        this.trackImage = img;

        // Create offscreen canvas for pixel sampling
        this.offscreenCanvas = document.createElement("canvas");
        this.offscreenCanvas.width = img.width;
        this.offscreenCanvas.height = img.height;
        this.offscreenCtx = this.offscreenCanvas.getContext("2d", {
          willReadFrequently: true,
        });

        if (this.offscreenCtx) {
          this.offscreenCtx.drawImage(img, 0, 0);
          // Cache entire image data for faster access
          this.imageData = this.offscreenCtx.getImageData(
            0,
            0,
            img.width,
            img.height
          );
        }

        resolve();
      };

      img.onerror = () => {
          console.warn("DriftSystem: Failed to load track image for analysis.");
          resolve(); 
      };
      img.src = trackUrl;
    });
  }

  /**
   * Fast pixel sampling using cached ImageData
   */
  private getPixel(x: number, y: number): { r: number; g: number; b: number } | null {
    if (!this.imageData || !this.trackImage) return null;

    const px = Math.floor(x);
    const py = Math.floor(y);

    if (px < 0 || py < 0 || px >= this.trackImage.width || py >= this.trackImage.height) {
      return null;
    }

    const index = (py * this.trackImage.width + px) * 4;
    return {
      r: this.imageData.data[index],
      g: this.imageData.data[index + 1],
      b: this.imageData.data[index + 2],
    };
  }

  /**
   * Check if car is in clipping zone using CarState
   */
  checkClippingZone(carState: CarState, trackWidth: number, trackHeight: number): number {
    if (!this.trackImage || !this.imageData) {
      return 1.0;
    }

    const { xPos, yPos, angle, width, height } = carState;

    // Convert car world position to image pixel coordinates
    const imageX = (xPos / trackWidth) * this.trackImage.width;
    const imageY = (yPos / trackHeight) * this.trackImage.height;

    // Check multiple points around the car perimeter
    const checkPoints = this.getCarCheckPoints(
      imageX,
      imageY,
      width,
      height,
      angle * (Math.PI / 180), 
      trackWidth,
      trackHeight
    );

    let clippingHits = 0;
    let totalChecks = 0;

    for (const point of checkPoints) {
      const pixel = this.getPixel(point.x, point.y);
      if (pixel) {
        totalChecks++;
        if (this.isClippingZoneColor(pixel.r, pixel.g, pixel.b)) {
          clippingHits++;
        }
      }
    }

    // Return multiplier if at least 30% of check points hit clipping zone
    if (totalChecks > 0 && clippingHits / totalChecks >= 0.3) {
      return this.config.pointMultiplier;
    }

    return 1.0;
  }

  private getCarCheckPoints(
    centerX: number,
    centerY: number,
    carWidth: number,
    carHeight: number,
    angleRad: number,
    trackWidth: number,
    trackHeight: number
  ): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];

    const imgScaleX = (this.trackImage?.width || 1) / trackWidth;
    const imgScaleY = (this.trackImage?.height || 1) / trackHeight;
    
    const imgW = carWidth * imgScaleX;
    const imgH = carHeight * imgScaleY;

    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const offsets = [
      { x: -imgW * 0.5, y: imgH * 0.5 },
      { x: 0, y: imgH * 0.5 },
      { x: imgW * 0.5, y: imgH * 0.5 },
      { x: -imgW * 0.5, y: -imgH * 0.5 },
      { x: imgW * 0.5, y: -imgH * 0.5 },
      { x: imgW * 0.5, y: 0 },
      { x: -imgW * 0.5, y: 0 },
    ];

    for (const offset of offsets) {
      const rotatedX = offset.x * cos - offset.y * sin;
      const rotatedY = offset.x * sin + offset.y * cos;
      
      points.push({
        x: centerX + rotatedX,
        y: centerY + rotatedY,
      });
    }

    return points;
  }

  private isClippingZoneColor(r: number, g: number, b: number): boolean {
    const { clippingColor, colorTolerance } = this.config;

    return (
      Math.abs(r - clippingColor.r) <= colorTolerance &&
      Math.abs(g - clippingColor.g) <= colorTolerance &&
      Math.abs(b - clippingColor.b) <= colorTolerance
    );
  }
}

// ===========================================
// DRIFT SCORING SYSTEM
// ===========================================

export interface DriftState {
  isDrifting: boolean;
  currentScore: number;
  totalScore: number;
  multiplier: number;
  combo: number;
  duration: number;
  isInClippingZone: boolean;
}

export interface DriftScoringConfig {
  minDriftAngle: number;
  minSpeed: number;
  basePointsPerSecond: number;
  comboDecayTime: number;
  comboBonus: number;
}

export class DriftScoring {
  private state: DriftState = {
    isDrifting: false,
    currentScore: 0,
    totalScore: 0,
    multiplier: 1.0,
    combo: 0,
    duration: 0,
    isInClippingZone: false,
  };

  private config: DriftScoringConfig;
  private comboTimer = 0;
  private lastDriftDir = 0; // -1 (Left), 0, 1 (Right)

  constructor(config: Partial<DriftScoringConfig> = {}) {
    this.config = {
      minDriftAngle: config.minDriftAngle || 15,
      minSpeed: config.minSpeed || 3,
      basePointsPerSecond: config.basePointsPerSecond || 500,
      comboDecayTime: config.comboDecayTime || 2000,
      comboBonus: config.comboBonus || 0.2, // 20% bonus per chain link
    };
  }

  /**
   * Update drift state using your CarState
   */
  update(carState: CarState, clippingMultiplier: number, deltaTime: number): DriftState {
    const { speed, driftAngle } = carState;

    this.state.isInClippingZone = clippingMultiplier > 1.0;

    // Check speed requirement. If too slow, immediately bank/fail.
    if (Math.abs(speed) < this.config.minSpeed) {
      if (this.state.isDrifting || this.state.currentScore > 0) {
          this.endDrift(false); // Fail: stopped moving
      }
      return this.state;
    }

    const angleDeg = Math.abs(driftAngle * (180 / Math.PI));
    const currentDir = Math.sign(driftAngle);

    // Check if drifting
    if (angleDeg >= this.config.minDriftAngle) {
      if (!this.state.isDrifting) {
        this.startDrift();
        this.lastDriftDir = currentDir;
      }

      // --- CHAIN LOGIC ---
      // If we are actively drifting and switch direction compared to the last recorded direction
      if (this.lastDriftDir !== 0 && currentDir !== 0 && currentDir !== this.lastDriftDir) {
          this.state.combo++;
          this.lastDriftDir = currentDir; // Update direction
          
          // Small immediate point bonus for the transition
          this.state.currentScore += 500 * this.state.combo; 
      }

      // Apply clipping zone multiplier
      this.state.multiplier = clippingMultiplier;

      // Calculate points with combo bonus
      // Combo 1 (Start) = 1x
      // Combo 2 (Switch) = 1.2x
      const comboMultiplier = 1 + ((this.state.combo - 1) * this.config.comboBonus);
      const angleBonus = Math.max(1, angleDeg / 30);

      const pointsThisFrame =
        this.config.basePointsPerSecond *
        this.state.multiplier *
        comboMultiplier *
        angleBonus *
        deltaTime;

      this.state.currentScore += pointsThisFrame;
      this.state.duration += deltaTime;

      // Reset combo timer while maintaining drift
      this.comboTimer = this.config.comboDecayTime;
      
    } else {
      // Not drifting (Going straight/Transition)
      // Decrease combo timer
      if (this.state.isDrifting) {
          this.comboTimer -= deltaTime * 1000;
          if (this.comboTimer <= 0) {
            this.endDrift(true); // Success: Bank points
          }
      }
    }

    return this.state;
  }

  private startDrift(): void {
    this.state.isDrifting = true;
    this.state.currentScore = 0;
    this.state.duration = 0;
    this.state.combo = 1; // Start chain at 1
    this.comboTimer = this.config.comboDecayTime;
  }

  private endDrift(bank: boolean): void {
    if (bank) {
      this.state.totalScore += Math.floor(this.state.currentScore);
    } 
    // Always reset session stats
    this.state.combo = 0;
    this.state.currentScore = 0;
    this.state.multiplier = 1.0;
    this.state.isDrifting = false;
    this.lastDriftDir = 0;
  }

  getState(): DriftState {
    return { ...this.state };
  }

  resetTotal(): void {
    this.state.totalScore = 0;
    this.state.currentScore = 0;
    this.state.combo = 0;
    this.state.isDrifting = false;
    this.lastDriftDir = 0;
  }
}

// ===========================================
// INTEGRATED SYSTEM
// ===========================================

export const createDriftSystem = async (trackUrl: string) => {
  const detector = new ClippingZoneDetector();
  if (trackUrl) {
      await detector.loadTrack(trackUrl);
  }

  const scoring = new DriftScoring();

  return {
    update: (carState: CarState, trackWidth: number, trackHeight: number, deltaTime: number) => {
      const multiplier = detector.checkClippingZone(carState, trackWidth, trackHeight);
      return scoring.update(carState, multiplier, deltaTime);
    },
    resetScore: () => scoring.resetTotal(),
    getState: () => scoring.getState()
  };
};
