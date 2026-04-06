import { type FormEvent, useState } from "react";

interface PurchaseScreenProps {
	onActivate: (key: string) => Promise<boolean>;
}

export function PurchaseScreen({ onActivate }: PurchaseScreenProps) {
	const [licenseKey, setLicenseKey] = useState("");
	const [isValidating, setIsValidating] = useState(false);
	const [validationError, setValidationError] = useState<string | null>(null);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!licenseKey.trim()) return;

		setIsValidating(true);
		setValidationError(null);

		const valid = await onActivate(licenseKey.trim());
		if (!valid) {
			setValidationError("Invalid license key. Please check and try again.");
		}
		setIsValidating(false);
	}

	function handlePurchase() {
		// Opens external purchase page
		window.open("https://knockknock.app/purchase", "_blank");
	}

	return (
		<div className="fixed inset-0 bg-gray-950/95 flex items-center justify-center p-8 z-50">
			<div className="max-w-md w-full text-center space-y-8">
				{/* Icon */}
				<div className="text-6xl">
					<svg
						className="w-16 h-16 mx-auto text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={1.5}
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>

				{/* Title */}
				<div>
					<h1 className="text-2xl font-bold text-white mb-2">
						Your Trial Has Expired
					</h1>
					<p className="text-gray-400">
						Purchase KnockKnock to continue using tap patterns to control your
						Mac.
					</p>
				</div>

				{/* Purchase button */}
				<button
					type="button"
					onClick={handlePurchase}
					className="w-full py-3 px-6 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
				>
					Purchase for $4.99
				</button>

				{/* Divider */}
				<div className="flex items-center gap-4">
					<div className="flex-1 h-px bg-gray-800" />
					<span className="text-gray-500 text-xs uppercase tracking-wider">
						Already purchased?
					</span>
					<div className="flex-1 h-px bg-gray-800" />
				</div>

				{/* License key input */}
				<form onSubmit={handleSubmit} className="space-y-3">
					<input
						type="text"
						value={licenseKey}
						onChange={(e) => setLicenseKey(e.target.value)}
						placeholder="KK-XXXX-XXXX-XXXX"
						className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 text-center font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
					{validationError && (
						<p className="text-red-400 text-sm">{validationError}</p>
					)}
					<button
						type="submit"
						disabled={isValidating || !licenseKey.trim()}
						className="w-full py-2.5 px-6 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isValidating ? "Validating..." : "Activate License"}
					</button>
				</form>
			</div>
		</div>
	);
}
