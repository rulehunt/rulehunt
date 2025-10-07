import {
  buildC4Index,
  conwayOutput,
  coords16x32,
  expandRule,
  makeRule140,
  outlierOutput,
  randomRule140,
  Rule140,
  ruleToHex,
} from "./cellular-automata-engine.ts";

// --- Renderer --------------------------------------------------------------
function renderRule(
  rule: Rule140,
  orbitId: Uint8Array,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ruleDisplay: HTMLElement,
  label: string
) {
  const truth = expandRule(rule, orbitId);
  const cols = 16,
    rows = 32;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "purple";

  for (let n = 0; n < 512; n++) {
    if (truth[n]) {
      const { x, y } = coords16x32(n);
      ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
    }
  }

  const hex35 = ruleToHex(rule);
  ruleDisplay.textContent = `${label} — ${hex35}`;
  
  console.log(`${label} rule140 (${hex35.length} hex chars):`);
  console.log("lo  =", "0x" + rule.lo.toString(16).padStart(16, "0"));
  console.log("mid =", "0x" + rule.mid.toString(16).padStart(16, "0"));
  console.log("hi  =", "0x" + rule.hi.toString(16).padStart(3, "0"));
  console.log("hex =", hex35);
}

// --- Canvas Click Handler --------------------------------------------------
function handleCanvasClick(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
  currentTruth: Uint8Array
) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  const cols = 16, rows = 32;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;
  
  const gridX = Math.floor(x / cellW);
  const gridY = Math.floor(y / cellH);
  
  // Find which patch index maps to this grid position
  let patchIndex = -1;
  for (let n = 0; n < 512; n++) {
    const coord = coords16x32(n);
    if (coord.x === gridX && coord.y === gridY) {
      patchIndex = n;
      break;
    }
  }
  
  if (patchIndex === -1) return;
  
  // Extract the 3x3 pattern from the 9-bit index
  const bits = [];
  for (let i = 0; i < 9; i++) {
    bits.push((patchIndex >> i) & 1);
  }
  
  // Format as 3x3 grid (bits are in this order: 0,1,2,3,4,5,6,7,8)
  // Position layout: 0 1 2
  //                  3 4 5
  //                  6 7 8
  const output = currentTruth[patchIndex];
  
  console.log("\n" + 
    `${bits[0]} ${bits[1]} ${bits[2]}\n` +
    `${bits[3]} ${bits[4]} ${bits[5]}     --->  ${output}\n` +
    `${bits[6]} ${bits[7]} ${bits[8]}\n`
  );
  console.log(`Patch index: ${patchIndex}`);
}

// --- Main ------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  const ruleDisplay = document.getElementById("ruleid")!;
  const canvas = document.getElementById("truth") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const { orbitId } = buildC4Index();

  // Track current truth table for click handler
  let currentTruth: Uint8Array;

  // Default: Conway
  const conwayRule = makeRule140(conwayOutput, orbitId);
  currentTruth = expandRule(conwayRule, orbitId);
  renderRule(conwayRule, orbitId, ctx, canvas, ruleDisplay, "Conway");
  
  // Add click listener
  canvas.addEventListener("click", (e) => {
    handleCanvasClick(e, canvas, currentTruth);
  });
  canvas.style.cursor = "pointer";

  // Buttons
  const btnRandom = document.getElementById("btn-random")!;
  const btnConway = document.getElementById("btn-conway")!;
  const btnOutlier = document.getElementById("btn-outlier")!;

  btnRandom.addEventListener("click", () => {
    const rule = randomRule140();
    currentTruth = expandRule(rule, orbitId);
    renderRule(rule, orbitId, ctx, canvas, ruleDisplay, "Random");
  });

  btnConway.addEventListener("click", () => {
    const rule = makeRule140(conwayOutput, orbitId);
    currentTruth = expandRule(rule, orbitId);
    renderRule(rule, orbitId, ctx, canvas, ruleDisplay, "Conway");
  });

  btnOutlier.addEventListener("click", () => {
    const rule = makeRule140(outlierOutput, orbitId);
    currentTruth = expandRule(rule, orbitId);
    renderRule(rule, orbitId, ctx, canvas, ruleDisplay, "Outlier");
  });
});