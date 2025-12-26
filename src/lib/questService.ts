import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { Quest, QuestMilestone, DailyLoad } from "@/types/quest";
import { generateId } from "@/lib/id";

const questsCollection = (userId: string) =>
    collection(db, "users", userId, "quests");

const questDoc = (userId: string, questId: string) =>
    doc(questsCollection(userId), questId);

// Create a new quest
export const createQuest = async (
    userId: string,
    questData: Omit<Quest, "id" | "createdAt" | "updatedAt">
): Promise<Quest> => {
    if (!userId) throw new Error("User ID required to create quest");

    const id = generateId();
    const now = new Date().toISOString();
    const quest: Quest = {
        ...questData,
        id,
        createdAt: now,
        updatedAt: now,
    };

    await setDoc(questDoc(userId, id), quest);
    return quest;
};

// Get a single quest
export const getQuest = async (
    userId: string,
    questId: string
): Promise<Quest | null> => {
    if (!userId) throw new Error("User ID required");

    const snapshot = await getDoc(questDoc(userId, questId));
    if (!snapshot.exists()) return null;

    return { id: snapshot.id, ...snapshot.data() } as Quest;
};

// Get all quests for a user
export const getUserQuests = async (userId: string): Promise<Quest[]> => {
    if (!userId) return [];

    const q = query(questsCollection(userId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Quest
    );
};

// Get active quests (not completed or paused)
export const getActiveQuests = async (userId: string): Promise<Quest[]> => {
    if (!userId) return [];

    const q = query(
        questsCollection(userId),
        where("status", "in", ["planning", "active"])
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Quest
    );
};

// Update a quest
export const updateQuest = async (
    userId: string,
    questId: string,
    updates: Partial<Quest>
): Promise<void> => {
    if (!userId) throw new Error("User ID required");

    await updateDoc(questDoc(userId, questId), {
        ...updates,
        updatedAt: new Date().toISOString(),
    });
};

// Delete a quest
export const deleteQuest = async (
    userId: string,
    questId: string
): Promise<void> => {
    if (!userId) throw new Error("User ID required");
    await deleteDoc(questDoc(userId, questId));
};

// Update milestone status
export const updateMilestoneStatus = async (
    userId: string,
    questId: string,
    milestoneId: string,
    status: QuestMilestone["status"],
    flowTaskId?: string
): Promise<void> => {
    const quest = await getQuest(userId, questId);
    if (!quest) throw new Error("Quest not found");

    const updatedSyllabus = quest.syllabus.map((m) =>
        m.id === milestoneId
            ? { ...m, status, flowTaskId: flowTaskId ?? m.flowTaskId }
            : m
    );

    const completedCount = updatedSyllabus.filter(
        (m) => m.status === "done"
    ).length;

    await updateQuest(userId, questId, {
        syllabus: updatedSyllabus,
        completedUnits: completedCount,
    });
};

// Calculate daily load across all quests
export const calculateDailyLoad = (
    quests: Quest[],
    startDate: string,
    endDate: string
): DailyLoad[] => {
    const loads: Map<string, DailyLoad> = new Map();

    // Initialize all dates (using UTC to avoid timezone/DST issues)
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const start = Date.UTC(startYear, startMonth - 1, startDay);
    const end = Date.UTC(endYear, endMonth - 1, endDay);
    const oneDay = 24 * 60 * 60 * 1000;

    for (let ts = start; ts <= end; ts += oneDay) {
        const d = new Date(ts);
        const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        loads.set(dateKey, {
            date: dateKey,
            totalMinutes: 0,
            quests: [],
        });
    }

    // Aggregate milestones by date
    for (const quest of quests) {
        for (const milestone of quest.syllabus) {
            if (milestone.assignedDate && loads.has(milestone.assignedDate)) {
                const load = loads.get(milestone.assignedDate)!;
                load.totalMinutes += milestone.durationMinutes;

                const existingQuest = load.quests.find((q) => q.questId === quest.id);
                if (existingQuest) {
                    existingQuest.minutes += milestone.durationMinutes;
                } else {
                    load.quests.push({
                        questId: quest.id,
                        questTitle: quest.title,
                        minutes: milestone.durationMinutes,
                    });
                }
            }
        }
    }

    return Array.from(loads.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
    );
};

// Get average daily commitment
export const getAverageDailyCommitment = (dailyLoads: DailyLoad[]): number => {
    if (dailyLoads.length === 0) return 0;
    const total = dailyLoads.reduce((sum, load) => sum + load.totalMinutes, 0);
    return Math.round(total / dailyLoads.length);
};
