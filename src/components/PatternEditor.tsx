import { useState } from "react";
import type { Action, TapCount, TapPattern } from "../lib/types";
import { ActionPicker } from "./ActionPicker";
import { TapDots } from "./TapDots";

interface PatternEditorProps {
	pattern?: TapPattern;
	onSave: (tapCount: TapCount, action: Action, enabled: boolean) => void;
	onCancel: () => void;
	usedTapCounts: TapCount[];
}

const VALID_TAP_COUNTS: TapCount[] = [1, 2, 3, 4];

export function PatternEditor({
	pattern,
	onSave,
	onCancel,
	usedTapCounts,
}: PatternEditorProps) {
	const [tapCount, setTapCount] = useState<TapCount>(
		pattern?.tapCount ?? getFirstAvailableTapCount(usedTapCounts, pattern),
	);
	const [selectedAction, setSelectedAction] = useState<Action | null>(
		pattern?.action ?? null,
	);
	const [enabled, setEnabled] = useState(pattern?.enabled ?? true);
	const [showActionPicker, setShowActionPicker] = useState(false);

	const isEditing = pattern !== undefined;

	function handleSave() {
		if (!selectedAction) return;
		onSave(tapCount, selectedAction, enabled);
	}

	return (
		<>
			<div className="space-y-6">
				<div>
					<h3 className="text-lg font-semibold text-white mb-1">
						{isEditing ? "Edit Pattern" : "New Pattern"}
					</h3>
					<p className="text-sm text-gray-400">
						{isEditing
							? "Modify this tap pattern mapping."
							: "Create a new tap pattern and assign an action."}
					</p>
				</div>

				{/* Tap count selector */}
				<div className="space-y-2">
					<span className="block text-sm font-medium text-gray-300">
						Tap Count
					</span>
					<div className="flex gap-2">
						{VALID_TAP_COUNTS.map((count) => {
							const isUsed =
								usedTapCounts.includes(count) && count !== pattern?.tapCount;
							return (
								<button
									type="button"
									key={count}
									onClick={() => {
										if (!isUsed) setTapCount(count);
									}}
									disabled={isUsed}
									className={`flex-1 py-3 rounded-lg border text-center transition-colors ${
										tapCount === count
											? "border-blue-500 bg-blue-600/20 text-blue-400"
											: isUsed
												? "border-gray-800 bg-gray-900/50 text-gray-600 cursor-not-allowed"
												: "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600"
									}`}
								>
									<TapDots count={count} size="sm" />
								</button>
							);
						})}
					</div>
				</div>

				{/* Action selector */}
				<div className="space-y-2">
					<span className="block text-sm font-medium text-gray-300">
						Action
					</span>
					<button
						type="button"
						onClick={() => setShowActionPicker(true)}
						className="w-full px-4 py-3 rounded-lg border border-gray-700 bg-gray-900 text-left transition-colors hover:border-gray-600"
					>
						{selectedAction ? (
							<span className="text-white">{selectedAction.label}</span>
						) : (
							<span className="text-gray-500">Choose an action...</span>
						)}
					</button>
				</div>

				{/* Enable toggle */}
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium text-gray-300">Enabled</span>
					<button
						type="button"
						onClick={() => setEnabled(!enabled)}
						className={`relative w-11 h-6 rounded-full transition-colors ${
							enabled ? "bg-blue-600" : "bg-gray-700"
						}`}
						role="switch"
						aria-checked={enabled}
					>
						<span
							className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
								enabled ? "translate-x-5" : "translate-x-0"
							}`}
						/>
					</button>
				</div>

				{/* Actions */}
				<div className="flex gap-3 pt-2">
					<button
						type="button"
						onClick={onCancel}
						className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={!selectedAction}
						className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isEditing ? "Save" : "Add Pattern"}
					</button>
				</div>
			</div>

			{showActionPicker && (
				<ActionPicker
					selectedActionId={selectedAction?.id}
					onSelect={(action) => {
						setSelectedAction(action);
						setShowActionPicker(false);
					}}
					onClose={() => setShowActionPicker(false)}
				/>
			)}
		</>
	);
}

function getFirstAvailableTapCount(
	usedCounts: TapCount[],
	editingPattern?: TapPattern,
): TapCount {
	const available = VALID_TAP_COUNTS.find(
		(c) => !usedCounts.includes(c) || c === editingPattern?.tapCount,
	);
	return available ?? 1;
}
