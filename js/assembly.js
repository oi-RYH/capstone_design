// 조립 규칙
// ------------------------------------------------------------------
// scene.json 에는 각 부품의 위치와 회전만 저장한다.
// 어떤 부품이 어디에 붙어 있는지는 매번 위치로부터 다시 판정한다.
//
//  - 프로파일 + 프로파일 : T자 / ㄱ자 (끝면이 옆면에 닿음), 일자 (끝면끼리 닿음)
//                         → 코너 브라켓 또는 일자 플레이트, M5 볼트, T너트 자동 생성
//  - 마운트(홀더, 모터 브라켓) : 고정면이 프로파일 옆면 위에 있어야 함 → M5 볼트, T너트
//  - 샤프트 : 베어링 구멍을 지나야 함
//  - 축 부품(롤러, 브러시, 커플링) : 샤프트 위에 있어야 함 (커플링은 모터 출력축도 가능)
//  - 모터 : 모터 브라켓 자리에 있어야 함
//  - 결합되지 않은 프로파일끼리 겹치면 경고
//
// 규칙을 어긴 부품도 놓을 수는 있고, 빨간색 경고로 표시된다.

import * as THREE from 'three';
import { ASSET_MAP, HARDWARE, onLength, resolveParams } from './assets.js';

const TOL = 0.6;          // 붙어 있다고 보는 오차 (mm)
const SNAP = 25;          // 자석처럼 붙는 거리 (mm)
const HALF = 10;          // 2020 프로파일 반폭
const PAR = 0.999;        // 평행으로 보는 cos 값 (약 2.5°)
const D2R = THREE.MathUtils.degToRad;
const R2D = THREE.MathUtils.radToDeg;
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

// ---------------- 기본 도구 ----------------
function poseOf(e) {
  return {
    p: new THREE.Vector3(...e.position),
    q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...e.rotation.map(D2R), 'XYZ')),
  };
}
function setPose(e, pose) {
  const r2 = n => Math.round(n * 100) / 100;
  e.position = pose.p.toArray().map(r2);
  const eu = new THREE.Euler().setFromQuaternion(pose.q, 'XYZ');
  e.rotation = [eu.x, eu.y, eu.z].map(r => r2(R2D(r)) + 0);
}
const dirW = (pose, k) => AX[k].clone().applyQuaternion(pose.q);
const ptW = (pose, v) => v.clone().applyQuaternion(pose.q).add(pose.p);
function align(pose, localKey, target, sign = 1) {
  const cur = dirW(pose, localKey).multiplyScalar(sign);
  pose.q.premultiply(new THREE.Quaternion().setFromUnitVectors(cur, target.clone().normalize()));
}
const clonePose = pose => ({ p: pose.p.clone(), q: pose.q.clone() });

function basisMatrix(origin, x, y) {
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  const m = new THREE.Matrix4().makeBasis(x.clone().normalize(), y.clone().normalize(), z);
  m.setPosition(origin);
  return m;
}
function boltMatrix(origin, up) {
  const u = up.clone().normalize();
  const t = Math.abs(u.y) < 0.9 ? AX.y : AX.x;
  const x = new THREE.Vector3().crossVectors(t, u).normalize();
  return basisMatrix(origin, x, u);
}

// 두 프로파일(직육면체)이 실제로 파고드는지 (분리축 판정, margin 만큼은 닿아도 허용)
function boxesOverlap(A, B, margin = 0.5) {
  const ax = [A.a, A.u, A.v], bx = [B.a, B.u, B.v];
  const ha = [A.L / 2, HALF, HALF], hb = [B.L / 2, HALF, HALF];
  const d = B.c.clone().sub(A.c);
  const axes = [...ax, ...bx];
  for (const p of ax) for (const q of bx) {
    const c = new THREE.Vector3().crossVectors(p, q);
    if (c.lengthSq() > 1e-6) axes.push(c.normalize());
  }
  for (const L of axes) {
    const ra = ha.reduce((s, h, i) => s + h * Math.abs(ax[i].dot(L)), 0);
    const rb = hb.reduce((s, h, i) => s + h * Math.abs(bx[i].dot(L)), 0);
    if (Math.abs(d.dot(L)) > ra + rb - margin) return false;
  }
  return true;
}

