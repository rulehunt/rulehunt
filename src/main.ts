import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite logo to learn more
    </p>
  </div>
`

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)

function setupCounter(element: HTMLButtonElement) {
  let counter = 0
  const setCounter = (count: number) => {
    counter = count
    element.innerHTML = `count is ${counter}`
  }
  element.addEventListener('click', () => setCounter(counter + 1))
  setCounter(0)
}

// --- constants ------------------------------------------------------------
const ROT_MAP = [6, 3, 0, 7, 4, 1, 8, 5, 2]; // 90° CW rotation for bits 8..0

// --- rotation/orbit utilities --------------------------------------------
function rot90(n: number): number {
  let r = 0;
  for (let i = 0; i < 9; i++) {
    const src = ROT_MAP[i];
    if ((n >> src) & 1) r |= 1 << i;
  }
  return r;
}

function canonicalC4(n: number): number {
  const r1 = rot90(n);
  const r2 = rot90(r1);
  const r3 = rot90(r2);
  return Math.min(n, r1, r2, r3);
}

function buildC4Index() {
  const canon = new Uint16Array(512);
  for (let n = 0; n < 512; n++) canon[n] = canonicalC4(n);
  const reps = Array.from(new Set(Array.from(canon))).sort((a, b) => a - b);
  const idMap = new Map<number, number>();
  reps.forEach((v, i) => idMap.set(v, i));
  const orbitId = new Uint8Array(512);
  for (let n = 0; n < 512; n++) orbitId[n] = idMap.get(canon[n])!;
  return { orbitId };
}

// --- rule generation / expansion -----------------------------------------
type Rule128 = { lo: bigint; hi: bigint };
function randomRule(): Rule128 {
  const lo = (BigInt(Math.floor(Math.random() * 2 ** 32)) << 32n) |
             BigInt(Math.floor(Math.random() * 2 ** 32));
  const hi = (BigInt(Math.floor(Math.random() * 2 ** 32)) << 32n) |
             BigInt(Math.floor(Math.random() * 2 ** 32));
  return { lo, hi };
}

function ruleGet(R: Rule128, orbit: number): number {
  if (orbit < 64) return Number((R.lo >> BigInt(orbit)) & 1n);
  return Number((R.hi >> BigInt(orbit - 64)) & 1n);
}

function expandRule(R: Rule128, orbitId: Uint8Array): Uint8Array {
  const T = new Uint8Array(512);
  for (let n = 0; n < 512; n++) T[n] = ruleGet(R, orbitId[n]);
  return T;
}

// --- visualization mapping (16×32 grid) ----------------------------------
function coords16x32(n: number) {
  const bx = ((n >> 7) & 1) << 3 | ((n >> 3) & 1) << 2 | ((n >> 1) & 1) << 1 | ((n >> 5) & 1);
  const x = bx ^ (bx >> 1); // 4-bit Gray
  const by = ((n >> 4) & 1) << 4 | ((n >> 8) & 1) << 3 | ((n >> 6) & 1) << 2 | ((n >> 0) & 1) << 1 | ((n >> 2) & 1);
  const y = by ^ (by >> 1); // 5-bit Gray
  return { x, y };
}

// --- main ----------------------------------------------------------------
const canvas = document.getElementById("truth") as HTMLCanvasElement;
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
