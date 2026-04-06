import { useEffect, useRef, useState } from "react";
import { onAccelerometerData } from "../../src-tauri/plugins/tauri-plugin-accelerometer/guest-js/index";
import { TapDetector } from "../core/tap-detector";
import type { CalibrationBaseline, TapCount } from "../lib/types";

interface UseTapDetectorOptions {
	enabled: boolean;
	sensitivity: number;
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
		sensitivity,
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

	// Create/dispose detector
	useEffect(() => {
		if (!enabled) {
			detectorRef.current?.dispose();
			detectorRef.current = null;
			setLiveTapCount(0);
			return;
		}

		const detector = new TapDetector({
			sensitivity,
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

		return () => {
			detector.dispose();
		};
	}, [enabled, sensitivity, baseline, calibratedThreshold]);

	// Subscribe to accelerometer data
	useEffect(() => {
		if (!enabled || !detectorRef.current) return;

		let unlisten: (() => void) | undefined;
		let mounted = true;

		const subscribe = async () => {
			unlisten = await onAccelerometerData((data) => {
				if (!mounted) return;
				detectorRef.current?.processSample({
					x: data.x,
					y: data.y,
					z: data.z,
					timestamp: data.timestamp,
				});
			});
		};

		subscribe().catch(() => {});

		return () => {
			mounted = false;
			unlisten?.();
		};
	}, [enabled]);

	// Update sensitivity without recreating detector
	useEffect(() => {
		detectorRef.current?.setSensitivity(sensitivity);
	}, [sensitivity]);

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
