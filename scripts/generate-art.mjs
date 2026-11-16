// Generates Cherry Creek's original placeholder artwork.
//
//   npm run art
//
// Everything is drawn procedurally from a fixed seed, so the output is
// reproducible and nothing here is (or pretends to be) a real screenshot.
// Outputs are committed; you only need to re-run this after changing it.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => join(root, p);

/** Small deterministic PRNG (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Collects unit cells per colour and emits one compact <path> per colour. */
class CellLayer {
  constructor(unit) {
    this.unit = unit;
    this.cells = new Map(); // colour -> Map(row -> Set(col))
  }
  set(col, row, colour) {
    // Later writes win: remove the cell from every other colour first.
    for (const rows of this.cells.values()) rows.get(row)?.delete(col);
    if (!this.cells.has(colour)) this.cells.set(colour, new Map());
    const rows = this.cells.get(colour);
    if (!rows.has(row)) rows.set(row, new Set());
    rows.get(row).add(col);
  }
  svg() {
    const u = this.unit;
    let s = '';
    for (const [colour, rows] of this.cells) {
      let d = '';
      for (const [row, cols] of rows) {
        const sorted = [...cols].sort((a, b) => a - b);
        let start = null;
        let prev = null;
        for (const c of sorted) {
          if (start === null) start = c;
          else if (c !== prev + 1) {
            d += `M${start * u} ${row * u}h${(prev - start + 1) * u}v${u}h${-(prev - start + 1) * u}z`;
            start = c;
          }
          prev = c;
        }
        if (start !== null) {
          d += `M${start * u} ${row * u}h${(prev - start + 1) * u}v${u}h${-(prev - start + 1) * u}z`;
        }
      }
      if (d) s += `<path fill="${colour}" d="${d}"/>`;
    }
    return s;
  }
}

/** Stepped (blocky) terrain silhouette as a single path. */
function terrainPath(heights, unit, bottom) {
  let d = `M0 ${bottom}`;
  heights.forEach((h, i) => {
    d += `V${h * unit}H${(i + 1) * unit}`;
  });
  return `${d}V${bottom}z`;
}

function ridge(cols, base, parts, rand) {
  const phases = parts.map(() => rand() * Math.PI * 2);
  return Array.from({ length: cols }, (_, x) => {
    let y = base;
    parts.forEach(([amp, freq], i) => {
      y += Math.sin(x * freq + phases[i]) * amp;
    });
    return Math.round(y);
  });
}

function cherryTree(layer, rand, col, groundRow, size, palette) {
  const trunkH = Math.round(size * 1.1) + 1;
  const trunkW = size > 4 ? 2 : 1;
  for (let y = 0; y < trunkH; y++) {
    for (let x = 0; x < trunkW; x++) layer.set(col + x, groundRow - 1 - y, palette.trunk);
  }
  const cx = col + trunkW / 2 - 0.5;
  const cy = groundRow - trunkH - size * 0.55;
  const rx = size * 1.35;
  const ry = size * 0.9;
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const e = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (e > 1 + (rand() - 0.5) * 0.35) continue;
      // Light comes from the upper right, where the sun sits.
      const lit = dx * 0.5 - dy * 1.1 + (rand() - 0.5) * size * 0.9;
      let colour = palette.mid;
      if (lit > size * 0.55) colour = palette.light;
      else if (lit < -size * 0.45) colour = palette.dark;
      layer.set(Math.round(cx + dx), Math.round(cy + dy), colour);
    }
  }
}