// ---------------- 부품별 월드 형상 ----------------
function derive(e) {
  const asset = ASSET_MAP[e.asset];
  const pose = poseOf(e);
  const it = { e, asset, kind: asset?.kind ?? 'free', pose };
  if (!asset) return it;
  const params = resolveParams(asset, e.params);
  if (it.kind === 'profile') {
    Object.assign(it, { c: pose.p, a: dirW(pose, 'x'), u: dirW(pose, 'y'), v: dirW(pose, 'z'), L: params.length });
  } else if (it.kind === 'shaft') {
    Object.assign(it, { c: pose.p, a: dirW(pose, 'x'), L: params.length });
  } else if (it.kind === 'onshaft') {
    Object.assign(it, { c: pose.p, a: dirW(pose, 'x'), len: onLength(asset, params) });
  } else if (it.kind === 'motor') {
    it.front = { p: ptW(pose, asset.front.point), d: dirW(pose, asset.front.dir), len: asset.front.len };
  }
  if (asset.mount) {
    it.mount = {
      p: ptW(pose, asset.mount.point),
      n: dirW(pose, asset.mount.normal),
      along: asset.mount.along ? dirW(pose, asset.mount.along) : null,
    };
  }
  if (asset.bore) it.bore = { p: ptW(pose, asset.bore.origin), d: dirW(pose, asset.bore.dir), half: asset.bore.half };
  if (asset.seat) it.seat = { p: ptW(pose, asset.seat.point), d: dirW(pose, asset.seat.dir) };
  return it;
}

function faces(B) {
  return [B.u, B.u.clone().negate(), B.v, B.v.clone().negate()].map(n => ({
    n, w: new THREE.Vector3().crossVectors(n, B.a).normalize(),
  }));
}
function ends(A) {
  return [1, -1].map(s => ({ s, p: A.c.clone().addScaledVector(A.a, s * A.L / 2), o: A.a.clone().multiplyScalar(s) }));
}

