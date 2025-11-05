import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "./firebase";
import {
  SharedLink,
  SharedLinkContentType,
  SharedLinkStatus,
  SharedLinkWritePayload,
} from "@/types/share";

const userSharesCollection = (userId: string) =>
  collection(db, "users", userId, "shares");

const normalizeContentType = (
  contentType?: SharedLinkContentType
): SharedLinkContentType => {
  if (!contentType) {
    return "unknown";
  }
  return contentType;
};

const normalizeStatus = (status?: SharedLinkStatus): SharedLinkStatus => {
  if (!status) {
    return "new";
  }
  return status;
};

export const createSharedLink = async (
  userId: string,
  payload: SharedLinkWritePayload
) => {
  if (!userId) {
    throw new Error("User ID is required to create shared links");
  }

  const nowIso = new Date().toISOString();
  const shareRef = doc(userSharesCollection(userId));

  const normalized = {
    url: payload.url ?? null,
    title: payload.title ?? null,
    description: payload.description ?? null,
    sourceApp: payload.sourceApp ?? null,
    platform: payload.platform ?? "android-share",
    contentType: normalizeContentType(payload.contentType),
    tags: payload.tags ?? [],
    previewImageUrl: payload.previewImageUrl ?? null,
    status: normalizeStatus(payload.status),
    createdAt: payload.createdAt ?? nowIso,
    updatedAt: payload.updatedAt ?? nowIso,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  };

  await setDoc(shareRef, normalized);

  return shareRef.id;
};

const mapShareDoc = (snapshot: QueryDocumentSnapshot<DocumentData>) => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    url: typeof data.url === "string" && data.url.length ? data.url : null,
    title: data.title ?? null,
    description: data.description ?? null,
    sourceApp: data.sourceApp ?? null,
    platform: data.platform ?? "android-share",
    contentType: normalizeContentType(data.contentType),
    tags: data.tags ?? [],
    previewImageUrl: data.previewImageUrl ?? null,
    status: normalizeStatus(data.status),
    createdAt:
      data.createdAt ??
      (data.serverCreatedAt?.toDate
        ? data.serverCreatedAt.toDate().toISOString()
        : ""),
    updatedAt:
      data.updatedAt ??
      (data.serverUpdatedAt?.toDate
        ? data.serverUpdatedAt.toDate().toISOString()
        : ""),
  } as SharedLink;
};

export const listSharedLinks = async (
  userId: string,
  options?: { limit?: number; status?: SharedLinkStatus }
): Promise<SharedLink[]> => {
  if (!userId) {
    return [];
  }

  const constraints: QueryConstraint[] = [orderBy("serverCreatedAt", "desc")];

  if (options?.status) {
    constraints.push(where("status", "==", options.status));
  }

  if (options?.limit) {
    constraints.push(limit(options.limit));
  }

  const q = query(userSharesCollection(userId), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => mapShareDoc(docSnap));
};

export const updateSharedLinkStatus = async (
  userId: string,
  shareId: string,
  status: SharedLinkStatus
) => {
  if (!userId || !shareId) {
    throw new Error("User ID and share ID are required");
  }

  const shareRef = doc(userSharesCollection(userId), shareId);
  await updateDoc(shareRef, {
    status,
    updatedAt: new Date().toISOString(),
    serverUpdatedAt: serverTimestamp(),
  });
};

export const deleteSharedLink = async (userId: string, shareId: string) => {
  if (!userId || !shareId) {
    return;
  }
  const shareRef = doc(userSharesCollection(userId), shareId);
  await deleteDoc(shareRef);
};

export const observeSharedLinks = (
  userId: string,
  options: { status?: SharedLinkStatus; limit?: number } = {},
  handler: (shares: SharedLink[]) => void,
  errorHandler?: (error: Error) => void
) => {
  if (!userId) {
    handler([]);
    return () => {};
  }

  const constraints: QueryConstraint[] = [orderBy("serverCreatedAt", "desc")];

  if (options.status) {
    constraints.push(where("status", "==", options.status));
  }
  if (options.limit) {
    constraints.push(limit(options.limit));
  }

  const q = query(userSharesCollection(userId), ...constraints);
  return onSnapshot(
    q,
    (snapshot) => {
      handler(snapshot.docs.map((docSnap) => mapShareDoc(docSnap)));
    },
    (error) => {
      if (errorHandler) {
        errorHandler(error);
      } else {
        console.error("Error observing shared links", error);
      }
    }
  );
};
