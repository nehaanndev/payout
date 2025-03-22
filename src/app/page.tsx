"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import ExpenseSplitter from "./expense_splitter";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p>Loading...</p>;
  }

  return (
    <div>
      {session ? (
        <div>
          <p>Welcome, {session.user?.name}</p>
          <Button onClick={() => signOut()}>Sign Out</Button>
          <ExpenseSplitter />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p>You are not signed in</p>
          <Button onClick={() => signIn("google")}>Sign In with Google</Button>
        </div>
      )}
    </div>
  );
}
