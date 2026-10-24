// 편집 페이지
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { ASSETS, ASSET_MAP, resolveParams } from './assets.js';
import {
  createViewport, fetchScene, normalizeScene, emptyScene, buildObject,
  applyTransform, readTransform, frameObjects, pickObject, renderHardware, markProblem, renderLinks,
} from './scene.js';
import { analyze, snapEntry, followersOf, canGear, MODULES } from './assembly.js';

const DRAFT_KEY = 'carrycarry-scene-draft';
const $ = id => document.getElementById(id);

// ---------------- 상태 ----------------
const state = {
  objects: [],          // scene.json 의 objects
  groups: new Map(),    // id -> THREE.Group
  selectedId: null,
  baseline: '',         // 마지막으로 불러오거나 저장한 상태 (변경 여부 표시용)
  analysis: null,       // 조립 판정 결과
  drag: null,           // 드래그 중 따라오는 부품
  alt: false,           // Alt 누르는 동안 자석 끄기
  links: [],            // 기어 연결 (scene.json 의 links)
  selectedLinkId: null, // 선택한 기어 연결
  secondId: null,       // Shift+클릭으로 고른 두 번째 부품
};
const history = { stack: [], index: -1 };

// ---------------- 3D 화면 ----------------
const view = createViewport($('view'));
const tc = new TransformControls(view.camera, view.renderer.domElement);
tc.setSize(0.9);
view.scene.add(tc.getHelper());
tc.addEventListener('dragging-changed', e => { view.controls.enabled = !e.value; });
tc.addEventListener('mouseDown', () => {
  const g = tc.object;
  if (!g) return;
  const ids = followersOf(g.userData.entry.id, state.analysis, state.objects);
  const inv = g.matrix.clone().invert();
  state.drag = {
    exclude: new Set([g.userData.entry.id, ...ids]),
    followers: ids.map(id => {
      const fg = state.groups.get(id);
      fg.updateMatrix();
      return { g: fg, rel: inv.clone().multiply(fg.matrix) };
    }),
  };
});
tc.addEventListener('objectChange', () => {
  const g = tc.object;
  if (!g) return;
  const entry = g.userData.entry;
  readTransform(g, entry);
  let label = null;
  if (!state.alt && state.drag) {
    label = snapEntry(entry, state.objects, state.drag.exclude);
    if (label) applyTransform(g, entry);
  }
  if (state.drag) {
    g.updateMatrix();
    for (const f of state.drag.followers) {
      f.g.matrix.copy(g.matrix).multiply(f.rel);
      f.g.matrix.decompose(f.g.position, f.g.quaternion, f.g.scale);
      readTransform(f.g, f.g.userData.entry);
    }
  }
  showSnapHint(label);
  fillTransformInputs();
  selBox.update();
  scheduleRefresh();
});
tc.addEventListener('mouseUp', () => {
  state.drag = null;
  showSnapHint(null);
  commit();
  refreshAssembly();
});

const selBox = new THREE.BoxHelper(undefined, 0xffb400);
selBox.visible = false;
view.scene.add(selBox);
const secondBox = new THREE.BoxHelper(undefined, 0x2f6fd0);
secondBox.visible = false;
view.scene.add(secondBox);
view.onTick(() => { if (selBox.visible) selBox.update(); if (secondBox.visible) secondBox.update(); });

// ---------------- 조립 판정 ----------------
let refreshQueued = false;
function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => { refreshQueued = false; refreshAssembly(); });
}

