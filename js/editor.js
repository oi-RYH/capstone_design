// 편집 페이지
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { ASSETS, ASSET_MAP, resolveParams } from './assets.js';
import {
  createViewport, fetchScene, normalizeScene, emptyScene, buildObject,
  applyTransform, readTransform, frameObjects, pickObject,
} from './scene.js';

const DRAFT_KEY = 'carrycarry-scene-draft';
const $ = id => document.getElementById(id);

// ---------------- 상태 ----------------
const state = {
  objects: [],          // scene.json 의 objects
  groups: new Map(),    // id -> THREE.Group
  selectedId: null,
  baseline: '',         // 마지막으로 불러오거나 저장한 상태 (변경 여부 표시용)
};
const history = { stack: [], index: -1 };

// ---------------- 3D 화면 ----------------
const view = createViewport($('view'));
const tc = new TransformControls(view.camera, view.renderer.domElement);
tc.setSize(0.9);
view.scene.add(tc.getHelper());
tc.addEventListener('dragging-changed', e => { view.controls.enabled = !e.value; });
tc.addEventListener('objectChange', () => {
  const g = tc.object;
  if (!g) return;
  readTransform(g, g.userData.entry);
  fillTransformInputs();
  selBox.update();
});
tc.addEventListener('mouseUp', () => commit());

const selBox = new THREE.BoxHelper(undefined, 0xffb400);
selBox.visible = false;
view.scene.add(selBox);
view.onTick(() => { if (selBox.visible) selBox.update(); });

// ---------------- 장면 다루기 ----------------
function snapshot() { return JSON.stringify(state.objects); }

function loadObjects(objects, { keepSelection = false } = {}) {
  const prevSel = state.selectedId;
  select(null);
  for (const g of state.groups.values()) view.root.remove(g);
  state.groups.clear();
  state.objects = objects;
  for (const e of state.objects) addGroup(e);
  renderOutliner();
  if (keepSelection && prevSel && state.groups.has(prevSel)) select(prevSel);
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
  loadObjects(JSON.parse(history.stack[i]), { keepSelection: true });
  afterChange();
}

function afterChange() {
  updateUndoButtons();
  const dirty = snapshot() !== state.baseline;
  $('dirty').textContent = dirty ? '저장 안 한 변경 있음' : '';
  try {
    if (dirty) localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, units: 'mm', objects: state.objects }));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* 브라우저 저장소를 못 쓰는 환경 */ }
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
  const id = state.selectedId;
  if (!id) return;
  select(null);
  view.root.remove(state.groups.get(id));
  state.groups.delete(id);
  state.objects = state.objects.filter(o => o.id !== id);
  renderOutliner();
  commit();
}

function selectedEntry() {
  return state.objects.find(o => o.id === state.selectedId) || null;
}

// ---------------- 선택 ----------------
function select(id) {
  state.selectedId = id;
  const g = id ? state.groups.get(id) : null;
  if (g) {
    tc.attach(g);
    selBox.setFromObject(g);
    selBox.visible = true;
  } else {
    tc.detach();
    selBox.visible = false;
  }
  for (const li of $('outliner').children) li.classList.toggle('sel', li.dataset.id === id);
  const sel = $('outliner').querySelector('.sel');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
  renderProps();
}

let down = null;
view.renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, onGizmo: tc.axis !== null }; });
view.renderer.domElement.addEventListener('pointerup', e => {
  if (!down || e.button !== 0) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4;
  if (!moved && !down.onGizmo) {
    const g = pickObject(view, e.clientX, e.clientY);
    select(g ? g.userData.entry.id : null);
  }
  down = null;
});

// ---------------- 패널 ----------------
function renderAssets() {
  const box = $('assets');
  const cats = [...new Set(ASSETS.map(a => a.category))];
  for (const c of cats) {
    const h = document.createElement('div');
    h.className = 'cat';
    h.textContent = c;
    box.appendChild(h);
    for (const a of ASSETS.filter(x => x.category === c)) {
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
    li.onclick = () => select(o.id);
    ul.appendChild(li);
  }
}

function renderProps() {
  const e = selectedEntry();
  $('no-sel').hidden = !!e;
  $('prop-form').hidden = !e;
  if (!e) return;
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
  const data = { version: 1, units: 'mm', objects: state.objects };
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
    loadObjects(data.objects);
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
    case 'escape': select(null); break;
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
  loadObjects(data.objects);
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

if (draft && JSON.stringify(draft.objects) !== state.baseline) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  $('banner').hidden = false;
  $('draft-restore').onclick = () => {
    loadObjects(draft.objects);
    commit();
    $('banner').hidden = true;
  };
  $('draft-discard').onclick = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    $('banner').hidden = true;
  };
}
