import { useState } from "react";
import type { TrialState } from "../lib/types";

interface TrialBannerProps {
	trialState: TrialState;
	onPurchase: () => void;
}

export function TrialBanner({ trialState, onPurchase }: TrialBannerProps) {
	const [dismissed, setDismissed] = useState(false);

	if (
		dismissed ||
		trialState.status === "active" ||
		trialState.status === "expired"
	) {
		return null;
	}

	return (
		<div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
			<div className="flex items-center gap-3">
				<div className="text-amber-400 text-sm font-medium">
					{trialState.daysRemaining === 1
						? "1 day remaining in your trial"
						: `${trialState.daysRemaining} days remaining in your trial`}
				</div>
			</div>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={onPurchase}
					className="text-xs font-medium px-3 py-1.5 rounded-md bg-amber-500 text-black hover:bg-amber-400 transition-colors"
				>
					Purchase
				</button>
				<button
					type="button"
					onClick={() => setDismissed(true)}
					className="text-gray-400 hover:text-gray-300 transition-colors p-1"
					aria-label="Dismiss"
				>
					<svg
						className="w-4 h-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</div>
	);
}
