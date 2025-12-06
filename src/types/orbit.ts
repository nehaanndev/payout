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

export type OrbitLearningLesson = {
  title: string;
  day: number;
  totalDays: number;
  overview: string;
  paragraphs: string[];
  code?: string[]; // Optional preformatted snippets (e.g., source code)
  quiz: Array<{
    question: string;
    answers: string[];
    correctAnswer: string;
  }>;
};

export type OrbitLearningPlan = {
  id: string;
  topic: string;
  depth: "light" | "standard" | "deep" | "expert" | "auto";
  totalLessons: number;
  currentLesson: number;
  startedAt: string;
  syllabus?: Array<{
    day: number;
    title: string;
    summary: string;
    quizFocus?: string;
  }>;
  completedLessons: Array<{
    day: number;
    title: string;
    overview: string;
  }>;
  updatedAt: string;
  lastLessonGeneratedAt?: string;
  activeLesson?: OrbitLearningLesson;
  lastLessonDate?: string; // YYYY-MM-DD
};

export type OrbitLearningProfile = {
  plans: OrbitLearningPlan[];
  updatedAt: string;
};

export type DailySummaryPayload = {
  overview: string[];
  recommendations: string[];
  completedWork: WorkTaskHighlight[];
  pendingWork: WorkTaskHighlight[];
  insights: OrbitInsightCard[];
  learningLesson?: OrbitLearningLesson | null; // Deprecated, keep for backward compat
  learningLessons?: OrbitLearningLesson[];
};

export type OrbitLesson = OrbitLearningLesson & {
  id: string;
  topic: string;
  createdAt: string;
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
