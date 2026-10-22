function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Cloud(count, rand) {
  this.count = count;
  this.rand = rand;
  this.pos = new Float32Array(count * 3);
  this.i = 0;
}

Cloud.prototype.push = function (x, y, z) {
  if (this.i >= this.count) return false;
  const o = this.i * 3;
  this.pos[o] = x;
  this.pos[o + 1] = y;
  this.pos[o + 2] = z;
  this.i += 1;
  return true;
};

Cloud.prototype.pad = function () {
  if (this.i === 0) {
    while (this.i < this.count) this.push(0, 0, 0);
    return;
  }
  const filled = this.i;
  let k = 0;
  while (this.i < this.count) {
    const o = (k % filled) * 3;
    const j = 0.04;
    this.push(
      this.pos[o] + (this.rand() - 0.5) * j,
      this.pos[o + 1] + (this.rand() - 0.5) * j,
      this.pos[o + 2] + (this.rand() - 0.5) * j
    );
    k += 1;
  }
};

function fillBox(cloud, cx, cy, cz, sx, sy, sz, budget) {
  for (let i = 0; i < budget; i += 1) {
    if (
      !cloud.push(
        cx + (cloud.rand() - 0.5) * sx,
        cy + (cloud.rand() - 0.5) * sy,
        cz + (cloud.rand() - 0.5) * sz
      )
    )
      break;
  }
}

function fillEllipsoid(cloud, cx, cy, cz, rx, ry, rz, budget) {
  let n = 0;
  let guard = 0;
  while (n < budget && guard < budget * 8) {
    guard += 1;
    const x = (cloud.rand() * 2 - 1) * rx;
    const y = (cloud.rand() * 2 - 1) * ry;
    const z = (cloud.rand() * 2 - 1) * rz;
    if ((x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz) > 1) continue;
    if (!cloud.push(cx + x, cy + y, cz + z)) break;
    n += 1;
  }
}

function fillCylinder(cloud, cx, cy, cz, radius, height, budget) {
  for (let i = 0; i < budget; i += 1) {
    const a = cloud.rand() * Math.PI * 2;
    const r = Math.sqrt(cloud.rand()) * radius;
    const y = cy + (cloud.rand() - 0.5) * height;
    if (!cloud.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r)) break;
  }
}

function fillTorus(cloud, cx, cy, cz, major, minor, budget) {
  for (let i = 0; i < budget; i += 1) {
    const a = cloud.rand() * Math.PI * 2;
    const b = cloud.rand() * Math.PI * 2;
    const rr = minor * Math.sqrt(cloud.rand());
    const R = major + Math.cos(b) * rr;
    if (
      !cloud.push(
        cx + Math.cos(a) * R,
        cy + Math.sin(b) * rr,
        cz + Math.sin(a) * R
      )
    )
      break;
  }
}

function fillArchMass(cloud, cx, cy, cz, radius, thickness, depth, budget) {
  let n = 0;
  let guard = 0;
  while (n < budget && guard < budget * 10) {
    guard += 1;
    const theta = cloud.rand() * Math.PI;
    const r = radius + (cloud.rand() - 0.5) * thickness;
    const along = (cloud.rand() - 0.5) * depth;
    const x = cx + Math.cos(theta) * r;
    const y = cy - Math.sin(theta) * r;
    if (y > cy + 0.05) continue;
    if (!cloud.push(x, y, cz + along)) break;
    n += 1;
  }
}

function fillPyramid(cloud, cx, cy, cz, width, depth, height, budget) {
  for (let i = 0; i < budget; i += 1) {
    const t = cloud.rand();
    const shrink = 1 - t;
    if (
      !cloud.push(
        cx + (cloud.rand() - 0.5) * width * shrink,
        cy + t * height,
        cz + (cloud.rand() - 0.5) * depth * shrink
      )
    )
      break;
  }
}

function deckY(x) {
  const t = x / 17;
  return 2.35 + 0.55 * Math.cos(t * Math.PI * 0.5);
}

