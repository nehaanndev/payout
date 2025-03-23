"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import ExpenseSplitter from "./expense_splitter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
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
            <Button onClick={() => signOut()} variant="outline" className="text-sm">
              Sign Out
            </Button>
          </div>

          {/* Main App Content */}
          <div className="flex-grow p-8">
            <ExpenseSplitter />
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
              <Button onClick={() => signIn("google")} className="w-full">
                Sign In with Google
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
