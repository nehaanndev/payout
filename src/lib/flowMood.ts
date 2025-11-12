import type { FlowReflectionSentiment } from "@/types/flow";

export type FlowMoodOption = {
  id: string;
  label: string;
  emoji: string;
  sentiment: FlowReflectionSentiment;
  description: string;
};

export const FLOW_MOOD_OPTIONS: FlowMoodOption[] = [
  {
    id: "energized",
    label: "Energized",
    emoji: "⚡️",
    sentiment: "positive",
    description: "Momentum is high",
  },
  {
    id: "grateful",
    label: "Grateful",
    emoji: "😊",
    sentiment: "positive",
    description: "Soaking up the good stuff",
  },
  {
    id: "calm",
    label: "Calm",
    emoji: "😌",
    sentiment: "neutral",
    description: "Steady and present",
  },
  {
    id: "focused",
    label: "Focused",
    emoji: "🎯",
    sentiment: "positive",
    description: "Locked into the work",
  },
  {
    id: "meh",
    label: "Meh",
    emoji: "😐",
    sentiment: "neutral",
    description: "Cruising on autopilot",
  },
  {
    id: "tired",
    label: "Tired",
    emoji: "🥱",
    sentiment: "neutral",
    description: "Energy is fading",
  },
  {
    id: "stressed",
    label: "Stressed",
    emoji: "😣",
    sentiment: "challenging",
    description: "Plates are spinning",
  },
  {
    id: "overwhelmed",
    label: "Overwhelmed",
    emoji: "😵‍💫",
    sentiment: "challenging",
    description: "Need a breather",
  },
  {
    id: "happy",
    label: "Happy",
    emoji: "😀",
    sentiment: "positive",
    description: "Feeling light and optimistic",
  },
  {
    id: "depressed",
    label: "Depressed",
    emoji: "😞",
    sentiment: "challenging",
    description: "Everything feels heavy right now",
  },
  {
    id: "excited",
    label: "Excited",
    emoji: "🤩",
    sentiment: "positive",
    description: "Buzzing with anticipation",
  },
  {
    id: "lazy",
    label: "Lazy",
    emoji: "😴",
    sentiment: "neutral",
    description: "Coasting and keeping it low-key",
  },
  {
    id: "sad",
    label: "Sad",
    emoji: "😢",
    sentiment: "challenging",
    description: "Carrying some low feelings",
  },
];

export const getFlowMoodOption = (id: string) =>
  FLOW_MOOD_OPTIONS.find((option) => option.id === id) ?? null;
