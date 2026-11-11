/* ============================================================================
   VALE VERDE — Simulação 4D da obra (estilo BIM) em Three.js
   ----------------------------------------------------------------------------
   Geometria derivada do pré-projeto:
   • Unidade tipo (planta): ~9,10 × 5,50 m em "L" — quarto 1 em recuo de 2,13 m,
     quarto 2, varanda recuada 0,92 m (guarda-corpo 1,10 m) com JA160 ao fundo,
     banheiro com JA80 alta. Porta para o corredor.
   • Unidades espelhadas em pares (banheiros geminados), duas fileiras por bloco
     com corredor central e escada na fileira sul (implantação).
   • Fachadas: paredes claras, faixas escuras nas varandas/escadas, platibanda,
     caixa d'água sobre a escada. Pé-direito de piso a piso: 2,80 m. 4 pavimentos.
   Coordenadas em px da prancha de implantação (932×853), escala 0,0873 m/px.
============================================================================ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const host = document.getElementById('viewport3d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 900px)').matches;

/* ---------------------------------------------------------------- constantes */
const BASE = 0.15, S = 0.0873, W = 9.10, D = 5.50, H = 2.80, SLAB = 0.12, FLOORS = 4, SH = 0.012;
const PX = x => (x - 400) * S, PZ = y => (y - 400) * S;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const BLOCKS = [
  { name: 'A', rows: [{ face: 'N', y: 65,  seq: [{ x: 90,  n: 4 }] },
                      { face: 'S', y: 210, seq: [{ x: 105, n: 2 }, { x: 365, n: 2 }] }], stair: [318, 350] },
  { name: 'B', rows: [{ face: 'N', y: 290, seq: [{ x: 157, n: 4 }] },
                      { face: 'S', y: 433, seq: [{ x: 172, n: 1 }, { x: 325, n: 2 }] }], stair: [278, 310] },
  { name: 'C', rows: [{ face: 'N', y: 515, seq: [{ x: 282, n: 2 }] },
                      { face: 'S', y: 658, seq: [{ x: 385, n: 1 }] }], stair: [353, 385] },
];
const LOT = [[28,32],[720,28],[700,250],[640,500],[560,700],[480,850],[122,475],[150,447]];
const ROAD_EDGE = [[722,-40],[720,28],[700,250],[640,500],[560,700],[480,850],[440,930]];

/* -------------------------------------------------------------- renderizador */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  host.classList.add('no-webgl');
  host.innerHTML = '<p class="fallback">Seu navegador não suporta WebGL — mostrando a implantação.</p><img src="assets/implantacao.jpg" alt="Planta de implantação">';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const BG = new THREE.Color('#CDD4CB');
const scene = new THREE.Scene();
scene.background = BG;
scene.fog = new THREE.Fog(BG, 120, 300);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(32, 1, 2, 700);

/* ------------------------------------------------------------------- luzes */
const hemi = new THREE.HemisphereLight('#E4ECF2', '#6F6C58', 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#FFF1DE', 2.3);
sun.position.set(48, 82, 62);
sun.castShadow = true;
sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 10, far: 280 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

/* ---------------------------------------------------------------- texturas */
function blockTexture() {                       // bloco de concreto 39×19, junta amarrada
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#9A978F'; g.fillRect(0, 0, 512, 512);
  const bw = 128, bh = 128 / 2.05 * 1.0;
  for (let r = 0, y = 0; y < 512; r++, y += 64) {
    for (let x = -(r % 2) * 64; x < 512; x += 128) {
      const v = 188 + Math.random() * 18 | 0;
      g.fillStyle = `rgb(${v},${v - 3},${v - 9})`;
      g.fillRect(x + 2, y + 2, bw - 4, 60);
      for (let k = 0; k < 40; k++) {             // poros
        g.fillStyle = `rgba(80,76,70,${Math.random() * .12})`;
        g.fillRect(x + Math.random() * bw, y + Math.random() * 60, 2, 2);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
function noiseFill(g, w, h, base, amp, n, size) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const a = (Math.random() - .5) * amp;
    g.fillStyle = a > 0 ? `rgba(255,255,240,${a})` : `rgba(40,30,10,${-a})`;
    const s = size * (.3 + Math.random());
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, s, 0, 7); g.fill();
  }
}

/* -------------------------------------------------------------- materiais */
const M = {
  struct: new THREE.MeshStandardMaterial({ map: blockTexture(), color: '#D9D5CC', roughness: .95, emissive: '#E8822F', emissiveIntensity: 0 }),
  slab:   new THREE.MeshStandardMaterial({ color: '#B4B1A8', roughness: .9 }),
  paint:  new THREE.MeshStandardMaterial({ color: '#E9E6DE', roughness: .82 }),
  dark:   new THREE.MeshStandardMaterial({ color: '#2E3A33', roughness: .62 }),
  glass:  new THREE.MeshStandardMaterial({ color: '#2B3A42', roughness: .06, metalness: .35, envMapIntensity: 1.6 }),
  frame:  new THREE.MeshStandardMaterial({ color: '#F7F7F4', roughness: .35, metalness: .1 }),
  sill:   new THREE.MeshStandardMaterial({ color: '#CFCAC0', roughness: .5 }),
  friso:  new THREE.MeshStandardMaterial({ color: '#C2BDB1', roughness: .7 }),
  soco:   new THREE.MeshStandardMaterial({ color: '#8C8981', roughness: .85 }),
  rail:   new THREE.MeshStandardMaterial({ color: '#23292A', roughness: .35, metalness: .7 }),
  roof:   new THREE.MeshStandardMaterial({ color: '#8C8A84', roughness: .95 }),
  crane:  new THREE.MeshStandardMaterial({ color: '#E9A61B', roughness: .45, metalness: .35 }),
  weight: new THREE.MeshStandardMaterial({ color: '#9A988F', roughness: .9 }),
  ghost:  new THREE.LineBasicMaterial({ color: '#2F7BD8', transparent: true, opacity: .32, depthWrite: false }),
};

/* --------------------------------------------- caixas com UV em escala real */
function box(list, x0, x1, y0, y1, z0, z1) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1),
        az = Math.min(z0, z1), bz = Math.max(z0, z1);
  if (bx - ax < 1e-4 || by - ay < 1e-4 || bz - az < 1e-4) return;
  const g = new THREE.BoxGeometry(bx - ax, by - ay, bz - az);
  g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {           // projeção por eixo — junta dos blocos em escala
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
    if (nx > .5) uv.setXY(i, Z / 1.6, Y / 0.8);
    else if (ny > .5) uv.setXY(i, X / 1.6, Z / 1.6);
    else uv.setXY(i, X / 1.6, Y / 0.8);
  }
  list.push(g);
}
const merge = list => list.length ? mergeGeometries(list, false) : null;

