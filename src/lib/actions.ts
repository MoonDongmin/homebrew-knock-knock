import type { Action, MediaPayload, TapPattern } from "./types";

function mediaAction(
	id: string,
	label: string,
	key: MediaPayload["key"],
): Action {
	return { type: "media", id, label, payload: { key } };
}

function soundAction(id: string, label: string, soundName: string): Action {
	return { type: "sound_play", id, label, payload: { soundName } };
}

export const MEDIA_ACTIONS: Action[] = [
	mediaAction("media_play_pause", "Play / Pause", "play_pause"),
	mediaAction("media_next", "Next Track", "next_track"),
	mediaAction("media_prev", "Previous Track", "previous_track"),
];

export const VOICE_ACTIONS: Action[] = [
	soundAction("voice_ya", "야!", "chan9"),
	soundAction("voice_ao", "아오!", "angerychan9"),
];

export const ACTION_CATALOG: ReadonlyArray<{
	category: string;
	actions: Action[];
}> = [
	{ category: "Media", actions: MEDIA_ACTIONS },
	{ category: "Voice", actions: VOICE_ACTIONS },
];

export const ALL_ACTIONS: Action[] = ACTION_CATALOG.flatMap(
	(cat) => cat.actions,
);

export function findActionById(id: string): Action | undefined {
	return ALL_ACTIONS.find((a) => a.id === id);
}

export const DEFAULT_MAPPINGS: TapPattern[] = [];
