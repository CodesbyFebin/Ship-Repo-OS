"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * A prompt bar never forgets (owner, 2026-09-26): its words and every
 * setting on it survive a refresh. This is the one way a bar remembers.
 *
 * Kept in `localStorage` under `amnt-bar:<key>`. SSR-safe: the first render
 * is `initial` on the server and in the browser alike (no hydration
 * mismatch), then the saved value lands in an effect. Nothing is written
 * until that read has happened, so the default never overwrites what was
 * saved. Blocked storage (private mode, quota) simply means it forgets.
 *
 * `ok` rejects a saved value that no longer makes sense - a model that was
 * retired, a mode that was renamed - so an old save can never send a bad id.
 */
export const PERSIST_PREFIX = "ship-bar:";

export function readPersisted(key: string): unknown {
    try {
        const raw = localStorage.getItem(PERSIST_PREFIX + key);
        return raw === null ? undefined : JSON.parse(raw);
    } catch {
        return undefined;
    }
}

export function writePersisted(key: string, value: unknown) {
    try {
        localStorage.setItem(PERSIST_PREFIX + key, JSON.stringify(value));
    } catch {
        /* storage blocked or full: this bar just forgets */
    }
}

export function usePersistedState<T>(
    key: string | null | undefined,
    initial: T,
    ok?: (v: unknown) => boolean,
): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(initial);
    /** The key whose saved value has been read. Nothing is written before. */
    const loaded = useRef<string | null>(null);
    /** The pass that read it: its `value` is still the default, never saved. */
    const justLoaded = useRef(false);
    const okRef = useRef(ok);
    okRef.current = ok;

    useEffect(() => {
        if (!key) return;
        const saved = readPersisted(key);
        const valid = saved !== undefined && (okRef.current ? okRef.current(saved) : typeof saved === typeof initial);
        if (valid) setValue(saved as T);
        loaded.current = key;
        justLoaded.current = true;
        // `initial` is a first-render default, not a dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    useEffect(() => {
        if (!key || loaded.current !== key) return;
        if (justLoaded.current) { justLoaded.current = false; return; }
        writePersisted(key, value);
    }, [key, value]);

    return [value, setValue];
}

/**
 * For a bar whose words live somewhere else (a parent's state, a store):
 * puts the saved words back once, if the box is empty, then saves every
 * change. `Composer` runs this for its `persistKey` prop.
 */
export function usePersistedText(key: string | null | undefined, value: string, onChange: (v: string) => void) {
    const loaded = useRef<string | null>(null);
    const justLoaded = useRef(false);
    const change = useRef(onChange);
    change.current = onChange;

    useEffect(() => {
        if (!key) return;
        const saved = readPersisted(key);
        if (typeof saved === "string" && saved && !value) change.current(saved);
        loaded.current = key;
        justLoaded.current = true;
        // Only on a new key: restoring is a mount-time thing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    useEffect(() => {
        if (!key || loaded.current !== key) return;
        // The restoring pass: the box still shows the old words (or none),
        // and writing them now would erase what was just asked for.
        if (justLoaded.current) { justLoaded.current = false; return; }
        writePersisted(key, value);
    }, [key, value]);
}
