'use client'

import { Suspense, useState, useEffect, useRef } from "react";
import SearchParamsClient from '@/components/SearchParamsClient'
import {
  auth,
  provider,
  microsoftProvider,
  facebookProvider,
  signInWithPopup,
  signOut,
  User,
  onAuthStateChanged,
} from "../lib/firebase"; // Import Firebase auth and providers
import ExpenseSplitter from "./expense_splitter";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getOrCreateUserId } from "@/lib/userUtils";
import { avatarUrls } from "@/lib/avatars";
import { Member } from "@/types/group"; // assuming Member is defined there
import { fetchGroupById } from "@/lib/firebaseUtils";
import IdentityPrompt from "@/components/IdentityPrompt";
/* --- imports (add these near the top of the file) --- */
import Image from "next/image";
import Link from "next/link";
import { CurrencyCode } from "@/lib/currency_core";
import { DEFAULT_CURRENCY, getGroupCurrency } from "@/lib/currency";
import { AppTopBar } from "@/components/AppTopBar";

export default function Home() {
  const [session, setSession] = useState<User | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [showIdentityChoice, setShowIdentityChoice] = useState(false);
  const [sharedMembers, setSharedMembers] = useState<Member[] | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [existingName, setExistingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [avatar, setAvatar] = useState("/avatars/avatar5.png");
  const [anonUser, setAnonUser] = useState<Member | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null)  // Get group_id from query string
    

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setSession(user); // Set the session as UserWithGroup type
      setGroup(groupId); // Reset group state
      console.log("group_id:", groupId);
      setLoading(false);
    });
  
    return () => unsubscribe();
  }, [groupId]);  // Add `group_id` as a dependency

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

  useEffect(() => {
    if (typeof window !== "undefined" && !session) {
      const storedAvatar = localStorage.getItem("user_avatar");
      if (storedAvatar) setAvatar(storedAvatar);
  
      const memberStr = localStorage.getItem("anon_member");
      if (memberStr) {
        try {
          const member: Member = JSON.parse(memberStr);
          setAnonUser(member);
        } catch {
          console.warn("Invalid anon member in storage");
        }
      }
    }
  }, [session]);
  
  // 1) If there's a group_id but no session or anonUser yet,
  // fetch that group's members so we can prompt "Who are you?"
  useEffect(() => {
    if (groupId && !session && !anonUser) {
      fetchGroupById(groupId)
        .then((g) => {
          if (g) {
            setSharedMembers(g.members ?? []);
            setCurrency(getGroupCurrency(g));
          }
          setShowIdentityChoice(true);
        })
        .catch(console.error);
    }
  }, [groupId, session, anonUser]);

  const displayName = session?.displayName || anonUser?.firstName || 'Guest User';
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in to Firebase: ", error);
    }
  };

  const handleMicrosoftSignIn = async () => {
    try {
      await signInWithPopup(auth, microsoftProvider);
    } catch (error) {
      console.error("Error signing in with Microsoft: ", error);
    }
  };

  const handleFacebookSignIn = async () => {
    try {
      await signInWithPopup(auth, facebookProvider);
    } catch (error) {
      console.error("Error signing in with Facebook: ", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleContinueWithoutSignIn = () => {
    const existing_name = localStorage.getItem('user_name');
    if (existing_name) {
      setExistingName(existing_name);
      setShowIdentityChoice(true);
    } else {
      setIsNewUser(true);
      setShowIdentityChoice(true);
    }
    const avatarIndex = Math.floor(Math.random() * avatarUrls.length);
    const anonAvatar = avatarUrls[avatarIndex];
    localStorage.setItem('user_avatar', anonAvatar);
  };

  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }
  return (
    <>
      {/* 3️⃣ Hydrate the client-only hook via Suspense */}
      <Suspense fallback={null}>
        <SearchParamsClient onParams={params => {
          setGroupId(params.get('group_id'))
        }} />
      </Suspense>
    <div className="min-h-screen flex flex-col bg-gray-100">
      { /* Case A: Signed-in or already-identified anon user → show the app */ }
      {session || anonUser ? (
        <>
          <AppTopBar
            product="expense"
            userSlot={
              <div className="relative">
                {avatar && (
                  <Image
                    src={avatar}
                    alt="User Avatar"
                    width={40}
                    height={40}
                    className="rounded-full border cursor-pointer"
                    onClick={() => setShowProfileCard((prev) => !prev)}
                  />
                )}
                {showProfileCard && (
                  <div ref={profileRef} className="absolute right-0 mt-2 w-72 rounded-2xl bg-white/95 shadow-xl ring-1 ring-slate-200">
                    <Card className="border-0 bg-transparent p-6">
                      <CardHeader className="flex flex-col items-center gap-3">
                        <Image
                          src={avatar}
                          alt="User"
                          width={80}
                          height={80}
                          className="rounded-full border"
                        />
                        <CardTitle className="text-lg">Hi, {displayName}! 👋</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-400">Jump to</p>
                          <div className="mt-3 grid gap-2">
                            <Link href="/" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-800">
                              <Image src="/brand/toodl-expense.svg" alt="Expense" width={20} height={20} />
                              Expense Splitter
                            </Link>
                            <Link href="/budget" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-800">
                              <Image src="/brand/toodl-budget.svg" alt="Budget" width={20} height={20} />
                              Budget Studio
                            </Link>
                            <Link href="/journal" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-800">
                              <Image src="/brand/toodl-journal.svg" alt="Journal" width={20} height={20} />
                              Journal Studio
                            </Link>
                          </div>
                        </div>
                        {session ? (
                          <Button onClick={handleSignOut} variant="outline" className="w-full">
                            Sign Out
                          </Button>
                        ) : (
                          <Button
                            onClick={() => {
                              localStorage.clear();
                              location.reload();
                            }}
                            variant="outline"
                            className="w-full"
                          >
                            Reset Identity
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            }
          />
          <div className="flex-grow p-8">
            <ExpenseSplitter session={session} groupid={group} anonUser={anonUser} currency={currency} />
          </div>
        </>
      )     
      /* Case B: No user yet, but we fetched sharedMembers → ask “Who are you?” */ 
      : sharedMembers ? (
        <IdentityPrompt
          members={sharedMembers}
          onSelect={(member) => {
            // Save the chosen member as our anonUser and hide the prompt
            localStorage.setItem("anon_member", JSON.stringify(member));
            setAnonUser(member);
            setShowIdentityChoice(false);
            setSharedMembers(null);
          }}
        />
      ): (
          /* ⬇️ LANDING HERO + SIGN‑IN SECTION ⬇️ */
          <div className="relative min-h-screen bg-[#FEF4D6] flex items-center">
            {/* decorative split background for desktop */}
            <div className="hidden lg:block absolute inset-y-0 right-0 w-1/2 bg-[#FEF4D6]/40 pointer-events-none" />
            <div className="container max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row md:items-start lg:items-center gap-16 lg:gap-32">
              {/* ── left / top column : sign‑in card ─────────────────────────── */}
              <div className="w-full md:max-w-sm">
              <Card className="p-8 rounded-xl shadow-lg ring-1 ring-black/5 bg-white">
                  <CardHeader>
                    <CardTitle className="text-4xl font-extrabold text-center text-[#1F2A37]">Toodl</CardTitle>
                    <p className="text-center text-gray-500 mt-2">Manage your expenses with ease</p>
                  </CardHeader>

                  <div className="flex flex-col items-center space-y-6 p-4">
                    <Button
                      variant="primaryDark"
                      onClick={handleGoogleSignIn}
                      className="w-full bg-[#1F2937] text-white hover:bg-[#111827]"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Image
                          src="/logos/google.svg"
                          alt="Google"
                          width={18}
                          height={18}
                          className="h-4 w-4"
                        />
                        Sign In with Google
                      </span>
                    </Button>
                    <Button
                      variant="primaryDark"
                      onClick={handleMicrosoftSignIn}
                      className="w-full bg-[#1F2937] text-white hover:bg-[#111827]"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Image
                          src="/logos/microsoft.svg"
                          alt="Microsoft"
                          width={18}
                          height={18}
                          className="h-4 w-4"
                        />
                        Sign In with Microsoft
                      </span>
                    </Button>
                    <Button
                      variant="primaryDark"
                      onClick={handleFacebookSignIn}
                      className="w-full bg-[#1F2937] text-white hover:bg-[#111827]"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Image
                          src="/logos/facebook.svg"
                          alt="Facebook"
                          width={18}
                          height={18}
                          className="h-4 w-4"
                        />
                        Sign In with Facebook
                      </span>
                    </Button>
                    <Button
                      variant="primaryDark"
                      className="w-full"
                      onClick={handleContinueWithoutSignIn}
                    >
                      Continue Without Sign In
                    </Button>
                  </div> 
            {showIdentityChoice && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
                  {existingName && !isNewUser ? (
                    <>
                      <h2 className="font-bold mb-4 text-center text-lg">Welcome back!</h2>
                      <div className="space-y-4">
                        <Button className="w-full" onClick={() => {
                          const member = JSON.parse(localStorage.getItem("anon_member")!);
                          setAnonUser(member);
                          setShowIdentityChoice(false);
                        }}>
                          I&apos;m {existingName}
                        </Button>

                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => setIsNewUser(true)}
                        >
                          Somebody else
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="font-bold mb-4 text-center text-lg">What&apos;s your name?</h2>
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        placeholder="Enter your name"
                        className="border p-2 w-full rounded mb-4"
                      />
                      <Button
                        variant="primaryDark"
                        className="w-full"
                        onClick={() => {
                          if (!tempName.trim()) return;
                          const id = getOrCreateUserId();
                          const member: Member = {
                            id,
                            email: "",
                            firstName: tempName.trim(),
                            authProvider: "anon",
                          };
                          
                          localStorage.setItem("anon_member", JSON.stringify(member));
                          setAnonUser(member);
                          
                          const avatarIndex = Math.floor(Math.random() * avatarUrls.length);
                          const anonAvatar = avatarUrls[avatarIndex];
                          localStorage.setItem('user_avatar', anonAvatar);
                          setShowIdentityChoice(false);
                        }}
                      >
                        Continue
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

          </Card>
            </div>
            {/* ── right / bottom column : hero illustration ───────────────── */}
            {/* right / bottom column : hero */}
            <div className="w-full md:flex-1 flex justify-center">
              <Image
                src="/images/hero-payout.png"
                alt="Toodl Hero Illustration"
                width={600}         /* <–– sets natural size */
                height={600}
                className="w-full max-w-[420px] lg:max-w-[540px] h-auto object-contain animate-float"
                priority
              />
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
