import { invoke } from "@tauri-apps/api/core";
import { Command } from "@tauri-apps/plugin-shell";
import type {
	Action,
	AppLaunchPayload,
	KeyboardShortcutPayload,
	MediaPayload,
	SoundPlayPayload,
	SystemPayload,
	VolumePayload,
} from "../lib/types";

const SYSTEM_SCRIPTS: Record<SystemPayload["command"], string> = {
	screenshot:
		'tell application "System Events" to keystroke "$" using {command down, shift down}',
	toggle_dnd: `
		tell application "System Events"
			tell process "ControlCenter"
				click menu bar item "Focus" of menu bar 1
			end tell
		end tell
	`,
	lock_screen:
		'tell application "System Events" to keystroke "q" using {command down, control down}',
	sleep_display: 'do shell script "pmset displaysleepnow"',
};

export class ActionExecutor {
	#soundEnabled: boolean;
	#feedbackSound: string;

	constructor(soundEnabled = true, feedbackSound = "Tink") {
		this.#soundEnabled = soundEnabled;
		this.#feedbackSound = feedbackSound;
	}

	setSoundEnabled(enabled: boolean): void {
		this.#soundEnabled = enabled;
	}

	setFeedbackSound(sound: string): void {
		this.#feedbackSound = sound;
	}

	async execute(action: Action): Promise<void> {
		// Play feedback sound before executing the action,
		// but skip when the action itself is a sound (to avoid double audio)
		if (this.#soundEnabled && action.type !== "sound_play") {
			this.#playFeedback().catch(() => {
				// Feedback sound failure is non-critical
			});
		}

		switch (action.type) {
			case "media":
				await this.#executeMedia(action.payload as MediaPayload);
				break;
			case "volume":
				await this.#executeVolume(action.payload as VolumePayload);
				break;
			case "app_launch":
				await this.#executeAppLaunch(action.payload as AppLaunchPayload);
				break;
			case "system":
				await this.#executeSystem(action.payload as SystemPayload);
				break;
			case "keyboard_shortcut":
				await this.#executeKeyboardShortcut(
					action.payload as KeyboardShortcutPayload,
				);
				break;
			case "sound_play":
				await this.#executeSoundPlay(action.payload as SoundPlayPayload);
				break;
		}
	}

	async #executeMedia(payload: MediaPayload): Promise<void> {
		await invoke("simulate_media_key", { key: payload.key });
	}

	async #executeVolume(payload: VolumePayload): Promise<void> {
		await invoke("simulate_media_key", { key: payload.key });
	}

	async #executeAppLaunch(payload: AppLaunchPayload): Promise<void> {
		const cmd = Command.create("exec-sh", [
			"-c",
			`open -a "${payload.appName}"`,
		]);
		await cmd.execute();
	}

	async #executeSystem(payload: SystemPayload): Promise<void> {
		const script = payload.script ?? SYSTEM_SCRIPTS[payload.command];
		if (!script) return;

		const cmd = Command.create("exec-sh", ["-c", `osascript -e '${script}'`]);
		await cmd.execute();
	}

	async #executeKeyboardShortcut(
		payload: KeyboardShortcutPayload,
	): Promise<void> {
		await invoke("simulate_keyboard_shortcut", {
			keys: payload.keys,
			modifiers: payload.modifiers,
		});
	}

	async #executeSoundPlay(payload: SoundPlayPayload): Promise<void> {
		await invoke("play_feedback_sound", { soundName: payload.soundName });
	}

	async #playFeedback(): Promise<void> {
		await invoke("play_feedback_sound", { soundName: this.#feedbackSound });
	}
}
