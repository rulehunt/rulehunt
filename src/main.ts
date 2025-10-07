import {
  buildC4Index,
  conwayOutput,
  coords16x32,
  expandRule,
  makeRule128,
  outlierOutput,
  Rule128,
} from "./cellular-automata-engine.ts";

// --- Helper: generate random 128-bit rule ---------------------------------
function randomRule128(): Rule128 {
  const lo =
    (BigInt(Math.floor(Math.random() * 2 ** 32)) << 32n) |
    BigInt(Math.floor(Math.random() * 2 ** 32));
  const hi =
    (BigInt(Math.floor(Math.random() * 2 ** 32)) << 32n) |
    BigInt(Math.floor(Math.random() * 2 ** 32));
  return { lo, hi };
}

// --- Renderer --------------------------------------------------------------
function renderRule(
  rule: Rule128,
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

  const hex32 =
    rule.hi.toString(16).padStart(16, "0") +
    rule.lo.toString(16).padStart(16, "0");

  ruleDisplay.textContent = `${label} — ${hex32}`;
  console.log(`${label} rule128:`);
  console.log("lo =", "0x" + rule.lo.toString(16).padStart(16, "0"));
  console.log("hi =", "0x" + rule.hi.toString(16).padStart(16, "0"));
}

// --- Main ------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  const ruleDisplay = document.getElementById("ruleid")!;
  const canvas = document.getElementById("truth") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const { orbitId } = buildC4Index();

  // Default: Conway
  const conwayRule = makeRule128(conwayOutput, orbitId);
  renderRule(conwayRule, orbitId, ctx, canvas, ruleDisplay, "Conway");

  // Buttons
  const btnRandom = document.getElementById("btn-random")!;
  const btnConway = document.getElementById("btn-conway")!;
  const btnOutlier = document.getElementById("btn-outlier")!;

  btnRandom.addEventListener("click", () => {
    const rule = randomRule128();
    renderRule(rule, orbitId, ctx, canvas, ruleDisplay, "Random");
  });

  btnConway.addEventListener("click", () => {
    const rule = makeRule128(conwayOutput, orbitId);
    renderRule(rule, orbitId, ctx, canvas, ruleDisplay, "Conway");
  });

  btnOutlier.addEventListener("click", () => {
    const rule = makeRule128(outlierOutput, orbitId);
    renderRule(rule, orbitId, ctx, canvas, ruleDisplay, "Outlier");
  });
});
