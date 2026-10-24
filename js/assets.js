// 에셋 카탈로그
// ------------------------------------------------------------------
// - 단위는 mm, 위쪽이 +Y.
// - 길이가 있는 부품(프로파일, 샤프트 등)은 로컬 X축 방향으로 놓이고 원점은 가운데.
// - params 에 정의한 치수만 편집 페이지에서 바꿀 수 있다 (크기 조절은 없음).
// - kind 는 조립 규칙(js/assembly.js)에서 쓰는 부품 종류:
//     profile       알루미늄 프로파일. 다른 프로파일과 T / ㄱ / 일자로 결합
//     mount         프로파일 옆면에 볼트로 고정되는 부품 (베어링 홀더, 모터 브라켓)
//     shaft         베어링(bore)에 끼워져야 하는 축
//     onshaft       샤프트 위에 끼우는 부품 (롤러, 브러시, 커플링)
//     motor         모터 브라켓(seat)에 고정되는 모터
//     free          제약 없음 (참고용 캐리어 등)
// - 결합점 정의 (모두 로컬 좌표)
//     mount : { point, normal:'x'|'y', along?:'z', boltHeight, bolts:[축 방향 오프셋...] }
//             point 가 프로파일 옆면 위에 놓이고, normal 축이 옆면 바깥쪽을 향해야 한다.
//             along 이 있으면 그 축을 프로파일 길이 방향에 맞춘다.
//     bore  : { origin, dir:'x', half }  샤프트가 지나가는 구멍 (half = 구멍 길이의 절반)
//     seat  : { point, dir:'x' }         모터 앞면이 닿는 자리와 모터 축 방향
//     front : { point, dir:'x', len }    모터 앞면과 출력축 길이
//     onLen : 축 부품의 길이 (축 방향)
//     couplesMotor : 모터 출력축에도 끼울 수 있음 (커플링)
// - 새 부품은 ASSETS 배열에 항목을 추가하면 된다.

import * as THREE from 'three';

export const M = {
  aluminum: new THREE.MeshStandardMaterial({ color: 0xc4cad0, metalness: 0.55, roughness: 0.38 }),
  steel:    new THREE.MeshStandardMaterial({ color: 0xa9b0b6, metalness: 0.8,  roughness: 0.25 }),
  zinc:     new THREE.MeshStandardMaterial({ color: 0x9aa0a5, metalness: 0.6,  roughness: 0.4 }),
  black:    new THREE.MeshStandardMaterial({ color: 0x2b2f33, metalness: 0.4,  roughness: 0.5 }),
  dark:     new THREE.MeshStandardMaterial({ color: 0x2d3338, metalness: 0.3,  roughness: 0.6 }),
  urethane: new THREE.MeshStandardMaterial({ color: 0xd8a03a, metalness: 0.0,  roughness: 0.55 }),
  rubber:   new THREE.MeshStandardMaterial({ color: 0x1d1f21, metalness: 0.0,  roughness: 0.9 }),
  cloth:    new THREE.MeshStandardMaterial({ color: 0xf1f1ec, metalness: 0.0,  roughness: 1.0 }),
  shell:    new THREE.MeshStandardMaterial({ color: 0x8f9aa3, metalness: 0.1,  roughness: 0.45 }),
};

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// X축 방향 원기둥 (가운데 원점)
export function cylX(r, len, mat, seg = 40) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateZ(Math.PI / 2);
  return new THREE.Mesh(g, mat);
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }

