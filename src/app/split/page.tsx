'use client'

import { Suspense, useState, useEffect, useMemo, useCallback } from "react";

import type { ReadonlyURLSearchParams } from "next/navigation";
import SearchParamsClient from '@/components/SearchParamsClient'
import {
  auth,
  provider,
  microsoftProvider,
  facebookProvider,
  signInWithPopup,
  User,
  onAuthStateChanged,
} from "@/lib/firebase"; // Import Firebase auth and providers
import ExpenseSplitter from "../expense_splitter";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getOrCreateUserId } from "@/lib/userUtils";
import { avatarUrls } from "@/lib/avatars";
import { Member } from "@/types/group"; // assuming Member is defined there
import { fetchGroupById } from "@/lib/firebaseUtils";
import IdentityPrompt from "@/components/IdentityPrompt";
/* --- imports (add these near the top of the file) --- */
import Image from "next/image";
import { CurrencyCode } from "@/lib/currency_core";
import { DEFAULT_CURRENCY, getGroupCurrency } from "@/lib/currency";
import { AppTopBar } from "@/components/AppTopBar";

import {
  Users,
} from "lucide-react";
import PaymentSettingsDialog from "@/components/PaymentSettingsDialog";
import { cn } from "@/lib/utils";
import { useToodlTheme } from "@/hooks/useToodlTheme";
import { theme as themeUtils } from "@/lib/theme";
import {
  fetchExpensePaymentPreferences,
  updateExpensePaymentPreferences,
} from "@/lib/expenseSettingsService";
import {
  ExpensePaymentPreferences,
  createDefaultExpensePaymentPreferences,
} from "@/types/paymentPreferences";
import { useToodlMind } from "@/components/mind/ToodlMindProvider";
import { MindUserIdentity } from "@/lib/mind/types";

const identitiesMatch = (
  a: MindUserIdentity | null,
  b: MindUserIdentity | null
) => {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.userId === b.userId &&
    a.email === b.email &&
    a.displayName === b.displayName &&
    a.timezone === b.timezone
  );
};

