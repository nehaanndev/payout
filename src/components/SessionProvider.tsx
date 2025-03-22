"use client";  // Ensures client-side rendering

import { SessionProvider as NextAuthProvider } from "next-auth/react";
import { ReactNode } from "react";
import { Session } from "next-auth";  // Import the correct Session type

interface Props {
  children: ReactNode;
  session: Session | null;  // Use the proper type
}

const SessionProvider = ({ children, session }: Props) => {
  return <NextAuthProvider session={session}>{children}</NextAuthProvider>;
};

export default SessionProvider;
