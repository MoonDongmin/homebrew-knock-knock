import { LazyStore } from "@tauri-apps/plugin-store";
import { DEFAULT_MAPPINGS } from "../lib/actions";
import { DEFAULT_SETTINGS } from "../lib/constants";
import type { AppSettings, TapPattern } from "../lib/types";

const STORE_KEY = "app_settings";

export class SettingsManager {
	#store: LazyStore;
	#cache: AppSettings | null = null;

	constructor() {
		this.#store = new LazyStore("settings.json");
	}

	async load(): Promise<AppSettings> {
		const raw = await this.#store.get<AppSettings>(STORE_KEY);

		if (!raw) {
			// First launch — initialize with defaults including default mappings
			const initial: AppSettings = {
				...DEFAULT_SETTINGS,
				patterns: DEFAULT_MAPPINGS,
			};
			await this.save(initial);
			return initial;
		}

		// Merge with defaults to handle schema evolution
		const settings: AppSettings = {
			...DEFAULT_SETTINGS,
			...raw,
		};

		this.#cache = settings;
		return settings;
	}

	async save(settings: AppSettings): Promise<void> {
		this.#cache = settings;
		await this.#store.set(STORE_KEY, settings);
		await this.#store.save();
	}

	async getPatterns(): Promise<TapPattern[]> {
		const settings = this.#cache ?? (await this.load());
		return settings.patterns;
	}

	async savePatterns(patterns: TapPattern[]): Promise<void> {
		const settings = this.#cache ?? (await this.load());
		await this.save({ ...settings, patterns });
	}

	async update(partial: Partial<AppSettings>): Promise<AppSettings> {
		const settings = this.#cache ?? (await this.load());
		const updated = { ...settings, ...partial };
		await this.save(updated);
		return updated;
	}

	getCached(): AppSettings | null {
		return this.#cache;
	}
}
