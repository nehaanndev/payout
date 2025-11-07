import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "./firebase";
import type { SharedLinkContentType } from "@/types/share";

export const ORBIT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024; // 25 MB limit

const sanitizeFileName = (fileName: string) => {
  const normalized = fileName.replace(/[^\w.-]/g, "_");
  return normalized.slice(-80) || "attachment";
};

const isPdfFile = (file: File) => {
  const mime = file.type?.toLowerCase() ?? "";
  const name = file.name?.toLowerCase() ?? "";
  return mime === "application/pdf" || name.endsWith(".pdf");
};

const isImageFile = (file: File) => {
  const mime = file.type?.toLowerCase() ?? "";
  return mime.startsWith("image/");
};

export const getOrbitContentTypeForFile = (file: File): SharedLinkContentType => {
  if (isImageFile(file)) {
    return "image";
  }
  if (isPdfFile(file)) {
    return "pdf";
  }
  return "unknown";
};

const assertFileSupported = (file: File) => {
  if (!isImageFile(file) && !isPdfFile(file)) {
    throw new Error("Orbit currently supports image or PDF uploads.");
  }
  if (file.size > ORBIT_UPLOAD_MAX_BYTES) {
    const maxMb = Math.round((ORBIT_UPLOAD_MAX_BYTES / (1024 * 1024)) * 10) / 10;
    throw new Error(`Choose a file under ${maxMb} MB to upload.`);
  }
};

export type OrbitAttachmentUploadResult = {
  downloadUrl: string;
  storagePath: string;
  mimeType: string;
  size: number;
};

export const uploadOrbitAttachment = async (
  userId: string,
  file: File
): Promise<OrbitAttachmentUploadResult> => {
  if (!userId) {
    throw new Error("Sign in before uploading files to Orbit.");
  }

  assertFileSupported(file);

  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeName = sanitizeFileName(file.name || "attachment");
  const storagePath = `users/${userId}/orbit/${uniqueId}-${safeName}`;
  const objectRef = ref(storage, storagePath);

  await uploadBytes(objectRef, file, {
    contentType: file.type || undefined,
    customMetadata: {
      originalName: file.name ?? "",
    },
  });

  const downloadUrl = await getDownloadURL(objectRef);

  return {
    downloadUrl,
    storagePath,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
};

export const deleteOrbitAttachment = async (storagePath: string) => {
  if (!storagePath) {
    return;
  }

  const objectRef = ref(storage, storagePath);
  await deleteObject(objectRef);
};
