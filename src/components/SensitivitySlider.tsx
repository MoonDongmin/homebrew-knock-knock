import { useLocale } from "../hooks/useLocale";
import { SENSITIVITY_RANGE, TAP_DETECTION } from "../lib/constants";

interface SensitivitySliderProps {
	value: number;
	onChange: (value: number) => void;
}

export function SensitivitySlider({ value, onChange }: SensitivitySliderProps) {
	const { t } = useLocale();
	const effectiveThreshold = TAP_DETECTION.threshold / value;

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-semibold text-white mb-1">
					{t("sensitivity.title")}
				</h3>
				<p className="text-sm text-gray-400">{t("sensitivity.desc")}</p>
			</div>

			<div className="space-y-4">
				{/* Slider */}
				<div className="space-y-2">
					<div className="flex justify-between text-xs text-gray-500">
						<span>{t("sensitivity.low")}</span>
						<span>{t("sensitivity.default")}</span>
						<span>{t("sensitivity.high")}</span>
					</div>
					<input
						type="range"
						min={SENSITIVITY_RANGE.min}
						max={SENSITIVITY_RANGE.max}
						step={SENSITIVITY_RANGE.step}
						value={value}
						onChange={(e) => onChange(Number.parseFloat(e.target.value))}
						className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-500"
					/>
				</div>

				{/* Value display */}
				<div className="flex justify-between items-center bg-gray-900 rounded-lg px-4 py-3">
					<div className="text-sm text-gray-400">
						{t("sensitivity.current")}
					</div>
					<div className="text-sm font-mono text-white">
						{value.toFixed(1)}x
					</div>
				</div>

				{/* Effective threshold */}
				<div className="flex justify-between items-center bg-gray-900 rounded-lg px-4 py-3">
					<div className="text-sm text-gray-400">
						{t("sensitivity.effective")}
					</div>
					<div className="text-sm font-mono text-white">
						{effectiveThreshold.toFixed(3)}g
					</div>
				</div>
			</div>
		</div>
	);
}
