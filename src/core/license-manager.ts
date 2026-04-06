import { LazyStore } from "@tauri-apps/plugin-store";
import { TRIAL } from "../lib/constants";
import type { TrialState } from "../lib/types";

interface StoredLicenseData {
	trialStartedAt: string | null;
	lastCheckedAt: string | null;
	licenseKey: string | null;
	isLicensed: boolean;
}

const LICENSE_KEY = "license_data";
const MS_PER_DAY = 86_400_000;

export class LicenseManager {
	#store: LazyStore;
	#cache: StoredLicenseData | null = null;

	constructor() {
		this.#store = new LazyStore("license.json");
	}

	async #loadData(): Promise<StoredLicenseData> {
		if (this.#cache) return this.#cache;

		const raw = await this.#store.get<StoredLicenseData>(LICENSE_KEY);
		const data: StoredLicenseData = raw ?? {
			trialStartedAt: null,
			lastCheckedAt: null,
			licenseKey: null,
			isLicensed: false,
		};

		this.#cache = data;
		return data;
	}

	async #saveData(data: StoredLicenseData): Promise<void> {
		this.#cache = data;
		await this.#store.set(LICENSE_KEY, data);
		await this.#store.save();
	}

	async startTrialIfNeeded(): Promise<void> {
		const data = await this.#loadData();

		if (data.trialStartedAt === null) {
			const now = new Date().toISOString();
			await this.#saveData({
				...data,
				trialStartedAt: now,
				lastCheckedAt: now,
			});
		}
	}

	async getTrialState(): Promise<TrialState> {
		const data = await this.#loadData();

		// If licensed, return active with max days
		if (data.isLicensed) {
			return {
				status: "active",
				daysRemaining: Number.POSITIVE_INFINITY,
				trialStartedAt: data.trialStartedAt ?? new Date().toISOString(),
			};
		}

		// No trial started yet
		if (data.trialStartedAt === null) {
			return {
				status: "active",
				daysRemaining: TRIAL.durationDays,
				trialStartedAt: new Date().toISOString(),
			};
		}

		const now = new Date();
		const nowIso = now.toISOString();

		// Anti-tamper: check if current time is before last checked time
		if (data.lastCheckedAt !== null) {
			const lastChecked = new Date(data.lastCheckedAt);
			if (now.getTime() < lastChecked.getTime()) {
				// Time was tampered — immediately expire
				await this.#saveData({ ...data, lastCheckedAt: nowIso });
				return {
					status: "expired",
					daysRemaining: 0,
					trialStartedAt: data.trialStartedAt,
				};
			}
		}

		// Update last checked time
		await this.#saveData({ ...data, lastCheckedAt: nowIso });

		const trialStart = new Date(data.trialStartedAt);
		const elapsed = now.getTime() - trialStart.getTime();
		const elapsedDays = elapsed / MS_PER_DAY;
		const daysRemaining = Math.max(
			0,
			Math.ceil(TRIAL.durationDays - elapsedDays),
		);

		if (daysRemaining <= 0) {
			return {
				status: "expired",
				daysRemaining: 0,
				trialStartedAt: data.trialStartedAt,
			};
		}

		const isExpiringSoon = TRIAL.warningDays.some((d) => daysRemaining <= d);

		return {
			status: isExpiringSoon ? "expiring_soon" : "active",
			daysRemaining,
			trialStartedAt: data.trialStartedAt,
		};
	}

	async validateLicense(key: string): Promise<boolean> {
		// In production this would call the LemonSqueezy/Gumroad API
		// For now, accept any non-empty key that matches a basic pattern
		const isValid = /^KK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);

		if (isValid) {
			const data = await this.#loadData();
			await this.#saveData({
				...data,
				licenseKey: key,
				isLicensed: true,
			});
		}

		return isValid;
	}

	async isLicensed(): Promise<boolean> {
		const data = await this.#loadData();
		return data.isLicensed;
	}
}