export default function Home() {

  const [session, setSession] = useState<User | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabState, setTabState] = useState<{
    activeTab: 'summary' | 'create';
    showCreateTab: boolean;
    setActiveTab: ((tab: 'summary' | 'create') => void) | null;
  } | null>(null);
  const [showIdentityChoice, setShowIdentityChoice] = useState(false);
  const [sharedMembers, setSharedMembers] = useState<Member[] | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [existingName, setExistingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);

  const [anonUser, setAnonUser] = useState<Member | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null)  // Get group_id from query string
  const [paymentPreferences, setPaymentPreferences] = useState<ExpensePaymentPreferences | null>(null);
  const [paymentDialogMode, setPaymentDialogMode] = useState<"prompt" | "settings" | null>(null);
  const [hasPromptedForPaypal, setHasPromptedForPaypal] = useState(false);
  const { setIdentity, identity } = useToodlMind();
  const initialTheme = useMemo(
    () => (new Date().getHours() < 17 ? "morning" : "night"),
    []
  );
  const { isNight } = useToodlTheme(initialTheme);

  // Memoize the onParams callback to prevent infinite loops
  const handleParamsChange = useCallback((params: ReadonlyURLSearchParams) => {
    const newGroupId = params.get('group_id');
    // Only update if the value has actually changed
    if (newGroupId !== groupId) {
      setGroupId(newGroupId);
    }
  }, [groupId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setSession(user); // Set the session as UserWithGroup type
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (groupId) {
      setGroup(groupId);
    }
  }, [groupId]);

  useEffect(() => {
    if (typeof window !== "undefined" && !session) {



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

  useEffect(() => {
    const timezone =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC";

    let nextIdentity: MindUserIdentity | null = null;
    if (session) {
      nextIdentity = {
        userId: session.uid,
        email: session.email ?? null,
        displayName:
          session.displayName ??
          (session.email ? session.email.split("@")[0] : null),
        timezone,
      };
    } else if (anonUser) {
      nextIdentity = {
        userId: anonUser.id,
        email: anonUser.email ?? null,
        displayName: anonUser.firstName ?? anonUser.email ?? null,
        timezone,
      };
    }

    if (identitiesMatch(identity, nextIdentity)) {
      return;
    }

    setIdentity(nextIdentity);
  }, [session, anonUser, identity, setIdentity]);

  useEffect(() => {
    if (!session) {
      setPaymentPreferences(null);
      setPaymentDialogMode(null);
      return;
    }

    let active = true;
    const loadPreferences = async () => {
      try {
        const prefs = await fetchExpensePaymentPreferences(session.uid);
        if (!active) {
          return;
        }
        setPaymentPreferences(prefs);
        if (
          !prefs.paypalMeLink &&
          !prefs.suppressPaypalPrompt &&
          !hasPromptedForPaypal
        ) {
          setPaymentDialogMode((prev) => prev ?? "prompt");
          setHasPromptedForPaypal(true);
        }
      } catch (error) {
        console.error("Error loading payment preferences", error);
      }
    };

    void loadPreferences();
    return () => {
      active = false;
    };
  }, [session, hasPromptedForPaypal]);

  useEffect(() => {
    setHasPromptedForPaypal(false);
  }, [session?.uid]);


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

  const handlePaymentPreferencesSave = async ({
    paypalMeLink,
    suppressPaypalPrompt,
  }: {
    paypalMeLink: string | null;
    suppressPaypalPrompt: boolean;
  }) => {
    if (!session) {
      throw new Error("Sign in required to save payment settings");
    }
    await updateExpensePaymentPreferences(session.uid, {
      paypalMeLink,
      suppressPaypalPrompt,
    });
    const base =
      paymentPreferences ?? createDefaultExpensePaymentPreferences();
    setPaymentPreferences({
      ...base,
      paypalMeLink,
      suppressPaypalPrompt,
      updatedAt: new Date().toISOString(),
    });
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

  const handleSelectExistingIdentity = () => {
    const memberStr = localStorage.getItem("anon_member");
    if (!memberStr) {
      return;
    }
    try {
      const member: Member = JSON.parse(memberStr);
      setAnonUser(member);
      setShowIdentityChoice(false);
      setIsNewUser(false);
      if (member.firstName) {
        setExistingName(member.firstName);
      }
    } catch (error) {
      console.warn("Failed to parse stored anon member", error);
    }
  };

  const handleSubmitIdentityName = () => {
    if (!tempName.trim()) {
      return;
    }
    const id = getOrCreateUserId();
    const member: Member = {
      id,
      email: "",
      firstName: tempName.trim(),
      authProvider: "anon",
    };
    localStorage.setItem("anon_member", JSON.stringify(member));
    setAnonUser(member);
    setExistingName(member.firstName ?? null);
    const avatarIndex = Math.floor(Math.random() * avatarUrls.length);
    const anonAvatar = avatarUrls[avatarIndex];
    localStorage.setItem("user_avatar", anonAvatar);
    setShowIdentityChoice(false);
    setIsNewUser(false);
    setTempName("");
  };



  // Memoize the tab state change callback to prevent infinite loops
  const handleTabStateChange = useCallback((state: {
    activeTab: 'summary' | 'create';
    showCreateTab: boolean;
    setActiveTab: ((tab: 'summary' | 'create') => void) | null;
  }) => {
    setTabState(state);
  }, []);


  if (loading) {
    return (
      <div
        className={cn(
          "flex h-screen items-center justify-center",
          isNight ? "bg-slate-950 text-slate-100" : undefined
        )}
      >
        <Spinner size="lg" />
      </div>
    );
  }
  return (
    <>
      {/* 3️⃣ Hydrate the client-only hook via Suspense */}
      <Suspense fallback={null}>
        <SearchParamsClient onParams={handleParamsChange} />
      </Suspense>
      { /* Case A: Signed-in or already-identified anon user → show the app */}
      {session || anonUser ? (
        <div
          className={cn(
            "min-h-screen px-4 py-10",
            isNight ? "bg-slate-950 text-slate-100" : "bg-slate-50/80"
          )}
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <AppTopBar
              product="expense"
              heading="Split"
              subheading="Invite your crew, log purchases, and keep every tab honest."
              dark={isNight}
            />
            <div
              className={cn(
                "flex items-center justify-between rounded-3xl border px-4 py-3 shadow-sm",
                isNight
                  ? "border-white/15 bg-slate-900/60 shadow-slate-900/50"
                  : "border-slate-200 bg-white/80"
              )}
            >
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                {tabState && (
                  <>
                    <button
                      type="button"
                      onClick={() => tabState.setActiveTab?.('summary')}
                      className={cn(
                        "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                        tabState.activeTab === 'summary'
                          ? isNight
                            ? "bg-white/20 text-white"
                            : "bg-slate-900 text-white"
                          : isNight
                            ? "text-slate-300 hover:text-white hover:bg-white/10"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      )}
                    >
                      Overview
                    </button>
                    {tabState.showCreateTab && (
                      <button
                        type="button"
                        onClick={() => tabState.setActiveTab?.('create')}
                        className={cn(
                          "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                          tabState.activeTab === 'create'
                            ? isNight
                              ? "bg-white/20 text-white"
                              : "bg-slate-900 text-white"
                            : isNight
                              ? "text-slate-300 hover:text-white hover:bg-white/10"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        )}
                      >
                        Expenses
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-1 justify-end">
                <Button
                  variant="outline"
                  className={themeUtils.button.secondary(isNight)}
                  onClick={() => setPaymentDialogMode("settings")}
                  disabled={!session}
                >
                  Payment settings
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
              <ExpenseSplitter
                session={session}
                groupid={group}
                anonUser={anonUser}
                currency={currency}
                paymentPreferences={paymentPreferences}
                onShowPaymentSettings={() => setPaymentDialogMode("settings")}
                isNight={isNight}
                onTabStateChange={handleTabStateChange}
              />
            </div>
          </div>
        </div>
      )
        /* Case B: No user yet, but we fetched sharedMembers → ask “Who are you?” */
        : sharedMembers ? (
          <div
            className={cn(
              "min-h-screen px-4 py-10",
              isNight ? "bg-slate-950 text-slate-100" : "bg-slate-50/80"
            )}
          >
            <div className="mx-auto w-full max-w-3xl">
              <IdentityPrompt
                members={sharedMembers}
                onSelect={(member) => {
                  localStorage.setItem("anon_member", JSON.stringify(member));
                  setAnonUser(member);
                  setShowIdentityChoice(false);
                  setSharedMembers(null);
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <SplitSignIn
              onGoogle={handleGoogleSignIn}
              onMicrosoft={handleMicrosoftSignIn}
              onFacebook={handleFacebookSignIn}
              onContinueWithoutSignIn={handleContinueWithoutSignIn}
              isNight={isNight}
            />
            <IdentityModal
              open={showIdentityChoice}
              existingName={existingName}
              isNewUser={isNewUser}
              tempName={tempName}
              onSetTempName={setTempName}
              onSetIsNewUser={setIsNewUser}
              onClose={() => {
                setShowIdentityChoice(false);
                setIsNewUser(false);
                setTempName("");
              }}
              onSelectExisting={handleSelectExistingIdentity}
              onSubmitNew={handleSubmitIdentityName}
              isNight={isNight}
            />
          </>
        )}
      <PaymentSettingsDialog
        open={paymentDialogMode !== null}
        mode={paymentDialogMode ?? "settings"}
        initialLink={paymentPreferences?.paypalMeLink ?? null}
        initialSuppressPrompt={
          paymentPreferences?.suppressPaypalPrompt ?? false
        }
        onClose={() => setPaymentDialogMode(null)}
        onSave={handlePaymentPreferencesSave}
        isNight={isNight}
      />
    </>
  );
}

type SplitSignInProps = {
  onGoogle: () => void;
  onMicrosoft: () => void;
  onFacebook: () => void;
  onContinueWithoutSignIn: () => void;
  isNight: boolean;
};

function SplitSignIn({
  onGoogle,
  onMicrosoft,
  onFacebook,
  onContinueWithoutSignIn,
  isNight,
}: SplitSignInProps) {
  return (
    <div className={cn(
      "flex min-h-screen flex-col items-center justify-center p-6",
      isNight ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      <div className={cn(
        "w-full max-w-md space-y-8 rounded-3xl border p-8 shadow-xl",
        isNight
          ? "border-slate-800 bg-slate-900/50"
          : "border-slate-200 bg-white"
      )}>
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sign in to Split</h1>
          <p className={cn("text-sm", isNight ? "text-slate-400" : "text-slate-500")}>
            Track expenses, settle tabs, and keep it fair.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={onGoogle}
            className={cn(
              "w-full justify-start gap-3 h-12 text-base font-medium",
              isNight
                ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-white"
                : "bg-white hover:bg-slate-50 text-slate-700"
            )}
          >
            <Image src="/logos/google.svg" alt="Google" width={20} height={20} className="h-5 w-5" />
            Continue with Google
          </Button>
          <Button
            variant="outline"
            onClick={onMicrosoft}
            className={cn(
              "w-full justify-start gap-3 h-12 text-base font-medium",
              isNight
                ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-white"
                : "bg-white hover:bg-slate-50 text-slate-700"
            )}
          >
            <Image src="/logos/microsoft.svg" alt="Microsoft" width={20} height={20} className="h-5 w-5" />
            Continue with Microsoft
          </Button>
          <Button
            variant="outline"
            onClick={onFacebook}
            className={cn(
              "w-full justify-start gap-3 h-12 text-base font-medium",
              isNight
                ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-white"
                : "bg-white hover:bg-slate-50 text-slate-700"
            )}
          >
            <Image src="/logos/facebook.svg" alt="Facebook" width={20} height={20} className="h-5 w-5" />
            Continue with Facebook
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className={cn("w-full border-t", isNight ? "border-slate-800" : "border-slate-200")} />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className={cn("px-2", isNight ? "bg-slate-900 text-slate-500" : "bg-white text-slate-500")}>
              Or
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          onClick={onContinueWithoutSignIn}
          className={cn(
            "w-full h-12 text-base",
            isNight ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
          )}
        >
          Continue as Guest
        </Button>
      </div>
    </div>
  );
}

type IdentityModalProps = {
  open: boolean;
  existingName: string | null;
  isNewUser: boolean;
  tempName: string;
  onSetTempName: (value: string) => void;
  onSetIsNewUser: (value: boolean) => void;
  onSelectExisting: () => void;
  onSubmitNew: () => void;
  onClose: () => void;
  isNight: boolean;
};

function IdentityModal({
  open,
  existingName,
  isNewUser,
  tempName,
  onSetTempName,
  onSetIsNewUser,
  onSelectExisting,
  onSubmitNew,
  onClose,
  isNight,
}: IdentityModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
      <div className={cn(
        "w-full max-w-sm rounded-3xl border p-6 shadow-2xl",
        isNight ? "border-slate-800 bg-slate-900 text-white" : "border-slate-100 bg-white"
      )}>
        {existingName && !isNewUser ? (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Welcome back!</h2>
              <p className={cn("text-sm", isNight ? "text-slate-400" : "text-slate-600")}>
                We spotted your earlier session. Continue as {existingName} or choose a different name.
              </p>
            </div>
            <div className="space-y-3">
              <Button className={cn("w-full", themeUtils.button.primary(isNight))} onClick={onSelectExisting}>
                I&apos;m {existingName}
              </Button>
              <Button
                className={cn("w-full", themeUtils.button.secondary(isNight))}
                variant="outline"
                onClick={() => {
                  onSetIsNewUser(true);
                }}
              >
                Somebody else
              </Button>
              <Button variant="ghost" className={cn("w-full", themeUtils.button.ghost(isNight))} onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-semibold">Who should we call you?</h2>
              <p className={cn("text-sm", isNight ? "text-slate-400" : "text-slate-600")}>
                We&apos;ll use this name in shared tabs until you sign in.
              </p>
            </div>
            <div className="space-y-3">
              <label className="sr-only" htmlFor="anon-name">
                Your name
              </label>
              <input
                id="anon-name"
                type="text"
                value={tempName}
                onChange={(event) => onSetTempName(event.target.value)}
                placeholder="Enter your name"
                className={themeUtils.input(isNight, "w-full")}
                autoFocus
              />
              <Button className={cn("w-full", themeUtils.button.primary(isNight))} onClick={onSubmitNew}>
                Continue
              </Button>
              <Button variant="ghost" className={cn("w-full", themeUtils.button.ghost(isNight))} onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