/* ------------------------------------------------- unidade tipo (coord. local)
   lx: 0..W ao longo da fachada · lz: 0 (fachada) → D (corredor) · y por pavimento */
const NOTCH_X = 2.13, NOTCH_Z = 2.15, VAR_X0 = 4.76, VAR_X1 = 7.34, VAR_Z = 0.92;
const UNIT_MASS = [            // [lx0,lx1,lz0,lz1]
  [NOTCH_X, VAR_X0, 0, D], [VAR_X0, VAR_X1, VAR_Z, D], [VAR_X1, W, 0, D], [0, NOTCH_X, NOTCH_Z, D]];
const UNIT_SLAB = [[NOTCH_X, W, 0, D], [0, NOTCH_X, NOTCH_Z, D]];
// janelas: [lx centro, plano lz, largura, peitoril, altura, montante?]
const UNIT_WIN = [
  [1.14, NOTCH_Z - SH, 1.20, 1.00, 1.20, true],      // JA120 quarto 1 (no recuo)
  [3.25, -SH,          1.20, 1.00, 1.20, true],      // JA120 quarto 2
  [6.05, VAR_Z - 0.035, 1.60, 0.03, 2.10, true],     // porta de correr de vidro sala → varanda
  [8.25, -SH,          0.80, 1.60, 0.60, false],     // JA80 banheiro
];

function makeXform(ux, mirror, face, yf) {        // local → mundo
  const fx = lx => ux + (mirror ? W - lx : lx);
  const fz = lz => face === 'N' ? PZ(yf) + lz : PZ(yf) - lz;
  return { fx, fz, out: face === 'N' ? -1 : 1 };
}
function lbox(list, T, lx0, lx1, y0, y1, lz0, lz1) { box(list, T.fx(lx0), T.fx(lx1), y0, y1, T.fz(lz0), T.fz(lz1)); }

function windowGeo(G, T, [cx, zp, w, sill, h, mull]) {
  const x0 = cx - w / 2, x1 = cx + w / 2, fr = 0.055;
  lbox(G.glass, T, x0, x1, sill, sill + h, zp - 0.022, zp - 0.010);
  lbox(G.frame, T, x0 - fr, x1 + fr, sill + h, sill + h + fr, zp - 0.06, zp);             // verga
  lbox(G.frame, T, x0 - fr, x0, sill, sill + h, zp - 0.06, zp);
  lbox(G.frame, T, x1, x1 + fr, sill, sill + h, zp - 0.06, zp);
  lbox(G.frame, T, x0, x1, sill, sill + 0.035, zp - 0.05, zp);
  if (mull) lbox(G.frame, T, cx - 0.02, cx + 0.02, sill, sill + h, zp - 0.05, zp);
  lbox(G.sill, T, x0 - 0.07, x1 + 0.07, sill - 0.045, sill, zp - 0.085, zp);               // peitoril
}

function unitGeo(G, T) {
  for (const [a, b, c, d] of UNIT_MASS) {
    lbox(G.struct, T, a, b, 0, H - SLAB, c, d);
    lbox(G.paint, T, a - SH, b + SH, 0, H, c - SH, d + SH);
    lbox(G.friso, T, a - SH - .01, b + SH + .01, H - .075, H - .02, c - SH - .01, d + SH + .01);   // friso de pavimento
    lbox(G.soco, T, a - SH - .012, b + SH + .012, 0, .45, c - SH - .012, d + SH + .012);           // soco (só térreo)
  }
  for (const [a, b, c, d] of UNIT_SLAB) lbox(G.slab, T, a, b, H - SLAB, H, c, d);
  // varanda: revestimento escuro (fundo + laterais + faixa da laje)
  lbox(G.dark, T, VAR_X0 + SH, VAR_X1 - SH, 0, H, VAR_Z - 0.035, VAR_Z - SH);
  lbox(G.dark, T, VAR_X0 + SH, VAR_X0 + SH + 0.014, 0, H, 0, VAR_Z - SH);
  lbox(G.dark, T, VAR_X1 - SH - 0.014, VAR_X1 - SH, 0, H, 0, VAR_Z - SH);
  lbox(G.dark, T, VAR_X0 + SH, VAR_X1 - SH, H - SLAB - 0.02, H, -0.02, 0.02);
  // guarda-corpo h = 1,10 m: corrimão, travessa e balaústres
  const r0 = VAR_X0 + 0.05, r1 = VAR_X1 - 0.05;
  lbox(G.rail, T, r0, r1, 1.05, 1.10, -0.035, 0.015);
  lbox(G.rail, T, r0, r1, 0.10, 0.14, -0.025, 0.005);
  for (let x = r0; x <= r1 + 1e-6; x += 0.115) lbox(G.rail, T, x, x + 0.022, 0.10, 1.05, -0.02, 0.0);
  for (const w of UNIT_WIN) windowGeo(G, T, w);
}

