import { invoke } from "@tauri-apps/api/core";
import { useLocale } from "../hooks/useLocale";
import type { AppSettings } from "../lib/types";

interface SoundSettingsProps {
	soundFeedback: boolean;
	feedbackSound: AppSettings["feedbackSound"];
	onSoundFeedbackChange: (enabled: boolean) => void;
	onFeedbackSoundChange: (sound: AppSettings["feedbackSound"]) => void;
}

const SOUND_OPTIONS: {
	value: AppSettings["feedbackSound"];
	labelKey: "system" | "custom";
	label: string;
}[] = [
	{ value: "Tink", labelKey: "system", label: "Tink" },
	{ value: "Pop", labelKey: "system", label: "Pop" },
	{ value: "Blow", labelKey: "system", label: "Blow" },
	{ value: "Glass", labelKey: "system", label: "Glass" },
	{ value: "angerychan9", labelKey: "custom", label: "아오!" },
	{ value: "chan9", labelKey: "custom", label: "야!" },
];

export function SoundSettings({
	soundFeedback,
	feedbackSound,
	onSoundFeedbackChange,
	onFeedbackSoundChange,
}: SoundSettingsProps) {
	const { t } = useLocale();

	function previewSound(soundName: string) {
		invoke("play_feedback_sound", { soundName }).catch(() => {});
	}

	return (
		<div className="space-y-8">
			<div>
				<h3 className="text-lg font-semibold text-white mb-2">
					{t("sound.title")}
				</h3>
				<p className="text-sm text-gray-400 leading-relaxed">
					{t("sound.desc")}
				</p>
			</div>

			{/* Enable/disable */}
			<div className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-3">
				<span className="text-sm text-gray-300">{t("sound.enable")}</span>
				<button
					type="button"
					onClick={() => onSoundFeedbackChange(!soundFeedback)}
					className={`relative w-11 h-6 rounded-full transition-colors ${
						soundFeedback ? "bg-blue-600" : "bg-gray-700"
					}`}
					role="switch"
					aria-checked={soundFeedback}
				>
					<span
						className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
							soundFeedback ? "translate-x-5" : "translate-x-0"
						}`}
					/>
				</button>
			</div>

			{/* Sound picker */}
			{soundFeedback && (
				<div className="space-y-2">
					<span className="block text-sm font-medium text-gray-300">
						{t("sound.selectSound")}
					</span>
					<div className="grid grid-cols-2 gap-2">
						{SOUND_OPTIONS.map((option) => (
							<button
								type="button"
								key={option.value}
								onClick={() => {
									onFeedbackSoundChange(option.value);
									previewSound(option.value);
								}}
								className={`px-4 py-3 rounded-lg border text-sm transition-colors ${
									feedbackSound === option.value
										? "border-blue-500 bg-blue-600/20 text-blue-400"
										: "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600"
								}`}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