function addBridge(cloud) {
  for (let i = 0; i < 14000; i += 1) {
    const x = (cloud.rand() - 0.5) * 34;
    const z = (cloud.rand() - 0.5) * 3.6;
    const y = deckY(x) + (cloud.rand() - 0.2) * 0.55;
    cloud.push(x, y, z);
  }

  for (let i = 0; i < 5200; i += 1) {
    const x = (cloud.rand() - 0.5) * 33;
    const side = cloud.rand() > 0.5 ? 1 : -1;
    const y = deckY(x) + cloud.rand() * 0.85;
    const z = side * (1.35 + cloud.rand() * 0.45);
    cloud.push(x, y, z);
  }

  const openings = 6;
  const span = 30 / openings;
  for (let i = 0; i <= openings; i += 1) {
    const x = -15 + i * span;
    fillBox(cloud, x, deckY(x) - 1.45, 0, 0.7, 2.7, 3.0, 700);
  }
  for (let i = 0; i < openings; i += 1) {
    const x = -15 + span * 0.5 + i * span;
    fillArchMass(cloud, x, deckY(x) - 0.1, 0, span * 0.42, 0.55, 2.8, 1600);
    fillBox(cloud, x, deckY(x) - 2.2, 0, span * 0.85, 1.1, 2.6, 900);
  }

  addSolidPavilion(cloud, -9.2, 1.05, 2);
  addSolidPavilion(cloud, 0, 1.35, 3);
  addSolidPavilion(cloud, 9.2, 1.05, 2);
  cloud.pad();
}

function addSolidPavilion(cloud, x, scale, tiers) {
  const y0 = deckY(x);
  fillBox(cloud, x, y0 + 0.85 * scale, 0, 1.7 * scale, 1.5 * scale, 1.7 * scale, 1800);
  const posts = [
    [-0.75, -0.75],
    [0.75, -0.75],
    [-0.75, 0.75],
    [0.75, 0.75],
  ];
  posts.forEach(([px, pz]) => {
    fillCylinder(cloud, x + px * scale, y0 + 0.9 * scale, pz * scale, 0.14 * scale, 1.7 * scale, 320);
  });
  for (let t = 0; t < tiers; t += 1) {
    const w = (2.7 - t * 0.5) * scale;
    const h = y0 + (1.5 + t * 0.78) * scale;
    fillPyramid(cloud, x, h, 0, w, w, 0.62 * scale, 1100);
    fillBox(cloud, x, h + 0.08, 0, w * 0.48, 0.22 * scale, w * 0.48, 380);
  }
}

function addStoneLion(cloud) {
  fillEllipsoid(cloud, 0, 3.4, 0, 2.4, 2.0, 3.2, 9000);
  fillEllipsoid(cloud, 0, 5.8, 1.6, 1.7, 1.5, 1.6, 5200);
  fillEllipsoid(cloud, 0.55, 6.15, 2.7, 0.35, 0.28, 0.35, 400);
  fillEllipsoid(cloud, -0.55, 6.15, 2.7, 0.35, 0.28, 0.35, 400);
  fillEllipsoid(cloud, 0, 5.55, 3.05, 0.55, 0.35, 0.45, 500);
  fillEllipsoid(cloud, 0, 6.9, 1.3, 1.2, 0.7, 1.1, 1800);
  fillCylinder(cloud, 1.1, 2.0, 1.4, 0.45, 2.4, 900);
  fillCylinder(cloud, -1.1, 2.0, 1.4, 0.45, 2.4, 900);
  fillCylinder(cloud, 1.0, 1.7, -1.5, 0.42, 2.0, 800);
  fillCylinder(cloud, -1.0, 1.7, -1.5, 0.42, 2.0, 800);
  fillEllipsoid(cloud, 0, 2.4, -2.8, 0.55, 0.45, 1.4, 1200);
  fillBox(cloud, 0, 0.55, 0, 5.2, 1.1, 4.4, 4500);
  fillEllipsoid(cloud, 1.8, 1.6, 0.6, 0.9, 0.75, 0.85, 1600);
  cloud.pad();
}

