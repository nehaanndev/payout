"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { MindUserIdentity } from "@/lib/mind/types";
import { useToodlMind } from "./ToodlMindProvider";

const identitiesEqual = (
  a: MindUserIdentity | null,
  b: MindUserIdentity | null
) => {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.userId === b.userId &&
    (a.email ?? null) === (b.email ?? null) &&
    (a.displayName ?? null) === (b.displayName ?? null) &&
    (a.timezone ?? null) === (b.timezone ?? null)
  );
};

const MindIdentityBridge = () => {
  const { setIdentity, identity } = useToodlMind();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const timezone =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "UTC";

      const nextIdentity: MindUserIdentity | null = user
        ? {
            userId: user.uid,
            email: user.email ?? null,
            displayName:
              user.displayName ??
              (user.email ? user.email.split("@")[0] : null),
            timezone,
          }
        : null;

      if (!identitiesEqual(identity, nextIdentity)) {
        setIdentity(nextIdentity);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [identity, setIdentity]);

  return null;
};

export default MindIdentityBridge;
