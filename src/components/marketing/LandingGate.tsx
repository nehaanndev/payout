"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  provider,
  microsoftProvider,
  facebookProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "@/lib/firebase";
import { LandingPage } from "@/components/marketing/LandingPage";
import { Spinner } from "@/components/ui/spinner";
import type { Member } from "@/types/group";

export function LandingGate() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      if (current) {
        setRedirecting(true);
        router.replace("/dashboard");
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (checkingAuth || redirecting) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("anon_member");
    if (stored) {
      setRedirecting(true);
      router.replace("/dashboard");
    }
  }, [checkingAuth, redirecting, router]);

  const startSignIn = useCallback(
    async (providerType: "google" | "microsoft" | "facebook") => {
      try {
        const selectedProvider =
          providerType === "microsoft"
            ? microsoftProvider
            : providerType === "facebook"
            ? facebookProvider
            : provider;
        await signInWithPopup(auth, selectedProvider);
        router.replace("/dashboard");
      } catch (error) {
        console.error("Sign-in failed", error);
      }
    },
    [router]
  );

  const handleContinueWithoutSignIn = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const anonMember: Member = {
      id: `anon-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
      firstName: "Friend",
      email: null,
    };
    window.localStorage.setItem("anon_member", JSON.stringify(anonMember));
    setRedirecting(true);
    router.replace("/dashboard");
  }, [router]);

  if (redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <LandingPage
      onGoogle={() => startSignIn("google")}
      onMicrosoft={() => startSignIn("microsoft")}
      onFacebook={() => startSignIn("facebook")}
      onContinueWithoutSignIn={handleContinueWithoutSignIn}
    />
  );
}
