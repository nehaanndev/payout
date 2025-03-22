"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const SignInPage = () => {
  const router = useRouter();

  const handleSignIn = async () => {
    await signIn("google");
    router.push("/");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Sign in</h1>
      <Button onClick={handleSignIn}>Sign in with Google</Button>
    </div>
  );
};

export default SignInPage;
