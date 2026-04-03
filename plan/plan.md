# KnockKnock Implementation Plan

## Context

macOS 메뉴바 유틸리티 앱. MacBook의 내장 가속도계로 책상 탭(두드리기)을 감지하고, 탭 횟수에 따라 시스템 액션(미디어 제어, 앱 실행 등)을 매핑하는 자동화 앱.

**목표**: 수익화 가능한 Freemium macOS 앱 출시
**핵심 차별화**: 키보드/트랙패드에서 손을 뗀 상태에서도 맥을 조작

### 중요 기술 발견

- **CoreMotion은 macOS에서 가속도계를 지원하지 않음** (Mac Catalyst 호환용으로만 존재)
- Apple Silicon MacBook의 가속도계는 **문서화되지 않은 IOKit HID 인터페이스**로만 접근 가능
  - 디바이스: `AppleSPUHIDDevice`, Usage Page `0xFF00`, Usage `3`
  - 22바이트 HID 리포트 → x/y/z i32 (offset 6,10,14) / 65536.0 = g-force
  - **root 권한 필요**
- 참고 구현: [olvvier/apple-silicon-accelerometer](https://github.com/olvvier/apple-silicon-accelerometer)

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| App Framework | **Tauri v2** | 경량 (~10MB), 네이티브 macOS 통합 |
| Backend | **Rust** | IOKit HID 가속도계 브릿지, CGEvent 미디어키 |
| Frontend | **TypeScript + React** | UI, 탭 감지 알고리즘, 액션 매핑, 모든 비즈니스 로직 |
| UI | **Tailwind CSS** | 설정 패널 스타일링 |
| Build | **Vite + Bun** | 프론트엔드 번들링 |
| Package Manager | **Bun** (frontend), **Cargo** (Rust) | |

### Rust vs TypeScript 역할 분배

- **Rust (최소화)**: IOKit HID 디바이스 접근, 가속도 데이터 이벤트 발행, CGEvent 미디어키/키보드 시뮬레이션
- **TypeScript (모든 로직)**: 탭 감지 알고리즘, 패턴 매칭, 액션 매핑/실행, 설정 관리, UI, 라이선스

---

## Project Structure

```
knock-knock/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── lib.rs                     # Tauri 앱 셋업, 트레이, ActivationPolicy
│   │   ├── main.rs
│   │   ├── tray.rs                    # 시스템 트레이 아이콘 + 이벤트
│   │   └── commands/
│   │       ├── mod.rs
│   │       ├── system_actions.rs      # CGEvent 미디어키, 키보드 단축키 시뮬레이션
│   │       └── audio.rs              # 피드백 사운드 재생
│   └── plugins/
│       └── tauri-plugin-accelerometer/
│           ├── Cargo.toml
│           ├── src/
│           │   ├── lib.rs             # 플러그인 등록
│           │   ├── desktop.rs         # IOKit HID 가속도계 브릿지
│           │   ├── iokit_hid.rs       # IOKit FFI + 디바이스 디스커버리
│           │   └── commands.rs        # start_stream / stop_stream / calibrate
│           └── guest-js/
│               └── index.ts           # JS API 바인딩
├── src/                               # React 프론트엔드
│   ├── main.tsx
│   ├── App.tsx
│   ├── core/
│   │   ├── tap-detector.ts           # ★ 탭 감지 알고리즘 (핵심 비즈니스 로직)
│   │   ├── action-mapper.ts          # 탭 횟수 → 액션 매핑
│   │   ├── action-executor.ts        # Tauri invoke로 액션 실행
│   │   ├── settings-manager.ts       # 설정 로드/저장
│   │   ├── license-manager.ts        # 7일 Trial + 라이선스 검증
│   │   └── sound-feedback.ts         # 확인음 재생
│   ├── hooks/
│   │   ├── useAccelerometer.ts
│   │   ├── useTapDetector.ts
│   │   ├── useSettings.ts
│   │   └── useTrial.ts
│   ├── components/
│   │   ├── SettingsPanel.tsx          # 메인 설정 윈도우
│   │   ├── PatternList.tsx           # 탭 패턴 목록
│   │   ├── PatternEditor.tsx         # 패턴 편집
│   │   ├── ActionPicker.tsx          # 액션 선택
│   │   ├── SensitivitySlider.tsx     # 감도 조절
│   │   ├── CalibrationView.tsx       # 초기 캘리브레이션 위자드
│   │   ├── TrayPopover.tsx           # 트레이 팝오버
│   │   ├── TrialBanner.tsx           # Trial 남은 일수 배너
│   │   └── PurchaseScreen.tsx        # 만료 후 구매 안내 화면
│   └── lib/
│       ├── actions.ts                # 액션 타입 정의 + 카탈로그
│       ├── constants.ts              # 임계값, 타이밍 상수
│       └── types.ts                  # 공유 TypeScript 타입
├── package.json
├── tsconfig.json
├── biome.json
├── tailwind.config.ts
└── vite.config.ts
```

---

## 핵심 구현 상세

### 1. 가속도계 플러그인 (Rust)

IOKit HID로 `AppleSPUHIDDevice` 접근 → 22바이트 리포트 파싱 → ~100Hz로 다운샘플링 → Tauri 이벤트 발행

```
[IOKit HID Device ~800Hz] → [Rust: 다운샘플 100Hz] → [Tauri Event] → [TS: TapDetector]
```

**root 권한 처리 (MVP)**: 첫 실행 시 관리자 비밀번호 요청 → v1.1에서 SMJobBless privileged helper로 마이그레이션

**플러그인 커맨드**:
- `start_accelerometer_stream()` — 가속도 이벤트 스트리밍 시작
- `stop_accelerometer_stream()` — 스트리밍 중지
- `is_accelerometer_available()` — 지원 여부 확인
- `calibrate_baseline()` — 1초간 샘플링하여 기준 벡터 반환

### 2. 탭 감지 알고리즘 (TypeScript) — `src/core/tap-detector.ts`

```typescript
// 핵심 설정값
threshold: 0.15g        // 탭 인식 임계값
maxTapInterval: 500ms   // 탭 간 최대 간격
silenceTimeout: 600ms   // 시퀀스 확정까지 무음 시간
debounceWindow: 80ms    // 탭 후 무시 시간
maxTapCount: 7          // 최대 탭 수 제한
```

**알고리즘 흐름**:
1. baseline 벡터 차감 → delta 벡터 크기 계산
2. magnitude > threshold AND (now - lastTap) > debounce → 탭 인식
3. silenceTimeout 후 최종 tapCount 이벤트 발행
4. 노이즈 필터링: 연속 2+ 샘플이 threshold 초과해야 유효한 탭으로 인정

### 3. 액션 실행

| 액션 유형 | 실행 방법 |
|-----------|-----------|
| 미디어 제어 | Rust CGEvent (NX_KEYTYPE_PLAY=16, NEXT=17, PREV=18) |
| 볼륨 조절 | Rust CGEvent |
| 앱 실행/전환 | AppleScript via Tauri shell plugin |
| 시스템 명령 | AppleScript (스크린샷, DND 토글 등) |
| 키보드 단축키 | Rust CGEvent 키 시뮬레이션 |

### 4. 설정 저장

`@tauri-apps/plugin-store` (JSON 기반 key-value 스토어) 사용

---

## 수익 모델: 7일 무료 체험 + 일회성 구매

### 체험 기간 (Trial)

- **7일간 모든 기능 제한 없이 사용 가능**
- 첫 실행 시 trial 시작 시점을 `@tauri-apps/plugin-store`에 저장
- 남은 일수를 트레이 팝오버 및 설정 패널에 표시
- 만료 3일 전, 1일 전 알림 (앱 내 배너)
- **만료 후**: 앱 실행 시 구매 안내 화면만 표시, 탭 감지 중단

### 시간 조작 방지

- `lastCheckedAt` 타임스탬프 함께 저장
- 현재 시간 < lastCheckedAt이면 즉시 만료 처리
- trial 시작 시점은 한 번 저장되면 변경 불가

### 가격: $4.99 일회성 구매

- macOS 유틸리티 충동구매 sweet spot
- $2.99는 "장난감" 느낌, $5.99는 기능 대비 고민 유발
- 구독 모델은 단일 기능 앱에 부적합 (부정적 리뷰 유발)
- LemonSqueezy 또는 Gumroad로 라이선스 키 발급
- 라이선스 검증: 온라인 시 서버 확인, 오프라인 30일간 유효, 이후 재검증 필요

---

## 배포 전략

1. **직접 다운로드 (primary)**: 웹사이트/GitHub Releases에서 DMG
2. **Homebrew Cask**: `brew install --cask knockknock`
3. **Mac App Store 불가**: IOKit HID 접근이 샌드박싱과 비호환

**필수 요건**:
- Apple Developer Program ($99/year)
- Developer ID Application 인증서
- 코드 서명 + 공증 (notarization) 파이프라인

**타겟**: macOS 14+ / Apple Silicon (M1 이상)

---

## 리스크

| 리스크 | 수준 | 대응 |
|--------|------|------|
| IOKit HID API가 문서화되지 않음 (Apple이 언제든 변경 가능) | **높음** | macOS 버전별 분기, 커뮤니티 모니터링, graceful degradation |
| root 권한 요청 UX | 중간 | 캘리브레이션 위자드에서 명확한 설명, v1.1에서 SMJobBless 마이그레이션 |
| 배터리 영향 (100Hz 상시 읽기) | 낮음-중간 | 50Hz 다운샘플, "배터리 모드에서 일시정지" 옵션 |
| Intel Mac 미지원 | 낮음 | 명확한 시스템 요구사항 표시 |

---

## 구현 순서

### Phase 1: 프로젝트 셋업 + 가속도계 (Week 1-2)
1. Tauri v2 프로젝트 스캐폴딩 (React + TS + Vite + Bun)
2. 메뉴바 앱 설정 (ActivationPolicy::Accessory, 트레이 아이콘)
3. `tauri-plugin-accelerometer` Rust 플러그인 구현
4. 가속도 데이터가 React 프론트엔드까지 스트리밍되는지 확인

### Phase 2: 핵심 로직 (Week 2-3)
5. `TapDetector` 클래스 구현 (TypeScript)
6. 캘리브레이션 흐름 구현
7. `ActionMapper` + `ActionExecutor` 구현
8. 미디어키 시뮬레이션 (Rust CGEvent)
9. AppleScript 액션 연결

### Phase 3: UI (Week 3-4)
10. 설정 패널 (Tailwind CSS)
11. 패턴 목록/편집기 컴포넌트
12. 감도 슬라이더 + 캘리브레이션 뷰
13. 트레이 팝오버
14. 사운드 피드백

### Phase 4: 출시 준비 (Week 4-5)
15. LemonSqueezy 라이선스 연동
16. 7일 Trial 로직 + 만료 후 구매 화면
17. 로그인 시 자동 실행
18. 자동 업데이트 설정
19. 코드 서명 + 공증 CI/CD
20. 랜딩 페이지 + DMG 배포

---

## Verification

- Phase 1 완료 확인: `console.log`로 가속도 x/y/z 값이 실시간 출력되는지
- Phase 2 완료 확인: 책상을 2번/3번 두드리면 각각 다른 액션이 실행되는지
- Phase 3 완료 확인: 설정 UI에서 패턴 추가/수정/삭제 + 감도 조절이 동작하는지
- Phase 4 완료 확인: DMG 설치 → 공증 통과 → 첫 실행 캘리브레이션 → 탭 감지 동작
