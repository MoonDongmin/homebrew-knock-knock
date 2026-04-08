import { useEffect, useRef, useState } from "react";
import { onAccelerometerData } from "../../src-tauri/plugins/tauri-plugin-accelerometer/guest-js/index";
import { TapDetector } from "../core/tap-detector";
import type { CalibrationBaseline, TapCount } from "../lib/types";

interface UseTapDetectorOptions {
	enabled: boolean;
	baseline: CalibrationBaseline | null;
	calibratedThreshold: number | null;
	onTapSequence: (count: TapCount) => void;
	onTapDetected?: () => void;
}

interface UseTapDetectorReturn {
	liveTapCount: number;
	lastSequence: TapCount | null;
}

export function useTapDetector(
	options: UseTapDetectorOptions,
): UseTapDetectorReturn {
	const {
		enabled,
		baseline,
		calibratedThreshold,
		onTapSequence,
		onTapDetected,
	} = options;

	const [liveTapCount, setLiveTapCount] = useState(0);
	const [lastSequence, setLastSequence] = useState<TapCount | null>(null);

	const detectorRef = useRef<TapDetector | null>(null);
	const onTapSequenceRef = useRef(onTapSequence);
	const onTapDetectedRef = useRef(onTapDetected);

	// Keep callback refs current
	onTapSequenceRef.current = onTapSequence;
	onTapDetectedRef.current = onTapDetected;

	// Create detector + subscribe to accelerometer data in a single effect.
	// Keeping them together eliminates timing issues between detector creation
	// and data subscription. Sensitivity, baseline, and threshold are updated
	// via dedicated effects to avoid destroying in-progress tap detection state.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional — setter effects handle sensitivity/baseline/threshold updates
	useEffect(() => {
		if (!enabled) {
			detectorRef.current?.dispose();
			detectorRef.current = null;
			setLiveTapCount(0);
			return;
		}

		const detector = new TapDetector({
			calibratedThreshold,
			onTapSequence: (count) => {
				setLastSequence(count);
				setLiveTapCount(0);
				onTapSequenceRef.current(count);
			},
			onTapDetected: () => {
				setLiveTapCount((prev) => prev + 1);
				onTapDetectedRef.current?.();
			},
		});

		if (baseline) {
			detector.setBaseline(baseline);
		}

		detectorRef.current = detector;

		// Subscribe to accelerometer data with race-safe async cleanup
		let cancelled = false;
		let unlistenFn: (() => void) | null = null;

		onAccelerometerData((data) => {
			if (cancelled) return;
			detector.processSample({
				x: data.x,
				y: data.y,
				z: data.z,
				timestamp: data.timestamp,
			});
		}).then((fn) => {
			if (cancelled) {
				fn();
			} else {
				unlistenFn = fn;
			}
		});

		return () => {
			cancelled = true;
			unlistenFn?.();
			detector.dispose();
		};
	}, [enabled]);

	// Update calibrated threshold without recreating detector
	useEffect(() => {
		detectorRef.current?.setCalibratedThreshold(calibratedThreshold);
	}, [calibratedThreshold]);

	// Update baseline without recreating detector
	const prevBaseline = useRef(baseline);
	useEffect(() => {
		if (baseline && baseline !== prevBaseline.current) {
			detectorRef.current?.setBaseline(baseline);
			prevBaseline.current = baseline;
		}
	}, [baseline]);

	return { liveTapCount, lastSequence };
}
