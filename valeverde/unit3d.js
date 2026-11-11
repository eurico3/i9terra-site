/* ============================================================================
   VALE VERDE — Planta tipo em 3D (maquete de interiores, estilo BIM 4D)
   ----------------------------------------------------------------------------
   Medidas tiradas da planta do pré-projeto (escala ≈ 89 px/m na prancha):
   quarto casal 8,92 m² · quarto 2 solteiros 9,23 m² · sala/cozinha 18,38 m²
   banheiro acessível 3,36 m² · varanda 1,75 m² (guarda-corpo h=1,10 m)
   Esquadrias: JA120 ×2, porta de correr de vidro sala→varanda, JA80 (banho), portas 80×210.
============================================================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const host = document.getElementById('viewportUnit');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 900px)').matches;

/* ------------------------------------------------------- escala da prancha */
const PPM = 89, OX = 496, OY = 335;
const X = px => (px - OX) / PPM, Z = py => (py - OY) / PPM, L = px => px / PPM;
const WH = 2.6, TE = 0.15, TI = 0.11;              // altura de corte e espessuras
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const back = t => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

/* ------------------------------------------------------------ renderizador */
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
catch (e) {
  host.classList.add('no-webgl');
  host.innerHTML = '<img src="assets/planta.jpg" alt="Planta baixa da unidade tipo">';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const BG = new THREE.Color('#C3CBC1');
const scene = new THREE.Scene();
scene.background = BG;
scene.fog = new THREE.Fog(BG, 45, 110);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.42;
const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 200);

