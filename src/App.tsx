import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalibrationView } from "./components/CalibrationView";
import { PurchaseScreen } from "./components/PurchaseScreen";
import { SettingsPanel } from "./components/SettingsPanel";
import { TrialBanner } from "./components/TrialBanner";
import { ActionExecutor } from "./core/action-executor";
import { ActionMapper } from "./core/action-mapper";
import { useAccelerometer } from "./hooks/useAccelerometer";
import { LocaleContext } from "./hooks/useLocale";
import { useSettings } from "./hooks/useSettings";
import { useTapDetector } from "./hooks/useTapDetector";
import { useTrial } from "./hooks/useTrial";
import type { CalibrationBaseline, TapCount } from "./lib/types";

function App() {
	const {
		trialState,
		isLicensed,
		activate,
		isLoading: trialLoading,
	} = useTrial();
	const {
		settings,
		updateSettings,
		isLoading: settingsLoading,
	} = useSettings();
	const {
		isAvailable: accelAvailable,
		isStreaming,
		start: startAccel,
		stop: stopAccel,
		calibrate: doCalibrate,
		error: accelError,
	} = useAccelerometer();

	const [showPurchase, setShowPurchase] = useState(false);
	const [showCalibration, setShowCalibration] = useState(false);
	const [pendingSection, setPendingSection] = useState<string | null>(null);

	// Action mapper — synced with settings
	const actionMapper = useMemo(() => {
		if (!settings) return new ActionMapper();
		return new ActionMapper(settings.patterns);
	}, [settings]);

	// Action executor — synced with sound settings
	const executorRef = useRef<ActionExecutor>(new ActionExecutor());
	useEffect(() => {
		if (!settings) return;
		executorRef.current.setSoundEnabled(settings.soundFeedback);
		executorRef.current.setFeedbackSound(settings.feedbackSound);
	}, [settings]);

	// Tap sequence handler
	const handleTapSequence = useCallback(
		(count: TapCount) => {
			const action = actionMapper.getAction(count);
			if (action) {
				executorRef.current.execute(action).catch(() => {});
			}
		},
		[actionMapper],
	);

	// Determine if monitoring should be active
	const monitoringEnabled =
		settings?.monitoringEnabled !== false &&
		accelAvailable &&
		settings?.hasCompletedCalibration === true &&
		!showCalibration &&
		(isLicensed || trialState?.status !== "expired");

	// Sync monitoring state to tray menu label
	useEffect(() => {
		emit(
			"knockknock://monitoring-state",
			monitoringEnabled && isStreaming ? "true" : "false",
		);
	}, [monitoringEnabled, isStreaming]);

	// Tap detector
	const { liveTapCount, lastSequence } = useTapDetector({
		enabled: monitoringEnabled && isStreaming,
		baseline: settings?.calibrationBaseline ?? null,
		calibratedThreshold: settings?.calibratedThreshold ?? null,
		onTapSequence: handleTapSequence,
	});

	// Start/stop accelerometer based on monitoring state
	// Skip during calibration — CalibrationView manages its own stream
	useEffect(() => {
		if (showCalibration) return;

		if (monitoringEnabled && !isStreaming) {
			startAccel().catch(() => {});
		} else if (!monitoringEnabled && isStreaming) {
			stopAccel().catch(() => {});
		}
	}, [monitoringEnabled, isStreaming, startAccel, stopAccel, showCalibration]);

	// Stop monitoring stream when entering calibration
	useEffect(() => {
		if (showCalibration && isStreaming) {
			stopAccel().catch(() => {});
		}
	}, [showCalibration, isStreaming, stopAccel]);

	// Listen for tray toggle event
	useEffect(() => {
		let unlisten: (() => void) | undefined;

		listen("knockknock://toggle-monitoring", () => {
			if (settings) {
				updateSettings({
					monitoringEnabled: !settings.monitoringEnabled,
				});
			}
		}).then((fn) => {
			unlisten = fn;
		});

		return () => {
			unlisten?.();
		};
	}, [settings, updateSettings]);

	// Request accessibility permission on first launch (needed for media keys / keyboard simulation)
	useEffect(() => {
		invoke<boolean>("check_accessibility", { prompt: true }).catch(() => {});
	}, []);

	// Show calibration on first launch
	useEffect(() => {
		if (!settingsLoading && settings && !settings.hasCompletedCalibration) {
			setShowCalibration(true);
		}
	}, [settingsLoading, settings]);

	// Show purchase screen when trial expires
	useEffect(() => {
		if (trialState?.status === "expired" && !isLicensed) {
			setShowPurchase(true);
		}
	}, [trialState, isLicensed]);

	// Handle calibration completion
	const handleCalibrationComplete = useCallback(
		async (result: { baseline: CalibrationBaseline; threshold: number }) => {
			await updateSettings({
				calibrationBaseline: result.baseline,
				calibratedThreshold: result.threshold,
				hasCompletedCalibration: true,
			});
			setShowCalibration(false);
			setPendingSection("sensitivity");
		},
		[updateSettings],
	);

	// Handle license activation
	const handleActivate = useCallback(
		async (key: string): Promise<boolean> => {
			const valid = await activate(key);
			if (valid) {
				setShowPurchase(false);
			}
			return valid;
		},
		[activate],
	);

	const locale = settings?.locale ?? "ko";

	// Loading state
	if (trialLoading || settingsLoading) {
		return (
			<div className="min-h-screen bg-gray-950 flex items-center justify-center">
				<div className="text-gray-400 text-sm">Loading...</div>
			</div>
		);
	}

	// Calibration screen (first run or recalibration) — always takes priority
	if (showCalibration) {
		return (
			<LocaleContext.Provider value={locale}>
				<CalibrationView
					onCalibrate={doCalibrate}
					onComplete={handleCalibrationComplete}
					onCancel={
						settings?.hasCompletedCalibration
							? () => setShowCalibration(false)
							: undefined
					}
				/>
			</LocaleContext.Provider>
		);
	}

	// Purchase screen (trial expired)
	if (showPurchase && !isLicensed) {
		return (
			<LocaleContext.Provider value={locale}>
				<PurchaseScreen onActivate={handleActivate} />
			</LocaleContext.Provider>
		);
	}

	// Main app — settings panel
	if (!settings) return null;

	return (
		<LocaleContext.Provider value={locale}>
			<div className="min-h-screen bg-gray-950">
				{/* Trial banner */}
				{trialState && !isLicensed && (
					<TrialBanner
						trialState={trialState}
						onPurchase={() => setShowPurchase(true)}
					/>
				)}

				{/* Settings panel */}
				<SettingsPanel
					settings={settings}
					onUpdateSettings={updateSettings}
					isLicensed={isLicensed}
					isMonitoring={monitoringEnabled && isStreaming}
					liveTapCount={liveTapCount}
					lastSequence={lastSequence}
					onRecalibrate={() => setShowCalibration(true)}
					accelError={accelError}
					pendingSection={pendingSection}
					onPendingSectionHandled={() => setPendingSection(null)}
				/>
			</div>
		</LocaleContext.Provider>
	);
}

export default App;
