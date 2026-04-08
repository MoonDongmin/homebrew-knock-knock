import { useLocale } from "../hooks/useLocale";
import type { TapCount, TapPattern } from "../lib/types";
import { TapDots } from "./TapDots";

interface PatternListProps {
	patterns: TapPattern[];
	onToggle: (tapCount: TapCount, enabled: boolean) => void;
	onEdit: (pattern: TapPattern) => void;
	onDelete: (tapCount: TapCount) => void;
	onAdd: () => void;
	isMonitoring: boolean;
	liveTapCount: number;
	lastSequence: TapCount | null;
	accelError?: string | null;
}

export function PatternList({
	patterns,
	onToggle,
	onEdit,
	onDelete,
	onAdd,
	isMonitoring,
	liveTapCount,
	lastSequence,
	accelError,
}: PatternListProps) {
	const { t } = useLocale();

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold text-white">
						{t("pattern.title")}
					</h3>
					<p className="text-sm text-gray-400 mt-1">{t("pattern.desc")}</p>
				</div>
				<button
					type="button"
					onClick={onAdd}
					className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors flex items-center gap-1.5"
				>
					<svg
						className="w-3.5 h-3.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 4.5v15m7.5-7.5h-15"
						/>
					</svg>
					{t("pattern.add")}
				</button>
			</div>

			{/* Monitoring status bar */}
			<div
				className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
					accelError
						? "border-red-500/30 bg-red-500/5"
						: isMonitoring
							? "border-green-500/20 bg-green-500/5"
							: "border-gray-800 bg-gray-900/30"
				}`}
			>
				<div className="flex items-center gap-3">
					<div
						className={`w-2.5 h-2.5 rounded-full shrink-0 ${
							accelError
								? "bg-red-400"
								: isMonitoring
									? "bg-green-400 animate-pulse"
									: "bg-gray-500"
						}`}
					/>
					<div>
						<span
							className={`text-sm font-medium ${
								accelError
									? "text-red-400"
									: isMonitoring
										? "text-green-400"
										: "text-gray-500"
							}`}
						>
							{accelError
								? "Error"
								: isMonitoring
									? t("settings.monitoringOn")
									: t("settings.monitoringOff")}
						</span>
						{accelError && (
							<p className="text-[11px] text-red-400/70 mt-0.5 leading-tight">
								{accelError}
							</p>
						)}
					</div>
				</div>
				{isMonitoring && !accelError && (
					<div className="flex items-center gap-2">
						{liveTapCount > 0 && (
							<span className="text-xs text-blue-400 font-mono bg-blue-400/10 px-2 py-0.5 rounded-full">
								{t("sensitivity.detecting", { n: liveTapCount })}
							</span>
						)}
						{lastSequence !== null && liveTapCount === 0 && (
							<span className="text-xs text-emerald-400 font-mono bg-emerald-400/10 px-2 py-0.5 rounded-full">
								{t("sensitivity.detected", { n: lastSequence })}
							</span>
						)}
					</div>
				)}
			</div>

			{/* Pattern list */}
			{patterns.length === 0 ? (
				<div className="text-center py-14 border border-dashed border-gray-800 rounded-xl">
					<div className="text-gray-600 mb-3">
						<svg
							className="w-10 h-10 mx-auto"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={1}
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<p className="text-sm text-gray-500">{t("pattern.empty")}</p>
					<p className="text-xs text-gray-600 mt-1">{t("pattern.emptyHint")}</p>
				</div>
			) : (
				<div className="space-y-2">
					{patterns.map((pattern) => (
						<PatternRow
							key={pattern.id}
							pattern={pattern}
							onToggle={onToggle}
							onEdit={onEdit}
							onDelete={onDelete}
							lastSequence={lastSequence}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function PatternRow({
	pattern,
	onToggle,
	onEdit,
	onDelete,
	lastSequence,
}: {
	pattern: TapPattern;
	onToggle: (tapCount: TapCount, enabled: boolean) => void;
	onEdit: (pattern: TapPattern) => void;
	onDelete: (tapCount: TapCount) => void;
	lastSequence: TapCount | null;
}) {
	const { t } = useLocale();
	const isJustTriggered = lastSequence === pattern.tapCount && pattern.enabled;

	return (
		<div
			className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-300 ${
				isJustTriggered
					? "border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/20"
					: pattern.enabled
						? "border-gray-800 bg-gray-900/50 hover:border-gray-700"
						: "border-gray-800/50 bg-gray-950/50 opacity-50"
			}`}
		>
			{/* Tap dots */}
			<div className="w-20 shrink-0 text-blue-400">
				<TapDots count={pattern.tapCount} />
				<div className="text-xs text-gray-500 text-center mt-1">
					{t("pattern.taps", { n: pattern.tapCount })}
				</div>
			</div>

			{/* Arrow */}
			<svg
				className="w-4 h-4 text-gray-600 shrink-0"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				strokeWidth={2}
				aria-hidden="true"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
				/>
			</svg>

			{/* Action label */}
			<div className="flex-1 min-w-0">
				<div className="text-sm text-white truncate">
					{pattern.action.label}
				</div>
				<div className="text-xs text-gray-500 capitalize">
					{pattern.action.type.replace("_", " ")}
				</div>
			</div>

			{/* Controls */}
			<div className="flex items-center gap-2 shrink-0">
				{/* Edit button */}
				<button
					type="button"
					onClick={() => onEdit(pattern)}
					className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
					aria-label="Edit pattern"
				>
					<svg
						className="w-4 h-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={1.5}
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
						/>
					</svg>
				</button>

				{/* Delete button */}
				<button
					type="button"
					onClick={() => onDelete(pattern.tapCount)}
					className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
					aria-label="Delete pattern"
				>
					<svg
						className="w-4 h-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={1.5}
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
						/>
					</svg>
				</button>

				{/* Toggle */}
				<button
					type="button"
					onClick={() => onToggle(pattern.tapCount, !pattern.enabled)}
					className={`relative w-10 h-5.5 rounded-full transition-colors ${
						pattern.enabled ? "bg-blue-600" : "bg-gray-700"
					}`}
					role="switch"
					aria-checked={pattern.enabled}
					aria-label={`${pattern.enabled ? "Disable" : "Enable"} pattern`}
				>
					<span
						className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform ${
							pattern.enabled ? "translate-x-4.5" : "translate-x-0"
						}`}
					/>
				</button>
			</div>
		</div>
	);
}