// ---------------------------------------------------------------------------
// Hero scene: a blocky cherry grove at dusk with a creek running through it.
// ---------------------------------------------------------------------------
function heroScene() {
  const W = 1920;
  const H = 1080;
  const U = 12;
  const cols = W / U;
  const rand = rng(20261111);

  const stars = new CellLayer(6);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rand() * (W / 6));
    const y = Math.floor(rand() ** 1.8 * 70);
    stars.set(x, y, rand() > 0.8 ? '#F4F5F4' : '#A9B5B5');
  }

  const clouds = new CellLayer(U);
  for (let i = 0; i < 7; i++) {
    const cx = Math.floor(rand() * cols);
    const cy = 16 + Math.floor(rand() * 22);
    const w = 8 + Math.floor(rand() * 16);
    for (let x = 0; x < w; x++) clouds.set(cx + x, cy, '#F4C9C4');
    for (let x = 2; x < w - 3; x++) clouds.set(cx + x, cy - 1, '#F4C9C4');
  }

  const far = ridge(
    cols,
    50,
    [
      [7, 0.045],
      [3, 0.13],
      [1.5, 0.31],
    ],
    rand,
  );
  const mid = ridge(
    cols,
    58,
    [
      [4, 0.06],
      [2, 0.17],
    ],
    rand,
  );
  const grove = ridge(
    cols,
    66,
    [
      [2.5, 0.05],
      [1, 0.21],
    ],
    rand,
  );

  // Trees on the grove ridge.
  const groveTrees = new CellLayer(U);
  const grovePalette = { trunk: '#2B1F22', light: '#FFC9D3', mid: '#E88DA5', dark: '#B4607A' };
  for (let x = 3; x < cols - 2; x += 5 + Math.floor(rand() * 5)) {
    cherryTree(groveTrees, rand, x, grove[x], 2 + Math.floor(rand() * 2), grovePalette);
  }
  const midTrees = new CellLayer(U);
  const midPalette = { trunk: '#24292C', light: '#D9A0AE', mid: '#B77E90', dark: '#8A5C6E' };
  for (let x = 6; x < cols - 2; x += 7 + Math.floor(rand() * 9)) {
    cherryTree(midTrees, rand, x, mid[x], 1 + Math.floor(rand() * 2), midPalette);
  }

  // The creek: a band of reflected sky between the grove and the foreground.
  const creekTop = 71;
  const creekBottom = 80;
  const water = new CellLayer(U);
  for (let y = creekTop; y < creekBottom; y++) {
    for (let x = 0; x < cols; x++) {
      const t = (y - creekTop) / (creekBottom - creekTop);
      const sunCol = cols * 0.7;
      const glow = Math.max(0, 1 - Math.abs(x - sunCol) / (10 + t * 26));
      const ripple = rand();
      let colour = t < 0.35 ? '#5C4A5B' : '#33414A';
      if (glow > 0.15 && ripple < glow * 0.9) colour = glow > 0.6 ? '#F5C96A' : '#E7A27F';
      else if (ripple < 0.07) colour = '#8E7C8E';
      water.set(x, y, colour);
    }
  }
  // Blossoms drifting on the water.
  for (let i = 0; i < 26; i++) {
    water.set(
      Math.floor(rand() * cols),
      creekTop + 1 + Math.floor(rand() * (creekBottom - creekTop - 2)),
      '#FFB7C5',
    );
  }

  // Foreground banks: near-silhouette so overlaid text stays readable.
  const bank = Array.from({ length: cols }, (_, x) => {
    const left = 76 - Math.max(0, 1 - x / 62) ** 1.5 * 15;
    const right = 82 - Math.max(0, (x - 112) / 48) ** 1.6 * 13;
    return Math.round(Math.min(left, right, 82) + Math.sin(x * 0.4) * 0.6);
  });
  const frontTrees = new CellLayer(U);
  const frontPalette = { trunk: '#120E10', light: '#F2A9BA', mid: '#C4728B', dark: '#7C4257' };
  for (const [x, size] of [
    [9, 7],
    [30, 5],
    [142, 6],
    [156, 8],
  ]) {
    cherryTree(frontTrees, rand, x, bank[x] + 1, size, frontPalette);
  }
  // Grass tufts and fallen petals on the bank tops.
  const tufts = new CellLayer(U);
  bank.forEach((h, x) => {
    if (rand() < 0.22) tufts.set(x, h - 1, '#2E4A3C');
    if (rand() < 0.06) tufts.set(x, h, '#E88DA5');
  });

  const sunX = W * 0.7;
  const sunY = 560;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#0D1518"/><stop offset=".3" stop-color="#1A2931"/>
