import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { FlowPlan, FlowReflection, FlowTask } from "@/types/flow";

const flowPlansCollection = (userId: string) =>
  collection(db, "users", userId, "flowPlans");

const flowPlanDoc = (userId: string, dateKey: string) =>
  doc(flowPlansCollection(userId), dateKey);

export const getFlowDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const ensureFlowPlan = async (
  userId: string,
  dateKey: string,
  timezone: string
): Promise<FlowPlan> => {
  if (!userId) {
    throw new Error("User ID required to load Flow plan");
  }
  const ref = flowPlanDoc(userId, dateKey);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    return {
      id: snapshot.id,
      ...(snapshot.data() as Omit<FlowPlan, "id">),
    };
  }
  const nowIso = new Date().toISOString();
  const plan: FlowPlan = {
    id: dateKey,
    date: dateKey,
    timezone,
    startTime: "08:00",
    tasks: [],
    reflections: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await setDoc(ref, {
    ...plan,
  });
  return plan;
};

export const saveFlowPlan = async (userId: string, plan: FlowPlan) => {
  if (!userId) {
    throw new Error("User ID required to save Flow plan");
  }
  const ref = flowPlanDoc(userId, plan.id);
  const payload = {
    ...plan,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(ref, payload, { merge: true });
};

export const overwriteFlowTasks = async (
  userId: string,
  planId: string,
  tasks: FlowTask[]
) => {
  if (!userId) {
    throw new Error("User ID required to update Flow tasks");
  }
  const ref = flowPlanDoc(userId, planId);
  await updateDoc(ref, {
    tasks,
    updatedAt: new Date().toISOString(),
  });
};

export const appendFlowReflection = async (
  userId: string,
  planId: string,
  reflection: FlowReflection
) => {
  if (!userId) {
    throw new Error("User ID required to append Flow reflection");
  }
  const ref = flowPlanDoc(userId, planId);
  await updateDoc(ref, {
    reflections: arrayUnion(reflection),
    updatedAt: new Date().toISOString(),
  });
};
