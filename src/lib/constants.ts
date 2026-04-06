import type { AppSettings } from "./types";

export const TAP_DETECTION = {
	threshold: 0.04,
	maxTapInterval: 500,
	silenceTimeout: 600,
	maxTapCount: 7,
	/** Quiet period after vibration settles to confirm one physical tap (ms) */
	envelopeCooldownMs: 200,
	/** Max time a bounce can arrive after a dip — spikes after this are a new tap (ms) */
	bounceWindowMs: 80,
} as const;

export const CALIBRATION = {
	durationMs: 1000,
	minSamples: 50,
} as const;

export const TAP_CALIBRATION = {
	/** Knock counts to verify during calibration */
	verifySteps: [1, 2, 3] as const,
	/** Initial threshold to start calibration with — intentionally low to catch most taps */
	initialThreshold: 0.008,
	/** How much to adjust threshold on mismatch (multiplicative) */
	thresholdAdjustStep: 0.4,
	/** Min / max threshold bounds (g-force) */
	thresholdMin: 0.002,
	thresholdMax: 0.5,
} as const;

export const TRIAL = {
	durationDays: 7,
	warningDays: [3, 1] as const,
	offlineGraceDays: 30,
} as const;

export const SENSITIVITY_RANGE = {
	min: 0.5,
	max: 2.0,
	step: 0.1,
	default: 1.0,
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
	patterns: [],
	sensitivity: SENSITIVITY_RANGE.default,
	soundFeedback: true,
	feedbackSound: "Tink",
	monitoringEnabled: true,
	launchAtLogin: false,
	calibrationBaseline: null,
	calibratedThreshold: null,
	hasCompletedCalibration: false,
	locale: "ko",
};