<stop offset=".5" stop-color="#4A4553"/><stop offset=".62" stop-color="#A0677A"/>
<stop offset=".7" stop-color="#E69A86"/><stop offset=".76" stop-color="#F5C96A"/>
</linearGradient>
<radialGradient id="glow" cx="${sunX}" cy="${sunY}" r="620" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#FFE2A6" stop-opacity=".75"/><stop offset=".35" stop-color="#F5C96A" stop-opacity=".28"/>
<stop offset="1" stop-color="#F5C96A" stop-opacity="0"/>
</radialGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#E69A86" stop-opacity="0"/><stop offset="1" stop-color="#E69A86" stop-opacity=".35"/>
</linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<g opacity=".7">${stars.svg()}</g>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<rect x="${sunX - 54}" y="${sunY - 54}" width="108" height="108" fill="#FFF1CF"/>
<g opacity=".22">${clouds.svg()}</g>
<path fill="#5B5364" d="${terrainPath(far, U, H)}"/>
<rect y="520" width="${W}" height="260" fill="url(#haze)"/>
<path fill="#3A4149" d="${terrainPath(mid, U, H)}"/>
${midTrees.svg()}
<path fill="#263F36" d="${terrainPath(grove, U, H)}"/>
${groveTrees.svg()}
${water.svg()}
<path fill="#101B1C" d="${terrainPath(bank, U, H)}"/>
${tufts.svg()}
${frontTrees.svg()}
</svg>`;
}

// ---------------------------------------------------------------------------
// Map preview: an illustrative top-down map tile (not BlueMap output).
// ---------------------------------------------------------------------------
function mapPreview() {
  const U = 10;
  const cols = 96;
  const rows = 60;
  const rand = rng(4242);

  // Value noise.
  const G = 12;
  const grid = (seedOffset) => {
    const r = rng(1000 + seedOffset);
    const g = Array.from({ length: G + 2 }, () => Array.from({ length: G + 2 }, () => r()));
    return (x, y) => {
      const fx = (x / cols) * G;
      const fy = (y / rows) * G * (rows / cols);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const s = (t) => t * t * (3 - 2 * t);
      const a = g[y0][x0] + (g[y0][x0 + 1] - g[y0][x0]) * s(tx);
      const b = g[y0 + 1][x0] + (g[y0 + 1][x0 + 1] - g[y0 + 1][x0]) * s(tx);
      return a + (b - a) * s(ty);
    };
  };
  const height = grid(1);
  const biome = grid(2);

  const layer = new CellLayer(U);
  const creekX = (y) => 46 + Math.sin(y * 0.16) * 11 + Math.sin(y * 0.05 + 1) * 9;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dist = Math.abs(x - creekX(y));
      const h = height(x, y);
      const b = biome(x, y);
      const speck = rand();
      let colour;
      if (dist < 2.2) colour = speck < 0.12 ? '#5E8FA3' : '#3F7088';
      else if (dist < 3.4) colour = '#C9BE8F';
      else if (b > 0.6) {
        colour = speck < 0.25 ? '#FFC9D3' : speck < 0.6 ? '#E88DA5' : '#D17A95';
        if (speck > 0.94) colour = '#6FA57E';
      } else if (h > 0.68) colour = speck < 0.5 ? '#7C8A86' : '#69777A';
      else if (b < 0.3) colour = speck < 0.5 ? '#2F5E46' : '#3A6B50';
      else colour = speck < 0.5 ? '#6FA57E' : '#7DB58B';
      layer.set(x, y, colour);
    }
  }

  const claim = (x, y, w, h) =>
    `<rect x="${x * U}" y="${y * U}" width="${w * U}" height="${h * U}" fill="#F5C96A" fill-opacity=".14" stroke="#F5C96A" stroke-width="3" stroke-dasharray="10 6"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * U} ${rows * U}" shape-rendering="crispEdges">
