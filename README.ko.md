<p align="center">
  <img src="image/knock_icon.png" alt="KnockKnock" width="128" height="128">
</p>

<h1 align="center">KnockKnock</h1>

<p align="center">
  책상을 톡톡 두드리면, 맥북이 반응합니다.
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>한국어</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS-14%2B-black?logo=apple" alt="macOS 14+">
  <img src="https://img.shields.io/badge/Apple%20Silicon-only-blue" alt="Apple Silicon">
  <img src="https://img.shields.io/badge/version-1.0.0-green" alt="Version">
</p>

---

## KnockKnock이 뭔가요?

커피 한 잔을 들고 있어요. 영상이 재생 중이고요. 키보드까지 손 뻗기 귀찮죠.

**책상을 두 번 톡톡. 음악이 멈춥니다.**

KnockKnock은 Apple Silicon 맥북 안에 숨어 있는 **가속도계 센서**를 이용해 책상에서 전해지는 미세한 진동을 감지합니다. 그리고 그 진동을 시스템 액션으로 바꿔 실행해요. 외부 장비도, 웨어러블도 필요 없어요. 책상과 손가락만 있으면 됩니다.

[SlapMac](https://github.com/nickytonline/SlapMac) 에서 영감을 받았습니다.

<br>

## 무엇을 할 수 있나요?

탭 패턴(1회 ~ 7회)을 아래 액션 중 하나와 연결할 수 있어요:

| 액션 | 설명 |
|---|---|
| 🚀 **앱 실행** | 맥에 설치된 어떤 앱이든 바로 열기 |
| ▶️ **음악 재생 / 일시정지** | 미디어 재생 토글 |
| ⏭ **다음 곡** | 다음 트랙으로 건너뛰기 |
| ⏮ **이전 곡** | 이전 트랙으로 되돌리기 |
| 🔔 **사운드 재생** | 원하는 효과음 재생 |

**기본 매핑:**

- **2번 탭** → 재생 / 일시정지
- **3번 탭** → 다음 곡
- **4번 탭** → 앱 실행

모든 패턴은 Patterns 탭에서 자유롭게 수정할 수 있어요.

### 🚧 개발 중인 기능

아래 기능들은 로드맵에 올라가 있고, 다음 릴리즈에서 차례대로 추가될 예정이에요:

- 🔊 **볼륨 조절** — 음량 올리기 / 내리기 / 음소거
- ⌨️ **키보드 단축키** — 원하는 단축키 조합 트리거 (`⌘⇧4`, `⌃⌥→` 등)
- 🖥 **시스템 액션** — 스크린샷, 방해 금지 모드, 화면 잠금, 디스플레이 끄기

<br>

## 스크린샷

> 아래 파일명으로 `image/screenshots/` 폴더에 스크린샷을 넣으면 자동으로 표시됩니다.

<p align="center">
  <img src="image/screenshots/main.png" alt="메인 설정 화면" width="640">
</p>

| 캘리브레이션 | 패턴 편집 | 사운드 피드백 |
|:---:|:---:|:---:|
| <img src="image/screenshots/calibration.png" alt="캘리브레이션" width="240"> | <img src="image/screenshots/patterns.png" alt="패턴 편집" width="240"> | <img src="image/screenshots/sound.png" alt="사운드" width="240"> |

<br>

## 사용 방법

### 1. 첫 실행 — 책상의 평소 진동을 학습시키기

KnockKnock을 처음 실행하면 두 가지가 일어납니다:

1. **macOS가 관리자 비밀번호를 묻습니다.** 내장 가속도계에 접근하려면 세션마다 한 번씩 권한이 필요해요. 비밀번호는 어디에도 저장되지 않습니다.
2. **짧은 캘리브레이션이 진행됩니다.** KnockKnock이 평소 책상의 미세한 진동(소음 베이스라인)을 측정해서, 진짜 "탭"과 "지나가는 트럭"을 구분할 수 있게 됩니다.

### 2. 탭 패턴 설정

사이드바의 **Patterns** 탭을 열어 "몇 번 두드렸을 때 어떤 액션이 실행될지" 정해주세요. 최대 **7번 탭**까지 패턴을 추가, 수정, 비활성화할 수 있습니다.

### 3. 톡톡 두드리기

이제 책상을 두드려 보세요. 창 상단의 점들이 실시간으로 반응하기 때문에 KnockKnock이 무엇을 감지하고 있는지 바로 확인할 수 있어요. 등록한 패턴과 일치하면 액션이 실행됩니다.

### 4. 메뉴바에서 살아 숨쉬는 KnockKnock

KnockKnock은 메뉴바에 조용히 떠 있습니다. 트레이 아이콘을 클릭하면:

- 감지를 즉시 켜고 끄기
- 설정 창 열기
- 앱 종료

### 5. 민감도 조절

너무 예민하거나 너무 둔하다면 **Sensitivity** 탭에서 슬라이더를 조절하세요. 변경한 임계값이 즉시 적용됩니다.

<br>

## 설치

### Homebrew (권장)

```bash
brew tap MoonDongmin/knock-knock
brew install --cask knock-knock
```

### 수동 설치

[Releases](https://github.com/MoonDongmin/knock-knock/releases) 에서 최신 `.dmg` 를 다운로드하세요.

### macOS Gatekeeper 안내

처음 실행할 때 macOS가 **"KnockKnock이(가) 손상되었기 때문에 열 수 없습니다."** 라는 메시지를 띄울 수 있어요. 이건 앱이 Apple Developer 인증서로 코드 서명되어 있지 않아서 나타나는 메시지입니다. 앱은 안전합니다 — 전체 소스 코드는 이 저장소에서 확인하실 수 있어요.

설치 후 아래 명령을 한 번 실행해 주세요:

```bash
xattr -cr /Applications/KnockKnock.app
```

### 관리자 권한

KnockKnock은 내장 가속도계(IOKit HID)에 접근하기 위해 **관리자 권한**이 필요합니다. 첫 실행 시 macOS 비밀번호 입력창이 한 번 뜨며, 이는 세션당 한 번만 요구됩니다.

<br>

## 시스템 요구사항

- macOS 14 (Sonoma) 이상
- Apple Silicon Mac (M1 / M2 / M3 / M4)
- 관리자 비밀번호 (가속도계 접근을 위해 실행 시 요구)

<br>

## 자주 묻는 질문

**타이핑할 때 잘못 인식되지는 않나요?**
거의 그렇지 않아요. KnockKnock은 캘리브레이션 단계에서 책상의 평소 노이즈를 학습하고, 그 이하의 진동은 무시합니다. 그래도 너무 예민하다면 **Sensitivity** 슬라이더를 한 칸 낮춰보세요.

**Intel 맥에서도 작동하나요?**
아니요. IOKit HID 가속도계 인터페이스는 Apple Silicon (M1 이상)에서만 제공됩니다.

**무릎 위에 올려놓고 써도 되나요?**
딱딱하고 평평한 표면(책상, 테이블)에서 가장 잘 작동합니다. 무릎이나 쿠션 같은 부드러운 표면 위에서는 진동이 흡수되어 인식률이 떨어집니다.

**왜 비밀번호를 묻나요?**
macOS는 HID 디바이스 원시(raw) 접근을 elevated privilege를 가진 프로세스로 제한합니다. KnockKnock은 세션당 한 번만 비밀번호를 요청하며, 어떤 형태로도 저장하지 않습니다.

**Mac App Store에서 받을 수 있나요?**
아니요. IOKit HID API는 App Store 샌드박싱과 호환되지 않습니다.

<br>

## 기능 요청

새로운 탭 액션이 필요하거나 아이디어가 있다면 [Issue를 열어주세요](https://github.com/MoonDongmin/knock-knock/issues). 모든 제안을 환영합니다.

<br>

---

## 개발자를 위한 정보

### 기술 스택

| 레이어 | 기술 |
|---|---|
| 앱 프레임워크 | Tauri v2 |
| 백엔드 | Rust (IOKit HID, CGEvent) |
| 프론트엔드 | TypeScript + React |
| UI | Tailwind CSS |
| 빌드 | Vite + Bun |

### 아키텍처

```
[IOKit HID ~800Hz] → [Rust: 100Hz로 다운샘플] → [Tauri Event] → [TS: TapDetector] → [ActionMapper] → [ActionExecutor]
```

Rust는 최소한의 하드웨어 브릿지(가속도계 접근, 키 시뮬레이션)만 담당합니다. 모든 비즈니스 로직(탭 감지, 패턴 매칭, 액션 매핑)은 TypeScript에 위치합니다.

### 개발

```bash
# 의존성 설치
bun install

# 개발 모드 실행 (가속도계 접근을 위한 비밀번호 입력창이 뜹니다)
bun run tauri dev

# 프로덕션 빌드
bun run tauri build

# 린트 & 포맷
bun run check
```

<br>

## 라이선스

MIT