// ---------------- 판정 ----------------
export function analyze(objects, links = []) {
  const items = objects.map(derive);
  const profiles = items.filter(i => i.kind === 'profile');
  const problems = new Map();   // id -> 메시지
  const hosts = new Map();      // id -> Set(붙어 있는 대상 id)
  const hardware = [];          // { type, matrix }
  const extra = new Map();      // 볼트처럼 화면에 안 그리는 부품 개수
  const joints = [];
  const addHost = (id, h) => { if (!hosts.has(id)) hosts.set(id, new Set()); hosts.get(id).add(h); };
  const count = (name, n) => extra.set(name, (extra.get(name) || 0) + n);
  const bolt = (p, up) => { hardware.push({ type: 'bolt-m5', matrix: boltMatrix(p, up) }); count('M5 T너트', 1); };

  // 프로파일 결합
  const joined = new Set();
  for (const A of profiles) for (const end of ends(A)) for (const B of profiles) {
    if (A === B) continue;
    for (const f of faces(B)) {
      if (end.o.dot(f.n) > -PAR) continue;
      const rel = end.p.clone().sub(B.c);
      const d = rel.dot(f.n) - HALF, lat = rel.dot(f.w), t = rel.dot(B.a);
      const lim = B.L / 2 - HALF;
      if (Math.abs(d) < TOL && Math.abs(lat) < TOL && Math.abs(t) <= lim + TOL) {
        const flush = Math.abs(Math.abs(t) - lim) < 1;
        joints.push({ type: flush ? 'L' : 'T', A: A.e.id, B: B.e.id });
        addHost(A.e.id, B.e.id);
        joined.add(A.e.id + '|' + B.e.id); joined.add(B.e.id + '|' + A.e.id);
        const sides = flush ? [B.a.clone().multiplyScalar(-Math.sign(t) || 1)] : [B.a.clone(), B.a.clone().negate()];
        for (const dvec of sides) {
          const o = end.p.clone().addScaledVector(dvec, HALF);
          hardware.push({ type: 'corner-bracket-2020', matrix: basisMatrix(o, dvec, f.n) });
          bolt(o.clone().addScaledVector(dvec, 10).addScaledVector(f.n, 3), f.n);
          bolt(o.clone().addScaledVector(f.n, 10).addScaledVector(dvec, 3), dvec);
        }
      }
    }
    if (A.e.id < B.e.id) for (const end2 of ends(B)) {
      if (end.o.dot(end2.o) > -PAR || end.p.distanceTo(end2.p) > TOL) continue;
      joints.push({ type: 'I', A: A.e.id, B: B.e.id });
      addHost(A.e.id, B.e.id); addHost(B.e.id, A.e.id);
      joined.add(A.e.id + '|' + B.e.id); joined.add(B.e.id + '|' + A.e.id);
      for (const u of [A.u, A.u.clone().negate()]) {
        hardware.push({ type: 'straight-plate-2020', matrix: basisMatrix(end.p.clone().addScaledVector(u, HALF), A.a, u) });
        for (const k of [-22, -8, 8, 22]) bolt(end.p.clone().addScaledVector(u, HALF + 4).addScaledVector(A.a, k), u);
      }
    }
  }

  // 결합되지 않은 프로파일 겹침
  for (let i = 0; i < profiles.length; i++) for (let j = i + 1; j < profiles.length; j++) {
    const A = profiles[i], B = profiles[j];
    if (joined.has(A.e.id + '|' + B.e.id)) continue;
    if (boxesOverlap(A, B)) {
      problems.set(A.e.id, `「${B.e.name}」와 겹침. 브라켓으로 결합되는 위치가 아님`);
      problems.set(B.e.id, `「${A.e.name}」와 겹침. 브라켓으로 결합되는 위치가 아님`);
    }
  }

  // 마운트 (홀더, 모터 브라켓)
  for (const M of items.filter(i => i.mount)) {
    let ok = false;
    for (const B of profiles) {
      for (const f of faces(B)) {
        if (M.mount.n.dot(f.n) < PAR) continue;
        if (M.mount.along && Math.abs(M.mount.along.dot(B.a)) < PAR) continue;
        const rel = M.mount.p.clone().sub(B.c);
        const d = rel.dot(f.n) - HALF, lat = rel.dot(f.w), t = rel.dot(B.a);
        if (Math.abs(d) < TOL && Math.abs(lat) < TOL && Math.abs(t) <= B.L / 2 + TOL) {
          ok = true;
          addHost(M.e.id, B.e.id);
          for (const k of M.asset.mount.bolts) bolt(M.mount.p.clone().addScaledVector(f.n, M.asset.mount.boltHeight).addScaledVector(B.a, k), f.n);
          break;
        }
      }
      if (ok) break;
    }
    if (!ok) problems.set(M.e.id, '프로파일 옆면에 고정되어 있지 않음');
  }

  // 샤프트
  const bores = items.filter(i => i.bore);
  const shafts = items.filter(i => i.kind === 'shaft');
  for (const S of shafts) {
    for (const H of bores) {
      if (Math.abs(S.a.dot(H.bore.d)) < PAR) continue;
      const rel = H.bore.p.clone().sub(S.c);
      const ax = rel.dot(S.a);
      const perp = rel.clone().addScaledVector(S.a, -ax).length();
      if (perp < TOL && Math.abs(ax) <= S.L / 2 + TOL) addHost(S.e.id, H.e.id);
    }
    if (!hosts.has(S.e.id)) problems.set(S.e.id, '베어링(홀더)에 끼워져 있지 않음');
  }

  // 모터
  const seats = items.filter(i => i.seat);
  const motors = items.filter(i => i.kind === 'motor');
  for (const Mo of motors) {
    const S = seats.find(s => s.seat.p.distanceTo(Mo.front.p) < TOL && s.seat.d.dot(Mo.front.d) > PAR);
    if (S) { addHost(Mo.e.id, S.e.id); if (Mo.asset.fixBolts) count(Mo.asset.fixBolts.name, Mo.asset.fixBolts.count); }
    else problems.set(Mo.e.id, '모터 브라켓에 고정되어 있지 않음');
  }

  // 축 부품
  for (const P of items.filter(i => i.kind === 'onshaft')) {
    for (const S of shafts) {
      if (S === P || Math.abs(P.a.dot(S.a)) < PAR) continue;
      const rel = P.c.clone().sub(S.c), ax = rel.dot(S.a);
      if (rel.addScaledVector(S.a, -ax).length() < TOL && Math.abs(ax) <= S.L / 2 + TOL) addHost(P.e.id, S.e.id);
    }
    if (P.asset.couplesMotor) for (const Mo of motors) {
      if (Math.abs(P.a.dot(Mo.front.d)) < PAR) continue;
      const rel = P.c.clone().sub(Mo.front.p), ax = rel.dot(Mo.front.d);
      if (rel.addScaledVector(Mo.front.d, -ax).length() < TOL && ax >= -P.len / 2 && ax <= Mo.front.len + P.len / 2) addHost(P.e.id, Mo.e.id);
    }
    if (!hosts.has(P.e.id)) problems.set(P.e.id, P.asset.couplesMotor ? '샤프트나 모터 출력축에 끼워져 있지 않음' : '샤프트에 끼워져 있지 않음');
  }

  // 기어 연결
  const byId = new Map(items.map(i => [i.e.id, i]));
  const gears = links.filter(l => l.type === 'gear').map(l => solveGear(l, byId));
  const linkProblems = new Map(gears.filter(g => g.msg).map(g => [g.link.id, g.msg]));

  // 부품표
  const bom = new Map();
  const addBom = (name, n = 1) => bom.set(name, (bom.get(name) || 0) + n);
  for (const it of items) {
    if (!it.asset) { addBom(`알 수 없는 에셋 (${it.e.asset})`); continue; }
    if (it.asset.category === '참고') continue;
    const len = it.e.params?.length;
    addBom(len ? `${it.asset.name} ${len} mm` : it.asset.name);
  }
  for (const h of hardware) addBom(HARDWARE[h.type].name);
  for (const [k, n] of extra) addBom(k, n);
  for (const g of gears) if (g.zA) {
    addBom(`평기어 모듈 ${g.m} ${g.zA}T`);
    addBom(`평기어 모듈 ${g.m} ${g.zB}T`);
  }

  return { problems, hosts, hardware, joints, bom, gears, linkProblems };
}

