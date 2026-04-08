import { useCallback, useEffect, useRef, useState } from "react";
import {
	onAccelerometerData,
	startStream,
	stopStream,
} from "../../src-tauri/plugins/tauri-plugin-accelerometer/guest-js/index";
import { TapDetector } from "../core/tap-detector";
import { useLocale } from "../hooks/useLocale";
import { TAP_CALIBRATION } from "../lib/constants";
import type { CalibrationBaseline, TapCount } from "../lib/types";

// ─── Types ──────────────────────────────────────────────

type CalibrationPhase =
	| "baseline-prepare"
	| "baseline-measuring"
	| "knock-test"
	| "complete";

interface KnockTestState {
	/** Which knock count we're currently verifying (1, 2, or 3) */
	targetCount: number;
	/** "waiting" = not started, "listening" = actively listening + adjusting */
	status: "waiting" | "listening";
	/** Last detected count (null if none yet) */
	lastDetectedCount: number | null;
	/** Whether last detection matched the target */
	lastDetectedCorrect: boolean;
	/** Whether at least one correct detection happened (enables confirm button) */
	hasConfirmed: boolean;
	/** Live tap count while listening (before sequence finalizes) */
	liveTapCount: number;
}

interface CalibrationResult {
	baseline: CalibrationBaseline;
	threshold: number;
}

interface CalibrationViewProps {
	onCalibrate: () => Promise<CalibrationBaseline>;
	onComplete: (result: CalibrationResult) => void;
	onCancel?: () => void;
}

// ─── Component ──────────────────────────────────────────

