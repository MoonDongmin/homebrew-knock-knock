import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useMemo, useState } from "react";
import { useLocale } from "../hooks/useLocale";
import { ACTION_CATALOG } from "../lib/actions";
import type { Action } from "../lib/types";

interface InstalledApp {
	name: string;
	path: string;
	bundleId: string | null;
}

interface ActionPickerProps {
	selectedActionId?: string;
	onSelect: (action: Action) => void;
	onClose: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
	Media:
		"M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z",
	Volume:
		"M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z",
	System:
		"M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75",
	"App Launch":
		"M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25",
	"Keyboard Shortcut":
		"M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z",
	Voice:
		"M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z",
};

export function ActionPicker({
	selectedActionId,
	onSelect,
	onClose,
}: ActionPickerProps) {
	const { t } = useLocale();
	const [search, setSearch] = useState("");

	const categoryLabels: Record<string, string> = useMemo(
		() => ({
			Media: t("action.categoryMedia"),
			Voice: t("action.categoryVoice"),
			"App Launch": t("action.categoryAppLaunch"),
		}),
		[t],
	);

	const filteredCatalog = useMemo(() => {
		if (!search.trim()) return ACTION_CATALOG;

		const query = search.toLowerCase();
		return ACTION_CATALOG.map((category) => ({
			...category,
			actions: category.actions.filter((a) =>
				a.label.toLowerCase().includes(query),
			),
		})).filter((category) => category.actions.length > 0);
	}, [search]);

	async function handleFinderSelect() {
		const selected = await open({
			directory: false,
			multiple: false,
			defaultPath: "/Applications",
			filters: [{ name: "Applications", extensions: ["app"] }],
		});

		if (!selected) return;

		const path = selected;
		const name = path
			.split("/")
			.pop()
			?.replace(/\.app$/, "");

		if (!name) return;

		// Get bundle ID from the Rust backend
		const apps = await invoke<InstalledApp[]>("list_installed_apps");
		const matched = apps.find((a) => a.name === name || a.path === path);

		const action: Action = {
			type: "app_launch",
			id: `app_custom_${matched?.bundleId ?? name.toLowerCase().replace(/\s/g, "_")}`,
			label: t("action.openApp", { name }),
			payload: {
				appName: name,
				...(matched?.bundleId ? { bundleId: matched.bundleId } : {}),
			},
		};
		onSelect(action);
	}

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-8 z-40">
			<div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-gray-800">
					<h2 className="text-lg font-semibold text-white">
						{t("action.chooseAction")}
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-gray-400 hover:text-gray-300 transition-colors p-1"
						aria-label="Close"
					>
						<svg
							className="w-5 h-5"
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

				{/* Search */}
				<div className="p-4 border-b border-gray-800">
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t("action.searchActions")}
						className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</div>

				{/* Action list */}
				<div className="flex-1 overflow-y-auto p-4 space-y-6">
					{/* App Launch — opens Finder directly */}
					{(!search.trim() ||
						t("action.categoryAppLaunch")
							.toLowerCase()
							.includes(search.toLowerCase()) ||
						"app".includes(search.toLowerCase())) && (
						<div>
							<div className="flex items-center gap-2 mb-2">
								<svg
									className="w-4 h-4 text-gray-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={1.5}
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d={CATEGORY_ICONS["App Launch"]}
									/>
								</svg>
								<h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
									{t("action.categoryAppLaunch")}
								</h3>
							</div>
							<button
								type="button"
								onClick={handleFinderSelect}
								className="w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm text-blue-400 hover:bg-gray-800 flex items-center gap-2"
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
										d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
									/>
								</svg>
								{t("action.browseApps")}
							</button>
						</div>
					)}

					{/* Other categories */}
					{filteredCatalog.map((category) => (
						<div key={category.category}>
							<div className="flex items-center gap-2 mb-2">
								<svg
									className="w-4 h-4 text-gray-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={1.5}
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d={
											CATEGORY_ICONS[category.category] ??
											"M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
										}
									/>
								</svg>
								<h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
									{categoryLabels[category.category] ?? category.category}
								</h3>
							</div>
							<div className="space-y-1">
								{category.actions.map((action) => (
									<button
										type="button"
										key={action.id}
										onClick={() => onSelect(action)}
										className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm ${
											selectedActionId === action.id
												? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
												: "text-gray-300 hover:bg-gray-800"
										}`}
									>
										{action.label}
									</button>
								))}
							</div>
						</div>
					))}

					{filteredCatalog.length === 0 && search.trim() && (
						<div className="text-center text-gray-500 py-8">
							{t("action.noResults")}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
