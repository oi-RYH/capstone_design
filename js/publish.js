// 편집 페이지의 '적용' 버튼: GitHub API 로 gh-pages 브랜치의 scene.json 을 바로 커밋한다.
// 커밋되면 GitHub Pages 가 다시 배포해서 1~2분 뒤 모든 사람에게 보인다.
//
// 토큰은 이 브라우저의 localStorage 에만 저장되고, 레포에는 절대 올라가지 않는다.

export const REPO = { owner: 'oi-RYH', repo: 'capstone_design', branch: 'gh-pages', path: 'scene.json' };
const TOKEN_KEY = 'carrycarry-github-token';
const API = `https://api.github.com/repos/${REPO.owner}/${REPO.repo}/contents/${REPO.path}`;

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t.trim()) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// UTF-8 문자열 <-> base64
function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromB64(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

function explain(status, body) {
  if (status === 401) return '토큰이 올바르지 않거나 만료되었습니다. 토큰을 다시 입력해 주세요.';
  if (status === 403 || status === 404) return '이 토큰으로는 레포에 쓸 권한이 없습니다. 레포 협업자(collaborator)인지, 토큰 권한(public_repo 또는 Contents 쓰기)을 확인해 주세요.';
  if (status === 409) return '다른 사람이 방금 먼저 적용했습니다. 다시 시도해 주세요.';
  return `GitHub 응답 오류 (${status}) ${body?.message ?? ''}`;
}

// 레포에 있는 현재 scene.json (내용과 sha)
export async function readRemote(token) {
  const res = await fetch(`${API}?ref=${REPO.branch}&t=${Date.now()}`, { headers: headers(token), cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(explain(res.status, body));
  return { sha: body.sha, text: fromB64(body.content) };
}

// scene.json 커밋
export async function writeRemote(token, text, sha, message) {
  const res = await fetch(API, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: toB64(text), sha, branch: REPO.branch }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(explain(res.status, body));
  return { sha: body.content.sha, commit: body.commit };
}
