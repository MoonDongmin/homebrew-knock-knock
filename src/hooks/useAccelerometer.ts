import { useCallback, useEffect, useRef, useState } from "react";
import {
	type AccelerometerData,
	calibrate,
	isAvailable,
	onAccelerometerData,
	startStream,
	stopStream,
} from "../../src-tauri/plugins/tauri-plugin-accelerometer/guest-js/index";
import type { AccelerometerSample, CalibrationBaseline } from "../lib/types";

interface UseAccelerometerReturn {
	isAvailable: boolean;
	isStreaming: boolean;
	lastSample: AccelerometerSample | null;
	start: () => Promise<void>;
	stop: () => Promise<void>;
	calibrate: () => Promise<CalibrationBaseline>;
	error: string | null;
}

export function useAccelerometer(): UseAccelerometerReturn {
	const [available, setAvailable] = useState(false);
	const [streaming, setStreaming] = useState(false);
	const [lastSample, setLastSample] = useState<AccelerometerSample | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const unlistenRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		let mounted = true;

		isAvailable()
			.then((result) => {
				if (mounted) setAvailable(result);
			})
			.catch((e: unknown) => {
				if (mounted) {
					setError(e instanceof Error ? e.message : String(e));
				}
			});

		return () => {
			mounted = false;
		};
	}, []);

	const handleData = useCallback((data: AccelerometerData) => {
		setLastSample({
			x: data.x,
			y: data.y,
			z: data.z,
			timestamp: data.timestamp,
		});
	}, []);

	const start = useCallback(async () => {
		try {
			setError(null);
			const unlisten = await onAccelerometerData(handleData);
			unlistenRef.current = unlisten;
			await startStream();
			setStreaming(true);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			setError(msg);
			setStreaming(false);
		}
	}, [handleData]);

	const stop = useCallback(async () => {
		try {
			unlistenRef.current?.();
			unlistenRef.current = null;
			await stopStream();
			setStreaming(false);
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, []);

	const doCalibrate = useCallback(async (): Promise<CalibrationBaseline> => {
		const result = await calibrate();
		return { x: result.x, y: result.y, z: result.z };
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			unlistenRef.current?.();
			stopStream().catch(() => {});
		};
	}, []);

	return {
		isAvailable: available,
		isStreaming: streaming,
		lastSample,
		start,
		stop,
		calibrate: doCalibrate,
		error,
	};
}
