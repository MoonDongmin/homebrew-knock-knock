import { useEffect, useRef, useState } from "react";
import { useLocale } from "../hooks/useLocale";
import { TAP_CALIBRATION, TAP_DETECTION } from "../lib/constants";

interface TapTestEntry {
	detected: number;
	timestamp: number;
}

interface SensitivitySliderProps {
	calibratedThreshold: number | null;
	onThresholdChange: (threshold: number) => void;
	isMonitoring: boolean;
	liveTapCount: number;
	tapTestHistory: TapTestEntry[];
	onClearHistory: () => void;
	onRecalibrate: () => void;
}

// Log-scale helpers (same approach as CalibrationView)
const LOG_MIN = -Math.log10(TAP_CALIBRATION.thresholdMax);
const LOG_MAX = -Math.log10(TAP_CALIBRATION.thresholdMin);

function thresholdToSlider(threshold: number): number {
	return -Math.log10(threshold);
}

function sliderToThreshold(sliderValue: number): number {
	return 10 ** -sliderValue;
}

function thresholdToPercent(threshold: number): number {
	const logVal = Math.log10(threshold);
	const logMin = Math.log10(TAP_CALIBRATION.thresholdMin);
	const logMax = Math.log10(TAP_CALIBRATION.thresholdMax);
	return Math.round(((logMax - logVal) / (logMax - logMin)) * 100);
}

