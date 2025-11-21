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

export type DailySummaryPayload = {
  overview: string[];
  recommendations: string[];
  completedWork: WorkTaskHighlight[];
  pendingWork: WorkTaskHighlight[];
  insights: OrbitInsightCard[];
};

export type DailySummary = {
  shareId: string;
  date: string; // YYYY-MM-DD format
  shownAt: string; // ISO timestamp when shown to user
  createdAt: string;
  payload?: DailySummaryPayload | null;
};

export type OrbitInsightType = "news" | "concept";

export type OrbitInsightCard = {
  id: string;
  topic: string;
  title: string;
  summary: string;
  paragraphs: string[];
  type: OrbitInsightType;
  referenceUrl?: string | null;
};

export type OrbitInsightPreferences = {
  moreTopics: Record<string, number>;
  lessTopics: Record<string, number>;
  updatedAt: string;
};

export type InsightVoteDirection = "more" | "less";

export type WorkTaskHighlight = {
  title: string;
  status: string;
  note?: string | null;
};