function refreshAssembly() {
  const a = state.analysis = analyze(state.objects, state.links);
  renderHardware(view, a.hardware);
  renderLinks(view, a.gears, a.linkProblems);
  for (const [id, g] of state.groups) markProblem(g, a.problems.has(id));
  for (const li of $('outliner').children) {
    li.classList.toggle('bad', li.dataset.link ? a.linkProblems.has(li.dataset.link) : a.problems.has(li.dataset.id));
  }

  const n = a.problems.size + a.linkProblems.size;
  $('warn-count').textContent = n ? `${n}개` : '';
  const ul = $('warnings');
  ul.innerHTML = '';
  if (!n) {
    ul.innerHTML = '<li class="empty">모든 부품이 규칙대로 조립되어 있습니다.</li>';
  } else {
    for (const [id, msg] of a.problems) {
      const e = state.objects.find(o => o.id === id);
      const li = document.createElement('li');
      li.innerHTML = `<b></b><span></span>`;
      li.querySelector('b').textContent = e?.name ?? id;
      li.querySelector('span').textContent = msg;
      li.onclick = () => select(id);
      ul.appendChild(li);
    }
    for (const [id, msg] of a.linkProblems) {
      const l = state.links.find(x => x.id === id);
      const li = document.createElement('li');
      li.innerHTML = `<b></b><span></span>`;
      li.querySelector('b').textContent = l ? linkName(l) : id;
      li.querySelector('span').textContent = msg;
      li.onclick = () => selectLink(id);
      ul.appendChild(li);
    }
  }
  const tb = $('bom');
  tb.innerHTML = '';
  for (const [name, cnt] of [...a.bom].sort((x, y) => x[0].localeCompare(y[0], 'ko'))) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td></td><td></td>';
    tr.children[0].textContent = name;
    tr.children[1].textContent = cnt;
    tb.appendChild(tr);
  }
  const j = { T: 0, L: 0, I: 0 };
  for (const x of a.joints) j[x.type]++;
  $('joint-sum').textContent = `T자 ${j.T} · ㄱ자 ${j.L} · 일자 ${j.I}`;
  renderPropsStatus();
  renderLinkInfo();
}

function renderPropsStatus() {
  const e = selectedEntry();
  const box = $('p-status');
  if (!e || !state.analysis) { box.hidden = true; return; }
  const msg = state.analysis.problems.get(e.id);
  box.hidden = false;
  box.className = msg ? 'status bad' : 'status ok';
  if (msg) { box.textContent = msg; return; }
  const h = state.analysis.hosts.get(e.id);
  const names = h ? [...h].map(id => state.objects.find(o => o.id === id)?.name ?? id) : [];
  box.textContent = names.length ? `고정됨: ${names.join(', ')}` : '규칙 위반 없음';
}

function showSnapHint(label) {
  const el = $('snap-hint');
  el.hidden = !label;
  if (label) el.textContent = label;
}

// ---------------- 장면 다루기 ----------------
function snapshot() { return JSON.stringify({ o: state.objects, l: state.links }); }

function loadObjects(objects, links = [], { keepSelection = false } = {}) {
  const prevSel = state.selectedId, prevLink = state.selectedLinkId;
  select(null);
  for (const g of state.groups.values()) view.root.remove(g);
  state.groups.clear();
  state.objects = objects;
  state.links = links;
  for (const e of state.objects) addGroup(e);
  renderOutliner();
  if (keepSelection && prevSel && state.groups.has(prevSel)) select(prevSel);
  else if (keepSelection && prevLink && state.links.some(l => l.id === prevLink)) selectLink(prevLink);
}

function addGroup(entry) {
  const g = buildObject(entry);
  view.root.add(g);
  state.groups.set(entry.id, g);
  return g;
}

function rebuild(id) {
  const old = state.groups.get(id);
  const entry = old.userData.entry;
  const wasSel = state.selectedId === id;
  if (wasSel) tc.detach();
  view.root.remove(old);
  const g = addGroup(entry);
  if (wasSel) { tc.attach(g); selBox.setFromObject(g); }
  scheduleRefresh();
}

function resetHistory() {
  history.stack = [snapshot()];
  history.index = 0;
  updateUndoButtons();
}

function commit() {
  const s = snapshot();
  if (s === history.stack[history.index]) return;
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(s);
  if (history.stack.length > 200) history.stack.shift();
  history.index = history.stack.length - 1;
  afterChange();
}

function restore(i) {
  history.index = i;
  const snap = JSON.parse(history.stack[i]);
  loadObjects(snap.o, snap.l, { keepSelection: true });
  afterChange();
}

