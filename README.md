<p align="center">
  <img src="image/knock_icon.png" alt="KnockKnock" width="128" height="128">
</p>

<h1 align="center">KnockKnock</h1>

<p align="center">
  Detect desk taps with your MacBook's built-in accelerometer and trigger system actions.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS-14%2B-black?logo=apple" alt="macOS 14+">
  <img src="https://img.shields.io/badge/Apple%20Silicon-only-blue" alt="Apple Silicon">
  <img src="https://img.shields.io/badge/version-0.1.0-green" alt="Version">
</p>

---

## What is KnockKnock?

KnockKnock turns your MacBook into a tap-sensitive automation tool. Tap your desk — and your Mac responds.

- **2 taps** — Play/Pause media
- **3 taps** — Next track
- **4 taps** — Launch an app
- **...and more** — Fully customizable up to 7 taps

Built with Apple Silicon's built-in accelerometer (no external hardware needed).

## Install

### Homebrew (recommended)

```bash
brew tap MoonDongmin/knock-knock
brew install --cask knock-knock
```

### Manual

Download the latest `.dmg` from [Releases](https://github.com/MoonDongmin/knock-knock/releases).

## Requirements

- macOS 14 (Sonoma) or later
- Apple Silicon Mac (M1/M2/M3/M4)
- Administrator password (required for accelerometer access)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App Framework | Tauri v2 |
| Backend | Rust (IOKit HID, CGEvent) |
| Frontend | TypeScript + React |
| UI | Tailwind CSS |
| Build | Vite + Bun |

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run tauri dev

# Build for production
bun run tauri build

# Lint & format
bun run check
```

## Architecture

```
[IOKit HID ~800Hz] → [Rust: downsample 100Hz] → [Tauri Event] → [TS: TapDetector] → [ActionMapper] → [ActionExecutor]
```

Rust handles minimal hardware bridging (accelerometer access, key simulation). All business logic — tap detection, pattern matching, action mapping — lives in TypeScript.

## Inspiration

This project was inspired by [SlapMac](https://github.com/nickytonline/SlapMac) — a fun idea of interacting with your Mac through physical gestures.

## License

MIT
