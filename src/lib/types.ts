export interface AccelerometerSample {
	x: number;
	y: number;
	z: number;
	timestamp: number;
}

export interface CalibrationBaseline {
	x: number;
	y: number;
	z: number;
}

export type TapCount = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ActionType =
	| "media"
	| "volume"
	| "app_launch"
	| "system"
	| "keyboard_shortcut"
	| "sound_play";

export interface MediaPayload {
	key: "play_pause" | "next_track" | "previous_track";
}

export interface VolumePayload {
	key: "volume_up" | "volume_down" | "mute";
}

export interface AppLaunchPayload {
	appName: string;
	bundleId?: string;
}

export interface SystemPayload {
	command: "screenshot" | "toggle_dnd" | "lock_screen" | "sleep_display";
	script?: string;
}

export interface KeyboardShortcutPayload {
	keys: string[];
	modifiers: ("cmd" | "ctrl" | "alt" | "shift")[];
}

export interface SoundPlayPayload {
	soundName: string;
}

export type ActionPayload =
	| MediaPayload
	| VolumePayload
	| AppLaunchPayload
	| SystemPayload
	| KeyboardShortcutPayload
	| SoundPlayPayload;

export interface Action {
	type: ActionType;
	id: string;
	label: string;
	payload: ActionPayload;
}

export interface TapPattern {
	id: string;
	tapCount: TapCount;
	action: Action;
	enabled: boolean;
}

export interface AppSettings {
	patterns: TapPattern[];
	soundFeedback: boolean;
	feedbackSound: "Tink" | "Pop" | "Blow" | "Glass" | "angerychan9" | "chan9";
	monitoringEnabled: boolean;
	launchAtLogin: boolean;
	calibrationBaseline: CalibrationBaseline | null;
	calibratedThreshold: number | null;
	hasCompletedCalibration: boolean;
	locale: Locale;
}

export interface TrialState {
	status: "active" | "expiring_soon" | "expired";
	daysRemaining: number;
	trialStartedAt: string;
}

export type Locale = "en" | "ko";

export type SettingsSection = "patterns" | "sensitivity" | "sound" | "about";
