# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KnockKnock — macOS 메뉴바 유틸리티 앱. Apple Silicon MacBook 내장 가속도계로 책상 탭(두드리기)을 감지하여 탭 횟수에 따라 시스템 액션(미디어 제어, 앱 실행 등)을 실행하는 자동화 앱.

- **Target**: macOS 14+ / Apple Silicon (M1+)
- **Model**: Freemium ($4.99 일회성 Pro 업그레이드)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App Framework | Tauri v2 |
| Backend | Rust (IOKit HID 가속도계, CGEvent 미디어키) |
| Frontend | TypeScript + React |
| UI | Tailwind CSS |
| Build | Vite + Bun |
| Package Manager | Bun (frontend), Cargo (Rust) |
| Linting/Formatting | Biome |

## Commands

```bash
# Frontend
bun install                    # Install dependencies
bun run dev                    # Start Vite dev server
bun run build                  # Build frontend
bun run check                  # Biome check (lint + format)

# Tauri
cargo tauri dev                # Run app in development
cargo tauri build              # Build for production

# Rust (from src-tauri/)
cargo build                    # Build Rust backend
cargo test                     # Run Rust tests
cargo clippy                   # Lint Rust code

# Accelerometer plugin (from src-tauri/plugins/tauri-plugin-accelerometer/)
cargo build                    # Build plugin
cargo test                     # Test plugin
```

## Architecture

### Rust/TypeScript 역할 분배 (핵심 원칙)

**Rust는 최소한의 하드웨어 브릿지만 담당**. 모든 비즈니스 로직은 TypeScript에 위치.

- **Rust**: IOKit HID 디바이스 접근, 가속도 데이터 이벤트 발행, CGEvent 미디어키/키보드 시뮬레이션, 오디오 재생
- **TypeScript**: 탭 감지 알고리즘, 패턴 매칭, 액션 매핑/실행, 설정 관리, UI, 라이선스

### 데이터 흐름

```
[IOKit HID ~800Hz] → [Rust: 다운샘플 100Hz] → [Tauri Event] → [TS: TapDetector] → [ActionMapper] → [ActionExecutor]
```

### 가속도계 접근

- Apple Silicon MacBook의 가속도계는 **문서화되지 않은 IOKit HID 인터페이스**로만 접근 가능
- 디바이스: `AppleSPUHIDDevice`, Usage Page `0xFF00`, Usage `3`
- 22바이트 HID 리포트 → x/y/z i32 (offset 6,10,14) / 65536.0 = g-force
- **root 권한 필요** (MVP에서는 관리자 비밀번호 요청, v1.1에서 SMJobBless 마이그레이션 예정)

### 탭 감지 알고리즘 상수

```
threshold: 0.15g, maxTapInterval: 500ms, silenceTimeout: 600ms, debounceWindow: 80ms, maxTapCount: 7
```

노이즈 필터링: 연속 2+ 샘플이 threshold 초과해야 유효한 탭.

### 앱 특성

- 메뉴바 전용 앱 (`ActivationPolicy::Accessory`) — Dock 아이콘 없음
- 설정은 `@tauri-apps/plugin-store` (JSON key-value) 사용
- Mac App Store 배포 불가 (IOKit HID + 샌드박싱 비호환)

## 수익 모델: 7일 Trial + $4.99 일회성 구매

- 첫 실행부터 7일간 **모든 기능 제한 없이** 사용 가능
- Trial 시작 시점 + `lastCheckedAt`을 `@tauri-apps/plugin-store`에 저장 (시간 조작 방지)
- 만료 후: 탭 감지 중단, 구매 안내 화면만 표시
- 라이선스: LemonSqueezy 또는 Gumroad, 오프라인 30일간 유효
