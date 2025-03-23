"use client";

import { useState, useEffect } from "react";
import { auth, provider, signInWithPopup, signOut, User, onAuthStateChanged } from "../lib/firebase"; // Import Firebase auth and provider
import ExpenseSplitter from "./expense_splitter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const [session, setSession] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Set up an observer on auth state change to track the sign-in state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(user);
      setLoading(false);
    });

    // Cleanup on component unmount
    return () => unsubscribe();
  }, []);

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
    return <p>Loading...</p>;
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
            <div className="flex items-center space-x-4">
              {session.photoURL && (
                <img
                  src={session.photoURL}
                  alt="User Avatar"
                  className="w-10 h-10 rounded-full border-2 border-gray-300 shadow-sm"
                />
              )}
              <Button onClick={handleSignOut} variant="outline" className="text-sm">
                Sign Out
              </Button>
            </div>
          </div>              
          {/* Main App Content */}
          <div className="flex-grow p-8">
            <ExpenseSplitter session = {session}/>
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