function afterChange() {
  updateUndoButtons();
  refreshAssembly();
  const dirty = snapshot() !== state.baseline;
  $('dirty').textContent = dirty ? '저장 안 한 변경 있음' : '';
  try {
    if (dirty) localStorage.setItem(DRAFT_KEY, JSON.stringify(sceneData()));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* 브라우저 저장소를 못 쓰는 환경 */ }
}

function sceneData() {
  return { version: 1, units: 'mm', objects: state.objects, links: state.links };
}

function updateUndoButtons() {
  $('undo').disabled = history.index <= 0;
  $('redo').disabled = history.index >= history.stack.length - 1;
}

function uniqueId(base) {
  let n = 1;
  while (state.objects.some(o => o.id === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function uniqueName(base) {
  if (!state.objects.some(o => o.name === base)) return base;
  let n = 2;
  while (state.objects.some(o => o.name === `${base} ${n}`)) n++;
  return `${base} ${n}`;
}

function addAsset(assetId) {
  const asset = ASSET_MAP[assetId];
  const t = view.controls.target;
  const r10 = v => Math.round(v / 10) * 10;
  const entry = {
    id: uniqueId(assetId),
    asset: assetId,
    name: uniqueName(asset.name),
    params: resolveParams(asset, {}),
    position: [r10(t.x), Math.max(0, r10(t.y)), r10(t.z)],
    rotation: [0, 0, 0],
  };
  state.objects.push(entry);
  addGroup(entry);
  renderOutliner();
  select(entry.id);
  commit();
}

function duplicateSelected() {
  const src = selectedEntry();
  if (!src) return;
  const entry = structuredClone(src);
  entry.id = uniqueId(src.asset);
  entry.name = uniqueName(src.name);
  entry.position = [entry.position[0] + 40, entry.position[1], entry.position[2] + 40];
  state.objects.push(entry);
  addGroup(entry);
  renderOutliner();
  select(entry.id);
  commit();
}

function deleteSelected() {
  if (state.selectedLinkId) return deleteLink(state.selectedLinkId);
  const id = state.selectedId;
  if (!id) return;
  select(null);
  view.root.remove(state.groups.get(id));
  state.groups.delete(id);
  state.objects = state.objects.filter(o => o.id !== id);
  state.links = state.links.filter(l => l.a !== id && l.b !== id); // 그 부품에 걸린 기어 연결도 삭제
  renderOutliner();
  commit();
}

function selectedEntry() {
  return state.objects.find(o => o.id === state.selectedId) || null;
}

// ---------------- 선택 ----------------
function select(id) {
  state.selectedId = id;
  state.selectedLinkId = null;
  setSecond(null, true);
  const g = id ? state.groups.get(id) : null;
  if (g) {
    tc.attach(g);
    selBox.setFromObject(g);
    selBox.visible = true;
  } else {
    tc.detach();
    selBox.visible = false;
  }
  markOutlinerSelection();
  renderProps();
}

function markOutlinerSelection() {
  for (const li of $('outliner').children) {
    li.classList.toggle('sel', li.dataset.link ? li.dataset.link === state.selectedLinkId : li.dataset.id === state.selectedId);
    li.classList.toggle('second', !!li.dataset.id && li.dataset.id === state.secondId);
  }
  const sel = $('outliner').querySelector('.sel');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

// Shift+클릭으로 두 번째 부품 고르기 (기어 연결용)
function setSecond(id, silent = false) {
  if (id && id === state.selectedId) id = null;
  state.secondId = id;
  const g = id ? state.groups.get(id) : null;
  secondBox.visible = !!g;
  if (g) secondBox.setFromObject(g);
  if (!silent) { markOutlinerSelection(); renderProps(); }
}

function selectLink(id) {
  select(null);
  state.selectedLinkId = id;
  markOutlinerSelection();
  renderProps();
}

let down = null;
view.renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, onGizmo: tc.axis !== null }; });
view.renderer.domElement.addEventListener('pointerup', e => {
  if (!down || e.button !== 0) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4;
  if (!moved && !down.onGizmo) {
    const g = pickObject(view, e.clientX, e.clientY);
    if (g?.userData.link) selectLink(g.userData.link.id);
    else if (g && e.shiftKey && state.selectedId) setSecond(g.userData.entry.id);
    else select(g ? g.userData.entry.id : null);
  }
  down = null;
});

// ---------------- 패널 ----------------
function renderAssets() {
  const box = $('assets');
  const visible = ASSETS.filter(a => !a.hidden);
  const cats = [...new Set(visible.map(a => a.category))];
  for (const c of cats) {
    const h = document.createElement('div');
    h.className = 'cat';
    h.textContent = c;
    box.appendChild(h);
    for (const a of visible.filter(x => x.category === c)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'asset';
      b.innerHTML = `${a.name}<small>${a.spec}</small>`;
      b.onclick = () => addAsset(a.id);
      box.appendChild(b);
    }
  }
}

function renderOutliner() {
  const ul = $('outliner');
  ul.innerHTML = '';
  $('obj-count').textContent = state.objects.length ? `${state.objects.length}개` : '';
  if (!state.objects.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '왼쪽 에셋에서 부품을 추가하세요.';
    ul.appendChild(li);
    return;
  }
  for (const o of state.objects) {
    const li = document.createElement('li');
    li.dataset.id = o.id;
    li.textContent = o.name;
    li.title = `${o.name} (${ASSET_MAP[o.asset]?.name ?? o.asset})`;
    if (o.id === state.selectedId) li.classList.add('sel');
    li.onclick = ev => (ev.shiftKey && state.selectedId ? setSecond(o.id) : select(o.id));
    ul.appendChild(li);
  }
  for (const l of state.links) {
    const li = document.createElement('li');
    li.dataset.link = l.id;
    li.className = 'link';
    li.textContent = linkName(l);
    if (l.id === state.selectedLinkId) li.classList.add('sel');
    li.onclick = () => selectLink(l.id);
    ul.appendChild(li);
  }
}

function linkName(l) {
  const n = id => state.objects.find(o => o.id === id)?.name ?? '(없음)';
  return `기어: ${n(l.a)} ↔ ${n(l.b)}`;
}

function renderProps() {
  const e = selectedEntry();
  const link = state.links.find(l => l.id === state.selectedLinkId);
  $('no-sel').hidden = !!e || !!link;
  $('prop-form').hidden = !e;
  $('link-form').hidden = !link;
  if (link) return renderLinkForm(link);
  if (!e) return;
  renderPairBox(e);
  const a = ASSET_MAP[e.asset];
  $('p-name').value = e.name;
  $('p-asset').textContent = a ? `${a.name}, ${a.spec}` : `알 수 없는 에셋: ${e.asset}`;

  const box = $('p-params');
  box.innerHTML = '';
  for (const [k, def] of Object.entries(a?.params || {})) {
    const label = document.createElement('div');
    label.className = 'param-label';
    label.textContent = `${def.label} (${def.unit}, ${def.min}~${def.max})`;
    const row = document.createElement('div');
    row.className = 'param';
    const range = Object.assign(document.createElement('input'), { type: 'range', min: def.min, max: def.max, step: def.step, value: e.params[k] });
    const num = Object.assign(document.createElement('input'), { type: 'number', min: def.min, max: def.max, step: def.step, value: e.params[k] });
    range.setAttribute('aria-label', def.label);
    num.setAttribute('aria-label', `${def.label} 값`);
    const set = (v, done) => {
      e.params = resolveParams(a, { ...e.params, [k]: v });
      range.value = num.value = e.params[k];
      rebuild(e.id);
      if (done) commit();
    };
    range.oninput = () => set(range.value, false);
    range.onchange = () => set(range.value, true);
    num.onchange = () => set(num.value, true);
    row.append(range, num);
    box.append(label, row);
  }
  fillTransformInputs();
  renderPropsStatus();
}

function fillTransformInputs() {
  const e = selectedEntry();
  if (!e) return;
  for (const inp of document.querySelectorAll('#prop-form [data-k]')) {
    if (document.activeElement === inp) continue;
    inp.value = e[inp.dataset.k][+inp.dataset.i];
  }
}

for (const inp of document.querySelectorAll('#prop-form [data-k]')) {
  inp.addEventListener('change', () => {
    const e = selectedEntry();
    const v = Number(inp.value);
    if (!e || !Number.isFinite(v)) return fillTransformInputs();
    e[inp.dataset.k][+inp.dataset.i] = v;
    applyTransform(state.groups.get(e.id), e);
    selBox.update();
    commit();
  });
}

$('p-name').addEventListener('change', () => {
  const e = selectedEntry();
  if (!e) return;
  e.name = $('p-name').value.trim() || ASSET_MAP[e.asset]?.name || e.asset;
  $('p-name').value = e.name;
  state.groups.get(e.id).name = e.name;
  renderOutliner();
  commit();
});
$('prop-form').addEventListener('submit', ev => ev.preventDefault());
$('dup').onclick = duplicateSelected;
$('del').onclick = deleteSelected;

// ---------------- 기어 연결 ----------------
function renderPairBox(e) {
  const box = $('pair');
  const second = state.objects.find(o => o.id === state.secondId);
  if (!canGear(e)) { box.hidden = true; return; }
  box.hidden = false;
  if (!second) {
    box.innerHTML = '<p class="help">Shift+클릭으로 두 번째 샤프트나 모터를 고르면 기어로 연결할 수 있습니다.</p>';
    return;
  }
  box.innerHTML = '<p class="help">두 번째 선택: <b></b></p>';
  box.querySelector('b').textContent = second.name;
  if (!canGear(second)) {
    box.insertAdjacentHTML('beforeend', '<p class="help">기어는 샤프트나 모터 출력축끼리만 연결할 수 있습니다.</p>');
    return;
  }
  if (state.links.some(l => (l.a === e.id && l.b === second.id) || (l.a === second.id && l.b === e.id))) {
    box.insertAdjacentHTML('beforeend', '<p class="help">이미 기어로 연결되어 있습니다.</p>');
    return;
  }
  const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'btn primary', textContent: '기어로 연결' });
  btn.onclick = () => createGearLink(e.id, second.id);
  box.appendChild(btn);
}

