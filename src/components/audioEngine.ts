// src/components/audioEngine.ts

import type { GridStatistics } from '../statistics'

/**
 * AudioEngine manages Web Audio API synthesis for cellular automata sonification.
 * Uses aggregate statistics to create ambient drone sounds that reflect simulation state.
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null
  private oscillator: OscillatorNode | null = null
  private gainNode: GainNode | null = null
  private lfoGain: GainNode | null = null
  private lfo: OscillatorNode | null = null
  private filterNode: BiquadFilterNode | null = null
  private isPlaying = false
  private volume = 0.3 // Default 30% volume

  constructor(volume = 0.3) {
    this.volume = Math.max(0, Math.min(1, volume))
  }

  /**
   * Initialize and start the audio context.
   * Must be called after a user gesture (iOS/Safari requirement).
   */
  start(): boolean {
    try {
      // Create audio context
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext

      if (!AudioContextClass) {
        console.warn('Web Audio API not supported')
        return false
      }

      this.audioContext = new AudioContextClass()

      // Create oscillator (main drone)
      this.oscillator = this.audioContext.createOscillator()
      this.oscillator.type = 'sine'
      this.oscillator.frequency.value = 200 // Default frequency

      // Create filter for harmonic complexity
      this.filterNode = this.audioContext.createBiquadFilter()
      this.filterNode.type = 'lowpass'
      this.filterNode.frequency.value = 1000
      this.filterNode.Q.value = 1

      // Create LFO (Low Frequency Oscillator) for amplitude modulation
      this.lfo = this.audioContext.createOscillator()
      this.lfo.frequency.value = 1 // Default modulation rate
      this.lfo.type = 'sine'

      // Create gain node for LFO
      this.lfoGain = this.audioContext.createGain()
      this.lfoGain.gain.value = 0.3 // Modulation depth

      // Create main gain node
      this.gainNode = this.audioContext.createGain()
      this.gainNode.gain.value = this.volume

      // Connect nodes: Oscillator → Filter → Gain → Destination
      this.oscillator.connect(this.filterNode)
      this.filterNode.connect(this.gainNode)
      this.gainNode.connect(this.audioContext.destination)

      // Connect LFO to main gain for amplitude modulation
      this.lfo.connect(this.lfoGain)
      this.lfoGain.connect(this.gainNode.gain)

      // Start oscillators
      this.oscillator.start()
      this.lfo.start()
      this.isPlaying = true

      return true
    } catch (error) {
      console.error('Failed to initialize audio engine:', error)
      return false
    }
  }

  /**
   * Update audio parameters based on cellular automata statistics.
   * Maps CA state to sound characteristics:
   * - Population → base frequency/pitch
   * - Activity → amplitude modulation rate
   * - Entropy → filter cutoff (harmonic complexity)
   */
  updateFromStats(stats: GridStatistics): void {
    if (!this.isPlaying || !this.oscillator || !this.lfo || !this.filterNode) {
      return
    }

    try {
      const now = this.audioContext?.currentTime || 0

      // Map population (0-1) to frequency (100-800 Hz)
      // Lower population → lower pitch, higher population → higher pitch
      const baseFreq = 100 + stats.population * 700
      this.oscillator.frequency.setTargetAtTime(baseFreq, now, 0.1)

      // Map activity (0-1) to LFO rate (0.5-4.5 Hz)
      // More activity → faster amplitude modulation (rhythmic pulsing)
      const lfoRate = 0.5 + stats.activity * 4
      this.lfo.frequency.setTargetAtTime(lfoRate, now, 0.1)

      // Map entropy (0-1) to filter cutoff (400-4000 Hz)
      // Higher entropy → brighter sound (more harmonics)
      const filterCutoff = 400 + stats.entropy4x4 * 3600
      this.filterNode.frequency.setTargetAtTime(filterCutoff, now, 0.1)

      // Adjust overall volume based on population
      // Fade to silence as population approaches 0
      const volumeMultiplier = Math.max(0.1, stats.population)
      this.gainNode?.gain.setTargetAtTime(
        this.volume * volumeMultiplier,
        now,
        0.2,
      )
    } catch (error) {
      console.error('Error updating audio from stats:', error)
    }
  }

  /**
   * Stop all audio and clean up resources
   */
  stop(): void {
    if (!this.isPlaying) return

    try {
      this.oscillator?.stop()
      this.lfo?.stop()
      this.oscillator?.disconnect()
      this.lfo?.disconnect()
      this.filterNode?.disconnect()
      this.lfoGain?.disconnect()
      this.gainNode?.disconnect()
      this.audioContext?.close()

      this.oscillator = null
      this.lfo = null
      this.filterNode = null
      this.lfoGain = null
      this.gainNode = null
      this.audioContext = null
      this.isPlaying = false
    } catch (error) {
      console.error('Error stopping audio engine:', error)
    }
  }

  /**
   * Suspend audio context (for backgrounding)
   */
  suspend(): void {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend()
    }
  }

  /**
   * Resume audio context (after backgrounding)
   */
  resume(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.gainNode && this.audioContext) {
      const now = this.audioContext.currentTime
      this.gainNode.gain.setTargetAtTime(this.volume, now, 0.1)
    }
  }

  /**
   * Get current playing state
   */
  getIsPlaying(): boolean {
    return this.isPlaying
  }
}