/* ------------------------------------------------------- montagem dos blocos */
const blocks = [];
const newCats = () => ({ struct: [], slab: [], paint: [], dark: [], glass: [], frame: [], sill: [], rail: [], friso: [], soco: [] });

for (const B of BLOCKS) {
  const G = newCats(), ROOF = { paint: [], roof: [], dark: [], struct: [] }, FOUND = [], GHOST = [];
  const footprints = [];
  let cx0 = -1e9, cx1 = 1e9;
  for (const row of B.rows) {
    let rx0 = 1e9, rx1 = -1e9;
    for (const seg of row.seq) {
      for (let k = 0; k < seg.n; k++) {
        const ux = PX(seg.x) + k * W, mirror = k % 2 === 1;
        const T = makeXform(ux, mirror, row.face, row.y);
        unitGeo(G, T);
        for (const [a, b, c, d] of UNIT_MASS) footprints.push([T.fx(a), T.fx(b), T.fz(c), T.fz(d)]);
        rx0 = Math.min(rx0, ux); rx1 = Math.max(rx1, ux + W);
      }
    }
    row.x0 = rx0; row.x1 = rx1;
    cx0 = Math.max(cx0, rx0); cx1 = Math.min(cx1, rx1);
  }
  const [up, dn] = B.rows;
  const zc0 = PZ(up.y) + D, zc1 = PZ(dn.y) - D;
  // corredor central (fechado) + faixas escuras nas empenas
  box(G.struct, cx0, cx1, 0, H - SLAB, zc0, zc1);
  box(G.paint, cx0, cx1, 0, H, zc0 - SH, zc1 + SH);
  box(G.friso, cx0, cx1, H - .075, H - .02, zc0 - SH - .01, zc1 + SH + .01);
  box(G.slab, cx0, cx1, H - SLAB, H, zc0, zc1);
  box(G.dark, cx0 - 0.03, cx0, 0, H, zc0, zc1); box(G.dark, cx1, cx1 + 0.03, 0, H, zc0, zc1);
  footprints.push([cx0, cx1, zc0, zc1]);
  // escada: núcleo escuro com janelas de ventilação
  const sx0 = PX(B.stair[0]), sx1 = PX(B.stair[1]), sz0 = PZ(dn.y) - D, sz1 = PZ(dn.y) + 0.35;
  box(G.struct, sx0, sx1, 0, H - SLAB, sz0, sz1);
  box(G.dark, sx0 - SH, sx1 + SH, 0, H, sz0, sz1 + SH);
  box(G.slab, sx0, sx1, H - SLAB, H, sz0, sz1);
  const scx = (sx0 + sx1) / 2;
  box(G.glass, scx - 0.35, scx + 0.35, 1.4, 2.4, sz1 + SH, sz1 + SH + 0.012);
  box(G.frame, scx - 0.4, scx + 0.4, 2.4, 2.45, sz1 + SH, sz1 + SH + 0.05);
  footprints.push([sx0, sx1, sz0, sz1]);

  // cobertura: platibanda clara 0,9 m + manta interna; caixa d'água sobre a escada
  const RY = FLOORS * H;
  for (const [a, b, c, d] of footprints) {
    const x0 = Math.min(a, b), x1 = Math.max(a, b), z0 = Math.min(c, d), z1 = Math.max(c, d);
    box(ROOF.paint, x0 - SH, x1 + SH, RY, RY + 0.6, z0 - SH, z0 + 0.15);
    box(ROOF.paint, x0 - SH, x1 + SH, RY, RY + 0.6, z1 - 0.15, z1 + SH);
    box(ROOF.paint, x0 - SH, x0 + 0.15, RY, RY + 0.6, z0, z1);
    box(ROOF.paint, x1 - 0.15, x1 + SH, RY, RY + 0.6, z0, z1);
    box(ROOF.roof, x0 + 0.1, x1 - 0.1, RY, RY + 0.08, z0 + 0.1, z1 - 0.1);
    box(FOUND, x0 - 0.4, x1 + 0.4, -0.25, BASE, z0 - 0.4, z1 + 0.4);           // radier
  }
  box(ROOF.dark, sx0 - SH, sx1 + SH, RY, RY + 2.6, sz0, sz1 + SH);              // casa de máquinas / escada
  box(ROOF.paint, sx0 - 0.5, sx1 + 0.5, RY + 2.6, RY + 4.5, sz0 - 0.4, sz1 + 0.2); // caixa d'água
  box(ROOF.dark, sx0 - 0.52, sx1 + 0.52, RY + 4.5, RY + 4.62, sz0 - 0.42, sz1 + 0.22);

  // fantasma BIM (arestas do volume final)
  const gl = [];
  for (const [a, b, c, d] of footprints) {
    const x0 = Math.min(a, b), x1 = Math.max(a, b), z0 = Math.min(c, d), z1 = Math.max(c, d);
    const g = new THREE.BoxGeometry(x1 - x0, RY + 0.6, z1 - z0); g.translate((x0 + x1) / 2, BASE + (RY + 0.6) / 2, (z0 + z1) / 2);
    gl.push(new THREE.EdgesGeometry(g));
  }
  const ghost = new THREE.LineSegments(mergeGeometries(gl), M.ghost.clone());
  scene.add(ghost);

  // geometria única por bloco, instanciada por pavimento
  const geo = Object.fromEntries(Object.entries(G).map(([k, v]) => [k, merge(v)]));
  const floors = [];
  for (let f = 0; f < FLOORS; f++) {
    const grp = new THREE.Group(); grp.position.y = BASE + f * H; scene.add(grp);
    const mats = {
      struct: M.struct.clone(), paint: M.paint.clone(), dark: M.dark.clone(), friso: M.friso.clone(), soco: M.soco.clone(),
      glass: M.glass.clone(), frame: M.frame.clone(), sill: M.sill.clone(), rail: M.rail.clone(),
    };
    for (const k of ['paint', 'dark', 'friso', 'soco', 'glass', 'frame', 'sill', 'rail']) { mats[k].transparent = true; mats[k].opacity = 0; }
    const mk = (k, mat) => { const m = new THREE.Mesh(geo[k], mat); m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
    floors.push({
      grp, mats,
      struct: mk('struct', mats.struct), slab: mk('slab', M.slab),
      paint: mk('paint', mats.paint), dark: mk('dark', mats.dark), glass: mk('glass', mats.glass),
      frame: mk('frame', mats.frame), sill: mk('sill', mats.sill), rail: mk('rail', mats.rail),
      friso: mk('friso', mats.friso), soco: f === 0 ? mk('soco', mats.soco) : null,
    });
  }
  const roofMats = { paint: M.paint.clone(), dark: M.dark.clone(), roof: M.roof };
  const roof = new THREE.Group(); roof.userData.base = BASE; scene.add(roof);
  for (const k of ['paint', 'roof', 'dark']) {
    const m = new THREE.Mesh(merge(ROOF[k]), roofMats[k]); m.castShadow = m.receiveShadow = true; roof.add(m);
  }
  const found = new THREE.Mesh(merge(FOUND), M.slab); found.receiveShadow = found.castShadow = true; scene.add(found);
  blocks.push({ name: B.name, floors, roof, found, ghost, label: new THREE.Vector3(scx, BASE + RY + 6.5, (sz0 + sz1) / 2) });
}

/* ------------------------------------------------------------ terreno/site */
const SITE = 120, SC = 2048, sx0 = -60, sz0 = -48;            // canvas cobre 120×120 m
const toC = ([x, y]) => [(PX(x) - sx0) / SITE * SC, (PZ(y) - sz0) / SITE * SC];
const m2c = SC / SITE;
function sitePath(g, pts) { g.beginPath(); pts.map(toC).forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
function offsetLine(pts, d) {                                  // desloca polilinha (px) para leste
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = b[1] - a[1], ny = -(b[0] - a[0]); const L = Math.hypot(nx, ny); nx /= L; ny /= L;
    return [p[0] + nx * d / S, p[1] + ny * d / S];
  });
}
function strokeLine(g, pts, wM, color, dash) {
  g.save(); g.strokeStyle = color; g.lineWidth = wM * m2c; g.lineJoin = 'round'; g.lineCap = 'butt';
  if (dash) g.setLineDash(dash.map(v => v * m2c));
  g.beginPath(); pts.map(toC).forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.restore();
}
function drawSite(final) {
  const c = document.createElement('canvas'); c.width = c.height = SC; const g = c.getContext('2d');
  // entorno com borda suave para fundir no chão
  noiseFill(g, SC, SC, '#C4CBBE', .05, 9000, 6);
  const grd = g.createRadialGradient(SC / 2, SC / 2, SC * .3, SC / 2, SC / 2, SC * .5);
  grd.addColorStop(0, 'rgba(196,203,190,0)'); grd.addColorStop(1, 'rgba(196,203,190,1)');
  // rua: calçada + pista + faixas
  const side = offsetLine(ROAD_EDGE, 1.6), road = offsetLine(ROAD_EDGE, 7.4);
  strokeLine(g, side, 3.2, '#D6D2C7');
  strokeLine(g, road, 8.2, '#4A4E50');
  strokeLine(g, offsetLine(ROAD_EDGE, 3.5), 0.15, '#EDEDE6');
  strokeLine(g, offsetLine(ROAD_EDGE, 11.3), 0.15, '#EDEDE6');
  strokeLine(g, road, 0.16, '#E2B13C', [3, 3]);
  // lote
  g.save(); sitePath(g, LOT); g.clip();
  if (final) {
    noiseFill(g, SC, SC, '#8DB15F', .10, 26000, 5);
    // pátios e vias internas
    g.fillStyle = '#D2CEC3';
    [[170, 205, 600, 292], [215, 430, 565, 518], [560, 30, 640, 860]].forEach(([a, b, x, y]) => {
      const [p, q] = toC([a, b]), [r, s] = toC([x, y]); g.fillRect(p, q, r - p, s - q);
    });
    // estacionamento ao longo da frente
    strokeLine(g, offsetLine(ROAD_EDGE, -3.2), 5.4, '#BEB9AD');
    const n = ROAD_EDGE.length - 1;
    for (let i = 0; i <= 64; i++) {
      const t = 0.06 + i / 64 * 0.84, k = Math.min(n - 1, Math.floor(t * n)), f = t * n - k, A = ROAD_EDGE[k], Bp = ROAD_EDGE[k + 1];
      let nx = Bp[1] - A[1], ny = -(Bp[0] - A[0]); const L = Math.hypot(nx, ny); nx /= L; ny /= L;
      const px = A[0] + (Bp[0] - A[0]) * f, py = A[1] + (Bp[1] - A[1]) * f;
      strokeLine(g, [[px - nx * .6 / S, py - ny * .6 / S], [px - nx * 5.8 / S, py - ny * 5.8 / S]], 0.1, '#F4F3EE');
    }
    // calçadas em volta dos blocos
    for (const B of BLOCKS) for (const row of B.rows) {
      const z0 = row.face === 'N' ? PZ(row.y) : PZ(row.y) - D, z1 = z0 + D;
      g.fillStyle = '#DEDAD0';
      g.fillRect((row.x0 - 1.4 - sx0) * m2c, (z0 - 1.4 - sz0) * m2c, (row.x1 - row.x0 + 2.8) * m2c, (D + 2.8) * m2c);
    }
  } else {
    noiseFill(g, SC, SC, '#A4835E', .16, 30000, 7);
    g.globalAlpha = .5; noiseFill(g, SC, SC, 'rgba(0,0,0,0)', .2, 1200, 30); g.globalAlpha = 1;
    // acessos de brita do canteiro
    g.fillStyle = '#B8AC97';
    [[170, 205, 600, 292], [560, 30, 640, 860]].forEach(([a, b, x, y]) => { const [p, q] = toC([a, b]), [r, s] = toC([x, y]); g.fillRect(p, q, r - p, s - q); });
  }
  g.restore();
  sitePath(g, LOT); g.strokeStyle = final ? 'rgba(70,90,60,.5)' : 'rgba(120,80,40,.6)'; g.lineWidth = 0.25 * m2c; g.stroke();
  g.fillStyle = grd; g.fillRect(0, 0, SC, SC);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const groundBig = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: '#C4CBBE', roughness: 1 }));
