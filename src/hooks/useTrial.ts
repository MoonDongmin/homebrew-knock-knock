import { useCallback, useEffect, useRef, useState } from "react";
import { LicenseManager } from "../core/license-manager";
import type { TrialState } from "../lib/types";

interface UseTrialReturn {
	trialState: TrialState | null;
	isLicensed: boolean;
	activate: (key: string) => Promise<boolean>;
	isLoading: boolean;
	error: string | null;
}

export function useTrial(): UseTrialReturn {
	const [trialState, setTrialState] = useState<TrialState | null>(null);
	const [isLicensed, setIsLicensed] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const managerRef = useRef<LicenseManager | null>(null);

	useEffect(() => {
		let mounted = true;
		const manager = new LicenseManager();
		managerRef.current = manager;

		async function init() {
			try {
				await manager.startTrialIfNeeded();
				const [state, licensed] = await Promise.all([
					manager.getTrialState(),
					manager.isLicensed(),
				]);

				if (mounted) {
					setTrialState(state);
					setIsLicensed(licensed);
					setIsLoading(false);
				}
			} catch (e: unknown) {
				if (mounted) {
					setError(e instanceof Error ? e.message : String(e));
					setIsLoading(false);
				}
			}
		}

		init();

		return () => {
			mounted = false;
		};
	}, []);

	const activate = useCallback(async (key: string): Promise<boolean> => {
		const manager = managerRef.current;
		if (!manager) return false;

		try {
			const valid = await manager.validateLicense(key);
			if (valid) {
				setIsLicensed(true);
				const state = await manager.getTrialState();
				setTrialState(state);
			}
			return valid;
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : String(e));
			return false;
		}
	}, []);

	return { trialState, isLicensed, activate, isLoading, error };
}
