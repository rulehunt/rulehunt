import { Rule140, expandRule } from "./utils.ts";

const GRID_SIZE = 100;

export class CellularAutomata {
  private grid: Uint8Array;
  private nextGrid: Uint8Array;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize: number;
  private isPlaying: boolean = false;
  private playInterval: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cellSize = canvas.width / GRID_SIZE;
    
    this.grid = new Uint8Array(GRID_SIZE * GRID_SIZE);
    this.nextGrid = new Uint8Array(GRID_SIZE * GRID_SIZE);
    
    this.randomize();
    this.render();
  }

  randomize(alivePercentage: number = 50) {
    const threshold = alivePercentage / 100;
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = Math.random() < threshold ? 1 : 0;
    }
  }

  step(rule: Rule140, orbitId: Uint8Array) {
    const truth = expandRule(rule, orbitId);
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const pattern = this.get3x3Pattern(x, y);
        const index = this.patternToIndex(pattern);
        this.nextGrid[y * GRID_SIZE + x] = truth[index];
      }
    }
    
    // Swap grids
    const temp = this.grid;
    this.grid = this.nextGrid;
    this.nextGrid = temp;
    
    this.render();
  }

  private get3x3Pattern(centerX: number, centerY: number): number[][] {
    const pattern: number[][] = [];
    
    for (let dy = -1; dy <= 1; dy++) {
      const row: number[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        // Torus topology: wrap around edges
        const x = (centerX + dx + GRID_SIZE) % GRID_SIZE;
        const y = (centerY + dy + GRID_SIZE) % GRID_SIZE;
        row.push(this.grid[y * GRID_SIZE + x]);
      }
      pattern.push(row);
    }
    
    return pattern;
  }

  private patternToIndex(pattern: number[][]): number {
    // Convert 3x3 pattern to 9-bit index
    // Order: top-left to bottom-right, reading left to right, top to bottom
    let index = 0;
    let bit = 0;
    
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (pattern[y][x]) {
          index |= (1 << bit);
        }
        bit++;
      }
    }
    
    return index;
  }

  render() {
    this.ctx.fillStyle = "#fff";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = "purple";
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (this.grid[y * GRID_SIZE + x]) {
          this.ctx.fillRect(
            x * this.cellSize,
            y * this.cellSize,
            this.cellSize,
            this.cellSize
          );
        }
      }
    }
  }

  play(stepsPerSecond: number, rule: Rule140, orbitId: Uint8Array) {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    const intervalMs = 1000 / stepsPerSecond;
    
    this.playInterval = window.setInterval(() => {
      this.step(rule, orbitId);
    }, intervalMs);
  }

  pause() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    if (this.playInterval !== null) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }
}