groundBig.rotation.x = -Math.PI / 2; groundBig.position.y = -0.16; groundBig.receiveShadow = true; scene.add(groundBig);
const siteGeo = new THREE.PlaneGeometry(SITE, SITE); siteGeo.rotateX(-Math.PI / 2); siteGeo.translate(sx0 + SITE / 2, 0, sz0 + SITE / 2);
const siteObra = new THREE.Mesh(siteGeo, new THREE.MeshStandardMaterial({ map: drawSite(false), roughness: 1 }));
siteObra.position.y = -0.09; siteObra.receiveShadow = true; scene.add(siteObra);
const siteFinal = new THREE.Mesh(siteGeo, new THREE.MeshStandardMaterial({ map: drawSite(true), roughness: 1, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
siteFinal.position.y = -0.02; siteFinal.receiveShadow = true; scene.add(siteFinal);

/* ----------------------------------------------------------------- árvores */
function inLot(px, py) {
  let inside = false;
  for (let i = 0, j = LOT.length - 1; i < LOT.length; j = i++) {
    const [xi, yi] = LOT[i], [xj, yj] = LOT[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function trees(list, colorSet) {
  const n = list.length;
  const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 6); trunkGeo.translate(0, 0.5, 0);
  const canopy = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ roughness: .85, flatShading: true }), n * 2);
  const trunk = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#6B5440', roughness: .9 }), n);
  canopy.castShadow = trunk.castShadow = true; canopy.receiveShadow = true;
  const col = new THREE.Color();
  list.forEach((t, i) => {
    col.set(colorSet[i % colorSet.length]).offsetHSL(0, 0, (Math.random() - .5) * .08);
    canopy.setColorAt(i * 2, col); canopy.setColorAt(i * 2 + 1, col.clone().offsetHSL(0, 0, .04));
  });
  scene.add(canopy, trunk);
  const o = new THREE.Object3D();
  return {
    set(fn) {
      list.forEach((t, i) => {
        const k = Math.max(0.0001, fn(t, i)), s = t.s * k, h = t.h * k;
        o.position.set(t.x, 0, t.z); o.rotation.set(0, t.r, 0); o.scale.set(s * .35, h, s * .35); o.updateMatrix(); trunk.setMatrixAt(i, o.matrix);
        o.position.set(t.x, h + s * .7, t.z); o.scale.set(s, s * .82, s); o.updateMatrix(); canopy.setMatrixAt(i * 2, o.matrix);
        o.position.set(t.x + s * .35, h + s * 1.15, t.z - s * .2); o.scale.set(s * .7, s * .62, s * .7); o.updateMatrix(); canopy.setMatrixAt(i * 2 + 1, o.matrix);
      });
      trunk.instanceMatrix.needsUpdate = canopy.instanceMatrix.needsUpdate = true;
    }
  };
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const existing = [];
while (existing.length < 48) {
  const px = 40 + rnd() * 680, py = 40 + rnd() * 800;
  if (inLot(px, py)) existing.push({ x: PX(px), z: PZ(py), s: 1.5 + rnd() * 1.4, h: 2.4 + rnd() * 2.2, r: rnd() * 6, d: rnd() });
}
const oldTrees = trees(existing, ['#4A6B37', '#56783D', '#3E5E33', '#62804A']);
const NEW = [[60, 95, 1.2], [430, 745, 1.25], [240, 560, 1], [605, 95, .9], [405, 690, .85], [470, 805, .9], [120, 255, .85],
  [575, 470, .9], [520, 790, .8], [200, 520, .8], [610, 300, .8], [95, 180, .8], [135, 330, .7], [560, 600, .8]];
const newList = NEW.map(([x, y, k], i) => ({ x: PX(x), z: PZ(y), s: 1.9 * k + rnd() * .4, h: 2.8 * k + rnd(), r: rnd() * 6, d: i / NEW.length }));
for (let x = 110; x < 640; x += 30) newList.push({ x: PX(x), z: PZ(44), s: .9 + rnd() * .3, h: .4, r: rnd() * 6, d: rnd() });
const newTrees = trees(newList, ['#5D8A3F', '#6C9547', '#4E7A38', '#7A9F52']);

/* ------------------------------------------- entorno: casas em maquete de massa */
{
  const edgeM = ROAD_EDGE.map(([x, y]) => [PX(x), PZ(y)]);
  const distRoad = (x, z) => {
    let best = 1e9;
    for (let i = 0; i < edgeM.length - 1; i++) {
      const [ax, az] = edgeM[i], [bx, bz] = edgeM[i + 1], dx = bx - ax, dz = bz - az;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz));
      best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
    }
    return best;
  };
  const houses = [];
  for (let k = 0; k < 900 && houses.length < 70; k++) {
    const x = -95 + rnd() * 190, z = -85 + rnd() * 185;
    const px = x / S + 400, py = z / S + 400;
    if (inLot(px, py) || Math.hypot(x, z) > 100 || Math.hypot(x, z) < 20) continue;
    const dr = distRoad(x, z); if (dr < 15) continue;
    { const ax = -70, az = 88, bx = -3, bz = 6, dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz));
      if (Math.hypot(x - ax - t * dx, z - az - t * dz) < 26) continue; }
    const w = 7 + rnd() * 5, d = 8 + rnd() * 5;
    if (houses.some(h => Math.abs(h.x - x) < (h.w + w) / 2 + 2.5 && Math.abs(h.z - z) < (h.d + d) / 2 + 2.5)) continue;
    // não invadir o lote
    const corners = [[-w, -d], [w, -d], [-w, d], [w, d]].map(([a, b]) => [(x + a / 2) / S + 400, (z + b / 2) / S + 400]);
    if (corners.some(([a, b]) => inLot(a, b))) continue;
    houses.push({ x, z, w, d, h: rnd() < .3 ? 5.8 : 3.1, r: (rnd() - .5) * .25 });
  }
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1); bodyGeo.translate(0, .5, 0);
  const roofGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); roofGeo.rotateY(Math.PI / 4); roofGeo.translate(0, .5, 0);
  const body = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ color: '#E4E3DC', roughness: .92 }), houses.length);
  const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: '#C7B6A2', roughness: .9 }), houses.length);
  const o = new THREE.Object3D();
  houses.forEach((h, i) => {
    o.position.set(h.x, 0, h.z); o.rotation.set(0, h.r, 0); o.scale.set(h.w, h.h, h.d); o.updateMatrix(); body.setMatrixAt(i, o.matrix);
    o.position.set(h.x, h.h, h.z); o.scale.set(h.w * 1.08, 1.6, h.d * 1.08); o.updateMatrix(); roofs.setMatrixAt(i, o.matrix);
  });
  body.castShadow = body.receiveShadow = roofs.castShadow = roofs.receiveShadow = true;
  scene.add(body, roofs);
  // árvores do entorno
  const ctx = [];
  for (let k = 0; k < 600 && ctx.length < 60; k++) {
    const x = -100 + rnd() * 200, z = -90 + rnd() * 190;
    if (inLot(x / S + 400, z / S + 400) || distRoad(x, z) < 13 || Math.hypot(x, z) > 110) continue;
    if (houses.some(h => Math.abs(h.x - x) < h.w / 2 + 2 && Math.abs(h.z - z) < h.d / 2 + 2)) continue;
    ctx.push({ x, z, s: 1.6 + rnd() * 1.6, h: 2.5 + rnd() * 2.5, r: rnd() * 6, d: 0 });
  }
  trees(ctx, ['#7D9467', '#8AA071', '#71895C']).set(() => 1);
}