// ---------------- 따라오는 부품 ----------------
// id 를 옮기면 같이 움직여야 하는 부품들 (그 부품이 붙어 있는 대상이 전부 같이 움직일 때만)
export function followersOf(id, analysis, objects) {
  const moving = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const o of objects) {
      if (moving.has(o.id)) continue;
      const h = analysis.hosts.get(o.id);
      if (h && h.size && [...h].every(x => moving.has(x))) { moving.add(o.id); grew = true; }
    }
  }
  moving.delete(id);
  return [...moving];
}

// ---------------- 자석 스냅 ----------------
// entry 를 가장 가까운 결합 위치로 옮긴다. 붙었으면 결합 이름을 돌려준다.
export function snapEntry(entry, objects, exclude) {
  const me = derive(entry);
  if (!me.asset) return null;
  const others = objects.filter(o => o.id !== entry.id && !exclude.has(o.id)).map(derive);
  const profiles = others.filter(i => i.kind === 'profile');
  let best = null;
  const consider = (metric, pose, label) => { if (metric < SNAP && (!best || metric < best.metric)) best = { metric, pose, label }; };
  const cosSnap = Math.cos(D2R(25));

  if (me.kind === 'profile') {
    for (const s of [1, -1]) for (const B of profiles) {
      for (const f of faces(B)) {
        if (me.a.clone().multiplyScalar(s).dot(f.n) > -cosSnap) continue;
        const pose = clonePose(me.pose);
        align(pose, 'x', f.n.clone().negate(), s);
        const a = dirW(pose, 'x');
        const ep = pose.p.clone().addScaledVector(a, s * me.L / 2);
        const rel = ep.clone().sub(B.c);
        const d = rel.dot(f.n) - HALF, lat = rel.dot(f.w), t = rel.dot(B.a);
        const lim = B.L / 2 - HALF;
        const tc = Math.abs(Math.abs(t) - lim) < 12 ? Math.sign(t) * lim : THREE.MathUtils.clamp(t, -lim, lim);
        const metric = Math.abs(d) + Math.abs(lat) + Math.abs(t - tc) * (Math.abs(t) > lim ? 1 : 0);
        pose.p.addScaledVector(f.n, -d).addScaledVector(f.w, -lat).addScaledVector(B.a, tc - t);
        consider(metric, pose, Math.abs(Math.abs(tc) - lim) < 1 ? `ㄱ자 결합: ${B.e.name}` : `T자 결합: ${B.e.name}`);
      }
      for (const end2 of ends(B)) {
        if (me.a.clone().multiplyScalar(s).dot(end2.o) > -cosSnap) continue;
        const pose = clonePose(me.pose);
        align(pose, 'x', end2.o.clone().negate(), s);
        const ep = pose.p.clone().addScaledVector(dirW(pose, 'x'), s * me.L / 2);
        const metric = ep.distanceTo(end2.p);
        pose.p.add(end2.p.clone().sub(ep));
        consider(metric, pose, `일자 결합: ${B.e.name}`);
      }
    }
  }

  if (me.mount) {
    const def = me.asset.mount;
    for (const B of profiles) for (const f of faces(B)) {
      if (me.mount.n.dot(f.n) < Math.cos(D2R(40))) continue;
      const pose = clonePose(me.pose);
      align(pose, def.normal, f.n);
      if (def.along) {
        const cur = dirW(pose, def.along);
        align(pose, def.along, B.a.clone().multiplyScalar(cur.dot(B.a) >= 0 ? 1 : -1));
      }
      const mp = ptW(pose, def.point);
      const rel = mp.clone().sub(B.c);
      const d = rel.dot(f.n) - HALF, lat = rel.dot(f.w), t = rel.dot(B.a);
      const tc = THREE.MathUtils.clamp(t, -B.L / 2, B.L / 2);
      const metric = Math.abs(d) + Math.abs(lat) + Math.abs(t - tc);
      pose.p.addScaledVector(f.n, -d).addScaledVector(f.w, -lat).addScaledVector(B.a, tc - t);
      consider(metric, pose, `옆면 고정: ${B.e.name}`);
    }
  }

  if (me.kind === 'shaft' || me.kind === 'onshaft') {
    const lines = [];
    if (me.kind === 'shaft') {
      for (const H of others.filter(i => i.bore)) lines.push({ p: H.bore.p, d: H.bore.d, lo: 0, hi: 0, name: H.e.name, holeIsPoint: true });
    } else {
      for (const S of others.filter(i => i.kind === 'shaft')) lines.push({ p: S.c, d: S.a, lo: -S.L / 2, hi: S.L / 2, name: S.e.name });
      if (me.asset.couplesMotor) for (const Mo of others.filter(i => i.kind === 'motor')) {
        lines.push({ p: Mo.front.p, d: Mo.front.d, lo: 0, hi: Mo.front.len, name: `${Mo.e.name} 출력축` });
      }
    }
    for (const ln of lines) {
      if (Math.abs(me.a.dot(ln.d)) < cosSnap) continue;
      const pose = clonePose(me.pose);
      align(pose, 'x', ln.d.clone().multiplyScalar(me.a.dot(ln.d) >= 0 ? 1 : -1));
      const a = dirW(pose, 'x');
      if (ln.holeIsPoint) {
        // 샤프트: 구멍 중심이 샤프트 선 위에, 샤프트 길이 안에 오도록
        const rel = ln.p.clone().sub(pose.p), ax = rel.dot(a);
        const lim = me.L / 2;
        if (Math.abs(ax) > lim + SNAP) continue;   // 축 방향으로 빼냈으면 붙이지 않음
        const perp = rel.clone().addScaledVector(a, -ax);
        pose.p.add(perp);
        if (Math.abs(ax) > lim) pose.p.addScaledVector(a, ax - Math.sign(ax) * lim);
        consider(perp.length(), pose, `베어링에 끼움: ${ln.name}`);
      } else {
        // 축 부품: 부품 중심이 샤프트 선 위에, 샤프트 범위 안에 오도록
        const rel = pose.p.clone().sub(ln.p), ax = rel.dot(ln.d);
        if (ax < ln.lo - SNAP || ax > ln.hi + SNAP) continue;   // 축 끝 밖으로 빼냈으면 붙이지 않음
        const perp = rel.clone().addScaledVector(ln.d, -ax);
        pose.p.sub(perp);
        const axc = THREE.MathUtils.clamp(ax, ln.lo, ln.hi);
        pose.p.addScaledVector(ln.d, axc - ax);
        consider(perp.length(), pose, `축에 끼움: ${ln.name}`);
      }
    }
  }

  if (me.kind === 'motor') {
    for (const S of others.filter(i => i.seat)) {
      if (me.front.d.dot(S.seat.d) < Math.cos(D2R(40))) continue;
      const pose = clonePose(me.pose);
      align(pose, me.asset.front.dir, S.seat.d);
      const fp = ptW(pose, me.asset.front.point);
      const metric = fp.distanceTo(S.seat.p);
      pose.p.add(S.seat.p.clone().sub(fp));
      consider(metric * 0.6, pose, `브라켓에 고정: ${S.e.name}`);
    }
  }

  if (!best) return null;
  setPose(entry, best.pose);
  return best.label;
}

