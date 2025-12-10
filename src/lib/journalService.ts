import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  deleteDoc,
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
    isPublic: false,
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

export const findJournalForMember = async (
  memberId: string
): Promise<JournalDocument | null> => {
  if (!memberId) {
    return null;
  }
  const journalsRef = collection(db, "journals");
  const q = query(
    journalsRef,
    where("memberIds", "array-contains", memberId),
    orderBy("updatedAt", "desc"),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as Omit<JournalDocument, "id">) };
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

export const updateJournalPublicStatus = async (
  journalId: string,
  isPublic: boolean
) => {
  const ref = doc(db, "journals", journalId);
  await updateDoc(ref, {
    isPublic,
    serverUpdatedAt: serverTimestamp(),
    updatedAt: new Date().toISOString(),
  });
};

export const deleteJournalEntry = async (
  journalId: string,
  entryId: string
) => {
  const entryRef = doc(db, "journals", journalId, "entries", entryId);
  await deleteDoc(entryRef);
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
    const blogSnippet =
      data.answers?.blogSummary ||
      (data.answers?.blogBody
        ? `${data.answers.blogBody.slice(0, 120)}${data.answers.blogBody.length > 120 ? "..." : ""}`
        : null);
    return {
      id: data.id,
      entryDate: data.entryDate ?? null,
      mood: data.mood ?? null,
      snippet:
        data.answers?.goldenMoment ||
        data.answers?.gratitude ||
        data.answers?.dayVibe ||
        blogSnippet ||
        null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      entryType: data.entryType ?? "daily",
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

export const fetchJournalEntryByDate = async (
  journalId: string,
  entryDate: string
): Promise<JournalEntry | null> => {
  if (!entryDate) {
    return null;
  }
  const entriesRef = collection(db, "journals", journalId, "entries");
  const q = query(entriesRef, where("entryDate", "==", entryDate), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as Omit<JournalEntry, "id">) };
};

export const fetchLatestJournalEntry = async (
  journalId: string
): Promise<JournalEntry | null> => {
  const entriesRef = collection(db, "journals", journalId, "entries");
  const q = query(entriesRef, orderBy("entryDate", "desc"), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as Omit<JournalEntry, "id">) };
};