function addMoonGate(cloud) {
  for (let i = 0; i < 18000; i += 1) {
    const x = (cloud.rand() - 0.5) * 16;
    const y = cloud.rand() * 10.2;
    const z = (cloud.rand() - 0.5) * 1.8;
    const dx = x;
    const dy = y - 3.6;
    if (dx * dx + dy * dy < 3.7 * 3.7) continue;
    cloud.push(x, y, z);
  }
  fillTorus(cloud, 0, 3.6, 0, 4.15, 0.85, 9000);
  for (let step = 0; step < 6; step += 1) {
    fillBox(cloud, 0, 0.25 + step * 0.2, 2.6 + step * 0.5, 3.6 - step * 0.18, 0.28, 0.9, 900);
  }
  fillBox(cloud, 0, 9.4, 0, 16, 0.7, 2.0, 2800);
  cloud.pad();
}

function addPagoda(cloud) {
  fillCylinder(cloud, 0, 0.5, 0, 1.1, 1.0, 1600);
  const tiers = 7;
  for (let t = 0; t < tiers; t += 1) {
    const y = 1.1 + t * 1.35;
    const w = 5.6 - t * 0.58;
    fillBox(cloud, 0, y, 0, w * 0.62, 1.05, w * 0.62, 2200 - t * 120);
    fillPyramid(cloud, 0, y + 0.45, 0, w * 1.05, w * 1.05, 0.7, 2600 - t * 140);
  }
  fillCylinder(cloud, 0, 10.6, 0, 0.28, 1.8, 900);
  fillEllipsoid(cloud, 0, 11.5, 0, 0.55, 0.35, 0.55, 700);
  fillBox(cloud, 0, 0.2, 0, 7.5, 0.45, 7.5, 2400);
  cloud.pad();
}

function addLotus(cloud) {
  const petals = 14;
  for (let p = 0; p < petals; p += 1) {
    const base = (p / petals) * Math.PI * 2;
    for (let i = 0; i < 2200; i += 1) {
      const t = cloud.rand();
      const s = (cloud.rand() * 2 - 1) * (0.35 + t * 0.8);
      const thick = (cloud.rand() - 0.5) * (0.35 + (1 - t) * 0.55);
      const len = 0.8 + t * 4.6;
      const flare = Math.sin(t * Math.PI) * (1.25 + t * 0.7);
      const x =
        Math.cos(base) * len + Math.cos(base + Math.PI / 2) * s * flare + Math.cos(base) * thick * 0.2;
      const z =
        Math.sin(base) * len + Math.sin(base + Math.PI / 2) * s * flare + Math.sin(base) * thick * 0.2;
      const y = 1.35 + t * 3.6 + Math.sin(t * Math.PI) * 1.05 + thick * 0.4;
      if (!cloud.push(x, y, z)) break;
    }
  }
  fillEllipsoid(cloud, 0, 3.1, 0, 1.35, 1.1, 1.35, 5200);
  for (let i = 0; i < 3500; i += 1) {
    const a = cloud.rand() * Math.PI * 2;
    const r = 0.4 + Math.sqrt(cloud.rand()) * 5.8;
    cloud.push(Math.cos(a) * r, 0.2 + cloud.rand() * 0.35, Math.sin(a) * r);
  }
  cloud.pad();
}

