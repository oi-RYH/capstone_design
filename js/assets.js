// 에셋 카탈로그
// ------------------------------------------------------------------
// - 단위는 모두 mm, 위쪽이 +Y 입니다.
// - 길이가 있는 부품(프로파일, 샤프트 등)은 로컬 X축 방향으로 놓이고,
//   원점은 부품의 가운데입니다.
// - params 에 정의한 값만 편집 페이지에서 바꿀 수 있습니다.
//   (크기 조절은 지원하지 않습니다. 길이처럼 실제로 바뀌는 치수만 params 로 둡니다.)
// - 새 부품을 추가하려면 ASSETS 배열에 항목을 하나 더 넣으면 됩니다.

import * as THREE from 'three';

const M = {
  aluminum: new THREE.MeshStandardMaterial({ color: 0xc4cad0, metalness: 0.55, roughness: 0.38 }),
  steel:    new THREE.MeshStandardMaterial({ color: 0xa9b0b6, metalness: 0.8,  roughness: 0.25 }),
  dark:     new THREE.MeshStandardMaterial({ color: 0x2d3338, metalness: 0.3,  roughness: 0.6 }),
  urethane: new THREE.MeshStandardMaterial({ color: 0xd8a03a, metalness: 0.0,  roughness: 0.55 }),
  rubber:   new THREE.MeshStandardMaterial({ color: 0x1d1f21, metalness: 0.0,  roughness: 0.9 }),
  cloth:    new THREE.MeshStandardMaterial({ color: 0xf1f1ec, metalness: 0.0,  roughness: 1.0 }),
  shell:    new THREE.MeshStandardMaterial({ color: 0x8f9aa3, metalness: 0.1,  roughness: 0.45 }),
};

// X축 방향 원기둥 (가운데 원점)
function cylX(r, len, mat, seg = 40) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateZ(Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

// 2020 알루미늄 프로파일 단면 (슬롯 4개 + 가운데 구멍)
function profile2020Shape() {
  const s = new THREE.Shape();
  const o = 10, w = 3, d = 4; // 외곽 반폭, 슬롯 반폭, 슬롯 안쪽 끝
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

export const ASSETS = [
  {
    id: 'profile-2020',
    name: '알루미늄 프로파일 2020',
    category: '프레임',
    spec: '단면 20 × 20 mm',
    params: { length: { label: '길이', unit: 'mm', min: 20, max: 3000, step: 1, default: 600 } },
    build: ({ length }) => {
      const g = new THREE.ExtrudeGeometry(profile2020Shape(), { depth: length, bevelEnabled: false });
      g.rotateY(Math.PI / 2);
      g.translate(-length / 2, 0, 0);
      return new THREE.Mesh(g, M.aluminum);
    },
  },
  {
    id: 'bracket-2020',
    name: '코너 브라켓 2020',
    category: '프레임',
    spec: '20 × 20 × 20 mm, 두께 3 mm',
    params: {},
    build: () => {
      const grp = new THREE.Group();
      const a = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 20), M.aluminum);
      a.position.set(10, 1.5, 0);
      const b = new THREE.Mesh(new THREE.BoxGeometry(3, 20, 20), M.aluminum);
      b.position.set(1.5, 10, 0);
      grp.add(a, b);
      return grp;
    },
  },
  {
    id: 'shaft-10',
    name: '샤프트 Ø10',
    category: '구동',
    spec: '지름 10 mm',
    params: { length: { label: '길이', unit: 'mm', min: 10, max: 1500, step: 1, default: 300 } },
    build: ({ length }) => cylX(5, length, M.steel, 24),
  },
  {
    id: 'roller-urethane-40',
    name: '우레탄 롤러 Ø40',
    category: '구동',
    spec: 'C-ROGAN40-10-50, 외경 40 / 내경 10 / 길이 50 mm',
    params: {},
    build: () => cylX(20, 50, M.urethane),
  },
  {
    id: 'bearing-holder-6900',
    name: '베어링 홀더 6900ZZ',
    category: '구동',
    spec: 'C-BGHA6900ZZ-30, 내경 10 mm',
    params: {},
    build: () => {
      const grp = new THREE.Group();
      const flange = new THREE.Mesh(new THREE.BoxGeometry(6, 42, 42), M.aluminum);
      flange.position.x = -12;
      const body = cylX(14, 24, M.aluminum);
      body.position.x = 3;
      const bore = cylX(5.2, 25, M.dark, 20);
      bore.position.x = 3;
      grp.add(flange, body, bore);
      return grp;
    },
  },
  {
    id: 'coupling-20',
    name: '커플링 Ø20',
    category: '구동',
    spec: 'E-LMPL20, 외경 20 mm',
    params: {},
    build: () => cylX(10, 25, M.steel, 28),
  },
  {
    id: 'motor-37',
    name: 'DC 기어드 모터 Ø37',
    category: '구동',
    spec: '모터부 + 기어부, 출력축 Ø6 (+X 방향)',
    params: {},
    build: () => {
      const grp = new THREE.Group();
      const motor = cylX(18.5, 34, M.dark);
      motor.position.x = -29;
      const gear = cylX(18.5, 24, M.steel);
      gear.position.x = 0;
      const shaft = cylX(3, 16, M.steel, 16);
      shaft.position.x = 20;
      grp.add(motor, gear, shaft);
      return grp;
    },
  },
  {
    id: 'sponge-brush',
    name: '스펀지 브러시 (청소포)',
    category: '세척',
    spec: 'EPDM 보온재 13T + 청소포, 외경 약 40 mm',
    params: { length: { label: '길이', unit: 'mm', min: 20, max: 1000, step: 1, default: 120 } },
    build: ({ length }) => {
      const grp = new THREE.Group();
      grp.add(cylX(20, length, M.cloth));
      return grp;
    },
  },
  {
    id: 'carrier-20',
    name: '20인치 캐리어 (참고용)',
    category: '참고',
    spec: '약 360 × 230 × 550 mm, 바퀴 Ø50',
    params: {},
    build: () => {
      const grp = new THREE.Group();
      const W = 360, D = 230, H = 550, wheelR = 25, lift = 60;
      const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), M.shell);
      body.position.y = lift + H / 2;
      grp.add(body);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(120, 12, 24), M.dark);
      handle.position.y = lift + H + 20;
      grp.add(handle);
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(8, 22, 8), M.dark);
        post.position.set(sx * 54, lift + H + 9, 0);
        grp.add(post);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * (W / 2 - 40), z = sz * (D / 2 - 35);
        const caster = new THREE.Mesh(new THREE.BoxGeometry(30, lift - wheelR * 2 + 12, 30), M.dark);
        caster.position.set(x, wheelR * 2 + (lift - wheelR * 2) / 2, z);
        const wheel = cylX(wheelR, 22, M.rubber, 28);
        wheel.position.set(x, wheelR, z);
        grp.add(caster, wheel);
      }
      return grp;
    },
  },
];

export const ASSET_MAP = Object.fromEntries(ASSETS.map(a => [a.id, a]));

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
