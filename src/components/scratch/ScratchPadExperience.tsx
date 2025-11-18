"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ExternalLink,
  Inbox,
  ListChecks,
  RefreshCcw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { AppTopBar } from "@/components/AppTopBar";
import { AppUserMenu, AppUserMenuSection } from "@/components/AppUserMenu";
import { OrbitFlowNav } from "@/components/OrbitFlowNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  updateSharedLink,
  updateSharedLinkStatus,
} from "@/lib/shareService";
import {
  getOrbitContentTypeForFile,
  uploadOrbitAttachment,
  ORBIT_UPLOAD_MAX_BYTES,
} from "@/lib/orbitStorage";
import type { SharedLink, SharedLinkStatus } from "@/types/share";
import { cn } from "@/lib/utils";
import { useToodlTheme } from "@/hooks/useToodlTheme";

type ScratchPadFilter = SharedLinkStatus | "all";

const FILTERS: Array<{ id: ScratchPadFilter; label: string }> = [
  { id: "new", label: "Unread" },
  { id: "saved", label: "Saved" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

const STATUS_LABEL: Record<SharedLinkStatus, string> = {
  new: "Unread",
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
  note: "Note",
  image: "Image",
  pdf: "PDF",
  link: "Link",
  unknown: "Link",
};

const normaliseTags = (raw: string): string[] =>
  raw
    .split(/[,#]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

const parseTagQuery = (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  return normalized
    .split(/[,\s]+/)
    .map((item) => item.replace(/^#/, "").trim())
    .filter(Boolean);
};

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes)) {
    return "0 B";
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

const summariseLinkContent = (link: SharedLink): string => {
  const sourcePieces: string[] = [];
  if (link.description) {
    sourcePieces.push(link.description);
  }
  if (link.title) {
    sourcePieces.push(link.title);
  }
  if (link.tags?.length) {
    sourcePieces.push(`Tags: ${link.tags.join(", ")}`);
  }
  if (!sourcePieces.length && link.url) {
    sourcePieces.push(`Link: ${link.url}`);
  }
  const source = sourcePieces.join(". ");
  if (!source) {
    return "No additional context available yet.";
  }
  const sentences = source
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  if (sentences.length <= 2) {
    return source.length > 280 ? `${source.slice(0, 277)}…` : source;
  }

  const first = sentences[0];
  const second = sentences[1];
  const rest = sentences.slice(2).join(" ");
  const restSnippet = rest.length > 140 ? `${rest.slice(0, 137)}…` : rest;
  return `${first} ${second}${restSnippet ? ` ${restSnippet}` : ""}`;
};

const computeSmartScore = (
  link: SharedLink,
  now = Date.now(),
  queryTags: string[]
): number => {
  const createdAt = new Date(link.createdAt).getTime();
  const ageMs = Math.max(1, now - (Number.isFinite(createdAt) ? createdAt : now));
  const daysSince = ageMs / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 30 - daysSince); // fresher links score higher
  const statusWeight =
    link.status === "new" ? 40 : link.status === "saved" ? 20 : 0;

  const tagMatches = queryTags.length
    ? (link.tags ?? []).reduce(
        (matches, tag) =>
          queryTags.includes(tag.toLowerCase()) ? matches + 1 : matches,
        0
      )
    : 0;

  const typeWeight = link.contentType === "note" ? 10 : 0;

  return recencyScore + statusWeight + tagMatches * 15 + typeWeight;
};

export function ScratchPadExperience() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [allLinks, setAllLinks] = useState<SharedLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScratchPadFilter>("new");
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [createBusy, setCreateBusy] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkNotes, setLinkNotes] = useState("");
  const [linkTags, setLinkTags] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteTags, setNoteTags] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [tagQuery, setTagQuery] = useState("");
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizingIds, setSummarizingIds] = useState<Record<string, boolean>>({});
  const [digestExpanded, setDigestExpanded] = useState<boolean>(false);
  const [tagPaneOpen, setTagPaneOpen] = useState(false);
  const [createSuccessSource, setCreateSuccessSource] = useState<"link" | "note" | "file" | null>(
    null
  );
  const [linksOnly, setLinksOnly] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteEditorBody, setNoteEditorBody] = useState("");
  const [noteEditorTags, setNoteEditorTags] = useState("");
  const [noteEditorBusy, setNoteEditorBusy] = useState(false);
  const [noteEditorMessage, setNoteEditorMessage] = useState<string | null>(null);
  const [noteEditorError, setNoteEditorError] = useState<string | null>(null);
  const router = useRouter();
  const initialTheme = useMemo(
    () => (new Date().getHours() < 17 ? "morning" : "night"),
    []
  );
  const { theme, setTheme, isNight } = useToodlTheme(initialTheme);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      setUser(current);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setAllLinks([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const unsubscribe = observeSharedLinks(
      user.uid,
      {},
      (items) => {
        setAllLinks(items);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("We couldn't load your Orbit workspace right now.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const maxUploadMb = useMemo(
    () => Math.round((ORBIT_UPLOAD_MAX_BYTES / (1024 * 1024)) * 10) / 10,
    []
  );

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
    router.replace("/");
  }, [router]);

  const resetUploadForm = useCallback(() => {
    setUploadFile(null);
    setUploadTitle("");
    setUploadNotes("");
    setUploadTags("");
    setFileInputKey((value) => value + 1);
  }, []);

  const handleFileSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        setUploadFile(null);
        setUploadTitle("");
        setUploadNotes("");
        setUploadTags("");
        return;
      }

      if (file.size > ORBIT_UPLOAD_MAX_BYTES) {
        setError(`Orbit uploads are limited to ${maxUploadMb} MB.`);
        event.target.value = "";
        setUploadFile(null);
        setUploadTitle("");
        setUploadNotes("");
        setUploadTags("");
        return;
      }

      const detectedType = getOrbitContentTypeForFile(file);
      if (detectedType !== "image" && detectedType !== "pdf") {
        setError("Upload an image or a PDF to Orbit.");
        event.target.value = "";
        setUploadFile(null);
        setUploadTitle("");
        setUploadNotes("");
        setUploadTags("");
        return;
      }

      setError(null);
      setCreateSuccess(null);
      setCreateSuccessSource(null);
      setUploadFile(file);
      setUploadNotes("");
      setUploadTags("");
      const baseName = file.name?.replace(/\.[^.]+$/, "") || "Untitled file";
      setUploadTitle(baseName);
    },
    [maxUploadMb]
  );

  const menuSections = useMemo<AppUserMenuSection[]>(() => {
    if (!user) {
      return [];
    }
    return [
      {
        title: "Orbit",
        items: [
          {
            label: "View archived items",
            onClick: () => setFilter("archived"),
            icon: <RefreshCcw className="h-4 w-4 text-slate-400" />,
            disabled: !allLinks.some((link) => link.status === "archived"),
          },
        ],
      },
    ];
  }, [user, allLinks]);

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
        await deleteSharedLink(user.uid, link.id, link.storagePath);
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
    setCreateSuccessSource(null);
    setCreateBusy(true);
    try {
      const tags = normaliseTags(linkTags);
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
      setCreateSuccess("Link saved to Orbit.");
      setCreateSuccessSource("link");
      setFilter("new");
    } catch (err) {
      console.error(err);
      setError("We couldn't save that link. Please try again.");
    } finally {
      setCreateBusy(false);
    }
  }, [user, linkUrl, linkTitle, linkNotes, linkTags, inferContentType, setFilter]);

  const handleCreateNote = useCallback(async () => {
    if (!user) {
      return;
    }
    const trimmed = noteBody.trim();
    if (!trimmed) {
      setError("Add a note before saving.");
      return;
    }
    setError(null);
    setCreateSuccess(null);
    setCreateSuccessSource(null);
    setCreateBusy(true);
    try {
      const tags = normaliseTags(noteTags);
      const firstLine = trimmed.split("\n")[0]?.slice(0, 80) ?? "Note";
      await createSharedLink(user.uid, {
        url: null,
        title: firstLine,
        description: trimmed,
        tags,
        contentType: "note",
        platform: "web",
        status: "new",
      });
      setNoteBody("");
      setNoteTags("");
      setCreateSuccess("Note saved to Orbit.");
      setCreateSuccessSource("note");
      setFilter("new");
    } catch (err) {
      console.error(err);
      setError("We couldn't save that note. Please try again.");
    } finally {
      setCreateBusy(false);
    }
  }, [noteBody, noteTags, setFilter, user]);

  const handleUploadFile = useCallback(async () => {
    if (!user || !uploadFile) {
      return;
    }

    setError(null);
    setCreateSuccess(null);
    setCreateSuccessSource(null);
    setCreateBusy(true);

    try {
      const uploadResult = await uploadOrbitAttachment(user.uid, uploadFile);
      const tags = normaliseTags(uploadTags);
      const contentTypeCandidate = getOrbitContentTypeForFile(uploadFile);
      const contentType: SharedLink["contentType"] =
        contentTypeCandidate === "image" || contentTypeCandidate === "pdf"
          ? contentTypeCandidate
          : "link";

      await createSharedLink(user.uid, {
        url: uploadResult.downloadUrl,
        title: uploadTitle.trim() || uploadFile.name || "Untitled file",
        description: uploadNotes.trim() || null,
        tags,
        contentType,
        platform: "web",
        status: "new",
        previewImageUrl: contentType === "image" ? uploadResult.downloadUrl : null,
        storagePath: uploadResult.storagePath,
        sourceApp: "orbit-upload",
      });

      resetUploadForm();
      setCreateSuccess(contentType === "pdf" ? "PDF saved to Orbit." : "Image saved to Orbit.");
      setCreateSuccessSource("file");
      setFilter("new");
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "We couldn't upload that file. Please try again.";
      setError(message);
    } finally {
      setCreateBusy(false);
    }
  }, [
    resetUploadForm,
    setFilter,
    uploadFile,
    uploadNotes,
    uploadTags,
    uploadTitle,
    user,
  ]);

  const handleGenerateSummary = useCallback(
    async (link: SharedLink) => {
      const sourceId = link.id;
      if (summaries[sourceId]) {
        return;
      }
      setSummarizingIds((prev) => ({ ...prev, [sourceId]: true }));
      await new Promise((resolve) => setTimeout(resolve, 200));
      const summary = summariseLinkContent(link);
      setSummaries((prev) => ({ ...prev, [sourceId]: summary }));
      setSummarizingIds((prev) => {
        const next = { ...prev };
        delete next[sourceId];
        return next;
      });
    },
    [summaries]
  );

  const handleLinkCardClick = useCallback(
    (event: MouseEvent<HTMLElement>, link: SharedLink) => {
      if (link.contentType !== "note") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea")) {
        return;
      }
      setSelectedNoteId(link.id);
    },
    []
  );

  const handleCloseNotePreview = useCallback(() => {
    setSelectedNoteId(null);
  }, []);

  const handleAddTagToQuery = useCallback((rawTag: string) => {
    const normalized = rawTag.trim().toLowerCase();
    if (!normalized) {
      return;
    }
    setTagQuery((prev) => {
      const existing = parseTagQuery(prev);
      if (existing.includes(normalized)) {
        return prev;
      }
      const nextTags = [...existing, normalized];
      return nextTags.map((tag) => `#${tag}`).join(" ");
    });
  }, []);

  const handleRemoveTagFromQuery = useCallback((rawTag: string) => {
    const normalized = rawTag.trim().toLowerCase();
    setTagQuery((prev) => {
      const remaining = parseTagQuery(prev).filter((tag) => tag !== normalized);
      if (!remaining.length) {
        return "";
      }
      return remaining.map((tag) => `#${tag}`).join(" ");
    });
  }, []);

  const handleClearTagFilters = useCallback(() => {
    setTagQuery("");
  }, []);

  const statusFilteredLinks = useMemo(() => {
    if (filter === "all") {
      return allLinks;
    }
    return allLinks.filter((link) => link.status === filter);
  }, [allLinks, filter]);

  const tagStats = useMemo(() => {
    const tagMap = new Map<
      string,
      { tag: string; count: number; lastUsed: number }
    >();
    const now = Date.now();
    allLinks.forEach((link, index) => {
      const createdAt = new Date(link.createdAt).getTime();
      const recencyHint =
        Number.isFinite(createdAt) && createdAt > 0
          ? createdAt
          : now - index;
      (link.tags ?? []).forEach((rawTag) => {
        const normalized = rawTag.trim().toLowerCase();
        if (!normalized) {
          return;
        }
        const existing = tagMap.get(normalized);
        if (existing) {
          existing.count += 1;
          existing.lastUsed = Math.max(existing.lastUsed, recencyHint);
          existing.tag = rawTag;
        } else {
          tagMap.set(normalized, {
            tag: rawTag,
            count: 1,
            lastUsed: recencyHint,
          });
        }
      });
    });
    return Array.from(tagMap.values()).sort(
      (left, right) => right.lastUsed - left.lastUsed
    );
  }, [allLinks]);

  const recentSearchTags = useMemo(
    () => tagStats.slice(0, 6),
    [tagStats]
  );

  const queryTags = useMemo(() => parseTagQuery(tagQuery), [tagQuery]);
  const hasTagFilters = queryTags.length > 0;

  const emptyStateLabel = useMemo(() => {
    if (filter === "all") {
      return "matching";
    }
    return STATUS_LABEL[filter as SharedLinkStatus].toLowerCase();
  }, [filter]);

  const visibleLinks = useMemo(() => {
    const now = Date.now();
    const filteredByTags = queryTags.length
      ? statusFilteredLinks.filter((link) =>
          (link.tags ?? []).some((tag) =>
            queryTags.includes(tag.toLowerCase())
          )
        )
      : statusFilteredLinks;

    return filteredByTags
      .slice()
      .sort(
        (left, right) =>
          computeSmartScore(right, now, queryTags) -
          computeSmartScore(left, now, queryTags)
      );
  }, [statusFilteredLinks, queryTags]);

  const weeklyDigest = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentSaved = allLinks.filter((link) => {
      if (link.status !== "saved") {
        return false;
      }
      const createdAt = new Date(link.createdAt).getTime();
      return Number.isFinite(createdAt) && createdAt >= weekAgo;
    });

    if (!recentSaved.length) {
      return null;
    }

    const tagCounts = new Map<string, number>();
    for (const link of recentSaved) {
      for (const tag of link.tags ?? []) {
        const lower = tag.toLowerCase();
        tagCounts.set(lower, (tagCounts.get(lower) ?? 0) + 1);
      }
    }
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    const highlights = recentSaved.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title || item.url || "Untitled",
      url: item.url,
      createdAt: item.createdAt,
    }));

    return {
      total: recentSaved.length,
      topTags,
      highlights,
    };
  }, [allLinks]);

  const selectedNote = useMemo(
    () =>
      allLinks.find(
        (link) => link.id === selectedNoteId && link.contentType === "note"
      ) ?? null,
    [allLinks, selectedNoteId]
  );

  useEffect(() => {
    if (selectedNoteId && !allLinks.some((link) => link.id === selectedNoteId)) {
      setSelectedNoteId(null);
    }
  }, [allLinks, selectedNoteId]);

  useEffect(() => {
    if (selectedNoteId && !visibleLinks.some((link) => link.id === selectedNoteId)) {
      setSelectedNoteId(null);
    }
  }, [selectedNoteId, visibleLinks]);

  useEffect(() => {
    if (!selectedNote) {
      setNoteEditorBody("");
      setNoteEditorTags("");
      setNoteEditorBusy(false);
      setNoteEditorMessage(null);
      setNoteEditorError(null);
      return;
    }
    setNoteEditorBody(selectedNote.description ?? "");
    setNoteEditorTags(selectedNote.tags?.join(", ") ?? "");
    setNoteEditorBusy(false);
    setNoteEditorMessage(null);
    setNoteEditorError(null);
  }, [selectedNote]);

  const handleResetNoteEditor = useCallback(() => {
    if (!selectedNote) {
      return;
    }
    setNoteEditorBody(selectedNote.description ?? "");
    setNoteEditorTags(selectedNote.tags?.join(", ") ?? "");
    setNoteEditorMessage(null);
    setNoteEditorError(null);
  }, [selectedNote]);

  const handleUpdateNote = useCallback(async () => {
    if (!user || !selectedNote) {
      return;
    }
    const trimmed = noteEditorBody.trim();
    if (!trimmed) {
      setNoteEditorError("Add note content before saving.");
      return;
    }
    setNoteEditorBusy(true);
    setNoteEditorError(null);
    setNoteEditorMessage(null);
    try {
      const tags = normaliseTags(noteEditorTags);
      const firstLine = trimmed.split("\n")[0]?.slice(0, 80) ?? "Orbit note";
      await updateSharedLink(user.uid, selectedNote.id, {
        description: trimmed,
        tags,
        title: firstLine,
      });
      setNoteEditorMessage("Note updated.");
    } catch (err) {
      console.error(err);
      setNoteEditorError("We couldn't update this note. Please try again.");
    } finally {
      setNoteEditorBusy(false);
    }
  }, [noteEditorBody, noteEditorTags, selectedNote, user]);

  return (
    <div
      className={cn(
        "min-h-screen p-4 pb-12 sm:p-6",
        isNight ? "bg-slate-950 text-slate-100" : "bg-slate-50/80"
      )}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <AppTopBar
          product="orbit"
          heading="Orbit"
          subheading="Collect sparks, links, and notes. Organize them when you’re ready."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <OrbitFlowNav />
              <ThemeToggle theme={theme} onSelect={setTheme} />
            </div>
          }
          userSlot={
            user ? (
              <AppUserMenu
                product="orbit"
                displayName={user.displayName ?? user.email ?? "You"}
                avatarSrc={user.photoURL}
                sections={menuSections}
                onSignOut={handleSignOut}
                dark={isNight}
              />
            ) : undefined
          }
        />
        {!user ? (
          <Card className="flex flex-col items-center gap-4 border-slate-200 bg-white/90 p-10 text-center shadow-xl shadow-slate-300/40 backdrop-blur">
            <Sparkles className="h-10 w-10 text-indigo-400" />
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">
                Save sparks on the go
              </h2>
              <p className="text-sm text-slate-500">
                Install the Android companion app, share anything to Toodl, and it will land in Orbit
                ready for a calmer moment.
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
            <div className="flex flex-col gap-2 rounded-3xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Links focus</p>
                  <p className="text-xs text-slate-500">
                    Collapse Orbit’s capture tools to keep only “Your links” in view.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-600">
                    {linksOnly ? "Links only" : "Capture + links"}
                  </span>
                  <Switch
                    checked={linksOnly}
                    onCheckedChange={setLinksOnly}
                    aria-label="Toggle links-only view"
                  />
                </div>
              </div>
            </div>

            <div
              className={cn(
                "grid gap-6",
                !linksOnly && "lg:grid-cols-[360px_minmax(0,1fr)]"
              )}
            >
            {!linksOnly ? (
              <div className="space-y-6">
                <Card className="border-slate-200 bg-white/95 p-5 shadow-lg shadow-slate-200/40 backdrop-blur">
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Drop a link</h2>
                      <p className="text-sm text-slate-500">
                        Paste a URL and add optional notes or tags. Anything you save lands in the
                        queue below.
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
                      {createSuccessSource === "link" && createSuccess ? (
                        <span className="text-sm text-emerald-600">{createSuccess}</span>
                      ) : null}
                    </div>
                  </div>

                  <Separator className="my-5" />

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Upload an image or PDF</h3>
                      <p className="text-sm text-slate-500">
                        Drop a screenshot, receipt, or research packet. Orbit uploads it to encrypted
                        Firebase Storage and keeps the download link handy.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor="orbit-file">
                          File<span className="text-rose-500">*</span>
                        </label>
                        <Input
                          key={fileInputKey}
                          id="orbit-file"
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleFileSelection}
                          disabled={createBusy}
                        />
                        <p className="text-xs text-slate-400">
                          Images or PDFs up to {maxUploadMb} MB.
                        </p>
                        {uploadFile ? (
                          <p className="text-xs text-slate-500">
                            Selected: <span className="font-medium">{uploadFile.name}</span> (
                            {formatFileSize(uploadFile.size)})
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor="orbit-file-title">
                          Title
                        </label>
                        <Input
                          id="orbit-file-title"
                          value={uploadTitle}
                          onChange={(event) => setUploadTitle(event.target.value)}
                          placeholder="Launch visuals"
                          disabled={createBusy}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor="orbit-file-tags">
                          Tags (optional)
                        </label>
                        <Input
                          id="orbit-file-tags"
                          value={uploadTags}
                          onChange={(event) => setUploadTags(event.target.value)}
                          placeholder="receipts, launch, design"
                          disabled={createBusy}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor="orbit-file-notes">
                          Notes
                        </label>
                        <Textarea
                          id="orbit-file-notes"
                          value={uploadNotes}
                          onChange={(event) => setUploadNotes(event.target.value)}
                          placeholder="Any context you want to remember when this file resurfaces."
                          disabled={createBusy}
                          className="min-h-[96px]"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        onClick={handleUploadFile}
                        disabled={!uploadFile || createBusy}
                        className="bg-slate-900 text-white hover:bg-slate-800"
                      >
                        {createBusy ? (
                          <>
                            <Spinner size="sm" className="mr-2" />
                            Uploading…
                          </>
                        ) : (
                          "Save file"
                        )}
                      </Button>
                      {createSuccessSource === "file" && createSuccess ? (
                        <span className="text-sm text-emerald-600">{createSuccess}</span>
                      ) : null}
                    </div>
                  </div>

                  <Separator className="my-5" />

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Paste a quick note</h3>
                      <p className="text-sm text-slate-500">
                        Drop meeting notes, reminders, or ideas without a link. They stay alongside your
                        read-later queue.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Textarea
                        value={noteBody}
                        onChange={(event) => setNoteBody(event.target.value)}
                        placeholder="What do you want to remember?"
                        className="min-h-[120px]"
                        disabled={createBusy}
                      />
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700" htmlFor="scratch-note-tags">
                          Tags (optional)
                        </label>
                        <Input
                          id="scratch-note-tags"
                          value={noteTags}
                          onChange={(event) => setNoteTags(event.target.value)}
                          placeholder="brainstorm, follow-up"
                          disabled={createBusy}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          onClick={handleCreateNote}
                          disabled={!noteBody.trim() || createBusy}
                          variant="outline"
                        >
                          {createBusy ? (
                            <>
                              <Spinner size="sm" className="mr-2" />
                              Saving…
                            </>
                          ) : (
                            "Save note"
                          )}
                        </Button>
                        {createSuccessSource === "note" && createSuccess ? (
                          <span className="text-sm text-emerald-600">{createSuccess}</span>
                        ) : null}
                        <span className="text-xs text-slate-400">
                          Tip: paste text from your clipboard — we keep the formatting.
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ) : null}
              <div className="space-y-6">
            <Card className="border border-slate-200 bg-white/95 shadow-xl shadow-slate-200/50">
              <CardHeader className="border-b border-slate-100 px-5 py-4">
                <div className="space-y-4">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900">Your links</CardTitle>
                    <p className="text-sm text-slate-500">
                      Filter by status to move items from your intake queue to your saved list.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={tagQuery}
                          onChange={(event) => setTagQuery(event.target.value)}
                          placeholder="Filter by #tag"
                          className="pl-9 pr-10"
                        />
                        {tagQuery ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                            onClick={handleClearTagFilters}
                            aria-label="Clear tag search"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                      {hasTagFilters ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-600">Active tags:</span>
                          {queryTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600 hover:border-rose-200 hover:text-rose-600"
                              onClick={() => handleRemoveTagFromQuery(tag)}
                            >
                              #{tag}
                              <X className="h-3 w-3" />
                            </button>
                          ))}
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="text-xs"
                            onClick={handleClearTagFilters}
                          >
                            Clear tags
                          </Button>
                        </div>
                      ) : recentSearchTags.length ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <Tag className="h-3.5 w-3.5 text-slate-400" />
                          <span>Recent:</span>
                          {recentSearchTags.map((tag) => (
                            <button
                              key={tag.tag}
                              type="button"
                              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                              onClick={() => handleAddTagToQuery(tag.tag)}
                            >
                              #{tag.tag}
                              <span className="ml-1 text-[10px] text-slate-400">({tag.count})</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
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
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                {tagStats.length ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/70">
                    <button
                      type="button"
                      onClick={() => setTagPaneOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Tag className="h-4 w-4 text-slate-500" />
                        Tags quick filter
                        <span className="text-xs font-normal text-slate-500">
                          {tagStats.length} tracked
                        </span>
                      </div>
                      <span className="text-xs font-medium text-indigo-600">
                        {tagPaneOpen ? "Hide" : "Show"}
                      </span>
                    </button>
                    {tagPaneOpen ? (
                      <div className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-4">
                        {tagStats.slice(0, 60).map((tag) => (
                          <button
                            key={tag.tag}
                            type="button"
                            className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                            onClick={() => handleAddTagToQuery(tag.tag)}
                          >
                            #{tag.tag}{" "}
                            <span className="text-[10px] text-slate-400">({tag.count})</span>
                          </button>
                        ))}
                        {hasTagFilters ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={handleClearTagFilters}
                          >
                            Clear tag filters
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {weeklyDigest ? (
                  <div className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-indigo-700">
                      <CalendarDays className="h-5 w-5" />
                      <div className="text-sm font-semibold uppercase tracking-wide">
                        Weekly digest
                      </div>
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      className="px-0 text-indigo-600"
                      onClick={() => setDigestExpanded((prev) => !prev)}
                    >
                      {digestExpanded ? "Hide details" : "View highlights"}
                    </Button>
                  </div>
                  <div className="mt-2 text-sm text-indigo-700">
                    {weeklyDigest.total} saved link{weeklyDigest.total === 1 ? "" : "s"} in the last 7 days.
                  </div>
                  {weeklyDigest.topTags.length ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {weeklyDigest.topTags.map((tag) => (
                        <Badge key={tag.tag} variant="outline" className="border-indigo-200 bg-white/80 text-[11px] uppercase tracking-wide text-indigo-600">
                          <Tag className="mr-1 h-3 w-3" />#{tag.tag} · {tag.count}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {digestExpanded && weeklyDigest.highlights.length ? (
                    <ul className="mt-3 space-y-2 text-sm text-indigo-700">
                      {weeklyDigest.highlights.map((item) => (
                        <li key={item.id} className="flex items-start gap-2">
                          <ListChecks className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <div>
                            <div className="font-medium">
                              {item.url ? (
                                <Link href={item.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                                  {item.title}
                                </Link>
                              ) : (
                                item.title
                              )}
                            </div>
                            <div className="text-xs text-indigo-500">
                              Saved {new Date(item.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              <Separator className="my-5" />
              {loading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-6 text-sm text-slate-600">
                  <Spinner size="sm" />
                  <span>Aligning your Orbit…</span>
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-4 text-sm text-rose-600">
                  {error}
                </div>
              ) : visibleLinks.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-slate-100/50 p-10 text-center text-slate-500">
                  <Inbox className="h-8 w-8 text-slate-400" />
                  <div>
                    {filter === "all" ? (
                      <p className="text-base font-medium">
                        Nothing here yet — share your first link!
                      </p>
                    ) : (
                      <p className="text-base font-medium">
                        No {emptyStateLabel} links right now.
                      </p>
                    )}
                    <p className="mt-2 text-sm">
                      Open an article or video on your phone, tap share, and pick Toodl Share.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleLinks.map((link) => {
                    const busy = busyIds[link.id];
                    const summary = summaries[link.id];
                    const summarizing = summarizingIds[link.id];
                    const hasUrl = Boolean(link.url);
                    const isReadLater = link.status === "new";
                    return (
                      <article
                        key={link.id}
                        onClick={(event) => handleLinkCardClick(event, link)}
                        className={cn(
                          "flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200 transition md:flex-row md:items-center md:justify-between",
                          link.contentType === "note"
                            ? "cursor-pointer hover:border-indigo-200 hover:shadow-md"
                            : "hover:border-indigo-100",
                          selectedNoteId === link.id && link.contentType === "note"
                            ? "border-indigo-300 bg-indigo-50/60 shadow-md"
                            : ""
                        )}
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
                          {hasUrl ? (
                            <p className="text-sm text-slate-500 break-all">{link.url}</p>
                          ) : null}
                          {link.description ? (
                            <p className="text-sm text-slate-600 whitespace-pre-line">
                              {link.description.length > 220
                                ? `${link.description.slice(0, 217)}…`
                                : link.description}
                            </p>
                          ) : null}
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
                          {isReadLater ? (
                            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-600">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-3.5 w-3.5" /> AI summary
                                {!summary ? (
                                  <Button
                                    size="sm"
                                    variant="link"
                                    className="px-0 text-indigo-500"
                                    onClick={() => handleGenerateSummary(link)}
                                    disabled={summarizing}
                                  >
                                    {summarizing ? "Thinking…" : "Generate"}
                                  </Button>
                                ) : null}
                              </div>
                              <div className="mt-1 text-[11px] leading-relaxed text-indigo-700">
                                {summary ? summary : "Preview the key points before diving in."}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {link.contentType === "note" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedNoteId(link.id);
                              }}
                            >
                              Open note
                            </Button>
                          ) : null}
                          {hasUrl ? (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={link.url ?? "#"} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-1 h-4 w-4" /> Open
                              </Link>
                            </Button>
                          ) : null}
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
            </CardContent>
            </Card>
              </div>
            </div>
          </>
        )}
      </div>
      <Dialog
        open={Boolean(selectedNote)}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseNotePreview();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-indigo-100 bg-white/95 shadow-2xl">
          {selectedNote ? (
            <>
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-xl font-semibold text-slate-900">
                  {selectedNote.title || "Orbit note"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Saved {new Date(selectedNote.createdAt).toLocaleString()}
                  {selectedNote.sourceApp ? ` · via ${selectedNote.sourceApp}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="orbit-note-editor"
                    className="text-sm font-medium text-slate-700"
                  >
                    Note body
                  </label>
                  <Textarea
                    id="orbit-note-editor"
                    value={noteEditorBody}
                    onChange={(event) => setNoteEditorBody(event.target.value)}
                    className="min-h-[220px]"
                    placeholder="Add more context or edit the note."
                    disabled={noteEditorBusy}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="orbit-note-tags-editor"
                    className="text-sm font-medium text-slate-700"
                  >
                    Tags
                  </label>
                  <Input
                    id="orbit-note-tags-editor"
                    value={noteEditorTags}
                    onChange={(event) => setNoteEditorTags(event.target.value)}
                    placeholder="planning, research"
                    disabled={noteEditorBusy}
                  />
                  <p className="text-xs text-slate-400">
                    Separate tags with commas or #. We’ll lowercase and dedupe them.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>Status: {STATUS_LABEL[selectedNote.status]}</span>
                  <span>·</span>
                  <span>Updated {new Date(selectedNote.updatedAt).toLocaleString()}</span>
                </div>
                {noteEditorError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                    {noteEditorError}
                  </div>
                ) : null}
                {noteEditorMessage ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-600">
                    {noteEditorMessage}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    onClick={handleUpdateNote}
                    disabled={noteEditorBusy || !noteEditorBody.trim()}
                  >
                    {noteEditorBusy ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Saving…
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleResetNoteEditor}
                    disabled={noteEditorBusy}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