// ---------------- 기어 ----------------
export const MODULES = [0.5, 0.8, 1, 1.25, 1.5, 2, 2.5, 3];
const Z_MIN = 12, Z_MAX = 150;
const GEAR_TOL = 0.25;     // 축 간 거리 허용 오차 (mm)

// 기어를 끼울 수 있는 축 (샤프트, 모터 출력축)
function axisOf(it) {
  if (!it) return null;
  if (it.kind === 'shaft') return { p: it.c, d: it.a, lo: -it.L / 2, hi: it.L / 2, bore: 5 };
  if (it.kind === 'motor') return { p: it.front.p, d: it.front.d, lo: 0, hi: it.front.len, bore: 3 };
  return null;
}
export function canGear(entry) {
  const k = ASSET_MAP[entry?.asset]?.kind;
  return k === 'shaft' || k === 'motor';
}

// 축 간 거리 D, 기어비 r (= B 회전수 / A 회전수 = zA / zB) 에 맞는 모듈과 잇수
export function pickTeeth(D, r, module = 'auto') {
  const mods = module === 'auto' ? MODULES : [Number(module)];
  let best = null;
  for (const m of mods) {
    const n0 = Math.round((2 * D) / m);
    for (const N of [n0 - 1, n0, n0 + 1]) {
      const zB = Math.round(N / (1 + r)), zA = N - zB;
      if (zA < Z_MIN || zB < Z_MIN || zA > Z_MAX || zB > Z_MAX) continue;
      const need = (m * (zA + zB)) / 2;
      const distErr = Math.abs(need - D);
      const ratioErr = Math.abs(zA / zB - r) / r;
      // 기어비 오차 2% 이내는 거의 같게 보고, 모듈은 1 에 가까운 쪽을 선호
      const score = distErr * 4 + Math.max(0, ratioErr - 0.02) * 40 + ratioErr * 5 + (module === 'auto' ? Math.abs(m - 1) * 0.3 : 0);
      if (!best || score < best.score) best = { m, zA, zB, need, distErr, ratioErr, score };
    }
  }
  return best;
}

