<p align="center">
  <img src="image/knock_icon.png" alt="KnockKnock" width="128" height="128">
</p>

<h1 align="center">KnockKnock</h1>

<p align="center">
  Tap your desk. Your Mac responds.
</p>

<p align="center">
  <strong>English</strong> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS-14%2B-black?logo=apple" alt="macOS 14+">
  <img src="https://img.shields.io/badge/Apple%20Silicon-only-blue" alt="Apple Silicon">
  <img src="https://img.shields.io/badge/version-1.0.0-green" alt="Version">
</p>

---

## What is KnockKnock?

You're holding a coffee. A video is playing. You don't want to reach for the keyboard.

**Tap your desk twice. Music pauses.**

KnockKnock uses the hidden accelerometer inside your Apple Silicon MacBook to feel the vibrations from your desk taps and turn them into actions on your Mac. No external hardware. No wearables. Just your desk and your fingertips.

Inspired by [SlapMac](https://github.com/nickytonline/SlapMac).

<br>

## What can it do?

Map any tap pattern (1–7 taps) to one of these actions:

| Action | Description |
|---|---|
| 🚀 **App launch** | Open any app installed on your Mac |
| ▶️ **Play / Pause music** | Toggle media playback |
| ⏭ **Next track** | Skip to the next track |
| ⏮ **Previous track** | Go back to the previous track |
| 🔔 **Play sound** | Trigger a custom sound effect |

**Default mapping** out of the box:

- **2 taps** → Play / Pause
- **3 taps** → Next track
- **4 taps** → Launch an app

Every pattern is fully editable in the Patterns tab.

### 🚧 Coming soon

The following actions are on the roadmap and will land in upcoming releases:

- 🔊 **Volume controls** — Volume up / down / mute
- ⌨️ **Keyboard shortcuts** — Trigger any keyboard combo (`⌘⇧4`, `⌃⌥→`, …)
- 🖥 **System actions** — Screenshot, Do Not Disturb, Lock screen, Sleep display

<br>

## Screenshots

> Place your screenshots in `image/screenshots/` with the filenames below and they'll show up here automatically.

<p align="center">
  <img src="image/screenshots/main.png" alt="Main settings view" width="640">
</p>

| Calibration | Pattern editor | Sound feedback |
|:---:|:---:|:---:|
| <img src="image/screenshots/calibration.png" alt="Calibration" width="240"> | <img src="image/screenshots/patterns.png" alt="Pattern editor" width="240"> | <img src="image/screenshots/sound.png" alt="Sound" width="240"> |

<br>

## How to use

### 1. First launch — let KnockKnock learn your desk

When you open KnockKnock for the first time, two things happen:

1. **macOS asks for your administrator password.** This is required once per session so KnockKnock can read the built-in accelerometer. Your password is never stored.
2. **KnockKnock walks you through a short calibration.** It measures the natural noise on your desk so it can tell the difference between a tap and a passing truck.

### 2. Set your tap patterns

Open the **Patterns** tab in the sidebar. Pick how many taps should trigger which action. You can edit, disable, or add patterns up to **7 taps**.

### 3. Tap

Tap your desk. The dots at the top of the window light up in real time so you can see exactly what KnockKnock is detecting. If a tap pattern matches one of your rules, the action fires.

### 4. Live in the menu bar

KnockKnock runs quietly from the menu bar. Click the tray icon to:

- Enable / disable monitoring on the fly
- Open the settings window
- Quit the app

### 5. Tweak sensitivity

Too jumpy? Too sleepy? Open the **Sensitivity** tab and slide. KnockKnock recalibrates against the new threshold immediately.

<br>

## Install

### Homebrew (recommended)

```bash
brew tap MoonDongmin/knock-knock
brew install --cask knock-knock
```

### Manual

Download the latest `.dmg` from [Releases](https://github.com/MoonDongmin/knock-knock/releases).

### macOS Gatekeeper notice

On first launch, macOS may show **"KnockKnock is damaged and can't be opened."** This happens because the app is not code-signed with an Apple Developer certificate. The app is completely safe — you can review the full source in this repository.

Run this once after installing:

```bash
xattr -cr /Applications/KnockKnock.app
```

### Administrator privileges

KnockKnock needs **administrator privileges** to read the built-in accelerometer (IOKit HID). A macOS password dialog appears on first launch — this is a one-time prompt per session.

<br>

## Requirements

- macOS 14 (Sonoma) or later
- Apple Silicon Mac (M1 / M2 / M3 / M4)
- Administrator password (prompted on launch for accelerometer access)

<br>

## FAQ

**Will it false-trigger when I'm typing?**
Probably not. KnockKnock learns your desk's baseline noise during calibration and ignores anything below it. If it ever feels too sensitive, drop the **Sensitivity** slider a notch.

**Does it work on Intel Macs?**
No. The IOKit HID accelerometer interface only exists on Apple Silicon (M1+).

**Does it work when the MacBook is on my lap?**
Best results come from a flat, hard surface (desk, table). On soft surfaces the accelerometer signal gets dampened.

**Why does it ask for my password?**
macOS restricts raw HID device access to processes running with elevated privileges. The prompt happens once per session and your password is never stored.

**Can I get it from the Mac App Store?**
No. The IOKit HID API isn't compatible with App Store sandboxing.

<br>

## Feature Requests

Want a new tap action? Have an idea? [Open an issue](https://github.com/MoonDongmin/knock-knock/issues) — all suggestions welcome.

<br>

---

## For developers

### Tech Stack

| Layer | Technology |
|---|---|
| App Framework | Tauri v2 |
| Backend | Rust (IOKit HID, CGEvent) |
| Frontend | TypeScript + React |
| UI | Tailwind CSS |
| Build | Vite + Bun |

### Architecture

```
[IOKit HID ~800Hz] → [Rust: downsample 100Hz] → [Tauri Event] → [TS: TapDetector] → [ActionMapper] → [ActionExecutor]
```

Rust handles only the minimal hardware bridging — accelerometer access and key simulation. All business logic (tap detection, pattern matching, action mapping) lives in TypeScript.

### Development

```bash
# Install dependencies
bun install

# Run in development (password dialog appears for accelerometer)
bun run tauri dev

# Build for production
bun run tauri build

# Lint & format
bun run check
```

<br>

## License

MIT