scene.add(new THREE.HemisphereLight('#E6EDF2', '#7A7663', 0.6));
const sun = new THREE.DirectionalLight('#FFEBD2', 2.7);
sun.position.set(9, 10, 6.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
scene.add(sun);

/* ---------------------------------------------------------------- texturas */
function canvasTex(size, draw, rep) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (rep) t.repeat.set(rep, rep); return t;
}
const texBlock = canvasTex(512, (g) => {                 // bloco estrutural 39×19
  g.fillStyle = '#9A978F'; g.fillRect(0, 0, 512, 512);
  for (let r = 0, y = 0; y < 512; r++, y += 64) for (let x = -(r % 2) * 64; x < 512; x += 128) {
    const v = 190 + Math.random() * 16 | 0; g.fillStyle = `rgb(${v},${v - 3},${v - 9})`; g.fillRect(x + 2, y + 2, 124, 60);
  }
});
const tile = (base, grout, n, jitter) => canvasTex(512, (g, s) => {   // porcelanato
  g.fillStyle = grout; g.fillRect(0, 0, s, s); const w = s / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const c = new THREE.Color(base).offsetHSL(0, 0, (Math.random() - .5) * jitter);
    g.fillStyle = '#' + c.getHexString(); g.fillRect(i * w + 1.5, j * w + 1.5, w - 3, w - 3);
    for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .08})`; g.fillRect(i * w + Math.random() * w, j * w + Math.random() * w, 6, 1); }
  }
});
const texFloor = tile('#C2B6A3', '#A39783', 2, .035);      // 60×60 (2 por textura de 1,2 m)
const texBath = tile('#ECEBE7', '#C9C6BF', 4, .015);       // 30×30
const texDeck = tile('#B9A486', '#97846A', 2, .05);
const texWood = canvasTex(256, (g, s) => {
  g.fillStyle = '#9C7A55'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${60 + Math.random() * 40},${40 + Math.random() * 20},20,${.15 + Math.random() * .2})`; g.lineWidth = 1 + Math.random() * 2; const y = Math.random() * s; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s * .3, y + 4, s * .6, y - 4, s, y + 2); g.stroke(); }
});
const texFabric = canvasTex(128, (g, s) => {
  g.fillStyle = '#8E9691'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .06})`; g.fillRect(Math.random() * s, Math.random() * s, 1, 1); }
}, 6);

/* -------------------------------------------------------------- materiais */
const std = (o) => new THREE.MeshStandardMaterial(o);
const MAT = {
  slab: std({ color: '#B2AFA6', roughness: .9 }),
  struct: std({ map: texBlock, color: '#D9D5CC', roughness: .95, emissive: '#E8822F', emissiveIntensity: 0 }),
  paint: std({ color: '#E1DBD0', roughness: .85 }),
  cap: std({ color: '#2E3A33', roughness: .7 }),
  floor: std({ map: texFloor, roughness: .35 }), bath: std({ map: texBath, roughness: .3 }), deck: std({ map: texDeck, roughness: .6 }),
  glass: std({ color: '#4F7383', roughness: .04, metalness: .2, transparent: true, opacity: .58, envMapIntensity: 1.6 }),
  frame: std({ color: '#33393A', roughness: .38, metalness: .45 }),
  sill: std({ color: '#6F6A63', roughness: .35 }),
  door: std({ map: texWood, color: '#C08E5E', roughness: .5 }), doorMain: std({ map: texWood, color: '#8A5E3C', roughness: .5 }),
  rail: std({ color: '#23292A', roughness: .35, metalness: .7 }),
  wood: std({ map: texWood, roughness: .6 }), woodLight: std({ map: texWood, color: '#E9D8C0', roughness: .6 }),
  white: std({ color: '#F7F6F2', roughness: .45 }), linen: std({ color: '#F2EFE8', roughness: .9 }),
  throw: std({ color: '#5E7F68', roughness: .9 }), throw2: std({ color: '#D79A62', roughness: .9 }),
  fabric: std({ map: texFabric, roughness: .95 }), rug: std({ color: '#D8CBB4', roughness: 1 }),
  steel: std({ color: '#C9CCCD', roughness: .25, metalness: .8 }), black: std({ color: '#1D2021', roughness: .4 }),
  granite: std({ color: '#3A3C3B', roughness: .25 }), ceramic: std({ color: '#FBFBF9', roughness: .15 }),
  plant: std({ color: '#4F7B3A', roughness: .8, flatShading: true }), pot: std({ color: '#C46A3C', roughness: .7 }),
  ghost: new THREE.LineBasicMaterial({ color: '#2F7BD8', transparent: true, opacity: .45, depthWrite: false }),
};

/* --------------------------------------------------------------- helpers */
const root = new THREE.Group(); scene.add(root);
function worldUV(g, sc = 1) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    uv.setXY(i, (nx > .5 ? z : x) / sc, (ny > .5 ? z : y) / sc);
  }
  return g;
}
function mesh(geo, mat, parent = root) { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function box(mat, x0, x1, y0, y1, z0, z1, parent, uvScale) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
  const g = new THREE.BoxGeometry(bx - ax, y1 - y0, bz - az); g.translate((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2);
  if (uvScale) worldUV(g, uvScale);
  return mesh(g, mat, parent);
}
function rbox(mat, x0, x1, y0, y1, z0, z1, r, parent) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
  const g = new RoundedBoxGeometry(bx - ax, y1 - y0, bz - az, 3, Math.min(r, (bx - ax) / 2.1, (y1 - y0) / 2.1, (bz - az) / 2.1));
  g.translate((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2);
  return mesh(g, mat, parent);
}
const pxBox = (mat, x0, x1, y0, y1, py0, py1, parent, uv) => box(mat, X(x0), X(x1), y0, y1, Z(py0), Z(py1), parent, uv);
const pxR = (mat, x0, x1, y0, y1, py0, py1, r, parent) => rbox(mat, X(x0), X(x1), y0, y1, Z(py0), Z(py1), r, parent);

/* ---------------------------------------------------------- laje e pisos */
const slabG = new THREE.Group(); root.add(slabG);
pxBox(MAT.slab, 278, 910, -0.14, 0, 85, 585, slabG); pxBox(MAT.slab, 82, 278, -0.14, 0, 282, 585, slabG);
const floorG = new THREE.Group(); root.add(floorG);
const fl = (mat, x0, x1, y0, y1, sc) => { const m = pxBox(mat, x0, x1, 0, 0.012, y0, y1, floorG, sc); m.castShadow = false; return m; };
fl(MAT.floor, 278, 752, 168, 585, 1.2); fl(MAT.floor, 752, 910, 286, 585, 1.2); fl(MAT.floor, 278, 511, 85, 168, 1.2);
fl(MAT.floor, 82, 278, 282, 585, 1.2); fl(MAT.bath, 752, 910, 85, 286, 1.2); fl(MAT.deck, 511, 752, 85, 168, 1.2);

/* ----------------------------------------------------------------- paredes
   [eixo, coord(px), de, até, espessura, aberturas[[a,b,peitoril,topo,tipo]]]  */
const JA = (a, b, s, t) => [a, b, s, t, 'win'], PO = (a, b) => [a, b, 0, 2.1, 'door'];
const WALLS = [
  ['h', 88,  278, 511, TE, [JA(330, 437, 1.0, 2.2)]],          // quarto casal — JA120
  ['h', 88,  752, 910, TE, [JA(818, 872, 1.6, 2.2)]],          // banheiro — JA80
  ['v', 907, 85,  585, TE, []],                                // empena leste (cozinha)
  ['h', 582, 82,  910, TE, [PO(522, 597)]],                    // corredor — porta de entrada
  ['v', 85,  282, 585, TE, []],                                // empena oeste
  ['h', 285, 82,  281, TE, [JA(130, 237, 1.0, 2.2)]],          // recuo — JA120 quarto 2
  ['v', 281, 85,  285, TE, []],
  ['v', 281, 285, 427, TI, []],                                // quarto 2 | quarto casal
  ['v', 511, 85,  429, TI, []],                                // quarto casal | sala
  ['h', 168, 511, 752, TI, [[566, 724, 0, 2.15, 'slide']]],      // sala | varanda — porta de correr de vidro
  ['v', 752, 85,  286, TI, []],                                // banho | varanda
  ['h', 286, 752, 907, TI, [PO(760, 832)]],                    // banho | cozinha
  ['h', 427, 281, 511, TI, [PO(435, 505)]],                    // quarto casal | circulação
  ['v', 432, 427, 582, TI, [PO(440, 511)]],                    // quarto 2 | circulação
];
const walls = [];
WALLS.forEach(([ax, c, a0, a1, t, ops], i) => {
  const g = new THREE.Group(), p = new THREE.Group(), cap = new THREE.Group(), fr = new THREE.Group(), gl = new THREE.Group();
  root.add(g, p, cap, fr, gl);
  const th = L(t) * PPM / PPM; // t em metros
  const half = t / 2, ext = half;
  const piece = (u0, u1, y0, y1) => {           // u ao longo da parede (m, mundo)
    const sh = 0.006;
    if (ax === 'h') {
      box(MAT.struct, u0, u1, y0, y1, Z(c) - half, Z(c) + half, g, 1.6);
      box(MAT.paint, u0 - (u0 === s0 ? sh : 0), u1 + (u1 === s1 ? sh : 0), y0, y1, Z(c) - half - sh, Z(c) + half + sh, p);
      if (y1 === WH) box(MAT.cap, u0 - (u0 === s0 ? sh : 0), u1 + (u1 === s1 ? sh : 0), WH, WH + .02, Z(c) - half - sh, Z(c) + half + sh, cap);
    } else {
      box(MAT.struct, X(c) - half, X(c) + half, y0, y1, u0, u1, g, 1.6);
      box(MAT.paint, X(c) - half - sh, X(c) + half + sh, y0, y1, u0 - (u0 === s0 ? sh : 0), u1 + (u1 === s1 ? sh : 0), p);
      if (y1 === WH) box(MAT.cap, X(c) - half - sh, X(c) + half + sh, WH, WH + .02, u0 - (u0 === s0 ? sh : 0), u1 + (u1 === s1 ? sh : 0), cap);
    }
  };
  const map = ax === 'h' ? X : Z;
  const s0 = map(a0) - ext, s1 = map(a1) + ext;
  let cur = s0;
  for (const [o0, o1, sill, top, type] of ops.sort((a, b) => a[0] - b[0])) {
    const u0 = map(o0), u1 = map(o1);
    piece(cur, u0, 0, WH);
    if (sill > 0) piece(u0, u1, 0, sill);
    piece(u0, u1, top, WH);
    // esquadria
    const mid = (u0 + u1) / 2, w = u1 - u0, f = .05;
    const B = (mat, a, b, y0, y1, d0, d1, parent) => ax === 'h'
      ? box(mat, a, b, y0, y1, Z(c) + d0, Z(c) + d1, parent) : box(mat, X(c) + d0, X(c) + d1, y0, y1, a, b, parent);
    if (type === 'win') {
      B(MAT.frame, u0, u0 + f, sill, top, -half - .01, half + .01, fr); B(MAT.frame, u1 - f, u1, sill, top, -half - .01, half + .01, fr);
      B(MAT.frame, u0, u1, top - f, top, -half - .01, half + .01, fr); B(MAT.frame, u0, u1, sill, sill + .03, -half - .01, half + .01, fr);
      if (w > .9) B(MAT.frame, mid - .02, mid + .02, sill, top, -.03, .03, fr);
      B(MAT.sill, u0 - .05, u1 + .05, sill - .03, sill, -half - .04, half + .04, fr);
      B(MAT.glass, u0 + f, u1 - f, sill + .03, top - f, -.008, .008, gl).castShadow = false;
    } else if (type === 'slide') {                // porta de correr: 2 folhas de vidro, uma aberta ~40%
      B(MAT.frame, u0, u0 + f, 0, top, -half - .01, half + .01, fr); B(MAT.frame, u1 - f, u1, 0, top, -half - .01, half + .01, fr);
      B(MAT.frame, u0, u1, top - f, top, -half - .01, half + .01, fr);
      B(MAT.sill, u0 - .02, u1 + .02, 0, .02, -half - .03, half + .03, fr);                    // soleira
      const pw = (w - 2 * f) / 2 + .03, open = pw * .42;
      const leaf = (a, d) => {
        B(MAT.frame, a, a + .045, .02, top - f, d - .018, d + .018, fr); B(MAT.frame, a + pw - .045, a + pw, .02, top - f, d - .018, d + .018, fr);
        B(MAT.frame, a, a + pw, .02, .1, d - .018, d + .018, fr); B(MAT.frame, a, a + pw, top - f - .05, top - f, d - .018, d + .018, fr);
        B(MAT.glass, a + .045, a + pw - .045, .1, top - f - .05, d - .006, d + .006, gl).castShadow = false;
        B(MAT.frame, a + pw - .07, a + pw - .05, .95, 1.15, d - .03, d + .03, fr);                 // puxador
      };
      leaf(u0 + f, -.025);                                   // fixa
      leaf(u1 - f - pw - open, .025);                        // móvel, parcialmente aberta
    } else {
      B(MAT.frame, u0, u0 + .045, 0, top, -half - .015, half + .015, fr); B(MAT.frame, u1 - .045, u1, 0, top, -half - .015, half + .015, fr);
      B(MAT.frame, u0, u1, top, top + .055, -half - .015, half + .015, fr);
      B(MAT.sill, u0, u1, 0, .015, -half, half, fr);                                           // soleira
    }
    cur = u1;
  }
  piece(cur, s1, 0, WH);
  walls.push({ g, p, cap, fr, gl, i, ext: ax === 'h' ? 'x' : 'z', outer: t === TE });
});

/* -------------------------------------------------------------- portas */
const doorsG = new THREE.Group(); root.add(doorsG);
function doorLeaf(hx, hz, len, dirX, dirZ, mat) {             // folha aberta 90°
  const x1 = hx + dirX * len, z1 = hz + dirZ * len;
  box(mat, Math.min(hx, x1) - (dirX ? 0 : .02), Math.max(hx, x1) + (dirX ? 0 : .02), 0.01, 2.08, Math.min(hz, z1) - (dirZ ? 0 : .02), Math.max(hz, z1) + (dirZ ? 0 : .02), doorsG);
  const ex = hx + dirX * (len - .07), ez = hz + dirZ * (len - .07);                       // maçaneta
  box(MAT.steel, ex - (dirX ? .03 : .045), ex + (dirX ? .03 : .045), 1.02, 1.06, ez - (dirZ ? .03 : .045), ez + (dirZ ? .03 : .045), doorsG);
}
doorLeaf(X(524), Z(582) - .08, .78, 0, -1, MAT.doorMain);     // entrada
doorLeaf(X(504), Z(427) - .06, .7, 0, -1, MAT.door);         // quarto casal
doorLeaf(X(432) - .06, Z(442), .7, -1, 0, MAT.door);         // quarto 2
doorLeaf(X(832), Z(286) + .06, .72, 0, 1, MAT.door);         // banheiro (abre para fora)
// guarda-corpo da varanda h=1,10
const railG = new THREE.Group(); root.add(railG);
pxBox(MAT.rail, 511, 752, 1.05, 1.10, 84, 92, railG); pxBox(MAT.rail, 511, 752, .1, .14, 85, 91, railG);
for (let x = 515; x <= 748; x += 10) pxBox(MAT.rail, x, x + 1.8, .1, 1.05, 86, 90, railG);

/* ------------------------------------------------------------- mobiliário */
const furn = [];                                               // [grupo, cômodo]
function piece(room, build) { const g = new THREE.Group(); root.add(g); build(g); furn.push({ g, room }); return g; }
function bed(g, x0, x1, y0, y1, head, kind) {                   // head: 'r' | 'b' (lado da cabeceira)
  pxR(MAT.woodLight, x0, x1, .12, .34, y0, y1, .03, g);
  pxR(MAT.linen, x0 + 2, x1 - 2, .34, .56, y0 + 2, y1 - 2, .06, g);
  if (head === 'r') {
    pxBox(MAT.wood, x1 - 2, x1 + 3, .1, 1.05, y0 - 2, y1 + 2, g);
    pxR(MAT[kind], x0 - 1, x1 - 50, .54, .6, y0 - 1, y1 + 1, .03, g);
    const n = (y1 - y0) > 100 ? 2 : 1, step = (y1 - y0 - 10) / n;
    for (let i = 0; i < n; i++) pxR(MAT.white, x1 - 42, x1 - 8, .55, .68, y0 + 6 + i * step, y0 + 2 + (i + 1) * step, .05, g);
  } else {
    pxBox(MAT.wood, x0 - 2, x1 + 2, .1, 1.05, y1 - 2, y1 + 3, g);
    pxR(MAT[kind], x0 - 1, x1 + 1, .54, .6, y0 - 1, y1 - 50, .03, g);
    pxR(MAT.white, x0 + 8, x1 - 8, .55, .68, y1 - 42, y1 - 8, .05, g);
  }
}
function wardrobe(g, x0, x1, y0, y1, front) {
  pxR(MAT.woodLight, x0, x1, 0, 2.1, y0, y1, .015, g);
  const n = Math.round(L(x1 - x0) / .5);
  for (let i = 1; i < n; i++) { const x = x0 + (x1 - x0) * i / n; pxBox(MAT.wood, x - .4, x + .4, .05, 2.05, front === 't' ? y0 - .6 : y1 - .2, front === 't' ? y0 + .2 : y1 + .6, g); }
}
function nightstand(g, x0, x1, y0, y1) {
  pxR(MAT.wood, x0, x1, 0, .5, y0, y1, .02, g);
  const cx = X((x0 + x1) / 2), cz = Z((y0 + y1) / 2);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .22, 20), MAT.linen); lamp.position.set(cx, .73, cz); lamp.castShadow = true; g.add(lamp);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .12, 8), MAT.black); st.position.set(cx, .56, cz); g.add(st);
}
function chair(g, x0, x1, y0, y1, backSide) {
  pxR(MAT.wood, x0, x1, .44, .49, y0, y1, .02, g);
  const lg = (a, b) => pxBox(MAT.wood, a, a + 2.2, 0, .44, b, b + 2.2, g);
  lg(x0 + 1, y0 + 1); lg(x1 - 3.2, y0 + 1); lg(x0 + 1, y1 - 3.2); lg(x1 - 3.2, y1 - 3.2);
  if (backSide === 'l') pxR(MAT.wood, x0, x0 + 3, .49, .92, y0, y1, .015, g); else pxR(MAT.wood, x1 - 3, x1, .49, .92, y0, y1, .015, g);
}
function plant(g, px, py, s = 1) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.16 * s, .12 * s, .34 * s, 18), MAT.pot); pot.position.set(X(px), .17 * s, Z(py)); pot.castShadow = true; g.add(pot);
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(new THREE.IcosahedronGeometry(.17 * s, 0), MAT.plant);
    l.position.set(X(px) + Math.cos(i) * .12 * s, (.45 + (i % 3) * .14) * s, Z(py) + Math.sin(i * 1.7) * .12 * s); l.castShadow = true; g.add(l);
  }
}

// Quarto casal (8,92 m²)
piece('q1', g => bed(g, 335, 503, 140, 265, 'r', 'throw'));
piece('q1', g => { nightstand(g, 460, 503, 95, 136); nightstand(g, 460, 503, 270, 312); });
piece('q1', g => wardrobe(g, 288, 430, 372, 423, 't'));
piece('q1', g => { const r = pxBox(MAT.rug, 300, 455, 0.012, 0.022, 270, 360, g); r.castShadow = false; });
// Quarto 2 solteiros (9,23 m²)
piece('q2', g => bed(g, 105, 275, 292, 360, 'r', 'throw2'));
piece('q2', g => bed(g, 93, 168, 405, 575, 'b', 'throw'));
piece('q2', g => wardrobe(g, 285, 427, 527, 577, 't'));
piece('q2', g => nightstand(g, 172, 218, 532, 577));
// Sala / estar
piece('sala', g => {
  pxR(MAT.fabric, 515, 597, .1, .44, 175, 390, .05, g);                        // base
  pxR(MAT.fabric, 515, 534, .4, .85, 175, 390, .06, g);                        // encosto
  pxR(MAT.fabric, 515, 597, .4, .62, 175, 194, .06, g); pxR(MAT.fabric, 515, 597, .4, .62, 371, 390, .06, g);
  for (let i = 0; i < 3; i++) pxR(MAT.fabric, 535, 594, .44, .56, 196 + i * 58, 252 + i * 58, .05, g);
  pxR(MAT.throw2, 540, 556, .56, .78, 200, 222, .05, g);                       // almofadas
  pxR(MAT.throw, 540, 556, .56, .78, 345, 366, .05, g);
});
piece('sala', g => { const r = pxBox(MAT.rug, 605, 700, .012, .022, 200, 365, g); r.castShadow = false;
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .04, 32), MAT.woodLight); t.position.set(X(652), .42, Z(282)); t.castShadow = true; g.add(t);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(.05, .12, .4, 16), MAT.black); b.position.set(X(652), .2, Z(282)); g.add(b); });
piece('sala', g => { pxR(MAT.wood, 708, 745, 0, .48, 185, 285, .02, g); pxBox(MAT.black, 738, 742, .7, 1.32, 192, 278, g); pxBox(MAT.black, 739, 741, .48, .7, 230, 240, g); });
piece('sala', g => {                                                             // mesa de jantar 4 lugares
  pxR(MAT.woodLight, 642, 697, .72, .76, 470, 575, .015, g);
  for (const [a, b] of [[645, 473], [690, 473], [645, 568], [690, 568]]) pxBox(MAT.wood, a, a + 4, 0, .72, b, b + 4, g);
  chair(g, 620, 642, 478, 512, 'l'); chair(g, 620, 642, 533, 567, 'l'); chair(g, 697, 719, 478, 512, 'r'); chair(g, 697, 719, 533, 567, 'r');
  const v = new THREE.Mesh(new THREE.CylinderGeometry(.05, .04, .18, 16), MAT.ceramic); v.position.set(X(669), .85, Z(522)); v.castShadow = true; g.add(v);
});
piece('sala', g => plant(g, 735, 330, 1.1));
// Cozinha / serviço (parede leste)
piece('coz', g => { pxR(MAT.steel, 855, 902, 0, 1.78, 293, 345, .03, g); pxBox(MAT.black, 853, 855, .95, 1.15, 334, 338, g); });
piece('coz', g => { pxR(MAT.white, 846, 900, 0, .88, 356, 410, .03, g);
  const d = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .03, 32), MAT.black); d.rotation.z = Math.PI / 2; d.position.set(X(845), .5, Z(383)); g.add(d); });
piece('coz', g => {
  pxBox(MAT.white, 860, 905, 0, .86, 413, 508, g); pxBox(MAT.granite, 856, 905, .86, .9, 411, 510, g);
  pxBox(MAT.steel, 868, 898, .78, .905, 432, 488, g);
  const f = new THREE.Mesh(new THREE.TorusGeometry(.09, .012, 8, 20, Math.PI), MAT.steel); f.rotation.y = Math.PI / 2; f.position.set(X(900), .98, Z(460)); g.add(f);
  pxBox(MAT.white, 884, 905, 1.5, 2.15, 413, 575, g);                          // armário aéreo
});
piece('coz', g => {
  pxBox(MAT.white, 852, 902, 0, .86, 520, 572, g); pxBox(MAT.black, 852, 902, .86, .9, 520, 572, g);
  for (const [a, b] of [[865, 533], [887, 533], [865, 558], [887, 558]]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(.06, .008, 6, 20), MAT.steel); r.rotation.x = Math.PI / 2; r.position.set(X(a), .905, Z(b)); g.add(r);
  }
  pxBox(MAT.black, 850, 852, .2, .7, 525, 567, g);
});
piece('coz', g => pxR(MAT.steel, 442, 502, 0, 1.0, 513, 572, .02, g));       // shaft / armário de serviço
// Banheiro acessível (3,36 m²)
piece('ban', g => {
  pxR(MAT.ceramic, 772, 808, 0, .78, 92, 108, .03, g);                          // caixa acoplada
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.2, .16, .42, 28), MAT.ceramic); bowl.scale.z = 1.3; bowl.position.set(X(790), .21, Z(134)); bowl.castShadow = true; g.add(bowl);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(.21, .21, .03, 28), MAT.white); seat.scale.z = 1.3; seat.position.set(X(790), .43, Z(134)); g.add(seat);
  pxBox(MAT.steel, 760, 763, .72, .76, 100, 170, g);                           // barra de apoio
});
piece('ban', g => { pxR(MAT.ceramic, 872, 905, .78, .9, 222, 278, .04, g); pxBox(MAT.steel, 897, 903, .9, 1.02, 248, 252, g); pxBox(MAT.glass, 903, 905, 1.1, 1.8, 222, 278, g); });
piece('ban', g => { pxBox(MAT.glass, 854, 857, .02, 1.95, 92, 200, g).castShadow = false; pxBox(MAT.steel, 854, 857, 1.95, 1.98, 92, 200, g);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .02, 20), MAT.steel); sh.position.set(X(880), 2.1, Z(110)); g.add(sh);
  pxBox(MAT.steel, 878, 882, 2.1, 2.2, 92, 112, g); });
// Varanda (1,75 m²)
piece('var', g => { chair(g, 540, 562, 110, 140, 'l'); chair(g, 640, 662, 110, 140, 'r');
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .03, 28), MAT.woodLight); t.position.set(X(600), .6, Z(126)); t.castShadow = true; g.add(t);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .6, 10), MAT.black); s.position.set(X(600), .3, Z(126)); g.add(s);
  plant(g, 728, 122, .9); });

/* ------------------------------------------------------- fantasma BIM */
const ghost = new THREE.Group(); root.add(ghost);
WALLS.forEach(([ax, c, a0, a1, t]) => {
  const g = ax === 'h' ? new THREE.BoxGeometry(L(a1 - a0) + t, WH, t) : new THREE.BoxGeometry(t, WH, L(a1 - a0) + t);
  g.translate(ax === 'h' ? (X(a0) + X(a1)) / 2 : X(c), WH / 2, ax === 'h' ? Z(c) : (Z(a0) + Z(a1)) / 2);
  ghost.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), MAT.ghost));
});

/* ------------------------------------------------- chão de apresentação */
const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#BCC4B9', roughness: 1 }));
shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.y = -0.15; shadowFloor.receiveShadow = true; scene.add(shadowFloor);

/* ---------------------------------------------------------- linha do tempo */
const ROOMS = {
  q1: { name: 'Quarto casal', area: '8,92 m²', px: [395, 330] }, q2: { name: 'Quarto 2', area: '9,23 m²', px: [300, 450] },
  sala: { name: 'Sala / cozinha', area: '18,38 m²', px: [705, 420] }, coz: null,
  ban: { name: 'Banheiro', area: '3,36 m²', px: [820, 190] }, var: { name: 'Varanda', area: '1,75 m²', px: [630, 128] },
};
const ORDER = ['q1', 'q2', 'sala', 'coz', 'ban', 'var'];
const T = { slab: [0.04, 0.12], walls: [0.12, 0.40], frames: [0.38, 0.50], finish: [0.46, 0.58], furn: [0.58, 0.88] };
const PHASES = [[0, T.walls[0]], [T.walls[0], T.frames[0]], [T.frames[0], T.finish[0] + .04], [T.finish[0] + .04, T.furn[0]], [T.furn[0], 1.01]];
furn.forEach(f => { f.order = ORDER.indexOf(f.room); });
const nIn = ORDER.map(r => furn.filter(f => f.room === r).length);

const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.01, 25, 1.2), new THREE.Vector3(-6, 21, 12), new THREE.Vector3(-15, 15, 10),
  new THREE.Vector3(-8, 18, 14), new THREE.Vector3(4, 19.5, 12.5), new THREE.Vector3(2.9, 20, 9.8)], false, 'centripetal');
const tgt0 = new THREE.Vector3(X(496), 0, Z(335)), tgt1 = new THREE.Vector3(X(496), 1.0, Z(335));   // centro do apartamento
const camTmp = new THREE.Vector3(), tgtTmp = new THREE.Vector3();

const hud = {
  rooms: [...document.querySelectorAll('#unitRooms li')], phases: [...document.querySelectorAll('#unitPhases li')],
  bar: document.getElementById('unitBar'),
  labels: Object.entries(ROOMS).filter(([, r]) => r).map(([k, r]) => {
    const el = document.createElement('span'); el.className = 'tag3d room'; el.innerHTML = `${r.name}<small>${r.area}</small>`; host.appendChild(el);
    return { k, el, v: new THREE.Vector3(X(r.px[0]), 1.2, Z(r.px[1])) };
  }),
};
let labelsOn = 0;

function setOpacity(group, o) {
  group.visible = o > 0.001;
  group.traverse(m => { if (m.material && !m.material.userData.shared) {
    if (!m.material.userData.cloned) { m.material = m.material.clone(); m.material.userData.cloned = true; m.material.userData.base = m.material.opacity; }
    m.material.transparent = o < 1 || m.material.userData.base < 1; m.material.opacity = o * m.material.userData.base; m.material.depthWrite = o > .5 && m.material.userData.base === 1; } });
}

function apply(p) {
  const cp = ease(p);
  curve.getPoint(cp, camTmp); camera.position.copy(camTmp); tgtTmp.lerpVectors(tgt0, tgt1, cp); camera.lookAt(tgtTmp);
  fitCamera();                                                                       // planta inteira no espaço livre

  const sl = easeOut(seg(p, ...T.slab)); slabG.position.y = (sl - 1) * .5; slabG.visible = sl > 0;
  ghost.children.forEach(l => { l.material.opacity = .45 * (1 - seg(p, T.walls[1] - .05, T.frames[1])); }); ghost.visible = p < T.frames[1];

  walls.forEach((w, i) => {
    const s0 = T.walls[0] + (i / walls.length) * (T.walls[1] - T.walls[0] - .07), t = seg(p, s0, s0 + .07);
    w.g.scale.y = Math.max(.001, easeOut(t)); w.g.visible = t > 0;
    w.g.children.forEach(m => { m.material = m.material === MAT.struct ? (w.mat ||= MAT.struct.clone()) : m.material; });
    if (w.mat) w.mat.emissiveIntensity = t > 0 && t < 1 ? .5 : .5 * (1 - seg(p, s0 + .07, s0 + .14));
    const fr = seg(p, T.frames[0] + i * .006, T.frames[0] + i * .006 + .05);
    setOpacity(w.fr, fr); setOpacity(w.gl, fr);
    const fi = seg(p, T.finish[0] + i * .004, T.finish[0] + i * .004 + .05);
    setOpacity(w.p, fi); setOpacity(w.cap, fi);
  });
  setOpacity(doorsG, seg(p, T.frames[0] + .06, T.frames[1]));
  setOpacity(railG, seg(p, T.frames[0] + .03, T.frames[1]));
  setOpacity(floorG, seg(p, T.finish[0], T.finish[1]));

  const span = T.furn[1] - T.furn[0], per = span / ORDER.length;
  const count = {};
  furn.forEach(f => {
    const k = count[f.room] = (count[f.room] || 0) + 1;
    const s0 = T.furn[0] + f.order * per + (k - 1) / nIn[f.order] * per * .55, t = seg(p, s0, s0 + per * .6);
    f.g.visible = t > 0; f.g.position.y = (1 - back(t)) * 1.6;
    f.g.scale.setScalar(.9 + .1 * easeOut(t));
  });
  // HUD
  hud.bar.style.transform = `scaleX(${seg(p, 0.02, 0.97)})`;
  hud.phases.forEach((li, i) => { const [a, b] = PHASES[i]; li.classList.toggle('on', p >= b); li.classList.toggle('now', p >= a && p < b); });
  hud.rooms.forEach(li => {
    const o = ORDER.indexOf(li.dataset.room), done = p >= T.furn[0] + (o + .6) * per, now = p >= T.furn[0] + o * per && !done;
    li.classList.toggle('on', done || p >= T.furn[1]); li.classList.toggle('now', now);
  });
  labelsOn = seg(p, T.furn[1] - .02, T.furn[1] + .04);
}

/* --------------------------------------- exploração livre (girar/zoom) */
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: .08, enablePan: false,
  minDistance: 7, maxDistance: 70, maxPolarAngle: THREE.MathUtils.degToRad(80), rotateSpeed: .7, zoomSpeed: .8 });
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
  fn(off);
  off.setLength(clamp(off.length(), controls.minDistance, controls.maxDistance));
  goal = controls.target.clone().add(off);
}
controls.addEventListener('start', () => { goal = null; });
if (ui) {
  const up = new THREE.Vector3(0, 1, 0);
  ui.querySelector('[data-a="in"]').onclick = () => nudge(o => o.multiplyScalar(.78));
  ui.querySelector('[data-a="out"]').onclick = () => nudge(o => o.multiplyScalar(1.28));
  ui.querySelector('[data-a="left"]').onclick = () => nudge(o => o.applyAxisAngle(up, Math.PI / 4));
  ui.querySelector('[data-a="right"]').onclick = () => nudge(o => o.applyAxisAngle(up, -Math.PI / 4));
  ui.querySelector('[data-a="free"]').onclick = () => setExplore(!explore);
  ui.querySelector('[data-a="reset"]').onclick = () => setExplore(false);
}

/* ---------------------------------------------- rótulos, resize, loop */
const v = new THREE.Vector3();
function placeLabels() {
  const w = host.clientWidth, h = host.clientHeight;
  hud.labels.forEach(({ el, v: p }) => {
    v.copy(p).project(camera);
    el.style.transform = `translate(${(v.x * .5 + .5) * w}px, ${(-v.y * .5 + .5) * h}px) translate(-50%,-100%)`;
    el.style.opacity = labelsOn;
  });
}
let fitK = 1, safe = { l: -.95, r: .95, t: .9, b: -.9 };
const BOX = []; for (const x of [X(82), X(910)]) for (const y of [0, WH]) for (const z of [Z(85), Z(585)]) BOX.push(new THREE.Vector3(x, y, z));
const pv = new THREE.Vector3(), offV = new THREE.Vector3();
function fitCamera() {                             // 3 iterações: projeta a caixa e ajusta a distância
  for (let i = 0; i < 3; i++) {
    camera.updateMatrixWorld();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of BOX) { pv.copy(c).project(camera); x0 = Math.min(x0, pv.x); x1 = Math.max(x1, pv.x); y0 = Math.min(y0, pv.y); y1 = Math.max(y1, pv.y); }
    const k = Math.max((x1 - x0) / (safe.r - safe.l), (y1 - y0) / (safe.t - safe.b)) / .86;
    offV.copy(camera.position).sub(tgtTmp).multiplyScalar(clamp(k, .5, 3));
    camera.position.copy(tgtTmp).add(offV);
    camera.lookAt(tgtTmp);
  }
}
const FIT_R = 6.1, FIT_BASE = 22;                                                     // raio da maquete · distância de referência
function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  // área livre = tela − painel (esq. no desktop / topo no celular) − barra de controles
  const sec = host.closest('section'), card = sec.querySelector('.hudcard'), bar = sec.querySelector('.ctl3d');
  const L = (!small && card) ? card.offsetLeft + card.offsetWidth + 24 : 12;
  const T = (small && card) ? card.offsetTop + card.offsetHeight + 12 : 64;
  const B = h - ((bar ? bar.offsetHeight : 50) + 34);
  const R = w - 16;
  // centro desejado: meio da área livre, um pouco acima (ponto de foco da câmera = centro do apartamento)
  const px = small ? w / 2 : Math.max(L + (R - L) * .3, (L + R) / 2 - w * .07), py = (T + B) / 2 - h * .08;
  const fw = 2 * Math.max(px, w - px), fh = 2 * Math.max(py, h - py);
  camera.aspect = fw / fh;
  camera.setViewOffset(fw, fh, fw / 2 - px, fh / 2 - py, w, h);
  camera.updateProjectionMatrix();
  safe = { l: L / w * 2 - 1, r: R / w * 2 - 1, t: 1 - T / h * 2, b: 1 - B / h * 2 };
  dirty = true;
}
new ResizeObserver(resize).observe(host);
let target = reduced ? 1 : (window.__vvUnit || 0), shown = -1, dirty = true, visible = false;
window.addEventListener('vv-unit', e => { target = e.detail; if (explore && target < .9) setExplore(false); });
new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) loop(); }, { rootMargin: '100px' }).observe(host);
let raf = 0, last = performance.now();
function loop() {
  cancelAnimationFrame(raf); if (!visible) return; raf = requestAnimationFrame(loop);
  const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
  const prev = shown;
  shown = shown < 0 ? target : shown + (target - shown) * (1 - Math.exp(-dt * 7));
  if (Math.abs(target - shown) < 1e-4) shown = target;
  if (ui) ui.classList.toggle('ready', shown > .9);
  if (explore) {                                   // câmera do usuário; maquete completa
    if (dirty || prev !== shown) { const c = camera.position.clone(); apply(1); camera.position.copy(c); }
    if (goal) { camera.position.lerp(goal, 1 - Math.exp(-dt * 8)); if (camera.position.distanceTo(goal) < .01) goal = null; }
    controls.update(); renderer.render(scene, camera); placeLabels(); dirty = false; return;
  }
  if (dirty || prev !== shown) { apply(shown); renderer.render(scene, camera); placeLabels(); dirty = false; }
}
resize(); apply(target); renderer.render(scene, camera);
host.classList.add('ready');
