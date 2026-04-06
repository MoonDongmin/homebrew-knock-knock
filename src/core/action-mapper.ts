import { DEFAULT_MAPPINGS } from "../lib/actions";
import type { Action, TapCount, TapPattern } from "../lib/types";

export class ActionMapper {
	#patterns: Map<TapCount, TapPattern> = new Map();

	constructor(initialPatterns?: TapPattern[]) {
		const patterns = initialPatterns ?? DEFAULT_MAPPINGS;
		this.loadFromConfig(patterns);
	}

	getAction(tapCount: TapCount): Action | undefined {
		const pattern = this.#patterns.get(tapCount);
		if (pattern?.enabled) {
			return pattern.action;
		}
		return undefined;
	}

	getPattern(tapCount: TapCount): TapPattern | undefined {
		return this.#patterns.get(tapCount);
	}

	setMapping(tapCount: TapCount, action: Action): void {
		const existing = this.#patterns.get(tapCount);
		this.#patterns.set(tapCount, {
			id: existing?.id ?? `pattern_${tapCount}tap`,
			tapCount,
			action,
			enabled: existing?.enabled ?? true,
		});
	}

	removeMapping(tapCount: TapCount): void {
		this.#patterns.delete(tapCount);
	}

	toggleMapping(tapCount: TapCount, enabled: boolean): void {
		const pattern = this.#patterns.get(tapCount);
		if (pattern) {
			this.#patterns.set(tapCount, { ...pattern, enabled });
		}
	}

	getAllMappings(): TapPattern[] {
		return Array.from(this.#patterns.values()).sort(
			(a, b) => a.tapCount - b.tapCount,
		);
	}

	loadFromConfig(patterns: TapPattern[]): void {
		this.#patterns.clear();
		for (const pattern of patterns) {
			this.#patterns.set(pattern.tapCount, pattern);
		}
	}
}
