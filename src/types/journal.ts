export type JournalMember = {
  id: string;
  email: string | null;
  name: string | null;
};

export type JournalAnswers = {
  entryDate: string;
  dayVibe: string;
  goldenMoment: string;
  workStory: string;
  workFeeling: string;
  learningNote: string;
  forwardIntent: string;
  familyStory: string;
  familyFeeling: string;
  gratitude: string;
  other: string;
};

export type JournalDocument = {
  id: string;
  title: string;
  ownerIds: string[];
  memberIds: string[];
  members: JournalMember[];
  shareCode: string;
  createdAt: string;
  updatedAt: string;
};

export type JournalEntry = {
  id: string;
  journalId: string;
  memberId: string;
  entryDate: string | null;
  mood: string | null;
  answers: JournalAnswers;
  createdAt: string;
  updatedAt: string;
};

export type JournalEntrySummary = {
  id: string;
  entryDate: string | null;
  mood: string | null;
  snippet: string | null;
  createdAt: string;
  updatedAt: string;
};
