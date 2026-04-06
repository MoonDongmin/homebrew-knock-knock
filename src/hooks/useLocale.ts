import { createContext, useContext } from "react";
import { type TranslationKey, t } from "../lib/i18n";
import type { Locale } from "../lib/types";

export const LocaleContext = createContext<Locale>("ko");

export function useLocale() {
	const locale = useContext(LocaleContext);

	function tr(
		key: TranslationKey,
		params?: Record<string, string | number>,
	): string {
		return t(key, locale, params);
	}

	return { locale, t: tr };
}
