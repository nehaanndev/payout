export type SharedLinkContentType = "link" | "video" | "article" | "audio" | "unknown";

export type SharedLinkStatus = "new" | "saved" | "archived";

export type SharedLink = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  sourceApp: string | null;
  platform: "android-share" | "web";
  contentType: SharedLinkContentType;
  tags: string[];
  previewImageUrl: string | null;
  status: SharedLinkStatus;
  createdAt: string;
  updatedAt: string;
};

export type SharedLinkWritePayload = {
  url: string;
  title?: string | null;
  description?: string | null;
  sourceApp?: string | null;
  platform?: "android-share" | "web";
  contentType?: SharedLinkContentType;
  tags?: string[];
  previewImageUrl?: string | null;
  status?: SharedLinkStatus;
  createdAt?: string;
  updatedAt?: string;
};

