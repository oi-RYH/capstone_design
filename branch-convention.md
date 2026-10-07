# 브랜치 작업 방법 및 규칙

팀 프로젝트에서는 **방법 2(PR로 합치기)**를 기본으로 사용한다. 간단한 개인 작업이나 팀에서 PR 없이 반영하기로 한 수정은 **방법 1(직접 합치기)**을 사용한다.

- `main`: 팀의 작업 결과를 모아 두는 기본 브랜치
- 작업 브랜치: 내 작업을 따로 진행하는 공간
- merge(병합): 작업한 내용을 다른 브랜치에 합치는 것
- PR(Pull Request): 내 작업을 `main`에 합치기 전에 팀원에게 확인을 요청하는 것

## 브랜치 이름 규칙

[커밋 메시지 규칙](commit-convention.md)과 동일한 타입을 사용한다.

```text
<타입>/<작업-설명>
```

| 타입 | 의미 | 브랜치 이름 예시 |
|---|---|---|
| `feat` | 새로운 기능 추가 | `feat/user-login` |
| `fix` | 버그 수정 | `fix/login-error` |
| `docs` | 문서만 변경 (README, 회의록 등) | `docs/branch-convention` |
| `style` | 코드 동작에 영향 없는 포맷팅 (세미콜론, 들여쓰기 등) | `style/code-format` |
| `refactor` | 기능 변화 없는 코드 구조 개선 | `refactor/auth-module` |
| `test` | 테스트 코드 추가/수정 | `test/login-test` |
| `chore` | 빌드, 설정, 패키지 관리 등 잡일성 변경 | `chore/update-dependencies` |
| `perf` | 성능 개선 | `perf/image-loading` |
| `ci` | CI/CD 설정 변경 | `ci/build-workflow` |

- 작업 설명은 영문 소문자와 하이픈(`-`)을 사용하는 케밥 케이스로 작성한다.
- 하나의 브랜치에서는 하나의 작업 목적에 집중한다.
- 커밋 메시지는 `<타입>: <설명>` 형식을 따른다.

## 시작하기 전에

- 프로젝트 폴더에서 터미널을 연다. GitHub 저장소를 내 컴퓨터에 내려받은 상태를 기준으로 한다.
- 아래 예시는 파일 이름을 정리하는 작업이다. `chore/rename-files`와 커밋 메시지는 자신의 작업에 맞게 바꾼다.
- 두 방법 중 **하나만 선택**해서 따라 한다. 명령어는 한 줄씩 실행하고, 오류가 나면 다음 단계로 넘어가지 않는다.
- 이전에 수정하던 내용이 있다면 먼저 해당 작업 브랜치에서 커밋하고 시작한다.

`origin`은 연결된 GitHub 저장소의 이름이다. 아래의 `git pull --ff-only origin main`은 GitHub의 최신 `main`을 내 컴퓨터로 가져오는 명령이다. 자동으로 합치기 어려운 상태라면 멈추도록 `--ff-only`를 사용한다.

## 방법 1: 터미널에서 직접 main에 합치기

### 깃허브에 브랜치 + PR 기록이 남지 않는다.
간단한 개인 작업이나 PR이 필요 없는 수정에 사용한다. 저장소에서 PR을 필수로 설정했다면 방법 2를 사용한다.

**순서:** main 최신화 → 작업 브랜치 생성 → 작업 및 커밋 → main에 합치기 → GitHub에 올리기

### 1. 최신 main에서 작업 브랜치 만들기

```bash
# main으로 이동하고 최신 내용 가져오기
git switch main
git pull --ff-only origin main

# 새 작업 브랜치를 만들고 이동하기
git switch -c chore/rename-files
```

### 2. 파일을 수정한 뒤 커밋하기

이제 필요한 파일을 수정하고 저장한다. 작업이 끝나면 아래 명령을 실행한다.

```bash
# 변경된 파일 확인하기
git status

# 변경 사항을 커밋할 대상으로 선택하기
git add .

# 작업 내용을 메시지와 함께 기록하기
git commit -m "chore: 폴더 및 파일 네이밍 정리"
```

