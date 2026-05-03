"use client";

// STORY-059 — tutorial state hook.
//
// One persistent "completed" flag per tutorial id, stored in
// localStorage so the same browser doesn't re-prompt. Flags are
// device-local (intentional — tutorials orient a user to THIS
// device's UI; clearing on logout would re-prompt on every signin
// for shared phones).
//
// Each tutorial is independent — completing the clients tutorial
// doesn't auto-complete the calendar one.
//
// API surface:
//   const tutorial = useTutorialState("clients-add");
//   tutorial.show       // true if not completed AND not yet dismissed this session
//   tutorial.complete() // mark as done, never show again
//   tutorial.skip()     // session-only hide; storage flag NOT set

import { useEffect, useState } from "react";
import { getStorage } from "@babun/shared/storage";

export type TutorialId =
  | "clients-add"
  | "calendar-tap"
  | "settings-billing";

const FLAG_PREFIX = "babun:tutorial-";

function flagKey(id: TutorialId): string {
  return `${FLAG_PREFIX}${id}-completed`;
}

export interface TutorialState {
  show: boolean;
  complete: () => void;
  skip: () => void;
}

export function useTutorialState(id: TutorialId): TutorialState {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let completed = false;
    try {
      completed = getStorage().getRaw(flagKey(id)) === "1";
    } catch {
      // private mode — we'll show the tutorial once, accept the
      // re-show on next reload.
    }
    if (completed) return;
    // Defer one frame so the underlying page has a chance to mount
    // its data-tutorial targets before the overlay measures their
    // bounding rects.
    const t = window.setTimeout(() => {
      setShow(true);
    }, 200);
    return () => window.clearTimeout(t);
  }, [id]);

  const complete = () => {
    try {
      getStorage().setRaw(flagKey(id), "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  const skip = () => {
    setShow(false);
  };

  return { show, complete, skip };
}