function createGearLink(a, b) {
  let n = 1;
  while (state.links.some(l => l.id === `gear-${n}`)) n++;
  const link = { id: `gear-${n}`, type: 'gear', a, b, ratio: [1, 1], module: 'auto', pos: null };
  state.links.push(link);
  renderOutliner();
  selectLink(link.id);
  commit();
}

function deleteLink(id) {
  state.links = state.links.filter(l => l.id !== id);
  state.selectedLinkId = null;
  renderOutliner();
  renderProps();
  commit();
}

function currentGear() {
  return state.analysis?.gears.find(g => g.link.id === state.selectedLinkId) || null;
}

function renderLinkForm(link) {
  const n = id => state.objects.find(o => o.id === id)?.name ?? '(없음)';
  $('l-a').textContent = n(link.a);
  $('l-b').textContent = n(link.b);
  $('l-ra').value = link.ratio[0];
  $('l-rb').value = link.ratio[1];
  $('l-module').value = String(link.module);
  renderLinkInfo();
}

function renderLinkInfo() {
  const link = state.links.find(l => l.id === state.selectedLinkId);
  if (!link || $('link-form').hidden) return;
  const g = currentGear();
  const msg = state.analysis?.linkProblems.get(link.id);
  const st = $('l-status');
  st.className = msg ? 'status bad' : 'status ok';
  st.textContent = msg || '정상적으로 맞물림';
  const info = $('l-info');
  if (g?.zA) {
    const real = (g.zA / g.zB).toFixed(3);
    info.textContent = `모듈 ${g.m}, ${g.zA}T ↔ ${g.zB}T, 이폭 ${g.w} mm. 실제 기어비 1 : ${real}, 축 간 거리 ${g.D.toFixed(1)} mm (필요 ${g.need.toFixed(1)} mm)`;
  } else info.textContent = '';
  $('l-fix').hidden = !(g?.zA && g.distErr > 0.25);
  const pos = $('l-pos');
  if (g?.zA && g.hi - g.lo >= g.w) {
    pos.disabled = false;
    pos.min = Math.round(g.lo + g.w / 2); pos.max = Math.round(g.hi - g.w / 2);
    if (document.activeElement !== pos) pos.value = Math.round(g.s);
  } else pos.disabled = true;
}

