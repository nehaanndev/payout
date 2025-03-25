"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";  // Import useSearchParams
import { auth, provider, signInWithPopup, signOut, User, onAuthStateChanged } from "../lib/firebase"; // Import Firebase auth and provider
import ExpenseSplitter from "./expense_splitter";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Home() {
  const searchParams = useSearchParams();  // Use searchParams to get query params
  const group_id = searchParams.get("group_id");  // Get group_id from query string
  const [session, setSession] = useState<User | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setSession(user); // Set the session as UserWithGroup type
      setGroup(group_id); // Reset group state
      console.log("group_id:", group_id);
      setLoading(false);
    });
  
    return () => unsubscribe();
  }, [group_id]);  // Add `group_id` as a dependency

    // Close the profile card when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
          setShowProfileCard(false);
        }
      };
  
      if (showProfileCard) {
        document.addEventListener("mousedown", handleClickOutside);
      }
  
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showProfileCard]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in to Firebase: ", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {session ? (
        <>
          {/* Top banner */}
          <div className="bg-white shadow-md w-full py-4 px-8 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Payout</h1>
              <p className="text-gray-500 text-sm">Manage your expenses with ease</p>
            </div>

            {/* Profile image and dropdown */}
            <div className="relative">
              {session.photoURL && (
                <img
                  src={session.photoURL}
                  alt="User Avatar"
                  width={40}
                  height={40}
                  className="rounded-full border cursor-pointer"
                  onClick={() => setShowProfileCard((prev) => !prev)}
                />
              )}

              {/* Profile Card */}
              {showProfileCard && (
                <div
                  ref={profileRef}
                  className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg z-50"
                >
                  <Card className="p-6">
                    <CardHeader className="flex flex-col items-center">
                      <img
                        src={session.photoURL || "/default-profile.png"}
                        alt="User"
                        width={80}
                        height={80}
                        className="rounded-full border"
                      />
                      <CardTitle className="text-lg mt-4">
                        Hi, {session.displayName || "User"}! 👋
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center mt-4">
                      <Button
                        onClick={() => handleSignOut()}
                        variant="outline"
                        className="w-full"
                      >
                        Sign Out
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>              
          {/* Main App Content */}
          <div className="flex-grow p-8">
            <ExpenseSplitter session = {session} groupid = {group}/>
          </div>              
        </>
      ) : (
        // Sign-in card (for non-signed-in users)
        <div className="flex items-center justify-center min-h-screen">
          <Card className="p-8 shadow-xl rounded-lg max-w-lg w-full bg-white">
            <CardHeader>
              <CardTitle className="text-4xl font-bold text-center">Payout</CardTitle>
              <p className="text-center text-gray-500 mt-2">Manage your expenses with ease</p>
            </CardHeader>
            <div className="flex flex-col items-center space-y-6 p-4">
              <Button onClick={() => handleSignIn()} className="w-full">
                Sign In with Google
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
