# 캐리캐리체인지 3D 뷰어 (gh-pages)

이 브랜치는 GitHub Pages 배포 전용이다. `main` 으로 PR 이나 merge 하지 않는다.

- 보기 페이지: `index.html` (레포의 `scene.json` 배치를 보여 줌)
- 편집 페이지: `editor.html` (부품 추가, 이동, 회전, 길이 조절)

## 배치 수정하는 법

1. 편집 페이지에서 부품을 배치한다.
2. **scene.json 저장** 을 눌러 파일을 내려받는다.
3. 내려받은 파일로 레포의 `scene.json` 을 덮어쓰고 커밋, push 한다.

```bash
git switch gh-pages
git pull
git add scene.json
git commit -m "feat: 기기 배치 수정"
git push
```

push 후 1~2분 뒤 보기 페이지에 반영된다.
편집하다가 창을 닫아도 같은 브라우저에서 다시 열면 이어서 편집할 수 있다.

## 내 컴퓨터에서 확인하기

파일을 더블클릭해서 열면 브라우저가 `scene.json` 읽기를 막는다. 레포 폴더에서 아래를 실행한 뒤 http://localhost:8000 으로 연다.

```bash
python3 -m http.server
```

## 조작 규칙

- 부품은 이동과 회전만 된다. 크기 조절은 없다.
- 길이가 있는 부품(프로파일, 샤프트, 스펀지 브러시)만 길이를 바꿀 수 있다.
- 단위는 mm, 위쪽이 +Y 이다. 바닥 격자 한 칸은 100 mm.

## 부품(에셋) 추가하기

`js/assets.js` 의 `ASSETS` 배열에 항목을 추가한다.

```js
{
  id: 'profile-2020',            // scene.json 에 저장되는 이름 (바꾸지 말 것)
  name: '알루미늄 프로파일 2020',  // 화면에 보이는 이름
  category: '프레임',             // 에셋 목록 묶음
  spec: '단면 20 × 20 mm',
  params: {                      // 편집 페이지에서 바꿀 수 있는 치수 (없으면 {})
    length: { label: '길이', unit: 'mm', min: 20, max: 3000, step: 1, default: 600 },
  },
  build: ({ length }) => { /* THREE.Object3D 를 만들어 반환 */ },
}
```

길이가 있는 부품은 로컬 X축 방향으로, 원점이 가운데에 오도록 만든다.

## 파일 구성

```text
index.html        보기 페이지
editor.html       편집 페이지
scene.json        현재 기기 배치
js/assets.js      부품 카탈로그
js/scene.js       보기, 편집 페이지 공통 3D 코드
js/editor.js      편집 기능
css/              스타일
vendor/three/     three.js r170 (MIT)
```