`git add .`은 현재 폴더와 하위 폴더의 변경 사항을 한꺼번에 선택한다. `git status`에서 이번 작업에 포함할 파일인지 먼저 확인한다. 특정 파일만 선택하려면 `git add 파일명`을 사용한다.

### 3. main에 합치고 GitHub에 올리기

```bash
# main으로 돌아가서 팀원의 최신 변경 사항 가져오기
git switch main
git pull --ff-only origin main

# 작업 브랜치의 내용을 main에 합치기
git merge chore/rename-files
```

파일이나 실행 결과에 문제가 없는지 확인한 뒤 GitHub에 올린다.

```bash
git push origin main
```

## 방법 2: GitHub에서 PR로 합치기 (팀 작업 추천)

### 깃허브에 브랜치 + PR 기록이 남는다.
내 작업을 GitHub에 올리고, 팀원이 확인한 뒤 `main`에 합치는 방법이다. (코드 작업과 같은 대부분의 작업)

**순서:** main 최신화 → 작업 브랜치 생성 → 작업 및 커밋 → 작업 브랜치 올리기 → PR 생성 및 병합 → 내 컴퓨터의 main 최신화

### 1. 최신 main에서 작업 브랜치 만들기

```bash
git switch main
git pull --ff-only origin main
git switch -c chore/rename-files
```

### 2. 파일을 수정한 뒤 커밋하기

필요한 파일을 수정하고 저장한 뒤 실행한다. `git status`로 이번 작업에 포함할 파일인지 확인하고 `git add .`을 실행한다.

```bash
git status
git add .
git commit -m "chore: 폴더 및 파일 네이밍 정리"
```

### 3. 작업 브랜치를 GitHub에 올리기

```bash
git push -u origin chore/rename-files
```

처음 올릴 때는 위 명령을 사용한다. 이후 같은 브랜치에서 추가로 수정하고 커밋했다면 `git push`만 실행하면 된다.

### 4. GitHub에서 PR 만들고 합치기

1. GitHub 저장소에 접속한다.
2. **Compare & pull request**를 누른다. 버튼이 보이지 않으면 **Pull requests → New pull request**로 들어간다.
3. `base`는 **main**, `compare`는 **chore/rename-files**로 선택한다. 작업 브랜치의 내용을 `main`에 합친다는 뜻이다.
4. 제목과 설명에 무엇을 수정했는지 적고 **Create pull request**를 누른다.
5. 팀원에게 확인받고, 충돌이나 검사 실패가 없다면 **Merge pull request**를 눌러 병합을 확정한다.

수정 의견을 받으면 같은 작업 브랜치에서 수정 → `git add .` → `git commit` → `git push` 순서로 진행한다. 기존 PR에 수정 내용이 추가되므로 PR을 새로 만들 필요는 없다.

### 5. 내 컴퓨터의 main도 최신화하기

GitHub에서 병합이 끝난 뒤 터미널에서 실행한다.

```bash
git switch main
git pull --ff-only origin main
```

이제 내 컴퓨터의 `main`에도 병합한 내용이 반영된다. 다음 작업은 최신 `main`에서 새로운 이름의 작업 브랜치를 만들어 시작한다.

## 진행 중 막혔을 때

- **충돌(`CONFLICT`)이 나온 경우:** 같은 부분을 서로 다르게 수정한 상황일 수 있다. 다음 명령을 실행하지 말고, 해당 파일을 수정한 팀원과 함께 내용을 확인한다.
- **pull이나 push가 실패한 경우:** 오류 메시지를 팀원에게 공유하고 원인을 확인한다. 강제 push(`git push --force`)로 해결하려고 하지 않는다.
- **브랜치가 이미 있다는 경우:** `git switch -c`는 새 브랜치를 만드는 명령이다. 기존 작업을 이어가려면 `git switch 브랜치명`, 새 작업이라면 다른 브랜치 이름을 사용한다.
