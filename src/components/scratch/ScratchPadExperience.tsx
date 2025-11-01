"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Inbox, RefreshCcw, Sparkles, Trash2 } from "lucide-react";

import { AppTopBar } from "@/components/AppTopBar";
import { AppUserMenu, AppUserMenuSection } from "@/components/AppUserMenu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  auth,
  provider,
  microsoftProvider,
  facebookProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "@/lib/firebase";
import {
  createSharedLink,
  deleteSharedLink,
  observeSharedLinks,
  updateSharedLinkStatus,
} from "@/lib/shareService";
import type { SharedLink, SharedLinkStatus } from "@/types/share";
import { cn } from "@/lib/utils";

type ScratchPadFilter = SharedLinkStatus | "all";

const FILTERS: Array<{ id: ScratchPadFilter; label: string }> = [
  { id: "new", label: "New" },
  { id: "saved", label: "Saved" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

const STATUS_LABEL: Record<SharedLinkStatus, string> = {
  new: "New",
  saved: "Saved",
  archived: "Archived",
};

const STATUS_ACCENT: Record<SharedLinkStatus, string> = {
  new: "bg-amber-100 text-amber-800 border-amber-200",
  saved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  video: "Video",
  article: "Article",
  audio: "Audio",
  link: "Link",
  unknown: "Link",
};

export function ScratchPadExperience() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScratchPadFilter>("new");
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [createBusy, setCreateBusy] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkNotes, setLinkNotes] = useState("");
  const [linkTags, setLinkTags] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      setUser(current);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setLinks([]);
       setLoading(false);
       setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const unsubscribe = observeSharedLinks(
      user.uid,
      filter === "all" ? {} : { status: filter },
      (items) => {
        setLinks(items);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("We couldn't load your scratch pad right now.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user, filter]);

  const handleSignIn = useCallback(
    async (providerType: "google" | "microsoft" | "facebook") => {
      try {
        const selectedProvider =
          providerType === "microsoft"
            ? microsoftProvider
            : providerType === "facebook"
            ? facebookProvider
            : provider;
        await signInWithPopup(auth, selectedProvider);
      } catch (err) {
        console.error("Sign-in failed", err);
        setError("Sign-in failed. Please try again.");
      }
    },
    []
  );

  const handleSignOut = useCallback(async () => {
    await signOut(auth);
  }, []);

  const menuSections = useMemo<AppUserMenuSection[]>(() => {
    if (!user) {
      return [];
    }
    return [
      {
        title: "Scratch Pad",
        items: [
          {
            label: "View archived items",
            onClick: () => setFilter("archived"),
            icon: <RefreshCcw className="h-4 w-4 text-slate-400" />,
            disabled: !links.some((link) => link.status === "archived"),
          },
        ],
      },
    ];
  }, [user, links]);

  const toggleBusy = useCallback((id: string, value: boolean) => {
    setBusyIds((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleStatusChange = useCallback(
    async (link: SharedLink, status: SharedLinkStatus) => {
      if (!user) {
        return;
      }
      setError(null);
      toggleBusy(link.id, true);
      try {
        await updateSharedLinkStatus(user.uid, link.id, status);
      } catch (err) {
        console.error(err);
        setError("Updating the link failed. Please try again.");
      } finally {
        toggleBusy(link.id, false);
      }
    },
    [toggleBusy, user]
  );

  const handleDelete = useCallback(
    async (link: SharedLink) => {
      if (!user) {
        return;
      }
      setError(null);
      toggleBusy(link.id, true);
      try {
        await deleteSharedLink(user.uid, link.id);
      } catch (err) {
        console.error(err);
        setError("Deleting the link failed. Please try again.");
      } finally {
        toggleBusy(link.id, false);
      }
    },
    [toggleBusy, user]
  );

  const inferContentType = useCallback((url: string): SharedLink["contentType"] => {
    const normalized = url.toLowerCase();
    if (normalized.includes("youtube.com") || normalized.includes("youtu.be") || normalized.includes("vimeo.com")) {
      return "video";
    }
    if (normalized.includes("spotify.com") || normalized.includes("music.apple.com") || normalized.includes("podcasts.apple.com")) {
      return "audio";
    }
    if (
      normalized.includes("medium.com") ||
      normalized.includes("substack.com") ||
      normalized.includes("news") ||
      normalized.includes("blog")
    ) {
      return "article";
    }
    return "link";
  }, []);

  const handleCreateLink = useCallback(async () => {
    if (!user) {
      return;
    }
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) {
      setError("Enter a link before saving.");
      return;
    }
    setError(null);
    setCreateSuccess(null);
    setCreateBusy(true);
    try {
      const tags = linkTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      await createSharedLink(user.uid, {
        url: trimmedUrl,
        title: linkTitle.trim() || null,
        description: linkNotes.trim() || null,
        tags,
        contentType: inferContentType(trimmedUrl),
        platform: "web",
        status: "new",
      });
      setLinkUrl("");
      setLinkTitle("");
      setLinkNotes("");
      setLinkTags("");
      setCreateSuccess("Link saved to your scratch pad.");
      setFilter("new");
    } catch (err) {
      console.error(err);
      setError("We couldn't save that link. Please try again.");
    } finally {
      setCreateBusy(false);
    }
  }, [user, linkUrl, linkTitle, linkNotes, linkTags, inferContentType, setFilter]);

  return (
    <div className="min-h-screen bg-slate-50/80 p-4 pb-12 sm:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <AppTopBar
          product="scratch"
          heading="Scratch Pad"
          subheading="Drop links you discover anywhere and come back to them when it suits you."
          userSlot={
            user ? (
              <AppUserMenu
                product="scratch"
                displayName={user.displayName ?? user.email ?? "You"}
                avatarSrc={user.photoURL}
                sections={menuSections}
                onSignOut={handleSignOut}
              />
            ) : undefined
          }
        />
        {!user ? (
          <Card className="flex flex-col items-center gap-4 border-slate-200 bg-white/90 p-10 text-center shadow-xl shadow-slate-300/40 backdrop-blur">
            <Sparkles className="h-10 w-10 text-indigo-400" />
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">
                Save links on the go
              </h2>
              <p className="text-sm text-slate-500">
                Install the Android companion app, share anything to Toodl, and it will show up
                right here ready for you to read later.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => handleSignIn("google")} className="gap-2">
                Continue with Google
              </Button>
              <Button variant="outline" onClick={() => handleSignIn("microsoft")}>
                Microsoft
              </Button>
              <Button variant="outline" onClick={() => handleSignIn("facebook")}>
                Facebook
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card className="border-slate-200 bg-white/95 p-5 shadow-lg shadow-slate-200/40 backdrop-blur">
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Drop a link</h2>
                  <p className="text-sm text-slate-500">
                    Paste a URL and add optional notes or tags. Anything you save lands in the queue below.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="scratch-url">
                      Link URL<span className="text-rose-500">*</span>
                    </label>
                    <Input
                      id="scratch-url"
                      value={linkUrl}
                      onChange={(event) => setLinkUrl(event.target.value)}
                      placeholder="https://"
                      disabled={createBusy}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="scratch-title">
                      Title (optional)
                    </label>
                    <Input
                      id="scratch-title"
                      value={linkTitle}
                      onChange={(event) => setLinkTitle(event.target.value)}
                      placeholder="A quick headline"
                      disabled={createBusy}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="scratch-tags">
                      Tags (comma separated)
                    </label>
                    <Input
                      id="scratch-tags"
                      value={linkTags}
                      onChange={(event) => setLinkTags(event.target.value)}
                      placeholder="read later, video, trip"
                      disabled={createBusy}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="scratch-notes">
                      Notes (optional)
                    </label>
                    <Textarea
                      id="scratch-notes"
                      value={linkNotes}
                      onChange={(event) => setLinkNotes(event.target.value)}
                      placeholder="Why this link matters…"
                      disabled={createBusy}
                      className="min-h-[96px]"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={handleCreateLink}
                    disabled={!linkUrl.trim() || createBusy}
                    className="bg-indigo-500 text-white hover:bg-indigo-400"
                  >
                    {createBusy ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Saving…
                      </>
                    ) : (
                      "Save link"
                    )}
                  </Button>
                  {createSuccess ? (
                    <span className="text-sm text-emerald-600">{createSuccess}</span>
                  ) : null}
                </div>
              </div>

              <Separator className="my-5" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Your links</h2>
                  <p className="text-sm text-slate-500">
                    Filter by status to move items from your intake queue to your saved list.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {FILTERS.map((option) => (
                    <Button
                      key={option.id}
                      variant={option.id === filter ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilter(option.id)}
                      className={cn(
                        option.id === filter
                          ? "bg-indigo-500 text-white hover:bg-indigo-400"
                          : "border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Separator className="my-5" />
              {loading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-6 text-sm text-slate-600">
                  <Spinner size="sm" />
                  <span>Loading your scratch pad…</span>
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-4 text-sm text-rose-600">
                  {error}
                </div>
              ) : links.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-slate-100/50 p-10 text-center text-slate-500">
                  <Inbox className="h-8 w-8 text-slate-400" />
                  <div>
                    {filter === "all" ? (
                      <p className="text-base font-medium">
                        Nothing here yet — share your first link!
                      </p>
                    ) : (
                      <p className="text-base font-medium">
                        No {STATUS_LABEL[filter as SharedLinkStatus].toLowerCase()} links right now.
                      </p>
                    )}
                    <p className="mt-2 text-sm">
                      Open an article or video on your phone, tap share, and pick Toodl Share.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {links.map((link) => {
                    const busy = busyIds[link.id];
                    return (
                      <article
                        key={link.id}
                        className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200 transition hover:border-indigo-200 hover:shadow-md md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900">
                              {link.title || link.url}
                            </h3>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border text-xs uppercase tracking-wide",
                                STATUS_ACCENT[link.status]
                              )}
                            >
                              {STATUS_LABEL[link.status]}
                            </Badge>
                            <Badge variant="secondary" className="text-xs uppercase">
                              {CONTENT_TYPE_LABEL[link.contentType] ?? "Link"}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500">{link.url}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            {link.tags?.map((tag) => (
                              <Badge key={tag} variant="outline" className="border-slate-200 text-xs">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-slate-400">
                            Shared {new Date(link.createdAt).toLocaleString()}
                            {link.sourceApp ? ` · via ${link.sourceApp}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={link.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 h-4 w-4" /> Open
                            </Link>
                          </Button>
                          {link.status !== "saved" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(link, "saved")}
                              disabled={busy}
                            >
                              Mark saved
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(link, "new")}
                              disabled={busy}
                            >
                              Move to queue
                            </Button>
                          )}
                          {link.status !== "archived" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(link, "archived")}
                              disabled={busy}
                            >
                              Archive
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(link, "saved")}
                              disabled={busy}
                            >
                              Restore
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(link)}
                            disabled={busy}
                          >
                            <Trash2 className="mr-1 h-4 w-4" /> Delete
                          </Button>
                          {busy ? <Spinner size="sm" /> : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
