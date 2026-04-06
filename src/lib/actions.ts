import type { Action, MediaPayload, TapPattern } from "./types";

function mediaAction(
	id: string,
	label: string,
	key: MediaPayload["key"],
): Action {
	return { type: "media", id, label, payload: { key } };
}

export const MEDIA_ACTIONS: Action[] = [
	mediaAction("media_play_pause", "Play / Pause", "play_pause"),
	mediaAction("media_next", "Next Track", "next_track"),
	mediaAction("media_prev", "Previous Track", "previous_track"),
];

export const ACTION_CATALOG: ReadonlyArray<{
	category: string;
	actions: Action[];
}> = [{ category: "Media", actions: MEDIA_ACTIONS }];

export const ALL_ACTIONS: Action[] = ACTION_CATALOG.flatMap(
	(cat) => cat.actions,
);

export function findActionById(id: string): Action | undefined {
	return ALL_ACTIONS.find((a) => a.id === id);
}

export const DEFAULT_MAPPINGS: TapPattern[] = [];
