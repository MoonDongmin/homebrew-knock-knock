import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import {
	calibrate,
	isAvailable,
	startStream,
	stopStream,
} from "../../src-tauri/plugins/tauri-plugin-accelerometer/guest-js/index";
import type { CalibrationBaseline } from "../lib/types";

interface UseAccelerometerReturn {
	isAvailable: boolean;
	isStreaming: boolean;
	start: () => Promise<void>;
	stop: () => Promise<void>;
	calibrate: () => Promise<CalibrationBaseline>;
	error: string | null;
}

export function useAccelerometer(): UseAccelerometerReturn {
	const [available, setAvailable] = useState(false);
	const [streaming, setStreaming] = useState(false);
	const [error, setError] = useState<string | null>(null);

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

	const start = useCallback(async () => {
		try {
			setError(null);
			await startStream();
			setStreaming(true);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			setError(msg);
			setStreaming(false);
		}
	}, []);

	const stop = useCallback(async () => {
		try {
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

	// Listen for helper connection errors (e.g., password canceled, helper timeout)
	useEffect(() => {
		let unlisten: (() => void) | undefined;

		listen<string>("accelerometer://error", (event) => {
			setError(event.payload);
			setStreaming(false);
		}).then((fn) => {
			unlisten = fn;
		});

		return () => {
			unlisten?.();
		};
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stopStream().catch(() => {});
		};
	}, []);

	return {
		isAvailable: available,
		isStreaming: streaming,
		start,
		stop,
		calibrate: doCalibrate,
		error,
	};
}
