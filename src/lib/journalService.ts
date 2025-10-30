import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase";
import {
  JournalDocument,
  JournalEntry,
  JournalMember,
  JournalEntrySummary,
} from "@/types/journal";

export const DEFAULT_JOURNAL_TITLE = "Daily Journal";

export const createJournalDocument = async (member?: JournalMember) => {
  const journalRef = doc(collection(db, "journals"));
  const nowIso = new Date().toISOString();

  const base: Omit<JournalDocument, "id"> = {
    title: DEFAULT_JOURNAL_TITLE,
    ownerIds: member?.id ? [member.id] : [],
    memberIds: member?.id ? [member.id] : [],
    members: member ? [member] : [],
    shareCode: journalRef.id,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await setDoc(journalRef, {
    ...base,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });

  return journalRef.id;
};

export const fetchJournalDocument = async (
  journalId: string
): Promise<JournalDocument | null> => {
  const ref = doc(db, "journals", journalId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...(snapshot.data() as Omit<JournalDocument, "id">) };
};

export const ensureMemberOnJournal = async (
  journalId: string,
  member: JournalMember
) => {
  const ref = doc(db, "journals", journalId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return;
  }
  const data = snapshot.data() as Omit<JournalDocument, "id">;
  if (data.memberIds?.includes(member.id)) {
    return;
  }
  await updateDoc(ref, {
    memberIds: arrayUnion(member.id),
    members: arrayUnion(member),
    serverUpdatedAt: serverTimestamp(),
    updatedAt: new Date().toISOString(),
  });
};

export const saveJournalEntry = async (
  journalId: string,
  entry: JournalEntry
) => {
  const entryRef = doc(
    collection(db, "journals", journalId, "entries"),
    entry.id
  );
  await setDoc(entryRef, {
    ...entry,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });

  const journalRef = doc(db, "journals", journalId);
  await updateDoc(journalRef, {
    updatedAt: entry.updatedAt,
    serverUpdatedAt: serverTimestamp(),
  });
};

export const listJournalEntrySummaries = async (
  journalId: string,
  limitCount = 100
): Promise<JournalEntrySummary[]> => {
  const entriesRef = collection(db, "journals", journalId, "entries");
  const q = query(entriesRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.slice(0, limitCount).map((docSnap) => {
    const data = docSnap.data() as JournalEntry;
    return {
      id: data.id,
      entryDate: data.entryDate ?? null,
      mood: data.mood ?? null,
      snippet:
        data.answers?.goldenMoment ||
        data.answers?.gratitude ||
        data.answers?.dayVibe ||
        null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });
};

export const fetchJournalEntryById = async (
  journalId: string,
  entryId: string
): Promise<JournalEntry | null> => {
  const entryRef = doc(collection(db, "journals", journalId, "entries"), entryId);
  const snapshot = await getDoc(entryRef);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...(snapshot.data() as Omit<JournalEntry, "id">) };
};