function updateLink(patch, done = true) {
  const link = state.links.find(l => l.id === state.selectedLinkId);
  if (!link) return;
  Object.assign(link, patch);
  if (done) commit(); else scheduleRefresh();
}
$('l-ra').onchange = () => updateLink({ ratio: [Math.max(0.1, Number($('l-ra').value) || 1), state.links.find(l => l.id === state.selectedLinkId).ratio[1]] });
$('l-rb').onchange = () => updateLink({ ratio: [state.links.find(l => l.id === state.selectedLinkId).ratio[0], Math.max(0.1, Number($('l-rb').value) || 1)] });
$('l-module').onchange = () => updateLink({ module: $('l-module').value === 'auto' ? 'auto' : Number($('l-module').value) });
$('l-pos').oninput = () => updateLink({ pos: Number($('l-pos').value) }, false);
$('l-pos').onchange = () => updateLink({ pos: Number($('l-pos').value) });
$('l-del').onclick = () => deleteLink(state.selectedLinkId);
$('l-swap').onclick = () => {
  const link = state.links.find(l => l.id === state.selectedLinkId);
  updateLink({ a: link.b, b: link.a, ratio: [link.ratio[1], link.ratio[0]], pos: null });
  renderProps();
};
for (const opt of ['auto', ...MODULES]) {
  $('l-module').append(new Option(opt === 'auto' ? '자동' : `모듈 ${opt}`, String(opt)));
}

