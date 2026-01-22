/**
 * AudioManager - Manages all game audio using Howler.js
 * 
 * Features:
 * - Sound debouncing to prevent "machine gun" effect on rapid clicks
 * - Separate zoom-in and zoom-out sound pools (cycles through 4 samples each)
 * - Per-sound cooldown tracking
 * - Configurable debounce duration
 */

// @ts-ignore - Howler types
import { Howl } from 'howler';
import { CONFIG } from '../config/constants';

// Sound identifiers for debounce tracking
type SoundId = 'zoomIn' | 'zoomOut' | 'click' | 'lock' | 'ambient';

export class AudioManager {
  // Zoom sound pools - cycles through these
  private zoomInSounds: Howl[] = [];
  private zoomOutSounds: Howl[] = [];
  private zoomInIndex = 0;
  private zoomOutIndex = 0;
  
  private clickSound: Howl;
  private ambientSound: Howl;
  private isAmbientPlaying = false;
  
  // Debounce tracking: stores last play time for each sound
  private lastPlayedTime: Map<SoundId, number> = new Map();
  private debounceMs: number;
  
  constructor(debounceMs: number = CONFIG.AUDIO.DEBOUNCE_MS) {
    this.debounceMs = debounceMs;
    
    // Initialize debounce tracking
    this.lastPlayedTime.set('zoomIn', 0);
    this.lastPlayedTime.set('zoomOut', 0);
    this.lastPlayedTime.set('click', 0);
    this.lastPlayedTime.set('lock', 0);
    this.lastPlayedTime.set('ambient', 0);
    
    // Initialize zoom-in sound pool (4 samples)
    for (const src of CONFIG.AUDIO.ZOOM_IN_SOUNDS) {
      this.zoomInSounds.push(new Howl({
        src: [src],
        volume: CONFIG.AUDIO.ZOOM_VOLUME,
        rate: CONFIG.AUDIO.ZOOM_RATE,
      }));
    }
    
    // Initialize zoom-out sound pool (4 samples)
    for (const src of CONFIG.AUDIO.ZOOM_OUT_SOUNDS) {
      this.zoomOutSounds.push(new Howl({
        src: [src],
        volume: CONFIG.AUDIO.ZOOM_VOLUME,
        rate: CONFIG.AUDIO.ZOOM_RATE,
      }));
    }
    
    this.clickSound = new Howl({
      src: ['/click-01-wind.m4a'],
      volume: CONFIG.AUDIO.CLICK_VOLUME,
      sprite: {
        click: [0, 200],
        lock: [200, 500],
      }
    });
    
    this.ambientSound = new Howl({
      src: ['/atmosphere-small.wav'],
      volume: CONFIG.AUDIO.AMBIENT_VOLUME,
      loop: true,
    });
  }
  
  /**
   * Check if a sound can be played (debounce logic)
   * Returns true if enough time has passed since last play
   */
  private canPlay(soundId: SoundId): boolean {
    const now = performance.now();
    const lastPlayed = this.lastPlayedTime.get(soundId) || 0;
    
    if (now - lastPlayed < this.debounceMs) {
      return false; // Too soon, ignore the request
    }
    
    // Update last played time
    this.lastPlayedTime.set(soundId, now);
    return true;
  }
  
  /**
   * Play zoom-in sound (cycles through 4 samples)
   */
  playZoomIn(): boolean {
    if (!this.canPlay('zoomIn')) {
      return false;
    }
    
    // Play current sample
    this.zoomInSounds[this.zoomInIndex].play();
    
    // Cycle to next sample
    this.zoomInIndex = (this.zoomInIndex + 1) % this.zoomInSounds.length;
    
    return true;
  }
  
  /**
   * Play zoom-out sound (cycles through 4 samples)
   */
  playZoomOut(): boolean {
    if (!this.canPlay('zoomOut')) {
      return false;
    }
    
    // Play current sample
    this.zoomOutSounds[this.zoomOutIndex].play();
    
    // Cycle to next sample
    this.zoomOutIndex = (this.zoomOutIndex + 1) % this.zoomOutSounds.length;
    
    return true;
  }
  
  /**
   * Play appropriate zoom sound based on direction
   * @param zoomingIn - true for zoom in, false for zoom out
   */
  playZoom(zoomingIn: boolean): boolean {
    return zoomingIn ? this.playZoomIn() : this.playZoomOut();
  }
  
  /**
   * Play click sound with debounce
   */
  playClick(): boolean {
    if (!this.canPlay('click')) {
      return false;
    }
    this.clickSound.play('click');
    return true;
  }
  
  /**
   * Play lock/target sound with debounce
   */
  playLock(): boolean {
    if (!this.canPlay('lock')) {
      return false;
    }
    this.clickSound.play('lock');
    return true;
  }
  
  /**
   * Start ambient sound (no debounce needed - only plays once)
   */
  startAmbient(): void {
    if (!this.isAmbientPlaying) {
      this.ambientSound.play();
      this.isAmbientPlaying = true;
    }
  }
  
  /**
   * Stop ambient sound
   */
  stopAmbient(): void {
    this.ambientSound.stop();
    this.isAmbientPlaying = false;
  }
  
  /**
   * Set ambient volume (0-1)
   */
  setAmbientVolume(volume: number): void {
    this.ambientSound.volume(Math.max(0, Math.min(1, volume)));
  }
  
  /**
   * Set master debounce duration
   */
  setDebounceMs(ms: number): void {
    this.debounceMs = Math.max(0, ms);
  }
  
  /**
   * Get current debounce duration
   */
  getDebounceMs(): number {
    return this.debounceMs;
  }
}
