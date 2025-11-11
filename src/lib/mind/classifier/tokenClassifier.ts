import tokenModel from "@/lib/mind/classifier/models/token_manual.json";

export type TokenSpan = {
  text: string;
  start: number;
  end: number;
};

export type TokenPrediction = TokenSpan & {
  label: string;
  probability: number;
};

export type SlotValue = {
  value: string;
  confidence: number;
};

export type SlotName = "groupName" | "merchant" | "paidByHint" | "note";

export type TokenSlotExtraction = {
  slots: Partial<Record<SlotName, SlotValue>>;
  tokenPredictions: TokenPrediction[];
};

type TokenModel = {
  vocabulary: Record<string, number>;
  coef: number[][];
  intercept: number[];
  classes: string[];
};

type FeatureVector = Array<{ idx: number; value: number }>;

type TokenFeatureBuilder = (tokens: TokenSpan[], index: number) => Record<string, number>;

type LabelSlot = SlotName | null;

const model = tokenModel as TokenModel;

const GROUP_KEYWORDS = new Set(["group", "crew", "trip", "team", "fund"]);

const CURRENCY_SYMBOLS_REGEX = /[$€£₹]/;

const TOKEN_REGEX = /[\p{L}\p{N}]+|[$€£₹]+|[^\s]/gu;

const labelToSlot = (label: string): LabelSlot => {
  if (label.endsWith("GROUP")) return "groupName";
  if (label.endsWith("MERCHANT")) return "merchant";
  if (label.endsWith("PAYER")) return "paidByHint";
  if (label.endsWith("NOTE")) return "note";
  return null;
};

const wordShape = (token: string): string => {
  let shape = "";
  for (const char of token) {
    if (/\d/.test(char)) {
      shape += "d";
    } else if (/[A-Z]/.test(char)) {
      shape += "X";
    } else if (/[a-z]/.test(char)) {
      shape += "x";
    } else {
      shape += char;
    }
  }
  return shape;
};

const tokenize = (text: string): TokenSpan[] => {
  if (!text) {
    return [];
  }
  const spans: TokenSpan[] = [];
  let match: RegExpExecArray | null;
  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    spans.push({ text: match[0], start: match.index, end: match.index + match[0].length });
  }
  return spans;
};

const buildFeatures: TokenFeatureBuilder = (tokens, index) => {
  const token = tokens[index];
  const lower = token.text.toLowerCase();
  const prev = tokens[index - 1]?.text.toLowerCase() ?? "<bos>";
  const next = tokens[index + 1]?.text.toLowerCase() ?? "<eos>";

  const features: Record<string, number> = {
    bias: 1,
    [`token=${lower}`]: 1,
    [`prefix3=${lower.slice(0, 3)}`]: 1,
    [`suffix3=${lower.slice(-3)}`]: 1,
    [`shape=${wordShape(token.text)}`]: 1,
    [`prev_token=${prev}`]: 1,
    [`next_token=${next}`]: 1,
    [`prev_bigram=${prev}_${lower}`]: 1,
    [`next_bigram=${lower}_${next}`]: 1,
  };

  if (/\d/.test(token.text)) {
    features.has_digit = 1;
  }
  if (CURRENCY_SYMBOLS_REGEX.test(token.text)) {
    features.has_currency_symbol = 1;
  }
  if (GROUP_KEYWORDS.has(lower)) {
    features.group_keyword = 1;
  }

  return features;
};

const vectorize = (features: Record<string, number>): FeatureVector => {
  const entries: FeatureVector = [];
  for (const [name, value] of Object.entries(features)) {
    const idx = model.vocabulary[name];
    if (idx === undefined || value === 0) {
      continue;
    }
    entries.push({ idx, value });
  }
  return entries;
};

const softmax = (scores: number[]): number[] => {
  const maxScore = Math.max(...scores);
  const expScores = scores.map((score) => Math.exp(score - maxScore));
  const denom = expScores.reduce((sum, value) => sum + value, 0) || 1;
  return expScores.map((value) => value / denom);
};

const scoreToken = (features: FeatureVector): { label: string; probability: number; probabilities: number[] } => {
  const scores = model.coef.map((weights, classIdx) => {
    const bias = model.intercept[classIdx] ?? 0;
    return features.reduce((sum, entry) => sum + (weights[entry.idx] ?? 0) * entry.value, bias);
  });
  const probabilities = softmax(scores);
  let bestIdx = 0;
  for (let i = 1; i < probabilities.length; i += 1) {
    if (probabilities[i] > probabilities[bestIdx]) {
      bestIdx = i;
    }
  }
  return {
    label: model.classes[bestIdx],
    probability: probabilities[bestIdx],
    probabilities,
  };
};

export const predictTokenLabels = (text: string): TokenPrediction[] => {
  const tokens = tokenize(text);
  if (!tokens.length) {
    return [];
  }
  return tokens.map((token, index) => {
    const features = buildFeatures(tokens, index);
    const vector = vectorize(features);
    const scored = scoreToken(vector);
    return {
      ...token,
      label: scored.label,
      probability: Number(scored.probability.toFixed(4)),
    };
  });
};

const average = (values: number[]) => {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const extractTokenSlots = (text: string): TokenSlotExtraction => {
  const predictions = predictTokenLabels(text);
  const slots: Partial<Record<SlotName, SlotValue>> = {};

  type ActiveSpan = {
    slot: SlotName;
    start: number;
    end: number;
    probs: number[];
  } | null;

  let active: ActiveSpan = null;

  const flush = () => {
    if (!active) {
      return;
    }
    const rawValue = text.slice(active.start, active.end).trim();
    if (rawValue) {
      const confidence = Number(average(active.probs).toFixed(3));
      const current = slots[active.slot];
      if (!current || confidence > current.confidence) {
        slots[active.slot] = {
          value: rawValue.replace(/\s+/g, " "),
          confidence,
        };
      }
    }
    active = null;
  };

  predictions.forEach((prediction) => {
    const slot = labelToSlot(prediction.label);
    const prefix = prediction.label.split("_")[0];

    if (!slot || prefix === "O") {
      flush();
      return;
    }

    if (prefix === "B" || !active || active.slot !== slot) {
      flush();
      active = {
        slot,
        start: prediction.start,
        end: prediction.end,
        probs: [prediction.probability],
      };
      return;
    }

    active.end = prediction.end;
    active.probs.push(prediction.probability);
  });

  flush();

  return {
    slots,
    tokenPredictions: predictions,
  };
};