function addPalaceLantern(cloud) {
  fillCylinder(cloud, 0, 9.0, 0, 0.22, 2.4, 900);
  fillEllipsoid(cloud, 0, 10.1, 0, 0.7, 0.35, 0.7, 900);
  for (let i = 0; i < 16000; i += 1) {
    const a = cloud.rand() * Math.PI * 2;
    const h = cloud.rand();
    const bulge = 1.35 + Math.sin(h * Math.PI) * 1.25;
    const r = Math.sqrt(cloud.rand()) * bulge;
    const y = 2.3 + h * 5.4;
    cloud.push(Math.cos(a) * r, y, Math.sin(a) * r);
  }
  fillBox(cloud, 0, 7.7, 0, 3.8, 0.45, 3.8, 2200);
  fillBox(cloud, 0, 2.2, 0, 3.5, 0.45, 3.5, 2000);
  fillEllipsoid(cloud, 0, 4.9, 0, 1.0, 1.5, 1.0, 2800);
  for (let i = 0; i < 2800; i += 1) {
    const a = cloud.rand() * Math.PI * 2;
    const drop = cloud.rand() * 2.2;
    const r = cloud.rand() * 0.35;
    cloud.push(Math.cos(a) * r, 1.85 - drop, Math.sin(a) * r);
  }
  cloud.pad();
}

function addRitualDing(cloud) {
  for (let i = 0; i < 14000; i += 1) {
    const a = cloud.rand() * Math.PI * 2;
    const h = cloud.rand();
    const bulge = 2.4 + Math.sin(h * Math.PI) * 1.35;
    const r = Math.sqrt(cloud.rand()) * bulge;
    const y = 2.4 + h * 4.2;
    cloud.push(Math.cos(a) * r, y, Math.sin(a) * r);
  }
  fillTorus(cloud, 0, 6.55, 0, 2.55, 0.35, 2800);
  fillBox(cloud, 1.7, 7.5, 0, 0.55, 1.8, 0.35, 900);
  fillBox(cloud, -1.7, 7.5, 0, 0.55, 1.8, 0.35, 900);
  fillCylinder(cloud, 1.6, 1.3, 1.4, 0.35, 2.2, 900);
  fillCylinder(cloud, -1.6, 1.3, 1.4, 0.35, 2.2, 900);
  fillCylinder(cloud, 0, 1.2, -1.8, 0.35, 2.0, 850);
  fillBox(cloud, 0, 0.25, 0, 5.5, 0.5, 5.5, 2200);
  cloud.pad();
}

function addMountainPeak(cloud) {
  fillPyramid(cloud, 0, 0.2, 0, 14, 10, 9.5, 12000);
  fillPyramid(cloud, -5.5, 0.2, -1.5, 8, 7, 6.2, 7000);
  fillPyramid(cloud, 5.2, 0.15, 1.2, 7.5, 6.5, 5.6, 6500);
  fillEllipsoid(cloud, -1.5, 7.8, 0, 2.2, 0.9, 1.6, 2200);
  fillEllipsoid(cloud, 2.2, 6.4, 0.8, 1.8, 0.7, 1.3, 1800);
  fillBox(cloud, 0, 0.15, 0, 18, 0.35, 12, 3500);
  cloud.pad();
}

export function buildScenes(count) {
  const rand = mulberry32(20261019);
  const makers = [
    addBridge,
    addStoneLion,
    addMoonGate,
    addPagoda,
    addLotus,
    addPalaceLantern,
    addRitualDing,
    addMountainPeak,
  ];
  const seeds = [20261019, 7, 11, 19, 29, 37, 41, 53];
  const buffers = makers.map((make, index) => {
    const cloud = new Cloud(count, mulberry32(seeds[index]));
    make(cloud);
    return cloud.pos;
  });

  const jitter = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    let x = rand() * 2 - 1;
    let y = rand() * 2 - 1;
    let z = rand() * 2 - 1;
    const len = Math.hypot(x, y, z) || 1;
    jitter[i * 3] = x / len;
    jitter[i * 3 + 1] = y / len;
    jitter[i * 3 + 2] = z / len;
    seed[i] = rand();
  }

  return {
    scenes: buffers,
    jitter,
    seed,
  };
}

export const SCENE_NAMES = ["古桥", "石狮", "月洞门", "宝塔", "莲花", "宫灯", "青铜鼎", "山峰"];
export const SCENE_COUNT = SCENE_NAMES.length;
