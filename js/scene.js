// 뷰어와 편집 페이지가 함께 쓰는 3D 장면 코드
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ASSET_MAP, HARDWARE, resolveParams } from './assets.js';

export const SCENE_URL = 'scene.json';

// scene.json 형식
// {
//   "version": 1,
//   "units": "mm",
//   "objects": [
//     { "id": "p1", "asset": "profile-2020", "name": "...",
//       "params": { "length": 600 },
//       "position": [x, y, z],          // mm
//       "rotation": [rx, ry, rz] }      // 도(degree), XYZ 순서
//   ]
// }

export function emptyScene() {
  return { version: 1, units: 'mm', objects: [] };
}

export async function fetchScene(url = SCENE_URL) {
  const res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} 을(를) 불러오지 못했습니다 (HTTP ${res.status})`);
  return normalizeScene(await res.json());
}

export function normalizeScene(data) {
  if (!data || !Array.isArray(data.objects)) throw new Error('scene.json 형식이 올바르지 않습니다: objects 배열이 없습니다');
  return {
    version: 1,
    units: 'mm',
    objects: data.objects.map((o, i) => ({
      id: String(o.id ?? `obj-${i + 1}`),
      asset: String(o.asset),
      name: String(o.name ?? ASSET_MAP[o.asset]?.name ?? o.asset),
      params: { ...(o.params || {}) },
      position: vec3(o.position),
      rotation: vec3(o.rotation),
    })),
  };
}

function vec3(v) {
  return [0, 1, 2].map(i => {
    const n = Number(v?.[i]);
    return Number.isFinite(n) ? n : 0;
  });
}

// 장면 항목 하나를 3D 오브젝트로 만들기
export function buildObject(entry) {
  const asset = ASSET_MAP[entry.asset];
  const group = new THREE.Group();
  group.name = entry.name;
  let inner;
  if (asset) {
    entry.params = resolveParams(asset, entry.params);
    inner = asset.build(entry.params);
  } else {
    // 카탈로그에 없는 에셋: 빨간 상자로 표시
    inner = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshStandardMaterial({ color: 0xd33 }));
  }
  inner.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(inner);
  applyTransform(group, entry);
  group.userData.entry = entry;
  return group;
}

export function applyTransform(group, entry) {
  group.position.set(...entry.position);
  group.rotation.set(...entry.rotation.map(THREE.MathUtils.degToRad), 'XYZ');
}

export function readTransform(group, entry) {
  const r2 = n => Math.round(n * 100) / 100;
  entry.position = group.position.toArray().map(r2);
  entry.rotation = [group.rotation.x, group.rotation.y, group.rotation.z].map(r => r2(THREE.MathUtils.radToDeg(r)));
}

// 렌더러, 카메라, 조명, 바닥
export function createViewport(container, { background = 0xe9edf0, gridColor = 0xb8c2ca } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(40, 1, 5, 50000);
  camera.position.set(900, 700, 1100);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 150, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a949c, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(800, 1600, 600);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -1500, right: 1500, top: 1500, bottom: -1500, near: 100, far: 5000 });
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.ShadowMaterial({ opacity: 0.18 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 큰 칸 100 mm, 전체 3 m
  const grid = new THREE.GridHelper(3000, 30, gridColor, gridColor);
  grid.material.transparent = true;
  grid.material.opacity = 0.6;
  scene.add(grid);

  const root = new THREE.Group();
  root.name = 'objects';
  scene.add(root);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const tickers = [];
  renderer.setAnimationLoop(() => {
    controls.update();
    for (const t of tickers) t();
    renderer.render(scene, camera);
  });

  return { renderer, scene, camera, controls, root, grid, onTick: fn => tickers.push(fn) };
}

// 장면 전체가 화면에 들어오도록 카메라 맞추기
export function frameObjects(view, objects) {
  const box = new THREE.Box3();
  for (const o of objects) box.expandByObject(o);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const dir = view.camera.position.clone().sub(view.controls.target).normalize();
  const dist = size / (2 * Math.tan(THREE.MathUtils.degToRad(view.camera.fov / 2))) * 1.1;
  view.controls.target.copy(center);
  view.camera.position.copy(center).addScaledVector(dir, Math.max(dist, 300));
  view.controls.update();
}

// 화면 좌표의 오브젝트 찾기
export function pickObject(view, clientX, clientY) {
  const rect = view.renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, view.camera);
  const hits = ray.intersectObjects(view.root.children, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.entry) o = o.parent;
    if (o) return o;
  }
  return null;
}

// ---------------- 자동 체결 부품 그리기 ----------------
const hwProto = {};
export function renderHardware(view, list) {
  let g = view.scene.getObjectByName('hardware');
  if (!g) { g = new THREE.Group(); g.name = 'hardware'; view.scene.add(g); }
  g.clear();
  for (const h of list) {
    if (!hwProto[h.type]) {
      hwProto[h.type] = HARDWARE[h.type].build();
      hwProto[h.type].traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    }
    const o = hwProto[h.type].clone();
    o.matrixAutoUpdate = false;
    o.matrix.copy(h.matrix);
    g.add(o);
  }
}

// ---------------- 경고 표시 (빨간색) ----------------
const RED = new THREE.MeshStandardMaterial({ color: 0xe0453a, emissive: 0x5a0d08, metalness: 0.1, roughness: 0.6 });
export function markProblem(group, bad) {
  group.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData.baseMat) o.userData.baseMat = o.material;
    o.material = bad ? RED : o.userData.baseMat;
  });
}