export function SensitivitySlider({
	calibratedThreshold,
	onThresholdChange,
	isMonitoring,
	liveTapCount,
	tapTestHistory,
	onClearHistory,
	onRecalibrate,
}: SensitivitySliderProps) {
	const { t } = useLocale();

	const threshold = calibratedThreshold ?? TAP_DETECTION.threshold;
	const sensitivityPercent = thresholdToPercent(threshold);

	// Pulse animation when a new tap is detected in-progress
	const [pulse, setPulse] = useState(false);
	const prevTapCount = useRef(liveTapCount);
	useEffect(() => {
		if (liveTapCount > prevTapCount.current) {
			setPulse(true);
			const timer = setTimeout(() => setPulse(false), 300);
			return () => clearTimeout(timer);
		}
		prevTapCount.current = liveTapCount;
	}, [liveTapCount]);

	// Flash animation when a sequence completes (new entry in history)
	const [flash, setFlash] = useState(false);
	const prevHistoryLen = useRef(tapTestHistory.length);
	useEffect(() => {
		if (tapTestHistory.length > prevHistoryLen.current) {
			setFlash(true);
			const timer = setTimeout(() => setFlash(false), 600);
			prevHistoryLen.current = tapTestHistory.length;
			return () => clearTimeout(timer);
		}
		prevHistoryLen.current = tapTestHistory.length;
	}, [tapTestHistory.length]);

	const formatTime = (ts: number) => {
		const d = new Date(ts);
		return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
	};

	return (
		<div className="space-y-8">
			<div>
				<h3 className="text-lg font-semibold text-white mb-2">
					{t("sensitivity.title")}
				</h3>
				<p className="text-sm text-gray-400 leading-relaxed">
					{t("sensitivity.desc")}
				</p>
			</div>

			{/* ── Live Test Zone ── */}
			{calibratedThreshold === null ? (
				<div className="bg-gray-900 rounded-xl p-5 space-y-3 border border-gray-800 text-center">
					<div className="w-12 h-12 mx-auto rounded-full bg-amber-600/10 flex items-center justify-center">
						<svg
							className="w-6 h-6 text-amber-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={1.5}
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
							/>
						</svg>
					</div>
					<h4 className="text-sm font-medium text-gray-300">
						{t("sensitivity.needsCalibration")}
					</h4>
					<p className="text-xs text-gray-500">
						{t("sensitivity.needsCalibrationDesc")}
					</p>
					<button
						type="button"
						onClick={onRecalibrate}
						className="mt-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors"
					>
						{t("settings.recalibrate")}
					</button>
				</div>
			) : (
				<div className="bg-gray-900 rounded-xl p-5 space-y-4 border border-gray-800">
					{/* Header with status */}
					<div className="flex items-center justify-between">
						<h4 className="text-sm font-medium text-gray-300">
							{t("sensitivity.liveTest")}
						</h4>
						<div className="flex items-center gap-2">
							<div
								className={`w-2 h-2 rounded-full ${
									isMonitoring ? "bg-green-400 animate-pulse" : "bg-gray-600"
								}`}
							/>
							<span className="text-xs text-gray-500">
								{isMonitoring
									? t("sensitivity.listening")
									: t("sensitivity.paused")}
							</span>
						</div>
					</div>

					{/* Tap indicator dots */}
					<div className="flex items-center justify-center gap-3 py-4">
						{Array.from({ length: TAP_DETECTION.maxTapCount }).map((_, i) => {
							const dotNum = i + 1;
							const isActive = i < liveTapCount;
							const isLatest = i === liveTapCount - 1 && pulse;
							return (
								<div
									key={`dot-${dotNum}`}
									className={`relative flex items-center justify-center transition-all duration-200 ${
										isActive ? "w-10 h-10" : "w-8 h-8"
									}`}
								>
									{/* Ripple effect on latest tap */}
									{isLatest && (
										<div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
									)}
									<div
										className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
											isActive
												? "bg-blue-500 text-white scale-110"
												: "bg-gray-800 text-gray-600 border border-gray-700"
										}`}
									>
										{dotNum}
									</div>
								</div>
							);
						})}
					</div>

					{/* Current detection status */}
					<div
						className={`text-center py-2 rounded-lg transition-all duration-300 ${
							liveTapCount > 0
								? "bg-blue-500/10 text-blue-400"
								: flash && tapTestHistory.length > 0
									? "bg-green-500/10 text-green-400"
									: "bg-gray-800/50 text-gray-500"
						}`}
					>
						<span className="text-sm font-medium">
							{liveTapCount > 0
								? t("sensitivity.detecting", { n: liveTapCount })
								: flash && tapTestHistory.length > 0
									? t("sensitivity.detected", {
											n: tapTestHistory[0]?.detected ?? 0,
										})
									: isMonitoring
										? t("sensitivity.knockToTest")
										: t("sensitivity.enableMonitoring")}
						</span>
					</div>

					{/* Recent detection history */}
					{tapTestHistory.length > 0 && (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-xs text-gray-500">
									{t("sensitivity.recentTests")}
								</span>
								<button
									type="button"
									onClick={onClearHistory}
									className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
								>
									{t("sensitivity.clear")}
								</button>
							</div>
							<div className="space-y-1">
								{tapTestHistory.map((entry) => (
									<div
										key={entry.timestamp}
										className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-1.5"
									>
										<div className="flex items-center gap-2">
											<div className="flex gap-0.5">
												{Array.from(
													{ length: entry.detected },
													(_, k) => `${entry.timestamp}-${k}`,
												).map((id) => (
													<div
														key={id}
														className="w-1.5 h-1.5 rounded-full bg-blue-400"
													/>
												))}
											</div>
											<span className="text-sm text-gray-300">
												{t("sensitivity.nKnocks", {
													n: entry.detected,
												})}
											</span>
										</div>
										<span className="text-xs text-gray-600 font-mono">
											{formatTime(entry.timestamp)}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* ── Slider (log scale, same as CalibrationView) ── */}
			{calibratedThreshold !== null && (
				<div className="space-y-4">
					<div className="space-y-2">
						<div className="flex justify-between text-xs text-gray-500">
							<span>{t("cal.lessSensitive")}</span>
							<span>{t("cal.moreSensitive")}</span>
						</div>
						<input
							type="range"
							min={LOG_MIN}
							max={LOG_MAX}
							step={0.01}
							value={thresholdToSlider(threshold)}
							onChange={(e) => {
								onThresholdChange(sliderToThreshold(Number(e.target.value)));
							}}
							className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-500"
						/>
					</div>

					{/* Value display */}
					<div className="flex justify-between items-center bg-gray-900 rounded-lg px-4 py-3">
						<div className="text-sm text-gray-400">
							{t("sensitivity.current")}
						</div>
						<div className="text-sm font-mono text-white">
							{sensitivityPercent}%
						</div>
					</div>
				</div>
			)}
			{/* Recalibrate */}
			<button
				type="button"
				onClick={onRecalibrate}
				className="w-full px-4 py-3 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 transition-colors"
			>
				{t("settings.recalibrate")}
			</button>
		</div>
	);
}