/* ------------------------------------------------------------ grua (lattice) */
const crane = new THREE.Group(), jib = new THREE.Group();
{
  const C = [], Wt = [], m = 1.6, Hm = 26;
  const post = (x, z) => box(C, x - .08, x + .08, 0, Hm, z - .08, z + .08);
  post(-m / 2, -m / 2); post(m / 2, -m / 2); post(-m / 2, m / 2); post(m / 2, m / 2);
  for (let y = 0; y <= Hm; y += 1.6) {
    box(C, -m / 2, m / 2, y, y + .08, -m / 2 - .04, -m / 2 + .04); box(C, -m / 2, m / 2, y, y + .08, m / 2 - .04, m / 2 + .04);
    box(C, -m / 2 - .04, -m / 2 + .04, y, y + .08, -m / 2, m / 2); box(C, m / 2 - .04, m / 2 + .04, y, y + .08, -m / 2, m / 2);
  }
  box(Wt, -2, 2, 0, .8, -2, 2);                                                   // base
  const J = [], L = 32, Lc = 9;
  box(J, -Lc, L, 0, .1, -.6, -.5); box(J, -Lc, L, 0, .1, .5, .6); box(J, -Lc, L, 1.3, 1.4, -.05, .05);
  for (let x = -Lc; x <= L; x += 2) { box(J, x, x + .07, 0, 1.35, -.55, -.48); box(J, x, x + .07, 0, 1.35, .48, .55); box(J, x, x + .07, 0, .08, -.55, .55); }
  box(J, -1, 1, 1.4, 5.5, -.12, .12);                                             // torre de topo
  box(J, -1.2, 1.2, -2.2, 0, -1, 1);                                              // cabine
  const Wc = []; box(Wc, -Lc, -Lc + 3, -1.6, .2, -.9, .9);                        // contrapeso
  box(J, 19.9, 20.1, -14, 0, -.03, .03);                                          // cabo
  box(Wc, 19.4, 20.6, -15, -14, -.4, .4);                                         // moitão
  const mc = new THREE.Mesh(merge(C), M.crane), mj = new THREE.Mesh(merge(J), M.crane);
  const mw = new THREE.Mesh(merge(Wt), M.weight), mwc = new THREE.Mesh(merge(Wc), M.weight);
  [mc, mj, mw, mwc].forEach(m => { m.castShadow = true; });
  jib.add(mj, mwc); jib.position.y = Hm; crane.add(mc, mw, jib);
  crane.position.set(PX(335), 0, PZ(252));
  scene.add(crane);
}

