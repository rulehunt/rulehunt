import { buildC4Index, randomRule, expandRule, coords16x32 } from './cellular-automata-engine';

// --- main ----------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("truth") as HTMLCanvasElement | null;
  if (!canvas) {
    console.error("No canvas with id='truth' found.");
    return;
  }

  const ctx = canvas.getContext("2d")!;
  const { orbitId } = buildC4Index();
  const rule = randomRule();
  const truth = expandRule(rule, orbitId);

  const cellSize = 16; // 16×32 grid -> 512px canvas
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "purple";

  for (let n = 0; n < 512; n++) {
    if (truth[n]) {
      const { x, y } = coords16x32(n);
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  console.log("Random 128-bit rule:", rule);
});