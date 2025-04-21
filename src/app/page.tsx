"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";  // Import useSearchParams
import { auth, provider, signInWithPopup, signOut, User, onAuthStateChanged } from "../lib/firebase"; // Import Firebase auth and provider
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

export default function Home() {
  const searchParams = useSearchParams();  // Use searchParams to get query params
  const group_id = searchParams.get("group_id");  // Get group_id from query string
  const [session, setSession] = useState<User | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [showIdentityChoice, setShowIdentityChoice] = useState(false);
  const [sharedMembers, setSharedMembers] = useState<Member[] | null>(null);
  const [existingName, setExistingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [avatar, setAvatar] = useState("avatars/avatar5.png");
  const [anonUser, setAnonUser] = useState<Member | null>(null);
    

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
    if (group_id && !session && !anonUser) {
      fetchGroupById(group_id)
        .then((g) => {
          if (g) {
            setSharedMembers(g.members ?? []);
          }
          setShowIdentityChoice(true);
        })
        .catch(console.error);
    }
  }, [group_id, session, anonUser]);

  const displayName = session?.displayName || anonUser?.firstName || 'Guest User';
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

  const handleContinueWithoutSignIn = () => {
    const existing_name = localStorage.getItem('user_name');
    const existing_id = localStorage.getItem('user_id');
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
    <div className="min-h-screen flex flex-col bg-gray-100">
      { /* Case A: Signed-in or already-identified anon user → show the app */ }
      {session || anonUser ? (
        <>
          {/* Top banner */}
          <div className="bg-white shadow-md w-full py-4 px-8 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Payout</h1>
              <p className="text-gray-500 text-sm">Manage your expenses with ease</p>
            </div>

            {/* Profile image and dropdown */}
            <div className="relative">
              {avatar && (
                <img
                  src={avatar}
                  alt="User Avatar"
                  width={40}
                  height={40}
                  className="rounded-full border cursor-pointer"
                  onClick={() => setShowProfileCard((prev) => !prev)}
                />
              )}

              {/* Profile Card */}
              {showProfileCard && (
                <div ref={profileRef} className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg z-50">
                  <Card className="p-6">
                    <CardHeader className="flex flex-col items-center">
                      <img
                        src={avatar}
                        alt="User"
                        width={80}
                        height={80}
                        className="rounded-full border"
                      />
                      <CardTitle className="text-lg mt-4">
                        Hi, {displayName}! 👋
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center mt-4">
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
          </div>              
          {/* Main App Content */}
          <div className="flex-grow p-8">
          <ExpenseSplitter session={session} groupid={group} anonUser={anonUser} />
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
          <div className="min-h-screen flex items-center justify-center bg-[#FEF4D3]">
            <div className="container mx-auto px-6 py-16 flex flex-col-reverse md:flex-row items-center gap-12">
              {/* ── left / top column : sign‑in card ─────────────────────────── */}
              <div className="w-full md:max-w-md">
                <Card className="p-8 shadow-xl rounded-lg w-full bg-white">
                  <CardHeader>
                    <CardTitle className="text-4xl font-extrabold text-center text-[#1F2A37]">Payout</CardTitle>
                    <p className="text-center text-gray-500 mt-2">Manage your expenses with ease</p>
                  </CardHeader>

                  <div className="flex flex-col items-center space-y-6 p-4">
                    <Button onClick={handleSignIn} className="w-full">
                      Sign In with Google
                    </Button>
                    <Button
                      variant="outline"
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
                          I'm {existingName}
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
                      <h2 className="font-bold mb-4 text-center text-lg">What's your name?</h2>
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        placeholder="Enter your name"
                        className="border p-2 w-full rounded mb-4"
                      />
                      <Button
                        className="w-full"
                        onClick={() => {
                          if (!tempName.trim()) return;
                          const id = getOrCreateUserId();
                          const member: Member = {
                            id,
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
                src="/hero-payout.png"
                alt="Payout Hero Illustration"
                width={600}         /* <–– sets natural size */
                height={600}
                className="w-full max-w-[420px] md:max-w-[500px] lg:max-w-[560px] h-auto object-contain"
                priority
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