// 축 간 거리 맞추기: B 쪽(안 되면 A 쪽) 부품이나 그 부품을 받치는 부품을 옮겨 본다.
// 다른 규칙을 깨지 않으면서 기어가 맞물리는 첫 번째 방법을 쓴다.
$('l-fix').onclick = () => {
  const link = state.links.find(l => l.id === state.selectedLinkId);
  const g = currentGear();
  if (!link || !g?.zA) return;
  const delta = g.need - g.D;
  const before = state.analysis.problems.size;
  const chain = id => {
    const out = [id], seen = new Set([id]);
    for (let i = 0; i < out.length; i++) {
      for (const h of state.analysis.hosts.get(out[i]) || []) if (!seen.has(h)) { seen.add(h); out.push(h); }
    }
    return out;
  };
  const tries = [];
  for (const id of chain(link.b)) tries.push({ id, v: g.u.clone().multiplyScalar(delta) });
  for (const id of chain(link.a)) tries.push({ id, v: g.u.clone().multiplyScalar(-delta) });
  for (const t of tries) {
    const objs = structuredClone(state.objects);
    const moving = [t.id, ...followersOf(t.id, state.analysis, state.objects)];
    for (const o of objs) if (moving.includes(o.id)) o.position = o.position.map((p, i) => Math.round((p + t.v.getComponent(i)) * 100) / 100);
    const res = analyze(objs, state.links);
    const lp = res.linkProblems.get(link.id);
    if (res.problems.size <= before && !lp) {
      const name = state.objects.find(o => o.id === t.id)?.name ?? t.id;
      loadObjects(objs, state.links);
      selectLink(link.id);
      commit();
      showSnapHint(`「${name}」를 ${Math.abs(delta).toFixed(1)} mm 옮겨서 맞췄습니다`);
      setTimeout(() => showSnapHint(null), 2500);
      return;
    }
  }
  showMsg(`자동으로 맞출 수 있는 위치가 없습니다.<br>두 축 사이를 ${g.need.toFixed(1)} mm 로 직접 맞추거나, 기어비나 모듈을 바꿔 보세요.`);
};

