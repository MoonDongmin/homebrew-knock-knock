import { useCallback, useState } from "react";
import { useLocale } from "../hooks/useLocale";
import type {
	Action,
	AppSettings,
	Locale,
	SettingsSection,
	TapCount,
	TapPattern,
} from "../lib/types";
import { AboutSection } from "./AboutSection";
import { PatternEditor } from "./PatternEditor";
import { PatternList } from "./PatternList";
import { SensitivitySlider } from "./SensitivitySlider";
import { SoundSettings } from "./SoundSettings";

interface SettingsPanelProps {
	settings: AppSettings;
	onUpdateSettings: (partial: Partial<AppSettings>) => Promise<void>;
	isLicensed: boolean;
	isMonitoring: boolean;
	liveTapCount: number;
	onRecalibrate: () => void;
	accelError?: string | null;
}

interface NavItem {
	id: SettingsSection;
	label: string;
	icon: string;
}

const NAV_ITEMS: NavItem[] = [
	{
		id: "patterns",
		label: "patterns",
		icon: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5",
	},
	{
		id: "sensitivity",
		label: "Sensitivity",
		icon: "M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75",
	},
	{
		id: "sound",
		label: "Sound",
		icon: "M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z",
	},
	{
		id: "about",
		label: "About",
		icon: "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z",
	},
];

export function SettingsPanel({
	settings,
	onUpdateSettings,
	isLicensed,
	isMonitoring,
	liveTapCount,
	onRecalibrate,
	accelError,
}: SettingsPanelProps) {
	const { t } = useLocale();
	const [activeSection, setActiveSection] =
		useState<SettingsSection>("patterns");
	const [editingPattern, setEditingPattern] = useState<TapPattern | null>(null);
	const [isAddingPattern, setIsAddingPattern] = useState(false);

	const handlePatternToggle = useCallback(
		(tapCount: TapCount, enabled: boolean) => {
			const updated = settings.patterns.map((p) =>
				p.tapCount === tapCount ? { ...p, enabled } : p,
			);
			onUpdateSettings({ patterns: updated });
		},
		[settings.patterns, onUpdateSettings],
	);

	const handlePatternDelete = useCallback(
		(tapCount: TapCount) => {
			const updated = settings.patterns.filter((p) => p.tapCount !== tapCount);
			onUpdateSettings({ patterns: updated });
		},
		[settings.patterns, onUpdateSettings],
	);

	const handlePatternSave = useCallback(
		(tapCount: TapCount, action: Action, enabled: boolean) => {
			const existingIndex = settings.patterns.findIndex(
				(p) => p.tapCount === tapCount,
			);

			const pattern: TapPattern = {
				id:
					existingIndex >= 0
						? (settings.patterns[existingIndex]?.id ?? `pattern_${tapCount}tap`)
						: `pattern_${tapCount}tap`,
				tapCount,
				action,
				enabled,
			};

			let updated: TapPattern[];
			if (existingIndex >= 0) {
				updated = settings.patterns.map((p, i) =>
					i === existingIndex ? pattern : p,
				);
			} else {
				updated = [...settings.patterns, pattern].sort(
					(a, b) => a.tapCount - b.tapCount,
				);
			}

			onUpdateSettings({ patterns: updated });
			setEditingPattern(null);
			setIsAddingPattern(false);
		},
		[settings.patterns, onUpdateSettings],
	);

	const usedTapCounts = settings.patterns.map((p) => p.tapCount) as TapCount[];

	return (
		<div className="flex h-screen bg-gray-950">
			{/* Sidebar */}
			<div className="w-56 shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col">
				{/* App title + status */}
				<div className="p-4 border-b border-gray-800">
					<h1 className="text-lg font-bold text-white">KnockKnock</h1>
					<div className="flex items-center gap-2 mt-2">
						<div
							className={`w-2 h-2 rounded-full ${
								accelError
									? "bg-red-400"
									: isMonitoring
										? "bg-green-400 animate-pulse"
										: "bg-gray-500"
							}`}
						/>
						<span className="text-xs text-gray-400">
							{accelError ? "Error" : isMonitoring ? "Monitoring" : "Paused"}
						</span>
						{isMonitoring && liveTapCount > 0 && (
							<span className="text-xs text-blue-400 font-mono">
								({liveTapCount})
							</span>
						)}
					</div>
					{accelError && (
						<p className="text-[10px] text-red-400 mt-1 leading-tight">
							{accelError}
						</p>
					)}
				</div>

				{/* Navigation */}
				<nav className="flex-1 p-2 space-y-1">
					{NAV_ITEMS.map((item) => (
						<button
							type="button"
							key={item.id}
							onClick={() => {
								setActiveSection(item.id);
								setEditingPattern(null);
								setIsAddingPattern(false);
							}}
							className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
								activeSection === item.id
									? "bg-gray-800 text-white"
									: "text-gray-400 hover:text-gray-300 hover:bg-gray-900"
							}`}
						>
							<svg
								className="w-4 h-4 shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.5}
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d={item.icon}
								/>
							</svg>
							{t(`settings.${item.id}` as Parameters<typeof t>[0])}
						</button>
					))}
				</nav>
			</div>

			{/* Main content */}
			<div className="flex-1 overflow-y-auto p-8">
				<div className="max-w-2xl">
					{activeSection === "patterns" &&
						!editingPattern &&
						!isAddingPattern && (
							<PatternList
								patterns={settings.patterns}
								onToggle={handlePatternToggle}
								onEdit={setEditingPattern}
								onDelete={handlePatternDelete}
								onAdd={() => setIsAddingPattern(true)}
							/>
						)}

					{activeSection === "patterns" &&
						(editingPattern || isAddingPattern) && (
							<PatternEditor
								pattern={editingPattern ?? undefined}
								usedTapCounts={usedTapCounts}
								onSave={handlePatternSave}
								onCancel={() => {
									setEditingPattern(null);
									setIsAddingPattern(false);
								}}
							/>
						)}

					{activeSection === "sensitivity" && (
						<SensitivitySlider
							value={settings.sensitivity}
							onChange={(v) => onUpdateSettings({ sensitivity: v })}
						/>
					)}

					{activeSection === "sound" && (
						<SoundSettings
							soundFeedback={settings.soundFeedback}
							feedbackSound={settings.feedbackSound}
							onSoundFeedbackChange={(v) =>
								onUpdateSettings({ soundFeedback: v })
							}
							onFeedbackSoundChange={(v) =>
								onUpdateSettings({ feedbackSound: v })
							}
						/>
					)}

					{activeSection === "about" && (
						<AboutSection
							isLicensed={isLicensed}
							locale={settings.locale}
							onRecalibrate={onRecalibrate}
							onLocaleChange={(locale: Locale) => onUpdateSettings({ locale })}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