/* --------------------------------------------------------- linha do tempo 4D */
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const back = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

const T = {
  clear: [0.02, 0.10], found: [0.10, 0.17],
  floor0: 0.17, floorDur: 0.475 / 4,                                   // 4 pavimentos → termina em 0,645
  roof: [0.645, 0.71], finish0: 0.70, finishDur: 0.035, land: [0.87, 0.97], crane: [0.80, 0.87],
};
const PHASES = [
  ['Terraplanagem e fundação', 0.00, T.floor0],
  ['Estrutura · alvenaria estrutural e lajes', T.floor0, T.roof[0]],
  ["Cobertura, platibanda e caixas d'água", T.roof[0], T.finish0 + 0.01],
  ['Fachadas, esquadrias e guarda-corpos', T.finish0 + 0.01, T.land[0]],
  ['Paisagismo, pavimentação e entrega', T.land[0], 1.01],
];

const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(4, 132, 80), new THREE.Vector3(74, 84, 84), new THREE.Vector3(96, 52, 22),
  new THREE.Vector3(48, 44, 104), new THREE.Vector3(-28, 44, 104), new THREE.Vector3(-66, 40, 84)], false, 'centripetal');
const tgt0 = new THREE.Vector3(-2, 0, 4), tgt1 = new THREE.Vector3(-3, 7, 6);
const camTmp = new THREE.Vector3(), tgtTmp = new THREE.Vector3();

