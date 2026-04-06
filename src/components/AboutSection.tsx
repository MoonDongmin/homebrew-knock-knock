import { useLocale } from "../hooks/useLocale";
import type { Locale } from "../lib/types";

interface AboutSectionProps {
	isLicensed: boolean;
	locale: Locale;
	onRecalibrate: () => void;
	onLocaleChange: (locale: Locale) => void;
}

export function AboutSection({
	isLicensed,
	locale,
	onRecalibrate,
	onLocaleChange,
}: AboutSectionProps) {
	const { t } = useLocale();

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-semibold text-white mb-1">
					{t("settings.about")}
				</h3>
				<p className="text-sm text-gray-400">KnockKnock v0.1.0</p>
			</div>

			{/* App info */}
			<div className="bg-gray-900 rounded-lg p-4 space-y-3">
				<InfoRow label={t("about.version")} value="0.1.0" />
				<InfoRow label="License" value={isLicensed ? "Licensed" : "Trial"} />
				<InfoRow label="Platform" value="macOS (Apple Silicon)" />
			</div>

			{/* Language */}
			<div className="space-y-2">
				<h4 className="text-sm font-medium text-gray-300">
					{t("settings.language")}
				</h4>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => onLocaleChange("ko")}
						className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
							locale === "ko"
								? "bg-blue-600 text-white"
								: "border border-gray-700 text-gray-300 hover:bg-gray-800"
						}`}
					>
						한국어
					</button>
					<button
						type="button"
						onClick={() => onLocaleChange("en")}
						className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
							locale === "en"
								? "bg-blue-600 text-white"
								: "border border-gray-700 text-gray-300 hover:bg-gray-800"
						}`}
					>
						English
					</button>
				</div>
			</div>

			{/* Recalibrate */}
			<div className="space-y-2">
				<h4 className="text-sm font-medium text-gray-300">
					{t("settings.recalibrate")}
				</h4>
				<button
					type="button"
					onClick={onRecalibrate}
					className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
				>
					{t("settings.recalibrate")}
				</button>
			</div>

			{/* Links */}
			<div className="space-y-2">
				<h4 className="text-sm font-medium text-gray-300">Links</h4>
				<div className="flex flex-col gap-1">
					<ExternalLink
						href="https://github.com/MoonDongmin/knock-knock"
						label="GitHub"
					/>
				</div>
			</div>
		</div>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex justify-between text-sm">
			<span className="text-gray-400">{label}</span>
			<span className="text-white">{value}</span>
		</div>
	);
}

function ExternalLink({ href, label }: { href: string; label: string }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
		>
			{label}
		</a>
	);
}
