export type SharedLinkContentType =
  | "link"
  | "video"
  | "article"
  | "audio"
  | "note"
  | "image"
  | "pdf"
  | "unknown";

export type SharedLinkStatus = "new" | "saved" | "archived";

export type SharedLink = {
  id: string;
  url: string | null;
  title: string | null;
  description: string | null;
  sourceApp: string | null;
  platform: "android-share" | "web";
  contentType: SharedLinkContentType;
  tags: string[];
  previewImageUrl: string | null;
  storagePath: string | null;
  status: SharedLinkStatus;
  summarizable?: boolean; // Mark as article/video/PDF for AI summarization
  createdAt: string;
  updatedAt: string;
  lessonPayload?: unknown;
};

export type SharedLinkWritePayload = {
  url?: string | null;
  title?: string | null;
  description?: string | null;
  sourceApp?: string | null;
  platform?: "android-share" | "web";
  contentType?: SharedLinkContentType;
  tags?: string[];
  previewImageUrl?: string | null;
  storagePath?: string | null;
  status?: SharedLinkStatus;
  summarizable?: boolean;
  createdAt?: string;
  updatedAt?: string;
};