// ---------------- 툴바 ----------------
function setMode(mode) {
  tc.setMode(mode);
  $('mode-translate').classList.toggle('on', mode === 'translate');
  $('mode-rotate').classList.toggle('on', mode === 'rotate');
}
function setSpace(space) {
  tc.setSpace(space);
  $('space-world').classList.toggle('on', space === 'world');
  $('space-local').classList.toggle('on', space === 'local');
}
function applySnap() {
  const on = $('snap-on').checked;
  const mv = Math.max(1, Number($('snap-move').value) || 5);
  const rt = Math.max(1, Number($('snap-rot').value) || 15);
  tc.setTranslationSnap(on ? mv : null);
  tc.setRotationSnap(on ? THREE.MathUtils.degToRad(rt) : null);
}
$('mode-translate').onclick = () => setMode('translate');
$('mode-rotate').onclick = () => setMode('rotate');
$('space-world').onclick = () => setSpace('world');
$('space-local').onclick = () => setSpace('local');
for (const id of ['snap-on', 'snap-move', 'snap-rot']) $(id).addEventListener('change', applySnap);
$('undo').onclick = () => { if (history.index > 0) restore(history.index - 1); };
$('redo').onclick = () => { if (history.index < history.stack.length - 1) restore(history.index + 1); };

$('export').onclick = () => {
  const data = sceneData();
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'scene.json' });
  a.click();
  URL.revokeObjectURL(a.href);
  state.baseline = snapshot();
  afterChange();
  $('saved').showModal();
};

$('import').onclick = () => $('file').click();
$('file').onchange = async () => {
  const f = $('file').files[0];
  $('file').value = '';
  if (!f) return;
  try {
    const data = normalizeScene(JSON.parse(await f.text()));
    loadObjects(data.objects, data.links);
    commit();
    frameObjects(view, view.root.children);
  } catch (err) {
    showMsg(`파일을 불러오지 못했습니다.<br>${err.message}`);
  }
};

$('reset').onclick = async () => {
  if (snapshot() !== state.baseline && !confirm('지금까지 편집한 내용을 버리고 레포에 저장된 배치로 되돌릴까요?')) return;
  await loadFromRepo();
};

// ---------------- 키보드 ----------------
window.addEventListener('keydown', e => { if (e.key === 'Alt') state.alt = true; });
window.addEventListener('keyup', e => { if (e.key === 'Alt') state.alt = false; });
window.addEventListener('blur', () => { state.alt = false; });

window.addEventListener('keydown', e => {
  const t = e.target;
  if (t.matches && t.matches('input, textarea, select')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? $('redo') : $('undo')).click(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if (mod) return;
  switch (e.key.toLowerCase()) {
    case 'w': setMode('translate'); break;
    case 'e': setMode('rotate'); break;
    case 'f': { const g = state.groups.get(state.selectedId); frameObjects(view, g ? [g] : view.root.children); break; }
    case 'escape': select(null); renderProps(); break;
    case 'delete': case 'backspace': e.preventDefault(); deleteSelected(); break;
  }
});

window.addEventListener('beforeunload', e => {
  if (snapshot() !== state.baseline) { e.preventDefault(); e.returnValue = ''; }
});

// ---------------- 시작 ----------------
function showMsg(html) {
  const m = $('msg');
  m.innerHTML = html + '<p><button class="btn" type="button" id="msg-close">닫기</button></p>';
  m.hidden = false;
  $('msg-close').onclick = () => { m.hidden = true; };
}

async function loadFromRepo() {
  let data;
  try {
    data = await fetchScene();
  } catch (err) {
    data = emptyScene();
    showMsg(`<b>scene.json 을 불러오지 못해 빈 장면으로 시작합니다.</b><br>${err.message}<br><small>파일을 더블클릭해서 열었다면 터미널에서 <code>python3 -m http.server</code> 실행 후 http://localhost:8000/editor.html 로 열어 주세요.</small>`);
  }
  loadObjects(data.objects, data.links);
  state.baseline = snapshot();
  resetHistory();
  afterChange();
  frameObjects(view, view.root.children);
}

renderAssets();
applySnap();

// 이전에 내려받지 않고 닫은 편집 내용 (장면을 불러오기 전에 먼저 읽어 둔다)
let draft = null;
try { draft = normalizeScene(JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')); } catch { draft = null; }

await loadFromRepo();

if (draft && JSON.stringify({ o: draft.objects, l: draft.links }) !== state.baseline) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  $('banner').hidden = false;
  $('draft-restore').onclick = () => {
    loadObjects(draft.objects, draft.links);
    commit();
    $('banner').hidden = true;
  };
  $('draft-discard').onclick = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    $('banner').hidden = true;
  };
}
