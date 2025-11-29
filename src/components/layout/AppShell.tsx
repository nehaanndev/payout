"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, signOut } from "@/lib/firebase";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
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
            <AppSidebar user={user} onSignOut={handleSignOut} />
            <div className={cn("transition-all duration-300", "pl-16")}>
                {children}
            </div>
        </div>
    );
}