const hud = {
  floor: document.getElementById('hudFloor'), month: document.getElementById('hudMonth'),
  bar: document.getElementById('bprog'), phases: [...document.querySelectorAll('#phases li')],
  labels: blocks.map(b => { const s = document.createElement('span'); s.className = 'tag3d'; s.textContent = 'Bloco ' + b.name; host.appendChild(s); return s; }),
};
const sunWarm = new THREE.Color('#FFD7A8'), sunDay = new THREE.Color('#FFF1DE');

function apply(p) {
  // câmera
  const cp = ease(p);
  curve.getPoint(cp, camTmp); camera.position.copy(camTmp);
  tgtTmp.lerpVectors(tgt0, tgt1, cp); camera.lookAt(tgtTmp);
  if (small) fitSmall();                            // celular: blocos inteiros abaixo do cartão
  // vegetação existente sai, terreno vira canteiro, depois paisagismo
  oldTrees.set(t => 1 - easeOut(seg(p, T.clear[0] + t.d * .05, T.clear[0] + t.d * .05 + .03)));
  siteFinal.material.opacity = ease(seg(p, T.land[0], T.land[0] + .05));
  newTrees.set(t => back(seg(p, T.land[0] + .02 + t.d * .06, T.land[0] + .06 + t.d * .06)));
  // grua
  const cu = easeOut(seg(p, 0.07, 0.13)) * (1 - ease(seg(p, T.crane[0], T.crane[1])));
  crane.scale.set(1, Math.max(.001, cu), 1); crane.visible = cu > .002;
  // blocos
  blocks.forEach((b, bi) => {
    const st = bi * 0.012;                                             // A → B → C defasados
    const fd = easeOut(seg(p, T.found[0] + st, T.found[1] + st));
    b.found.position.y = (1 - fd) * -0.45; b.found.visible = fd > 0;
    b.ghost.material.opacity = .36 * (1 - seg(p, T.roof[0], T.finish0 + .05)); b.ghost.visible = b.ghost.material.opacity > .005;
    b.floors.forEach((F, f) => {
      const s0 = T.floor0 + f * T.floorDur + st;
      const wall = seg(p, s0, s0 + T.floorDur * .62), slab = seg(p, s0 + T.floorDur * .58, s0 + T.floorDur * .92);
      F.struct.scale.y = Math.max(.001, easeOut(wall)); F.struct.visible = wall > 0;
      F.slab.visible = slab > 0; F.slab.position.y = (1 - back(slab)) * 3.2;
      F.mats.struct.emissiveIntensity = wall > 0 && wall < 1 ? .55 : .55 * (1 - seg(p, s0 + T.floorDur * .62, s0 + T.floorDur * 1.3));
      const f0 = T.finish0 + f * T.finishDur * .55 + st, fin = seg(p, f0, f0 + T.finishDur);
      const win = seg(p, f0 + T.finishDur * .4, f0 + T.finishDur * 1.3);
      for (const k of ['paint', 'dark', 'friso', 'soco']) { if (!F[k]) continue; F.mats[k].opacity = fin; F[k].visible = fin > 0; F.mats[k].transparent = fin < 1; F.mats[k].depthWrite = fin > .5; }
      for (const k of ['glass', 'frame', 'sill', 'rail']) { F.mats[k].opacity = win; F[k].visible = win > 0; F.mats[k].transparent = win < 1; }
    });
    const r = seg(p, T.roof[0] + st, T.roof[1] + st);
    b.roof.visible = r > 0; b.roof.position.y = BASE + (1 - back(r)) * 4;
    b.roof.children.forEach(m => { if (m.material !== M.roof) { m.material.transparent = r < 1; m.material.opacity = r; } });
  });
  // luz: fim de tarde na entrega
  const warm = seg(p, .9, 1);
  sun.color.copy(sunDay).lerp(sunWarm, warm); sun.intensity = 2.3 + warm * .25;
  // HUD
  const built = clamp(Math.floor((p - T.floor0 + 0.012) / T.floorDur), 0, FLOORS);
  const month = Math.round(seg(p, 0.02, 0.97) * 18);
  hud.floor.textContent = built; hud.month.textContent = month;
  hud.bar.style.transform = `scaleX(${seg(p, 0.02, 0.97)})`;
  hud.phases.forEach((li, i) => {
    const [, a, b] = PHASES[i];
    li.classList.toggle('on', p >= b); li.classList.toggle('now', p >= a && p < b);
  });
  showLabels = p > T.roof[1];
}