${layer.svg()}
${claim(14, 12, 13, 10)}${claim(62, 30, 16, 12)}${claim(24, 38, 9, 9)}
</svg>`;
}

// ---------------------------------------------------------------------------
// Camp scene: the campfire clearing in the grove, redrawn from an in-game
// screenshot of Cherry Creek in the same blocky style as the hero.
// ---------------------------------------------------------------------------
function campScene() {
  const W = 1920;
  const H = 1080;
  const U = 12;
  const cols = W / U;
  const rows = H / U;
  const rand = rng(20261116);
  const pick = (list) => list[Math.floor(rand() * list.length)];

  /** A leafy mass: a union of noisy ellipses, lit from above, darker underneath. */
  function canopy(layer, blobs, palette, leafChance = 0.035) {
    for (const [cx, cy, rx, ry] of blobs) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
          if (e > 1 + (rand() - 0.5) * 0.22) continue;
          const depth = (y - cy) / ry + (rand() - 0.5) * 0.7;
          let colour = palette.mid;
          if (depth < -0.35) colour = palette.light;
          else if (depth > 0.45) colour = palette.dark;
          if (rand() < leafChance) colour = palette.leaf;
          else if (rand() < 0.08) colour = palette.bright;
          layer.set(x, y, colour);
        }
      }
    }
  }

  function block(layer, x0, y0, w, h, colours) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++)
        layer.set(x, y, typeof colours === 'string' ? colours : pick(colours));
    }
  }

  const far = {
    light: '#E9B3C4',
    mid: '#C98CA6',
    dark: '#9A6684',
    bright: '#F3C9D3',
    leaf: '#9FA98C',
  };
  const near = {
    light: '#FFC9D3',
    mid: '#E88DA5',
    dark: '#A8587A',
    bright: '#FFE1E7',
    leaf: '#7FB07A',
  };
  const front = {
    light: '#F7B4C4',
    mid: '#D9789A',
    dark: '#8C4266',
    bright: '#FFD3DC',
    leaf: '#6FA068',
  };
  const BARK = ['#1C1418', '#221920', '#17110F'];

  // --- Sky ------------------------------------------------------------------
  const clouds = new CellLayer(U);
  for (const [cx, cy, w] of [
    [70, 9, 18],
    [92, 5, 12],
    [58, 20, 14],
    [86, 24, 20],
    [104, 15, 10],
    [76, 33, 16],
  ]) {
    for (let x = 0; x < w; x++) clouds.set(cx + x, cy, '#F6D9D2');
    for (let x = 2; x < w - 2; x++) clouds.set(cx + x, cy - 1, '#FBEAE2');
    for (let x = 4; x < w - 5; x++) clouds.set(cx + x, cy - 2, '#FBEAE2');
  }

  // --- Distant grove --------------------------------------------------------
  const distant = new CellLayer(U);
  for (let x = 2; x < cols; x += 9 + Math.floor(rand() * 5)) {
    block(distant, x, 44, 2, 9, '#2A1F27');
  }
  canopy(
    distant,
    Array.from({ length: 16 }, (_, i) => [
      i * 11 + rand() * 4,
      41 + rand() * 3,
      8 + rand() * 3,
      5 + rand() * 2,
    ]),
    far,
  );

  // --- Ground ---------------------------------------------------------------
  const HORIZON = 52;
  const ground = new CellLayer(U);
  for (let y = HORIZON; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Leaf litter: mottled browns with warm flecks, darker in the tree shade.
      const shade = y < 60 || x < 26 || x > 132;
      const r = rand();
      let colour = shade
        ? pick(['#3B2418', '#462A1A', '#33201A'])
        : pick(['#5A351E', '#6B4020', '#4C2D1B']);
      if (!shade && r < 0.16) colour = '#9A5A22';
      else if (!shade && r < 0.2) colour = '#C27B2B';
      ground.set(x, y, colour);
    }
  }
  // Grass: the meadow on the left, and the sunlit patch in the near right corner.
  for (let y = HORIZON; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const left = x < 30 - (y - HORIZON) * 1.1 + Math.sin(y * 0.9) * 1.5 && y < 74;
      const corner = y > 70 && x > 104 + (rows - y) * 2.2 + Math.sin(y * 0.7) * 2;
      if (left) ground.set(x, y, pick(['#3F6B3C', '#4C7A45', '#35603A']));
      if (corner) ground.set(x, y, pick(['#7DB56A', '#8ED5A3', '#6FA95E']));
    }
  }
  // Low stone wall along the back of the clearing.
  block(ground, 0, HORIZON - 1, cols, 2, ['#2C3338', '#353D42', '#262C31']);

  const sand = new Set();
  // Sand path: wide at the near left, narrowing to the campfire.
  for (let y = 56; y < rows; y++) {
    const t = (y - 56) / (rows - 56);
    const centre = 80 - t * 58;
    const half = 7 + t * 26;
    for (let x = Math.round(centre - half); x <= Math.round(centre + half); x++) {
      if (x < 0 || x >= cols) continue;
      sand.add(`${x},${y}`);
      ground.set(x, y, pick(['#C9A45C', '#B8934F', '#D6B36A', '#C09A55']));
    }
  }
  block(ground, 62, 54, 32, 4, ['#D6B36A', '#C9A45C', '#E0BF78']);

  // --- Huts -----------------------------------------------------------------
  const huts = new CellLayer(U);
  function hut(x, y, w, h, pillars) {
    block(huts, x, y + 2, w, h - 2, ['#4A2C1C', '#3F2619', '#55331F']);
    block(huts, x + 3, y + 4, w - 6, h - 4, '#1A1210'); // open front
    block(huts, x - 2, y, w + 4, 2, ['#3A2217', '#2F1C14']); // roof slab
    block(huts, x - 2, y, w + 4, 1, '#6B4020');
    for (const px of pillars) {
      for (let py = y + 4; py < y + h; py++) {
        huts.set(px, py, '#D9D4C7');
        if ((py - y) % 2 === 0) huts.set(px + 1, py, '#BDB8AC'); // notched like bone
      }
    }
  }
  hut(35, 42, 24, 13, [46, 57]);
  hut(83, 44, 14, 10, [95]);
  hut(120, 39, 30, 19, [123, 131]);

  // --- Benches, lamps and the fire -----------------------------------------
  const props = new CellLayer(U);
  function bench(x, y, w) {
    block(props, x, y, w, 1, ['#B9B4AE', '#A8A39D']);
    block(props, x, y + 1, w, 2, ['#F2B9C4', '#E9A6B5', '#F7C6CF']);
  }
  bench(64, 52, 10);
  bench(84, 51, 8);
  bench(92, 53, 7);

  function lamp(x, top, bottom, big) {
    for (let y = top; y < bottom; y++) {
      props.set(x, y, (y - top) % 2 ? '#F2B9C4' : '#FBE3E8'); // striped cherry-wood pole
      if (big) props.set(x + 1, y, (y - top) % 2 ? '#E9A6B5' : '#F2CDD5');
    }
    const w = big ? 6 : 4;
    const h = big ? 5 : 3;
    const hx = x - Math.floor(w / 2) + (big ? 1 : 0);
    block(props, hx, top - h, w, h, ['#E3B455', '#D9A645', '#EEC56A']);
    for (const side of [hx - 1, hx + w]) {
      props.set(side, top - 2, '#6B4020');
      props.set(side, top - 3, '#F5C96A');
      props.set(side, top - 4, '#FFE2A6');
    }
    props.set(hx + Math.floor(w / 2), top - h - 1, '#FFE2A6');
  }
  lamp(73, 43, 53, false);
  lamp(99, 36, 61, true);

  // Campfire with a column of smoke drifting up through the trees.
  block(props, 78, 56, 7, 2, ['#6B4020', '#8A5A2B', '#4A2C1C']);
  const flame = ['..o..', '.oyo.', 'oywyo', 'oywyo'];
  flame.forEach((line, dy) => {
    [...line].forEach((ch, dx) => {
      if (ch === '.') return;
      props.set(79 + dx, 52 + dy, { o: '#E88A3A', y: '#F5C96A', w: '#FFF1CF' }[ch]);
    });
  });
  let sx = 81;
  for (let y = 49, step = 0; y > 24; y -= 4, step++) {
    sx += step % 2 ? 2 : -1;
    const size = 2 + Math.floor(step / 2);
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size + 1; dx++) {
        // Knock the corners off so each puff reads as a cloud, not a box.
        const corner = (dx === 0 || dx === size) && (dy === 0 || dy === size - 1);
        if (corner && size > 2) continue;
        props.set(sx + dx, y - dy, pick(['#E6DCD7', '#D4C9C6', '#F1E9E4']));
      }
    }
  }

  // --- Trees in front -------------------------------------------------------
  const trunks = new CellLayer(U);
  block(trunks, 5, 22, 15, 33, BARK);
  block(trunks, 28, 40, 4, 14, BARK);
  block(trunks, 111, 40, 5, 17, BARK);
  block(trunks, 149, 22, 11, 56, ['#2A1A22', '#33202A', '#241620']);

  const mid = new CellLayer(U);
  canopy(
    mid,
    [
      [92, 26, 16, 10],
      [84, 32, 9, 6],
      [104, 31, 8, 6],
    ],
    near,
  );

  const leaves = new CellLayer(U);
  canopy(
    leaves,
    [
      [14, 6, 30, 16],
      [44, 12, 22, 14],
      [8, 26, 16, 10],
      [58, 24, 13, 9],
      [34, 30, 14, 7],
      [70, 8, 10, 6],
    ],
    front,
  );
  canopy(
    leaves,
    [
      [146, 8, 26, 18],
      [120, 14, 18, 12],
      [152, 30, 14, 9],
      [128, 32, 12, 6],
      [108, 6, 9, 6],
    ],
    front,
  );

  // --- Flowers and drifting petals -----------------------------------------
  const flowers = new CellLayer(U);
  for (let i = 0; i < 46; i++) {
    const y = 60 + Math.floor(rand() ** 0.8 * (rows - 62));
    const x = Math.floor(rand() * cols);
    if (sand.has(`${x},${y}`)) continue;
    flowers.set(x, y, '#5E8F4E');
    flowers.set(x, y - 1, pick(['#FFB7C5', '#FFE1E7', '#E88DA5']));
    if (y > 76) {
      flowers.set(x + 1, y - 1, '#FFB7C5');
      flowers.set(x - 1, y - 1, '#FFE1E7');
      flowers.set(x, y - 2, '#FFB7C5');
    }
  }
  const petals = new CellLayer(6);
  for (let i = 0; i < 40; i++) {
    petals.set(
      Math.floor(rand() * (W / 6)),
      60 + Math.floor(rand() * 100),
      pick(['#FFB7C5', '#FFD3DC']),
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">
<defs>
<linearGradient id="csky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#16242C"/><stop offset=".22" stop-color="#3B4257"/>
<stop offset=".38" stop-color="#8E6379"/><stop offset=".5" stop-color="#E69A86"/><stop offset=".58" stop-color="#F5C96A"/>
</linearGradient>
<radialGradient id="cfire" cx="${81.5 * U}" cy="${55 * U}" r="430" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#FFD98A" stop-opacity=".7"/><stop offset=".4" stop-color="#F5A85A" stop-opacity=".25"/>
<stop offset="1" stop-color="#F5A85A" stop-opacity="0"/>
</radialGradient>
<linearGradient id="cshade" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#0D1518" stop-opacity=".45"/><stop offset=".45" stop-color="#0D1518" stop-opacity="0"/>
</linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#csky)"/>
<g opacity=".5">${clouds.svg()}</g>
${distant.svg()}
${ground.svg()}
${huts.svg()}
${mid.svg()}
${trunks.svg()}
${props.svg()}
${flowers.svg()}
<rect width="${W}" height="${H}" fill="url(#cfire)"/>
${leaves.svg()}
<rect width="${W}" height="${H}" fill="url(#cshade)"/>
<g opacity=".8">${petals.svg()}</g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Brand mark: a five-petal pixel blossom.
// ---------------------------------------------------------------------------
const BLOSSOM = [
  '....pp..pp....',
  '...pPPp.PPp...',
  '...pPPPPPPp...',
  '.pp.pPPPPp.pp.',
  'pPPPpPggPpPPPp',
  'pPPPPPggPPPPPp',
  '.pPPPpPPpPPPp.',
  '..ppPPPPPPpp..',
  '...pPPp.PPPp..',
  '..pPPPp.pPPPp.',
  '..pPPp...pPPp.',
  '...pp.....pp..',
];
const BLOSSOM_COLOURS = { p: '#E88DA5', P: '#FFB7C5', g: '#F5C96A' };

function blossomCells(unit, ox, oy) {
  const layer = new CellLayer(unit);
  BLOSSOM.forEach((line, y) => {
    [...line].forEach((ch, x) => {
      if (ch !== '.') layer.set(x, y, BLOSSOM_COLOURS[ch]);
    });
  });
  return `<g transform="translate(${ox} ${oy})">${layer.svg()}</g>`;
}

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 12" shape-rendering="crispEdges">${blossomCells(1, 0, 0)}</svg>`;

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">
<rect width="64" height="64" rx="14" fill="#172126" shape-rendering="geometricPrecision"/>
${blossomCells(3.5, 7.5, 11)}
</svg>`;

function ogSvg(scene) {
  const inner = scene.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#0D1518" stop-opacity=".92"/><stop offset=".6" stop-color="#0D1518" stop-opacity=".35"/>
<stop offset="1" stop-color="#0D1518" stop-opacity="0"/></linearGradient></defs>
<svg x="0" y="-45" width="1200" height="675" viewBox="0 0 1920 1080" shape-rendering="crispEdges">${inner}</svg>
<rect width="1200" height="630" fill="url(#shade)"/>
<g font-family="Inter Display, Inter, sans-serif" fill="#F4F5F4">
<text x="72" y="300" font-size="104" font-weight="800" letter-spacing="-3">Cherry Creek</text>
<text x="74" y="364" font-size="36" font-weight="500" fill="#F4F5F4" fill-opacity=".86">Your next adventure begins here.</text>
<text x="74" y="548" font-size="28" font-weight="600" fill="#FFB7C5">play.cherrycreek.app</text>
<text x="74" y="500" font-size="24" font-weight="500" fill="#A9B5B5">Whitelisted Minecraft Java survival community</text>
</g>
</svg>`;
}

await mkdir(out('src/assets/art'), { recursive: true });
await mkdir(out('public'), { recursive: true });

const scene = heroScene();
await writeFile(out('src/assets/art/hero-scene.svg'), scene);
await writeFile(out('src/assets/art/map-preview.svg'), mapPreview());
// The camp scene has too much per-block texture to be a small SVG, so it
// ships as a raster; Astro resizes and converts it at build time.
await sharp(Buffer.from(campScene()))
  .png({ compressionLevel: 9, palette: true, colours: 128 })
  .toFile(out('src/assets/art/camp-scene.png'));
await writeFile(out('src/assets/art/mark.svg'), markSvg);
await writeFile(out('public/favicon.svg'), faviconSvg);
await sharp(Buffer.from(faviconSvg), { density: 300 })
  .resize(180, 180)
  .png()
  .toFile(out('public/apple-touch-icon.png'));
await sharp(Buffer.from(ogSvg(scene)))
  .png({ compressionLevel: 9, palette: true, colours: 256 })
  .toFile(out('public/og.png'));

console.log('Artwork written to src/assets/art and public/.');