export function CalibrationView({
	onCalibrate,
	onComplete,
	onCancel,
}: CalibrationViewProps) {
	const { t } = useLocale();
	const [phase, setPhase] = useState<CalibrationPhase>("baseline-prepare");
	const [error, setError] = useState<string | null>(null);
	const [baseline, setBaseline] = useState<CalibrationBaseline | null>(null);
	const [threshold, setThreshold] = useState<number>(
		TAP_CALIBRATION.initialThreshold,
	);
	const [knockTest, setKnockTest] = useState<KnockTestState>({
		targetCount: TAP_CALIBRATION.verifySteps[0],
		status: "waiting",
		lastDetectedCount: null,
		lastDetectedCorrect: false,
		hasConfirmed: false,
		liveTapCount: 0,
	});
	const [completedSteps, setCompletedSteps] = useState<number[]>([]);

	const unlistenRef = useRef<(() => void) | null>(null);
	const detectorRef = useRef<TapDetector | null>(null);
	const baselineRef = useRef<CalibrationBaseline | null>(null);
	const thresholdRef = useRef(threshold);
	const targetCountRef = useRef(knockTest.targetCount);

	// Keep refs in sync
	baselineRef.current = baseline;
	thresholdRef.current = threshold;
	targetCountRef.current = knockTest.targetCount;

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			unlistenRef.current?.();
			detectorRef.current?.dispose();
			stopStream().catch(() => {});
		};
	}, []);

	// ─── Baseline ───────────────────────────────────────

	const startBaseline = useCallback(async () => {
		setPhase("baseline-measuring");
		setError(null);
		try {
			const result = await onCalibrate();
			setBaseline(result);
			setPhase("knock-test");
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : String(e));
			setPhase("baseline-prepare");
		}
	}, [onCalibrate]);

	// ─── Knock test helpers ─────────────────────────────

	const stopListening = useCallback(async () => {
		unlistenRef.current?.();
		unlistenRef.current = null;
		detectorRef.current?.dispose();
		detectorRef.current = null;
		await stopStream().catch(() => {});
	}, []);

	const startListening = useCallback(async () => {
		const bl = baselineRef.current;
		if (!bl) return;

		setKnockTest((prev) => ({
			...prev,
			status: "listening",
			lastDetectedCount: null,
			lastDetectedCorrect: false,
			liveTapCount: 0,
		}));

		const targetCount = targetCountRef.current;

		// Create TapDetector with current threshold (from ref for freshness)
		const detector = new TapDetector({
			calibratedThreshold: thresholdRef.current,
			onTapSequence: (count: TapCount) => {
				const isCorrect = count === targetCount;
				setKnockTest((prev) => ({
					...prev,
					lastDetectedCount: count,
					lastDetectedCorrect: isCorrect,
					hasConfirmed: prev.hasConfirmed || isCorrect,
					liveTapCount: 0,
				}));
			},
			onTapDetected: () => {
				setKnockTest((prev) => ({
					...prev,
					liveTapCount: prev.liveTapCount + 1,
				}));
			},
		});
		detector.setBaseline(bl);
		detectorRef.current = detector;

		try {
			const unlisten = await onAccelerometerData((data) => {
				detectorRef.current?.processSample({
					x: data.x,
					y: data.y,
					z: data.z,
					timestamp: data.timestamp,
				});
			});
			unlistenRef.current = unlisten;

			await startStream();
		} catch (e: unknown) {
			await stopListening();
			setError(e instanceof Error ? e.message : String(e));
		}
	}, [stopListening]);

	// ─── User actions ───────────────────────────────────

	const handleConfirm = useCallback(async () => {
		await stopListening();

		const next = [...completedSteps, knockTest.targetCount];
		setCompletedSteps(next);

		const nextStepIndex =
			TAP_CALIBRATION.verifySteps.indexOf(
				knockTest.targetCount as (typeof TAP_CALIBRATION.verifySteps)[number],
			) + 1;

		if (nextStepIndex >= TAP_CALIBRATION.verifySteps.length) {
			// All steps verified — done
			setPhase("complete");
		} else {
			// Move to next knock count and auto-start listening
			const nextTarget = TAP_CALIBRATION.verifySteps[nextStepIndex] as number;
			targetCountRef.current = nextTarget;
			setKnockTest({
				targetCount: nextTarget,
				status: "listening",
				lastDetectedCount: null,
				lastDetectedCorrect: false,
				hasConfirmed: false,
				liveTapCount: 0,
			});
			startListening();
		}
	}, [completedSteps, knockTest.targetCount, stopListening, startListening]);

	const handleCancelListening = useCallback(async () => {
		await stopListening();
		setKnockTest((prev) => ({
			...prev,
			status: "waiting",
			lastDetectedCount: null,
			lastDetectedCorrect: false,
			hasConfirmed: false,
			liveTapCount: 0,
		}));
	}, [stopListening]);

	// Handle threshold slider change — restart listening if active
	const handleSliderChange = useCallback(
		(newThreshold: number) => {
			setThreshold(newThreshold);
			thresholdRef.current = newThreshold;
			if (knockTest.status === "listening") {
				stopListening().then(() => startListening());
			}
		},
		[knockTest.status, stopListening, startListening],
	);

	const finish = useCallback(() => {
		if (baseline) {
			onComplete({ baseline, threshold });
		}
	}, [baseline, threshold, onComplete]);

	// ─── Render ─────────────────────────────────────────

	const totalSteps = TAP_CALIBRATION.verifySteps.length + 1; // +1 for baseline
	const currentStepIndex =
		phase === "baseline-prepare" || phase === "baseline-measuring"
			? 0
			: phase === "complete"
				? totalSteps
				: completedSteps.length + 1;

	// Threshold → sensitivity percentage (log scale)
	const logMin = Math.log10(TAP_CALIBRATION.thresholdMin);
	const logMax = Math.log10(TAP_CALIBRATION.thresholdMax);
	const sensitivityPercent = Math.round(
		((logMax - Math.log10(threshold)) / (logMax - logMin)) * 100,
	);

	return (
		<div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
			<div className="max-w-md w-full text-center space-y-8">
				{/* Step indicator */}
				<div className="flex items-center justify-center gap-1">
					{Array.from({ length: totalSteps }).map((_, i) => {
						const isDone = i < currentStepIndex;
						const isActive = i === currentStepIndex;
						const label =
							i === 0
								? t("cal.baseline")
								: t("cal.knock", {
										n: TAP_CALIBRATION.verifySteps[i - 1] as number,
									});
						return (
							<div key={label} className="flex items-center gap-1">
								{i > 0 && (
									<div
										className={`w-6 h-0.5 ${isDone ? "bg-blue-500" : "bg-gray-700"}`}
									/>
								)}
								<div
									className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
										isDone
											? "bg-blue-500 text-white"
											: isActive
												? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500"
												: "bg-gray-800 text-gray-500"
									}`}
								>
									{isDone ? <CheckIcon /> : i + 1}
								</div>
								<span
									className={`text-xs ${isActive ? "text-gray-300" : "text-gray-500"}`}
								>
									{label}
								</span>
							</div>
						);
					})}
				</div>

				{/* ── Baseline prepare ── */}
				{phase === "baseline-prepare" && (
					<>
						<div className="space-y-2">
							<StepIcon color="blue">
								<LaptopIcon />
							</StepIcon>
							<h1 className="text-2xl font-bold text-white">
								{t("cal.baseline")}
							</h1>
							<p className="text-gray-400">{t("cal.baseline.desc")}</p>
						</div>
						{error && <ErrorBanner message={error} />}
						<button
							type="button"
							onClick={startBaseline}
							className="w-full py-3 px-6 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
						>
							{t("cal.baseline.start")}
						</button>
						{onCancel && (
							<button
								type="button"
								onClick={onCancel}
								className="w-full py-2.5 px-6 rounded-xl border border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-900 transition-colors text-sm"
							>
								{t("cal.backToHome")}
							</button>
						)}
					</>
				)}

				{/* ── Baseline measuring ── */}
				{phase === "baseline-measuring" && (
					<>
						<div className="space-y-4">
							<StepIcon color="blue" animate>
								<SpinnerIcon />
							</StepIcon>
							<h1 className="text-2xl font-bold text-white">
								{t("cal.baseline.measuring")}
							</h1>
							<p className="text-gray-400">{t("cal.baseline.holdStill")}</p>
						</div>
						<div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
							<div className="h-full bg-blue-500 rounded-full animate-[calibration-progress_1s_ease-in-out_forwards]" />
						</div>
					</>
				)}

				{/* ── Knock test ── */}
				{phase === "knock-test" && (
					<>
						{/* Waiting — show instructions and start button */}
						{knockTest.status === "waiting" && (
							<>
								<div className="space-y-2">
									<div className="w-20 h-20 mx-auto rounded-2xl bg-amber-600/10 flex items-center justify-center">
										<span className="text-4xl font-bold text-amber-400">
											{knockTest.targetCount}
										</span>
									</div>
									<h1 className="text-2xl font-bold text-white">
										{t("cal.knockTest", { n: knockTest.targetCount })}
									</h1>
									<p className="text-gray-400">
										{t("cal.knockTest.desc", { n: knockTest.targetCount })}
									</p>
								</div>
								{error && <ErrorBanner message={error} />}

								<button
									type="button"
									onClick={startListening}
									className="w-full py-3 px-6 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-500 transition-colors"
								>
									{t("cal.startSensitivity")}
								</button>
								{onCancel && (
									<button
										type="button"
										onClick={onCancel}
										className="w-full py-2.5 px-6 rounded-xl border border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-900 transition-colors text-sm"
									>
										{t("cal.backToHome")}
									</button>
								)}
							</>
						)}

						{/* Listening — continuous test & adjust */}
						{knockTest.status === "listening" && (
							<>
								<div className="space-y-4">
									<div className="w-20 h-20 mx-auto rounded-2xl bg-amber-600/10 flex items-center justify-center animate-pulse">
										<span className="text-4xl font-bold text-amber-400">
											{knockTest.targetCount}
										</span>
									</div>
									<h1 className="text-2xl font-bold text-white">
										{t("cal.knockNow", {
											n: knockTest.targetCount,
											unit:
												knockTest.targetCount === 1
													? t("cal.knockTest.timeUnit")
													: t("cal.knockTest.timesUnit"),
										})}
									</h1>

									{/* Live tap indicator dots */}
									<div className="flex items-center justify-center gap-3 py-2">
										{Array.from(
											{ length: knockTest.targetCount },
											(_, i) => `cal-dot-${i}`,
										).map((dotKey, i) => (
											<div
												key={dotKey}
												className={`w-4 h-4 rounded-full transition-all duration-200 ${
													i < knockTest.liveTapCount
														? "bg-amber-400 scale-125"
														: "bg-gray-700 border border-gray-600"
												}`}
											/>
										))}
									</div>

									{/* Status — waiting, live count, or last result */}
									{knockTest.lastDetectedCount !== null ? (
										<div
											className={`text-sm font-medium rounded-lg px-3 py-2 ${
												knockTest.lastDetectedCorrect
													? "bg-green-500/10 text-green-400"
													: "bg-red-500/10 text-red-400"
											}`}
										>
											{knockTest.lastDetectedCorrect
												? t("cal.lastResult", {
														n: knockTest.lastDetectedCount,
													})
												: knockTest.lastDetectedCount === 0
													? t("cal.noKnockDetected")
													: t("cal.lastResultWrong", {
															detected: knockTest.lastDetectedCount,
															expected: knockTest.targetCount,
														})}
										</div>
									) : (
										<p className="text-gray-400">
											{knockTest.liveTapCount > 0
												? t("cal.liveCount", {
														current: knockTest.liveTapCount,
														target: knockTest.targetCount,
													})
												: t("cal.waitingForKnocks")}
										</p>
									)}

									{knockTest.hasConfirmed && (
										<p className="text-xs text-gray-500">
											{t("cal.confirmWhenReady")}
										</p>
									)}
								</div>

								{/* Sensitivity slider — always visible during listening */}
								<div className="bg-gray-900 rounded-xl p-4 space-y-3">
									<div className="flex justify-between text-sm">
										<span className="text-gray-400">
											{t("cal.sensitivity")}
										</span>
										<span className="text-gray-300 font-mono text-xs">
											{sensitivityPercent}%
										</span>
									</div>
									<input
										type="range"
										min={-Math.log10(TAP_CALIBRATION.thresholdMax)}
										max={-Math.log10(TAP_CALIBRATION.thresholdMin)}
										step={0.01}
										value={-Math.log10(threshold)}
										onChange={(e) =>
											handleSliderChange(10 ** -Number(e.target.value))
										}
										className="w-full accent-amber-500"
									/>
									<div className="flex justify-between text-xs text-gray-600">
										<span>{t("cal.lessSensitive")}</span>
										<span>{t("cal.moreSensitive")}</span>
									</div>
								</div>

								{/* Confirm button — enabled only after correct detection */}
								<button
									type="button"
									onClick={handleConfirm}
									disabled={!knockTest.hasConfirmed}
									className={`w-full py-3 px-6 rounded-xl font-semibold transition-colors ${
										knockTest.hasConfirmed
											? "bg-green-600 text-white hover:bg-green-500"
											: "bg-gray-800 text-gray-600 cursor-not-allowed"
									}`}
								>
									{t("cal.confirmSensitivity")}
								</button>

								<button
									type="button"
									onClick={handleCancelListening}
									className="w-full py-2.5 px-4 rounded-xl bg-gray-800 text-gray-400 text-sm font-medium hover:bg-gray-700 transition-colors"
								>
									{t("cal.cancel")}
								</button>
							</>
						)}
					</>
				)}

				{/* ── Complete ── */}
				{phase === "complete" && (
					<>
						<div className="space-y-2">
							<StepIcon color="green">
								<CheckIcon />
							</StepIcon>
							<h1 className="text-2xl font-bold text-white">
								{t("cal.complete")}
							</h1>
							<p className="text-gray-400">{t("cal.complete.desc")}</p>
						</div>
						<div className="bg-gray-900 rounded-xl p-4 space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-gray-500">{t("cal.tapThreshold")}</span>
								<span className="text-gray-300 font-mono">
									{sensitivityPercent}%
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-500">
									{t("cal.verifiedPatterns")}
								</span>
								<span className="text-gray-300">
									{completedSteps.map((n) => t("cal.knock", { n })).join(", ")}
								</span>
							</div>
						</div>
						<button
							type="button"
							onClick={finish}
							className="w-full py-3 px-6 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors"
						>
							{t("cal.getStarted")}
						</button>
					</>
				)}
			</div>
		</div>
	);
}

// ─── Small sub-components ───────────────────────────────

function StepIcon({
	color,
	animate,
	children,
}: {
	color: "blue" | "green" | "red" | "amber";
	animate?: boolean;
	children: React.ReactNode;
}) {
	const bg = {
		blue: "bg-blue-600/10",
		green: "bg-green-600/10",
		red: "bg-red-600/10",
		amber: "bg-amber-600/10",
	}[color];
	const text = {
		blue: "text-blue-400",
		green: "text-green-400",
		red: "text-red-400",
		amber: "text-amber-400",
	}[color];

	return (
		<div
			className={`w-16 h-16 mx-auto rounded-2xl ${bg} flex items-center justify-center ${animate ? "animate-pulse" : ""}`}
		>
			<div className={`w-8 h-8 ${text}`}>{children}</div>
		</div>
	);
}

function CheckIcon() {
	return (
		<svg
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={2}
			aria-hidden="true"
		>
			<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
		</svg>
	);
}

function LaptopIcon() {
	return (
		<svg
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={1.5}
			aria-hidden="true"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a9 9 0 11-18 0V5.25"
			/>
		</svg>
	);
}

function SpinnerIcon() {
	return (
		<svg
			className="animate-spin"
			fill="none"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<circle
				className="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="4"
			/>
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
			/>
		</svg>
	);
}

function ErrorBanner({ message }: { message: string }) {
	return (
		<div className="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-2">
			{message}
		</div>
	);
}
