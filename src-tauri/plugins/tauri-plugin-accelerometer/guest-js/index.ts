import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AccelerometerData {
	x: number;
	y: number;
	z: number;
	/** Microseconds since stream start */
	timestamp: number;
}

export interface CalibrationResult {
	x: number;
	y: number;
	z: number;
	samples: number;
}

export async function startStream(): Promise<void> {
	await invoke("plugin:accelerometer|start_stream");
}

export async function stopStream(): Promise<void> {
	await invoke("plugin:accelerometer|stop_stream");
}

export async function isAvailable(): Promise<boolean> {
	return await invoke<boolean>("plugin:accelerometer|is_available");
}

export async function calibrate(): Promise<CalibrationResult> {
	return await invoke<CalibrationResult>("plugin:accelerometer|calibrate");
}

export async function onAccelerometerData(
	handler: (data: AccelerometerData) => void,
): Promise<UnlistenFn> {
	return await listen<AccelerometerData>("accelerometer://data", (event) => {
		handler(event.payload);
	});
}
