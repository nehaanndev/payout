import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  FLOW_DAY_ORDER,
  FlowFixedEventPreference,
  FlowMealPreference,
  FlowSettings,
  FlowSleepOverrides,
} from "@/types/flow";

const DEFAULT_MEALS: FlowMealPreference[] = [
  {
    id: "lunch",
    label: "Lunch",
    time: "12:30",
    durationMinutes: 45,
  },
  {
    id: "dinner",
    label: "Dinner",
    time: "19:00",
    durationMinutes: 60,
  },
];

const DEFAULT_FIXED_EVENTS: FlowFixedEventPreference[] = [];

const normalizeSleepOverrides = (
  overrides?: FlowSleepOverrides
): FlowSleepOverrides => {
  if (!overrides) {
    return {};
  }
  const entries = Object.entries(overrides) as Array<[
    keyof FlowSleepOverrides,
    { sleepStart: string; sleepEnd: string }
  ]>;
  return entries.reduce<FlowSleepOverrides>((acc, [day, value]) => {
    if (!day || !value?.sleepStart || !value?.sleepEnd) {
      return acc;
    }
    acc[day] = {
      sleepStart: value.sleepStart,
      sleepEnd: value.sleepEnd,
    };
    return acc;
  }, {});
};

export const createDefaultFlowSettings = (timezone: string): FlowSettings => ({
  workStart: "08:00",
  workEnd: "17:00",
  sleepStart: "23:00",
  sleepEnd: "07:00",
  meals: DEFAULT_MEALS,
  fixedEvents: DEFAULT_FIXED_EVENTS,
  sleepOverrides: {},
  updatedAt: new Date().toISOString(),
  timezone,
});

const flowSettingsDoc = (userId: string) =>
  doc(db, "users", userId, "preferences", "flow");

export const fetchFlowSettings = async (
  userId: string,
  timezone: string
): Promise<FlowSettings> => {
  if (!userId) {
    throw new Error("User ID required to load Flow settings");
  }
  const ref = flowSettingsDoc(userId);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    const data = snapshot.data() as FlowSettings;
    return {
      ...createDefaultFlowSettings(timezone),
      ...data,
      meals: data.meals?.length ? data.meals : DEFAULT_MEALS,
      fixedEvents: Array.isArray(data.fixedEvents)
        ? data.fixedEvents.map((event) => ({
            ...event,
            days:
              event.days && event.days.length ? event.days : FLOW_DAY_ORDER,
            tags: Array.isArray(event.tags) ? event.tags : [],
          }))
        : DEFAULT_FIXED_EVENTS,
      sleepOverrides: normalizeSleepOverrides(data.sleepOverrides),
    };
  }
  const defaults = createDefaultFlowSettings(timezone);
  await setDoc(ref, defaults, { merge: true });
  return defaults;
};

export const saveFlowSettings = async (
  userId: string,
  settings: FlowSettings
) => {
  if (!userId) {
    throw new Error("User ID required to save Flow settings");
  }
  const ref = flowSettingsDoc(userId);
  const payload: FlowSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(ref, payload, { merge: true });
};

export const updateFlowSettings = async (
  userId: string,
  patch: Partial<FlowSettings>
) => {
  if (!userId) {
    throw new Error("User ID required to update Flow settings");
  }
  const ref = flowSettingsDoc(userId);
  await updateDoc(ref, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
};

export type FlowSettingsDraft = FlowSettings;
