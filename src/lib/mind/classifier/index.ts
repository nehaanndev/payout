import binModel from "@/lib/mind/classifier/models/bin_manual.json";
import intentModel from "@/lib/mind/classifier/models/intent_manual.json";
import intentClasses from "@/lib/mind/classifier/models/intent_classes.json";

export type ManualModel = {
  vocabulary: Record<string, number>;
  idf: number[];
  ngram_range: [number, number] | number[];
  max_features: number | null;
  stop_words?: string[] | null;
  coef: number[][];
  intercept: number[];
  classes: Array<number | string>;
};

type SparseVectorEntry = { idx: number; val: number };

type BinaryPrediction = {
  probCommand: number;
  isCommand: boolean;
};

type IntentPrediction = {
  label: string;
  probability: number;
};

export type MindClassifierResult = BinaryPrediction & {
  topIntent?: IntentPrediction;
  intentProbabilities?: Record<string, number>;
};

const defaultThreshold = 0.6;

const sanitizeRegex = /[^a-z0-9\s$]/gi;

const toTokens = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(sanitizeRegex, " ")
    .split(/\s+/)
    .filter(Boolean);

const makeNgrams = (tokens: string[], minN: number, maxN: number): string[] => {
  const grams: string[] = [];
  for (let n = minN; n <= maxN; n += 1) {
    for (let i = 0; i + n <= tokens.length; i += 1) {
      grams.push(tokens.slice(i, i + n).join(" "));
    }
  }
  return grams;
};

const buildVector = (text: string, model: ManualModel): SparseVectorEntry[] => {
  if (!text.trim()) {
    return [];
  }

  const stopWords = model.stop_words ? new Set(model.stop_words) : null;
  const tokens = stopWords
    ? toTokens(text).filter((token) => !stopWords.has(token))
    : toTokens(text);
  const [minN, maxN] = Array.isArray(model.ngram_range)
    ? [model.ngram_range[0] ?? 1, model.ngram_range[1] ?? model.ngram_range[0] ?? 1]
    : model.ngram_range;
  const grams = makeNgrams(tokens, minN, maxN);

  const counts = new Map<number, number>();
  grams.forEach((gram) => {
    const idx = model.vocabulary[gram];
    if (typeof idx === "number") {
      counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
  });

  if (!counts.size) {
    return [];
  }

  const maxCount = Math.max(...counts.values());
  const entries: SparseVectorEntry[] = [];
  counts.forEach((count, idx) => {
    const tf = 0.5 + 0.5 * (count / maxCount);
    const idf = model.idf[idx] ?? 1;
    entries.push({ idx, val: tf * idf });
  });
  return entries;
};

const dot = (vec: SparseVectorEntry[], weights: number[]): number =>
  vec.reduce((sum, { idx, val }) => sum + val * (weights[idx] ?? 0), 0);

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

const predictBinary = (
  text: string,
  model: ManualModel,
  threshold = defaultThreshold
): MindClassifierResult => {
  const vector = buildVector(text, model);
  if (!vector.length) {
    return { probCommand: 0, isCommand: false };
  }
  const z = dot(vector, model.coef[0]) + (model.intercept?.[0] ?? 0);
  const probCommand = sigmoid(z);
  return { probCommand, isCommand: probCommand >= threshold };
};

const predictIntent = (
  text: string,
  model: ManualModel,
  classes: string[]
): { topIntent?: IntentPrediction; intentProbabilities?: Record<string, number> } => {
  const vector = buildVector(text, model);
  if (!vector.length) {
    return {};
  }

  const scores = model.coef.map((weights, idx) => {
    const z = dot(vector, weights) + (model.intercept?.[idx] ?? 0);
    return sigmoid(z);
  });

  const probabilities: Record<string, number> = {};
  classes.forEach((label, idx) => {
    probabilities[label] = scores[idx] ?? 0;
  });

  let bestIdx = 0;
  for (let i = 1; i < scores.length; i += 1) {
    if ((scores[i] ?? 0) > (scores[bestIdx] ?? 0)) {
      bestIdx = i;
    }
  }

  return {
    topIntent: {
      label: classes[bestIdx],
      probability: probabilities[classes[bestIdx]] ?? 0,
    },
    intentProbabilities: probabilities,
  };
};

export const classifyUtterance = (
  text: string,
  options?: { threshold?: number }
): MindClassifierResult => {
  const threshold = options?.threshold ?? defaultThreshold;
  const binary = predictBinary(text, binModel as ManualModel, threshold);
  if (!binary.isCommand) {
    return binary;
  }

  const { topIntent, intentProbabilities } = predictIntent(
    text,
    intentModel as ManualModel,
    intentClasses as string[]
  );

  return {
    ...binary,
    topIntent,
    intentProbabilities,
  };
};
