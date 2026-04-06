import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsManager } from "../core/settings-manager";
import type { AppSettings } from "../lib/types";

interface UseSettingsReturn {
	settings: AppSettings | null;
	updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
	isLoading: boolean;
	error: string | null;
}

export function useSettings(): UseSettingsReturn {
	const [settings, setSettings] = useState<AppSettings | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const managerRef = useRef<SettingsManager | null>(null);

	useEffect(() => {
		let mounted = true;
		const manager = new SettingsManager();
		managerRef.current = manager;

		manager
			.load()
			.then((loaded) => {
				if (mounted) {
					setSettings(loaded);
					setIsLoading(false);
				}
			})
			.catch((e: unknown) => {
				if (mounted) {
					setError(e instanceof Error ? e.message : String(e));
					setIsLoading(false);
				}
			});

		return () => {
			mounted = false;
		};
	}, []);

	const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
		const manager = managerRef.current;
		if (!manager) return;

		try {
			const updated = await manager.update(partial);
			setSettings(updated);
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, []);

	return { settings, updateSettings, isLoading, error };
}
