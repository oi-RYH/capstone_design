// 편집 페이지 비밀번호
// ------------------------------------------------------------------
// 정적 사이트라서 이 비밀번호는 "아무나 실수로 편집 화면에 들어오지 않게" 하는 용도다.
// 사이트에 실제로 반영되는 것은 '적용' 버튼의 GitHub 토큰(레포 쓰기 권한)이 있어야만 가능하다.
// 비밀번호는 원문 대신 해시로만 저장한다. 바꾸려면 아래 HASH 를
//   sha256("carrycarry:" + 새 비밀번호)
// 값으로 교체한다.

const HASH = 'c18518d06ec0c841918c87b67ffbe8ba577cb5c180e854e4753ad315d1375027';
const KEY = 'carrycarry-edit-unlocked';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isUnlocked() {
  try { return sessionStorage.getItem(KEY) === HASH; } catch { return false; }
}

export async function tryUnlock(pw) {
  const ok = (await sha256('carrycarry:' + pw)) === HASH;
  if (ok) { try { sessionStorage.setItem(KEY, HASH); } catch {} }
  return ok;
}

// 비밀번호 창을 띄우고, 맞으면 onOk 실행. 닫으면 onCancel 실행.
export function askPassword({ onOk, onCancel, closable = true }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'gate';
  dlg.innerHTML = `
    <form method="dialog">
      <h2>편집 비밀번호</h2>
      <p class="gate-help">편집은 팀원만 할 수 있습니다.</p>
      <input type="password" inputmode="numeric" autocomplete="off" aria-label="비밀번호" required>
      <p class="gate-err" hidden>비밀번호가 맞지 않습니다.</p>
      <div class="gate-actions">
        ${closable ? '<button type="button" class="btn" value="cancel">취소</button>' : '<a class="btn" href="index.html">보기 페이지로</a>'}
        <button type="submit" class="btn primary">확인</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  const input = dlg.querySelector('input'), err = dlg.querySelector('.gate-err');
  dlg.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    if (await tryUnlock(input.value)) { dlg.close(); dlg.remove(); onOk?.(); }
    else { err.hidden = false; input.select(); }
  });
  dlg.querySelector('button[value=cancel]')?.addEventListener('click', () => { dlg.close(); dlg.remove(); onCancel?.(); });
  dlg.addEventListener('cancel', ev => { if (!closable) ev.preventDefault(); else { dlg.remove(); onCancel?.(); } });
  dlg.showModal();
  input.focus();
}
