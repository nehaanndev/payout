"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, signOut } from "@/lib/firebase";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { cn } from "@/lib/utils";

import { ensureUserProfile } from "@/lib/userService";
import type { UserProfile } from "@/types/user";

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isAnon, setIsAnon] = useState(false);

    useEffect(() => {
        // Check for anonymous user
        const anonMember = typeof window !== "undefined" ? window.localStorage.getItem("anon_member") : null;
        if (anonMember) {
            setIsAnon(true);
        }

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
        if (user) {
            await signOut(auth);
        }

        // Clear all local storage data
        if (typeof window !== "undefined") {
            window.localStorage.removeItem("anon_member");
            window.localStorage.removeItem("user_avatar");
            window.localStorage.removeItem("user_name");
            window.localStorage.removeItem("user_id");
            window.localStorage.removeItem("toodl_intent");
        }

        setIsAnon(false);
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
                isAnon={isAnon}
                tier={userProfile?.tier}
                onSignOut={handleSignOut}
            />
            <MobileNav
                user={user}
                isAnon={isAnon}
                tier={userProfile?.tier}
                onSignOut={handleSignOut}
            />
            <div className={cn("transition-all duration-300", "pl-0 md:pl-16")}>
                {children}
            </div>
        </div>
    );
}
