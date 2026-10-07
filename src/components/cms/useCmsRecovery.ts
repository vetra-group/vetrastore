"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { checkpointScope, deleteCheckpoint, readCheckpoint, writeCheckpoint } from "@/lib/cms/draft-checkpoint";
import type { CmsContent } from "@/lib/cms/types";

export type RecoveredDraft = { base: CmsContent; content: CmsContent; revision: number };

export function useCmsRecovery(owner: string | undefined, base: CmsContent | undefined, content: CmsContent | null, revision: number | undefined, dirty: boolean) {
  const [scope, setScope] = useState<string | null>(null);
  const [recoveryOwner, setRecoveryOwner] = useState<string | undefined>();
  const [candidate, setCandidate] = useState<RecoveredDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const latest = useRef({ base, content, revision, dirty });
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const ownerRef = useRef(owner);
  const generation = useRef(0);
  const activeOwner = !!owner && recoveryOwner === owner;
  useLayoutEffect(() => { ownerRef.current = owner; latest.current = { base, content, revision, dirty }; }, [owner, base, content, revision, dirty]);
  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    void (async () => {
      try {
        const key = checkpointScope(owner);
        const saved = await readCheckpoint<RecoveredDraft>(`${key}:draft`, owner);
        if (cancelled) return;
        if (saved && (!saved.value?.base || !saved.value.content || !Number.isInteger(saved.value.revision) || ![saved.value.base, saved.value.content].every((entry) => Array.isArray(entry.products) && Array.isArray(entry.slides) && Array.isArray(entry.articles) && Array.isArray(entry.media) && entry.copy && entry.settings))) throw new Error("Invalid recovery data");
        setScope(key);
        setCandidate(saved?.value ?? null);
        setStatus("idle");
      } catch { if (!cancelled) { setScope(null); setCandidate(null); setStatus("error"); } }
      finally { if (!cancelled) { setRecoveryOwner(owner); setReady(true); } }
    })();
    return () => { cancelled = true; };
  }, [owner]);
  useEffect(() => {
    if (!activeOwner || !scope || !owner || !scope.startsWith(`${owner}:`) || !ready || candidate) return;
    let active = true;
    const version = generation.current;
    // Serialize writes so an older slow transaction can never overwrite newer edits.
    const flush = () => {
      clearTimeout(timer);
      if (generation.current !== version || ownerRef.current !== owner) return;
      const snapshot = latest.current;
      if (!snapshot.base || !snapshot.content || snapshot.revision === undefined) return;
      queue.current = queue.current.catch(() => undefined).then(async () => {
        if (snapshot.dirty) {
          if (active) setStatus("saving");
          await writeCheckpoint(`${scope}:draft`, owner, { base: snapshot.base, content: snapshot.content, revision: snapshot.revision });
          if (active) setStatus("saved");
        } else { await deleteCheckpoint(`${scope}:draft`); if (active) setStatus("idle"); }
      }).catch(() => { if (active) setStatus("error"); });
    };
    const timer = setTimeout(flush, 250);
    const visibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => { active = false; clearTimeout(timer); window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", visibility); };
  }, [activeOwner, scope, owner, ready, candidate, base, content, revision, dirty]);
  const dismiss = async () => {
    generation.current++;
    await queue.current.catch(() => undefined);
    if (activeOwner && scope) await deleteCheckpoint(`${scope}:draft`);
    if (ownerRef.current === owner) setCandidate(null);
  };
  const clear = async () => {
    generation.current++;
    await queue.current.catch(() => undefined);
    if (activeOwner && scope) { await deleteCheckpoint(`${scope}:draft`); await deleteCheckpoint(`${scope}:media`); }
    if (ownerRef.current === owner) setCandidate(null);
  };
  return { scope: activeOwner ? scope : null, candidate: activeOwner ? candidate : null, ready: activeOwner && ready, status: activeOwner ? status : "idle", dismiss, clear };
}
