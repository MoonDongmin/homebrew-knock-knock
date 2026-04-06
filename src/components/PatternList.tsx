import type { TapCount, TapPattern } from "../lib/types";
import { TapDots } from "./TapDots";

interface PatternListProps {
	patterns: TapPattern[];
	onToggle: (tapCount: TapCount, enabled: boolean) => void;
	onEdit: (pattern: TapPattern) => void;
	onDelete: (tapCount: TapCount) => void;
	onAdd: () => void;
}

export function PatternList({
	patterns,
	onToggle,
	onEdit,
	onDelete,
	onAdd,
}: PatternListProps) {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold text-white">Tap Patterns</h3>
					<p className="text-sm text-gray-400 mt-1">
						Map desk tap patterns to actions.
					</p>
				</div>
				<button
					type="button"
					onClick={onAdd}
					className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
				>
					Add Pattern
				</button>
			</div>

			{patterns.length === 0 ? (
				<div className="text-center py-12 text-gray-500">
					<p className="text-sm">No patterns configured yet.</p>
					<p className="text-xs mt-1">Add a pattern to get started.</p>
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
}: {
	pattern: TapPattern;
	onToggle: (tapCount: TapCount, enabled: boolean) => void;
	onEdit: (pattern: TapPattern) => void;
	onDelete: (tapCount: TapCount) => void;
}) {
	return (
		<div
			className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors ${
				pattern.enabled
					? "border-gray-800 bg-gray-900/50"
					: "border-gray-800/50 bg-gray-950/50 opacity-60"
			}`}
		>
			{/* Tap dots */}
			<div className="w-20 shrink-0 text-blue-400">
				<TapDots count={pattern.tapCount} />
				<div className="text-xs text-gray-500 text-center mt-1">
					{pattern.tapCount} {pattern.tapCount === 1 ? "tap" : "taps"}
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