// 2020 알루미늄 프로파일 단면 (슬롯 4개 + 가운데 구멍)
function profile2020Shape() {
  const s = new THREE.Shape();
  const o = 10, w = 3, d = 4;
  const pts = [
    [-o,-o],[-w,-o],[-w,-d],[w,-d],[w,-o],[o,-o],
    [o,-w],[d,-w],[d,w],[o,w],[o,o],
    [w,o],[w,d],[-w,d],[-w,o],[-o,o],
    [-o,w],[-d,w],[-d,-w],[-o,-w],
  ];
  s.moveTo(...pts[0]);
  for (let i = 1; i < pts.length; i++) s.lineTo(...pts[i]);
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 2.1, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

// ------------------------------------------------------------------
// 자동 체결 부품 (프로파일 결합, 마운트 고정 시 자동으로 생김)
// ------------------------------------------------------------------
export const HARDWARE = {
  'corner-bracket-2020': {
    name: '2020 코너 브라켓 (L형)',
    spec: '20 × 20 × 20 mm, 두께 3 mm, M5 2구',
    build: () => {
      // 원점 = 안쪽 모서리. 한 날개는 +X 방향(두께 +Y), 다른 날개는 +Y 방향(두께 +X)
      const g = new THREE.Group();
      g.add(box(20, 3, 20, M.zinc, 10, 1.5, 0), box(3, 20, 20, M.zinc, 1.5, 10, 0));
      const rib = new THREE.Shape([new THREE.Vector2(3, 3), new THREE.Vector2(14, 3), new THREE.Vector2(3, 14)]);
      const rg = new THREE.ExtrudeGeometry(rib, { depth: 2, bevelEnabled: false });
      rg.translate(0, 0, -1);
      g.add(new THREE.Mesh(rg, M.zinc));
      return g;
    },
  },
  'straight-plate-2020': {
    name: '2020 일자 연결 플레이트',
    spec: '60 × 20 mm, 두께 4 mm, M5 4구',
    build: () => box(60, 4, 20, M.zinc, 0, 2, 0),
  },
  'bolt-m5': {
    name: 'M5 볼트 (버튼 헤드)',
    spec: '머리 Ø9.5',
    build: () => {
      const g = new THREE.CylinderGeometry(4.75, 4.75, 2.75, 20);
      g.translate(0, 1.375, 0);
      return new THREE.Mesh(g, M.black); // +Y 방향으로 머리
    },
  },
};

// ------------------------------------------------------------------
// 배치 가능한 에셋
// ------------------------------------------------------------------
export const ASSETS = [
  // ---------------- 프레임 ----------------
  {
    id: 'profile-2020',
    name: '알루미늄 프로파일 2020',
    category: '프레임',
    spec: '단면 20 × 20 mm',
    kind: 'profile',
    params: { length: { label: '길이', unit: 'mm', min: 20, max: 3000, step: 1, default: 600 } },
    build: ({ length }) => {
      const g = new THREE.ExtrudeGeometry(profile2020Shape(), { depth: length, bevelEnabled: false });
      g.rotateY(Math.PI / 2);
      g.translate(-length / 2, 0, 0);
      return new THREE.Mesh(g, M.aluminum);
    },
  },

  // ---------------- 베어링 ----------------
  {
    id: 'bearing-holder-6900',
    name: '플랜지 베어링 홀더 6900ZZ',
    category: '베어링',
    spec: 'C-BGHA6900ZZ-30, 내경 10 mm. 축이 프로파일 옆면과 수직',
    kind: 'mount',
    mount: { point: v3(-15, 0, 0), normal: 'x', boltHeight: 6, bolts: [-15, 15] },
    bore: { origin: v3(0, 0, 0), dir: 'x', half: 15 },
    build: () => {
      const g = new THREE.Group();
      g.add(box(6, 42, 42, M.aluminum, -12, 0, 0));
      g.add(at(cylX(14, 24, M.aluminum), 3, 0, 0));
      g.add(at(cylX(5.2, 30.2, M.dark, 20), 0, 0, 0));
      return g;
    },
  },
  {
    id: 'pillow-kp000',
    name: '필로우 블록 KP000',
    category: '베어링',
    spec: '내경 10 mm, 축 높이 약 18 mm. 축이 프로파일 옆면과 평행',
    kind: 'mount',
    mount: { point: v3(0, 0, 0), normal: 'y', along: 'z', boltHeight: 6, bolts: [-26, 26] },
    bore: { origin: v3(0, 18, 0), dir: 'x', half: 6.5 },
    build: () => {
      const g = new THREE.Group();
      g.add(box(13, 6, 64, M.zinc, 0, 3, 0));
      g.add(box(13, 12, 26, M.zinc, 0, 9, 0));
      g.add(at(cylX(15, 13, M.zinc), 0, 18, 0));
      g.add(at(cylX(5.2, 13.2, M.dark, 20), 0, 18, 0));
      return g;
    },
  },

  // ---------------- 구동 ----------------
  {
    id: 'shaft-10',
    name: '샤프트 Ø10',
    category: '구동',
    spec: '지름 10 mm. 베어링에 끼워야 함',
    kind: 'shaft',
    params: { length: { label: '길이', unit: 'mm', min: 10, max: 1500, step: 1, default: 300 } },
    build: ({ length }) => cylX(5, length, M.steel, 24),
  },
  {
    id: 'roller-urethane-40',
    name: '우레탄 롤러 Ø40',
    category: '구동',
    spec: 'C-ROGAN40-10-50, 외경 40 / 내경 10 / 길이 50 mm',
    kind: 'onshaft',
    onLen: 50,
    build: () => cylX(20, 50, M.urethane),
  },
  {
    id: 'coupling-20',
    name: '커플링 Ø20 (6 ↔ 10 mm)',
    category: '구동',
    spec: 'E-LMPL20-6-10. 샤프트나 모터 출력축에 끼움',
    kind: 'onshaft',
    onLen: 25,
    couplesMotor: true,
    build: () => cylX(10, 25, M.steel, 28),
  },
  {
    id: 'motor-37',
    name: 'DC 기어드 모터 Ø37',
    category: '구동',
    spec: '출력축 Ø6 (+X 방향). 37mm 모터 브라켓에 고정',
    kind: 'motor',
    front: { point: v3(12, 0, 0), dir: 'x', len: 16 },
    fixBolts: { name: 'M3 볼트 (모터 고정)', count: 2 },
    build: () => {
      const g = new THREE.Group();
      g.add(at(cylX(18.5, 34, M.dark), -29, 0, 0));
      g.add(cylX(18.5, 24, M.steel));
      g.add(at(cylX(3, 16, M.steel, 16), 20, 0, 0));
      return g;
    },
  },
  {
    id: 'motor-nema17',
    name: 'NEMA17 스텝모터',
    category: '구동',
    spec: '42.3 mm 각, 길이 40 mm, 출력축 Ø5. NEMA17 브라켓에 고정',
    kind: 'motor',
    front: { point: v3(0, 0, 0), dir: 'x', len: 24 },
    fixBolts: { name: 'M3 볼트 (모터 고정)', count: 4 },
    build: () => {
      const g = new THREE.Group();
      g.add(box(40, 42.3, 42.3, M.black, -20, 0, 0));
      g.add(box(8, 42.6, 42.6, M.steel, -36, 0, 0));
      g.add(at(cylX(11, 2, M.steel), 1, 0, 0));
      g.add(at(cylX(2.5, 24, M.steel, 16), 12, 0, 0));
      return g;
    },
  },

  // ---------------- 브라켓 ----------------
  {
    id: 'motor-bracket-37',
    name: '37mm 모터 L 브라켓',
    category: '브라켓',
    spec: '37mm 기어드 모터용, 두께 3 mm. 프로파일 옆면에 고정',
    kind: 'mount',
    mount: { point: v3(16, 0, 0), normal: 'y', boltHeight: 3, bolts: [-12, 12] },
    seat: { point: v3(0, 30, 0), dir: 'x' },
    build: () => {
      const g = new THREE.Group();
      g.add(box(32, 3, 44, M.zinc, 16, 1.5, 0));
      g.add(box(3, 52, 44, M.zinc, 1.5, 26, 0));
      g.add(at(cylX(6.5, 3.4, M.dark, 24), 1.5, 30, 0));
      return g;
    },
  },
  {
    id: 'motor-bracket-nema17',
    name: 'NEMA17 L 브라켓',
    category: '브라켓',
    spec: 'NEMA17 스텝모터용, 두께 3 mm. 프로파일 옆면에 고정',
    kind: 'mount',
    mount: { point: v3(17.5, 0, 0), normal: 'y', boltHeight: 3, bolts: [-12, 12] },
    seat: { point: v3(0, 28, 0), dir: 'x' },
    build: () => {
      const g = new THREE.Group();
      g.add(box(35, 3, 50, M.zinc, 17.5, 1.5, 0));
      g.add(box(3, 56, 50, M.zinc, 1.5, 28, 0));
      g.add(at(cylX(11.5, 3.4, M.dark, 24), 1.5, 28, 0));
      return g;
    },
  },

  // ---------------- 세척 ----------------
  {
    id: 'sponge-brush',
    name: '스펀지 브러시 (청소포)',
    category: '세척',
    spec: 'EPDM 보온재 13T + 청소포, 외경 약 40 mm. 샤프트에 끼움',
    kind: 'onshaft',
    params: { length: { label: '길이', unit: 'mm', min: 20, max: 1000, step: 1, default: 120 } },
    build: ({ length }) => cylX(20, length, M.cloth),
  },

  // ---------------- 참고 ----------------
  {
    id: 'carrier-20',
    name: '20인치 캐리어 (참고용)',
    category: '참고',
    spec: '약 360 × 230 × 550 mm, 바퀴 Ø50. 조립 규칙 없음',
    kind: 'free',
    build: () => {
      const grp = new THREE.Group();
      const W = 360, D = 230, H = 550, wheelR = 25, lift = 60;
      grp.add(box(W, H, D, M.shell, 0, lift + H / 2, 0));
      grp.add(box(120, 12, 24, M.dark, 0, lift + H + 20, 0));
      for (const sx of [-1, 1]) grp.add(box(8, 22, 8, M.dark, sx * 54, lift + H + 9, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * (W / 2 - 40), z = sz * (D / 2 - 35);
        grp.add(box(30, lift - wheelR * 2 + 12, 30, M.dark, x, wheelR * 2 + (lift - wheelR * 2) / 2, z));
        grp.add(at(cylX(wheelR, 22, M.rubber, 28), x, wheelR, z));
      }
      return grp;
    },
  },

  // 예전 버전 호환용 (목록에는 안 보임. 이제 브라켓은 자동으로 생김)
  {
    id: 'bracket-2020',
    name: '코너 브라켓 2020 (수동)',
    category: '숨김',
    hidden: true,
    spec: '',
    kind: 'free',
    build: () => HARDWARE['corner-bracket-2020'].build(),
  },
];

export const ASSET_MAP = Object.fromEntries(ASSETS.map(a => [a.id, a]));

// 축 부품 길이 (params.length 가 있으면 그 값)
export function onLength(asset, params) {
  return params?.length ?? asset.onLen ?? 0;
}

// params 기본값 채우기 + 범위 제한
export function resolveParams(asset, params = {}) {
  const out = {};
  for (const [k, def] of Object.entries(asset.params || {})) {
    let v = Number(params[k]);
    if (!Number.isFinite(v)) v = def.default;
    out[k] = Math.min(def.max, Math.max(def.min, v));
  }
  return out;
}

// ------------------------------------------------------------------
// 평기어 (기어 연결에서 자동으로 만들어짐)
// z: 잇수, m: 모듈, width: 이폭, phase: 이빨 회전 오프셋(rad), bore: 축 구멍 반지름
// 로컬 X 가 회전축, 원점이 기어 가운데, 각도 0 인 이빨이 +Y 방향
// ------------------------------------------------------------------
export const GEAR_MAT = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.5, roughness: 0.35 });
export function buildGear(z, m, width, phase = 0, bore = 5) {
  const ra = m * (z + 2) / 2, rf = m * (z - 2.5) / 2, pa = (Math.PI * 2) / z;
  const s = new THREE.Shape();
  const pt = (r, th) => [-r * Math.sin(th), r * Math.cos(th)];
  for (let i = 0; i < z; i++) {
    const th = phase + i * pa;
    const pts = [pt(rf, th - 0.27 * pa), pt(ra, th - 0.12 * pa), pt(ra, th + 0.12 * pa), pt(rf, th + 0.27 * pa)];
    pts.forEach((p, k) => (i === 0 && k === 0 ? s.moveTo(...p) : s.lineTo(...p)));
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, bore, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 16 });
  g.rotateY(Math.PI / 2);
  g.translate(-width / 2, 0, 0);
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(g, GEAR_MAT));
  const hubR = Math.min(rf * 0.7, bore + 7);
  if (hubR > bore + 1.5) {
    const hub = cylX(hubR, width + 8, GEAR_MAT, 28);
    grp.add(hub);
  }
  return grp;
}