function solveGear(link, byId) {
  const out = { link };
  const A = byId.get(link.a), B = byId.get(link.b);
  const ax = axisOf(A), bx = axisOf(B);
  if (!ax || !bx) { out.msg = '연결할 축(샤프트, 모터)이 없음'; return out; }
  if (Math.abs(ax.d.dot(bx.d)) < PAR) { out.msg = '두 축이 평행하지 않음 (평기어는 평행한 축끼리만)'; return out; }

  // 두 축이 축 방향으로 겹치는 구간 (A 축 기준 좌표)
  const proj = t => bx.p.clone().addScaledVector(bx.d, t).sub(ax.p).dot(ax.d);
  const b1 = proj(bx.lo), b2 = proj(bx.hi);
  const lo = Math.max(ax.lo, Math.min(b1, b2)), hi = Math.min(ax.hi, Math.max(b1, b2));
  const pA0 = ax.p.clone().addScaledVector(ax.d, (lo + hi) / 2);
  const relB = pA0.clone().sub(bx.p);
  const footB = bx.p.clone().addScaledVector(bx.d, relB.dot(bx.d));
  const D = pA0.distanceTo(footB);
  out.D = D;
  if (D < 5) { out.msg = '두 축이 같은 선 위에 있음 (커플링으로 연결해야 함)'; return out; }

  const ratio = Math.max(0.05, (link.ratio?.[1] ?? 1) / (link.ratio?.[0] ?? 1));
  const t = pickTeeth(D, ratio, link.module ?? 'auto');
  if (!t) { out.msg = `이 거리(${D.toFixed(1)} mm)와 기어비로 만들 수 있는 기어가 없음 (잇수 ${Z_MIN}~${Z_MAX})`; return out; }
  Object.assign(out, t);
  out.w = Math.min(20, Math.max(6, Math.round(t.m * 10)));
  out.lo = lo; out.hi = hi;

  if (hi - lo < out.w) { out.msg = `두 축이 축 방향으로 겹치는 구간이 기어 폭(${out.w} mm)보다 짧음`; }
  else if (t.distErr > GEAR_TOL) {
    out.msg = `축 간 거리 ${D.toFixed(1)} mm, 맞물리려면 ${t.need.toFixed(1)} mm 필요 (${(t.need - D > 0 ? '+' : '') + (t.need - D).toFixed(1)} mm)`;
  }

  // 기어 위치 (축 방향): link.pos 가 있으면 그 위치, 없으면 겹치는 구간 가운데
  const half = out.w / 2;
  const sA = THREE.MathUtils.clamp(link.pos ?? (lo + hi) / 2, lo + half, Math.max(lo + half, hi - half));
  out.s = sA;
  const cA = ax.p.clone().addScaledVector(ax.d, sA);
  const cB = bx.p.clone().addScaledVector(bx.d, cA.clone().sub(bx.p).dot(bx.d));
  const u = cB.clone().sub(cA).normalize();
  out.u = u;
  out.matA = basisMatrix(cA, ax.d, u);
  out.matB = basisMatrix(cB, ax.d, u.clone().negate());
  out.boreA = ax.bore; out.boreB = bx.bore;
  return out;
}
