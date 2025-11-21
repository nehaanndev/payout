export type OrbitSummary = {
  shareId: string;
  summary: string;
  keyPoints?: string[];
  createdAt: string;
  updatedAt: string;
};

export type UserInterests = {
  interests: string[];
  updatedAt: string;
};

export type DailySummary = {
  shareId: string;
  date: string; // YYYY-MM-DD format
  shownAt: string; // ISO timestamp when shown to user
  createdAt: string;
};

