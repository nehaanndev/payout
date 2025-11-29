"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, signOut } from "@/lib/firebase";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";

import { ensureUserProfile } from "@/lib/userService";
import type { UserProfile } from "@/types/user";

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Ensure profile exists and fetch it
                const profile = await ensureUserProfile(currentUser);
                setUserProfile(profile);
            } else {
                setUserProfile(null);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await signOut(auth);
        router.push("/");
    };

    // Don't show sidebar on landing page
    const isLandingPage = pathname === "/";

    if (isLandingPage) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen">
            <AppSidebar
                user={user}
                tier={userProfile?.tier}
                onSignOut={handleSignOut}
            />
            <div className={cn("transition-all duration-300", "pl-16")}>
                {children}
            </div>
        </div>
    );
}
