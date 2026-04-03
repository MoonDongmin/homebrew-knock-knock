import { useCallback, useEffect, useRef, useState } from "react";
import {
	type AccelerometerData,
	isAvailable,
	onAccelerometerData,
	startStream,
	stopStream,
} from "../src-tauri/plugins/tauri-plugin-accelerometer/guest-js/index";

type StreamStatus = "idle" | "streaming" | "error" | "unavailable";

function App() {
	const [status, setStatus] = useState<StreamStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [data, setData] = useState<AccelerometerData | null>(null);
	const [sps, setSps] = useState(0);
	const sampleCount = useRef(0);
	const lastSecond = useRef(Date.now());

	const handleData = useCallback((sample: AccelerometerData) => {
		setData(sample);

		// Calculate samples per second
		sampleCount.current += 1;
		const now = Date.now();
		if (now - lastSecond.current >= 1000) {
			setSps(sampleCount.current);
			sampleCount.current = 0;
			lastSecond.current = now;
		}
	}, []);

	useEffect(() => {
		let unlisten: (() => void) | undefined;
		let mounted = true;

		async function init() {
			try {
				const available = await isAvailable();
				if (!available) {
					if (mounted) setStatus("unavailable");
					return;
				}

				unlisten = await onAccelerometerData(handleData);
				await startStream();
				if (mounted) setStatus("streaming");
			} catch (e) {
				if (mounted) {
					setStatus("error");
					setError(e instanceof Error ? e.message : String(e));
				}
			}
		}

		init();

		return () => {
			mounted = false;
			unlisten?.();
			stopStream().catch(() => {});
		};
	}, [handleData]);

	const magnitude = data
		? Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2)
		: 0;

	return (
		<div className="min-h-screen bg-gray-900 text-white p-6 font-mono">
			<div className="max-w-md mx-auto">
				<h1 className="text-xl font-bold mb-1">KnockKnock</h1>
				<p className="text-gray-500 text-sm mb-6">
					Accelerometer Debug — Phase 1
				</p>

				{/* Status */}
				<div className="flex items-center gap-2 mb-6">
					<div
						className={`w-2 h-2 rounded-full ${
							status === "streaming"
								? "bg-green-400 animate-pulse"
								: status === "error"
									? "bg-red-400"
									: status === "unavailable"
										? "bg-yellow-400"
										: "bg-gray-500"
						}`}
					/>
					<span className="text-sm text-gray-400">
						{status === "streaming" && `Streaming · ${sps} samples/sec`}
						{status === "idle" && "Connecting..."}
						{status === "error" && `Error: ${error}`}
						{status === "unavailable" &&
							"Accelerometer not found. Run with sudo?"}
					</span>
				</div>

				{/* Axes */}
				{data && (
					<div className="space-y-3">
						<AxisRow label="X" value={data.x} />
						<AxisRow label="Y" value={data.y} />
						<AxisRow label="Z" value={data.z} />

						<div className="border-t border-gray-700 pt-3 mt-4">
							<div className="flex justify-between text-sm">
								<span className="text-gray-400">Magnitude</span>
								<span className="text-white font-bold">
									{magnitude.toFixed(4)}g
								</span>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function AxisRow({ label, value }: { label: string; value: number }) {
	// Map value range [-2g, 2g] to bar width [0%, 100%]
	const barWidth = Math.min(Math.abs(value) / 2, 1) * 100;
	const isPositive = value >= 0;

	return (
		<div>
			<div className="flex justify-between text-sm mb-1">
				<span className="text-gray-400">{label}</span>
				<span className="tabular-nums">{value.toFixed(4)}g</span>
			</div>
			<div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
				<div
					className={`h-full rounded-full transition-all duration-75 ${
						isPositive ? "bg-blue-400" : "bg-orange-400"
					}`}
					style={{ width: `${barWidth}%` }}
				/>
			</div>
		</div>
	);
}

export default App;
