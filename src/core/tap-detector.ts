import { TAP_DETECTION } from "../lib/constants";
import type {
	AccelerometerSample,
	CalibrationBaseline,
	TapCount,
} from "../lib/types";

export interface TapDetectorOptions {
	onTapSequence: (count: TapCount) => void;
	onTapDetected?: () => void;
	calibratedThreshold?: number | null;
}

/**
 * Envelope-based tap detector.
 *
 * A single physical tap creates vibrations lasting 100-300ms.
 * Instead of debouncing individual spikes, we track the entire
 * vibration "envelope" as one event:
 *
 *   magnitude > threshold  →  enter active envelope, track peak
 *   still above threshold  →  stay active, reset cooldown
 *   drops below threshold  →  start cooldown timer
 *   cooldown expires (200ms of quiet)  →  confirm ONE tap
 */
export class TapDetector {
	#baseline: CalibrationBaseline = { x: 0, y: 0, z: 0 };
	#calibratedThreshold: number | null;

	// Envelope state
	#envelopeActive = false;
	#envelopeCooldownTimer: ReturnType<typeof setTimeout> | null = null;
	#cooldownStartTime = 0;

	// Tap sequence state
	#tapCount = 0;
	#lastTapTime = 0;
	#silenceTimer: ReturnType<typeof setTimeout> | null = null;

	#onTapSequence: (count: TapCount) => void;
	#onTapDetected: (() => void) | undefined;
	#disposed = false;

	constructor(options: TapDetectorOptions) {
		this.#onTapSequence = options.onTapSequence;
		this.#onTapDetected = options.onTapDetected;
		this.#calibratedThreshold = options.calibratedThreshold ?? null;
	}

	get currentTapCount(): number {
		return this.#tapCount;
	}

	get effectiveThreshold(): number {
		return this.#calibratedThreshold ?? TAP_DETECTION.threshold;
	}

	setCalibratedThreshold(threshold: number | null): void {
		this.#calibratedThreshold = threshold;
	}

	setBaseline(baseline: CalibrationBaseline): void {
		this.#baseline = { ...baseline };
	}

	processSample(sample: AccelerometerSample): void {
		if (this.#disposed) return;

		const dx = sample.x - this.#baseline.x;
		const dy = sample.y - this.#baseline.y;
		const dz = sample.z - this.#baseline.z;
		const magnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);

		if (magnitude > this.effectiveThreshold) {
			if (this.#envelopeCooldownTimer !== null) {
				// Spike arrived during cooldown — bounce or new tap?
				const elapsed = Date.now() - this.#cooldownStartTime;
				clearTimeout(this.#envelopeCooldownTimer);
				this.#envelopeCooldownTimer = null;

				if (elapsed >= TAP_DETECTION.bounceWindowMs) {
					// Gap was long enough — this is a NEW tap
					// Confirm the old envelope first, then start fresh
					this.#confirmTap();
				}
				// else: gap too short — it's a bounce, continue same envelope
			}

			this.#envelopeActive = true;
		} else if (this.#envelopeActive) {
			// Below threshold while envelope is active — start cooldown
			if (this.#envelopeCooldownTimer === null) {
				this.#cooldownStartTime = Date.now();
				this.#envelopeCooldownTimer = setTimeout(() => {
					this.#confirmTap();
				}, TAP_DETECTION.envelopeCooldownMs);
			}
		}
	}

	/** Called when cooldown expires — the vibration has fully settled */
	#confirmTap(): void {
		this.#envelopeActive = false;
		this.#envelopeCooldownTimer = null;

		const now = Date.now();

		// Check if this tap belongs to the current sequence
		if (
			this.#tapCount > 0 &&
			now - this.#lastTapTime > TAP_DETECTION.maxTapInterval
		) {
			this.#finalizeSequence();
		}

		this.#tapCount += 1;
		this.#lastTapTime = now;

		// Per-tap feedback
		this.#onTapDetected?.();

		// Cap at max
		if (this.#tapCount >= TAP_DETECTION.maxTapCount) {
			this.#finalizeSequence();
			return;
		}

		// Reset silence timer — waiting for next tap or sequence end
		this.#resetSilenceTimer();
	}

	#resetSilenceTimer(): void {
		if (this.#silenceTimer !== null) {
			clearTimeout(this.#silenceTimer);
		}

		this.#silenceTimer = setTimeout(() => {
			this.#finalizeSequence();
		}, TAP_DETECTION.silenceTimeout);
	}

	#finalizeSequence(): void {
		if (this.#silenceTimer !== null) {
			clearTimeout(this.#silenceTimer);
			this.#silenceTimer = null;
		}

		if (this.#tapCount > 0 && this.#tapCount <= TAP_DETECTION.maxTapCount) {
			this.#onTapSequence(this.#tapCount as TapCount);
		}

		this.#tapCount = 0;
	}

	reset(): void {
		if (this.#silenceTimer !== null) {
			clearTimeout(this.#silenceTimer);
			this.#silenceTimer = null;
		}
		if (this.#envelopeCooldownTimer !== null) {
			clearTimeout(this.#envelopeCooldownTimer);
			this.#envelopeCooldownTimer = null;
		}
		this.#tapCount = 0;
		this.#lastTapTime = 0;
		this.#envelopeActive = false;
		this.#cooldownStartTime = 0;
	}

	dispose(): void {
		this.#disposed = true;
		this.reset();
	}
}