/* ------------------------------------------------- rótulos, resize e loop */
let showLabels = false;
const v = new THREE.Vector3();
function placeLabels() {
  const w = host.clientWidth, h = host.clientHeight;
  blocks.forEach((b, i) => {
    const el = hud.labels[i];
    v.copy(b.label).project(camera);
    el.style.transform = `translate(${(v.x * .5 + .5) * w}px, ${(-v.y * .5 + .5) * h}px) translate(-50%,-100%)`;
    el.classList.toggle('show', showLabels && v.z < 1);
  });
}
/* celular: enquadra os 3 blocos na área livre abaixo do cartão */
let safeS = { l: -.95, r: .95, t: .9, b: -.92 };
const BBOX = []; for (const x of [PX(90), PX(575)]) for (const y of [0, FLOORS * H + 5]) for (const z of [PZ(65), PZ(660)]) BBOX.push(new THREE.Vector3(x, y, z));
const pj = new THREE.Vector3(), offS = new THREE.Vector3();
function fitSmall() {
  for (let i = 0; i < 3; i++) {
    camera.updateMatrixWorld();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of BBOX) { pj.copy(c).project(camera); x0 = Math.min(x0, pj.x); x1 = Math.max(x1, pj.x); y0 = Math.min(y0, pj.y); y1 = Math.max(y1, pj.y); }
    const k = Math.max((x1 - x0) / (safeS.r - safeS.l), (y1 - y0) / (safeS.t - safeS.b)) / .92;
    offS.copy(camera.position).sub(tgtTmp).multiplyScalar(clamp(k, .5, 3));
    camera.position.copy(tgtTmp).add(offS); camera.lookAt(tgtTmp);
  }
  const d = camera.position.distanceTo(tgtTmp);       // névoa acompanha a distância
  scene.fog.near = d * .9; scene.fog.far = d * 2.6;
  if (camera.far < d * 4) { camera.far = d * 4; camera.updateProjectionMatrix(); }
}
function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  const card = host.closest('section').querySelector('.hudcard');
  if (!small && card) {
    const shift = card.getBoundingClientRect().right * 0.9;
    camera.setViewOffset(w + shift, h, 0, 0, w, h);
  } else if (card) {                                // celular: centro da cena abaixo do cartão
    const bar = host.closest('section').querySelector('.ctl3d');
    const T = card.offsetTop + card.offsetHeight + 10, B = h - ((bar ? bar.offsetHeight : 50) + 28), px = w / 2, py = (T + B) / 2;
    const fw = w, fh = 2 * Math.max(py, h - py);
    camera.aspect = fw / fh;
    camera.setViewOffset(fw, fh, 0, fh / 2 - py, w, h);
    safeS = { l: -.96, r: .96, t: 1 - T / h * 2, b: 1 - B / h * 2 };
  } else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  dirty = true;
}
new ResizeObserver(resize).observe(host);

let target = reduced ? 1 : (window.__vvBuild || 0), shown = -1, dirty = true, visible = false;

/* --------------------------------------- exploração livre (girar/zoom) */
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: .08, enablePan: false,
  minDistance: 22, maxDistance: 320, maxPolarAngle: THREE.MathUtils.degToRad(82), rotateSpeed: .6, zoomSpeed: .8 });
let explore = false, goal = null;
const ui = host.closest('section').querySelector('.ctl3d');
function setExplore(on) {
  if (explore === on) return;
  explore = on; controls.enabled = on; goal = null;
  host.style.pointerEvents = on ? 'auto' : 'none';
  host.classList.toggle('exploring', on); ui && ui.classList.toggle('on', on);
  if (on) { controls.target.copy(tgtTmp); controls.update(); }
  dirty = true;
}
function nudge(fn) {
  setExplore(true);
  const off = (goal || camera.position).clone().sub(controls.target);
  fn(off); off.setLength(clamp(off.length(), controls.minDistance, controls.maxDistance));
  goal = controls.target.clone().add(off);
}
controls.addEventListener('start', () => { goal = null; });
if (ui) {
  const up = new THREE.Vector3(0, 1, 0);
  ui.querySelector('[data-a="in"]').onclick = () => nudge(o => o.multiplyScalar(.75));
  ui.querySelector('[data-a="out"]').onclick = () => nudge(o => o.multiplyScalar(1.3));
  ui.querySelector('[data-a="left"]').onclick = () => nudge(o => o.applyAxisAngle(up, Math.PI / 4));
  ui.querySelector('[data-a="right"]').onclick = () => nudge(o => o.applyAxisAngle(up, -Math.PI / 4));
  ui.querySelector('[data-a="free"]').onclick = () => setExplore(!explore);
  ui.querySelector('[data-a="reset"]').onclick = () => setExplore(false);
}
window.addEventListener('vv-build', e => { target = e.detail; if (explore && target < .9) setExplore(false); });
new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) loop(); }, { rootMargin: '100px' }).observe(host);

let raf = 0, last = performance.now();
function loop() {
  cancelAnimationFrame(raf);
  if (!visible) return;
  raf = requestAnimationFrame(loop);
  const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
  const prev = shown;
  shown = shown < 0 ? target : shown + (target - shown) * (1 - Math.exp(-dt * 7));   // scrub suave
  if (Math.abs(target - shown) < 1e-4) shown = target;
  if (!reduced && crane.visible) { jib.rotation.y = Math.sin(now / 5200) * .9 + shown * 4; dirty = true; }
  if (ui) ui.classList.toggle('ready', shown > .95);
  if (explore) {                                   // câmera do usuário; obra concluída
    if (dirty || prev !== shown) { const c = camera.position.clone(); apply(1); camera.position.copy(c); }
    if (goal) { camera.position.lerp(goal, 1 - Math.exp(-dt * 8)); if (camera.position.distanceTo(goal) < .05) goal = null; }
    controls.update();
    const d = camera.position.distanceTo(controls.target);   // névoa acompanha o zoom
    scene.fog.near = Math.max(120, d * .9); scene.fog.far = Math.max(300, d * 2.6);
    if (camera.far < d * 4) { camera.far = d * 4; camera.updateProjectionMatrix(); }
    renderer.render(scene, camera); placeLabels(); dirty = false; return;
  }
  if (!small) { scene.fog.near = 120; scene.fog.far = 300; }
  if (dirty || prev !== shown) { apply(shown); renderer.render(scene, camera); placeLabels(); dirty = false; }
}
resize(); apply(target); renderer.render(scene, camera);
host.classList.add('ready');
