import { extractTokenSlots, SlotValue } from "@/lib/mind/classifier/tokenClassifier";
import {
  MindEditableMessage,
  MindExperienceSnapshot,
  MindIntent,
  MindDebugTrace,
} from "../types";

type AmountParse = {
  minor: number;
  major: number;
  currency?: string;
  index: number;
  length: number;
};

type GroupResolution = {
  name?: string;
  matchedExisting: boolean;
  source?: string;
  debug?: ExtractGroupDebug;
};

type ExtractGroupDebug = {
  utterance: string;
  normalizedUtterance: string;
  slotHint?: string;
  slotHintConfidence?: number;
  regexCandidates: string[];
  trimmedCandidate?: string;
  normalizedCandidate?: string;
  candidateSingular?: string;
  matchType?: string;
  matchedGroupName?: string;
  comparisons: Array<{
    groupId?: string;
    groupName?: string;
    normalized?: string;
    distance?: number;
  }>;
};

type DeterministicPlan = {
  intent: MindIntent;
  confidence: number;
  message: string;
  editableMessage?: MindEditableMessage;
  debugTrace?: MindDebugTrace[];
};

const ADD_EXPENSE_PREFIX =
  /\b(add|log|record|track)\b.{0,30}\b(expense|spend|spending|purchase|charge)\b/i;
const MONEY_FIRST_PATTERN =
  /^\s*[$€£¥₹]?\s*\d+(?:[.,]\d{1,2})?(?:\s+(usd|inr|eur|gbp|cad|aud|sgd|rs|rupees|bucks|dollars))?/i;

const LEADING_VERB_REGEX = /\b(add|log|record|track)\b/i;
const CURRENCY_TOKEN_REGEX =
  /[$€£¥₹]|\b(usd|inr|eur|gbp|cad|aud|sgd|chf|cny|jpy|nzd|zar|brl|mxn|rs|rupees|rupee|dollars|bucks|euro|euros|pounds|sterling|yen|yuan)\b/i;
const EXPENSE_KEYWORD_REGEX =
  /\b(expense|spend|spent|spending|purchase|purchased|charge|charged|paid|pay)\b/i;

const MONEY_REGEX =
  /(?:(?<symbol>[$€£¥₹])\s*)?(?<amount>\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)(?:\s*(?<code>usd|inr|eur|gbp|cad|aud|sgd|chf|cny|jpy|nzd|zar|brl|mxn|rs|rupees|rupee|dollars|bucks|euro|euros|pounds|sterling|yen|yuan))?/gi;

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "CNY",
  "₹": "INR",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  CAD: "$",
  AUD: "$",
  SGD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  CNY: "¥",
  JPY: "¥",
};

const WORD_TO_CURRENCY: Record<string, string> = {
  usd: "USD",
  dollar: "USD",
  dollars: "USD",
  bucks: "USD",
  cad: "CAD",
  aud: "AUD",
  sgd: "SGD",
  eur: "EUR",
  euro: "EUR",
  euros: "EUR",
  gbp: "GBP",
  sterling: "GBP",
  pounds: "GBP",
  inr: "INR",
  rs: "INR",
  rupee: "INR",
  rupees: "INR",
  cny: "CNY",
  yuan: "CNY",
  jpy: "JPY",
  yen: "JPY",
  chf: "CHF",
  nzd: "NZD",
  zar: "ZAR",
  brl: "BRL",
  mxn: "MXN",
};

const CATEGORY_STOPWORDS = new Set(["the", "a", "an", "some", "my", "our"]);

const CATEGORY_FALLBACK_SKIP = new Set([
  "to",
  "in",
  "under",
  "for",
  "with",
  "split",
  "between",
  "on",
  "of",
  "spent",
  "spend",
  "spending",
  "purchase",
  "purchased",
  "purchasing",
  "paying",
  "paid",
  "expense",
  "expenses",
  "at",
  "bucks",
  "dollars",
  "usd",
  "eur",
  "euro",
  "euros",
  "gbp",
  "pounds",
  "cad",
  "inr",
  "rs",
  "rupee",
  "rupees",
]);

const CATEGORY_GROUP_TERMINATORS = new Set([
  "group",
  "crew",
  "team",
  "fund",
  "squad",
  "party",
  "trip",
  "reunion",
  "weekend",
  "offsite",
  "family",
  "house",
  "household",
  "club",
]);

const CATEGORY_SYNONYMS: Record<string, string> = {
  gasoline: "gas",
  petrol: "gas",
  fuel: "gas",
  petroleum: "gas",
  snacks: "snacks",
  lunch: "lunch",
  dinner: "dinner",
  breakfast: "breakfast",
  groceries: "groceries",
  grocery: "groceries",
  uber: "ride share",
  lyft: "ride share",
  rideshare: "ride share",
  cab: "ride share",
  taxi: "ride share",
  hotel: "lodging",
  lodging: "lodging",
  airbnb: "lodging",
};

const GROUP_SYNONYM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bbday\b/gi, "birthday"],
  [/\bb-day\b/gi, "birthday"],
  [/\bbachelorette\b/gi, "bachelorette"],
  [/\bnyc\b/gi, "nyc"],
  [/\bwknd\b/gi, "weekend"],
];

const GROUP_HINT_WORDS = [
  "group",
  "trip",
  "party",
  "crew",
  "team",
  "fund",
  "ledger",
  "house",
  "household",
  "family",
  "birthday",
  "anniversary",
  "vacation",
  "rent",
  "wedding",
  "reunion",
  "travel",
  "holiday",
  "weekend",
  "festival",
  "bachelor",
  "bachelorette",
  "potluck",
  "ski",
];

const ON_DATE_REGEX =
  /\bon\s+((?:\d{4}-\d{2}-\d{2})|(?:\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)|today|tomorrow|yesterday|tonight|last\s+\w+|next\s+\w+)/i;
const RELATIVE_DATE_REGEX =
  /\b(today|tomorrow|yesterday|tonight|last\s+\w+|next\s+\w+)\b/i;

// Title-cases strings for cleaner UI output.
const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word.length > 1
        ? word[0].toUpperCase() + word.slice(1).toLowerCase()
        : word.toUpperCase()
    )
    .join(" ");

// Maps common currency words/symbols to ISO codes.
const normalizeCurrencyWord = (code?: string | null) => {
  if (!code) {
    return undefined;
  }
  const normalized = code.toLowerCase();
  return WORD_TO_CURRENCY[normalized] ?? undefined;
};

// Removes punctuation/whitespace so we can parse numeric strings.
const normalizeNumberString = (input: string) => {
  if (!input) {
    return undefined;
  }
  const trimmed = input.trim();
  const withoutCommas = trimmed.replace(/,/g, "");
  const normalized = withoutCommas.replace(/\s+/g, "");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : undefined;
};

// Finds the best-fit monetary amount mentioned in the utterance.
const extractAmount = (utterance: string): AmountParse | null => {
  MONEY_REGEX.lastIndex = 0;
  const candidates: Array<
    AmountParse & {
      weight: number;
      hasSymbol: boolean;
      hasWord: boolean;
    }
  > = [];

  let match: RegExpExecArray | null = null;

  while ((match = MONEY_REGEX.exec(utterance)) !== null) {
    const amountText = match.groups?.amount;
    if (!amountText) {
      continue;
    }
    const amountMajor = normalizeNumberString(amountText);
    if (typeof amountMajor !== "number") {
      continue;
    }
    const symbol = match.groups?.symbol ?? "";
    const wordCurrency = normalizeCurrencyWord(match.groups?.code);
    const symbolCurrency = symbol ? SYMBOL_TO_CURRENCY[symbol] : undefined;
    const currency = wordCurrency ?? symbolCurrency;
    const hasSymbol = Boolean(symbol);
    const hasWord = Boolean(wordCurrency);
    const index = typeof match.index === "number" ? match.index : 0;
    const length = match[0].length;

    candidates.push({
      major: amountMajor,
      minor: Math.round(amountMajor * 100),
      currency,
      index,
      length,
      weight: (hasSymbol ? 4 : 0) + (hasWord ? 2 : 0),
      hasSymbol,
      hasWord,
    });
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => {
    if (a.weight !== b.weight) {
      return b.weight - a.weight;
    }
    if (a.hasSymbol !== b.hasSymbol) {
      return a.hasSymbol ? -1 : 1;
    }
    if (a.hasWord !== b.hasWord) {
      return a.hasWord ? -1 : 1;
    }
    return a.index - b.index;
  });

  const best = candidates[0];

  return {
    major: best.major,
    minor: best.minor,
    currency: best.currency,
    index: best.index,
    length: best.length,
  };
};

// Cleans a potential category by stripping filler and applying synonyms.
const normalizeCategory = (raw?: string | null) => {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s&/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) {
    return undefined;
  }
  const tokens = trimmed.split(" ").filter((token) => {
    if (!token) {
      return false;
    }
    return !CATEGORY_STOPWORDS.has(token);
  });
  if (!tokens.length) {
    return undefined;
  }
  for (const token of tokens) {
    const mapped = CATEGORY_SYNONYMS[token];
    if (mapped && mapped !== token) {
      return mapped;
    }
  }
  return tokens.join(" ");
};

const CATEGORY_PHRASE_REGEX =
  /\b(?:for|on|of)\s+(?<category>[a-z][a-z0-9&'/-\s]{1,40}?)(?=\s+(?:in|to|under|for|with|between|among|split|toward|towards)\b|[,.!?]|$)/gi;

// Removes trailing punctuation/connectors from category phrases.
const stripCategoryCandidate = (value: string) => {
  if (!value) {
    return value;
  }
  let output = value.replace(/[,.!?]+$/g, " ").trim();
  output = output.replace(
    /\s+(?:in|to|under|for|with|between|among|split|toward|towards)\b.*$/i,
    ""
  );
  for (const terminator of CATEGORY_GROUP_TERMINATORS) {
    const regex = new RegExp(`\\b${terminator}\\b`, "i");
    const match = output.match(regex);
    if (match?.index !== undefined) {
      output = output.slice(0, match.index).trim();
    }
  }
  return output.trim();
};

// Attempts to infer the expense category via regex and heuristics.
const extractCategory = (utterance: string, amountParse: AmountParse | null) => {
  CATEGORY_PHRASE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let candidate: string | undefined;

  while ((match = CATEGORY_PHRASE_REGEX.exec(utterance)) !== null) {
    const raw = match.groups?.category ?? "";
    if (!raw) {
      continue;
    }
    if (/\bgroup\b/i.test(raw)) {
      continue;
    }
    if (/\b(account|ledger|budget)\b/i.test(raw)) {
      continue;
    }
    if (/\d/.test(raw) && !/^\d+-?(?:st|nd|rd|th)?\b/i.test(raw)) {
      continue;
    }
    candidate = raw.trim();
    break;
  }

  candidate = stripCategoryCandidate(candidate ?? "");
  if (!candidate) {
    candidate = undefined;
  }

  if (!candidate && amountParse) {
    const afterAmount = utterance
      .slice(amountParse.index + amountParse.length)
      .trim();
    const nextWords = afterAmount.split(/\s+/);
    const collected: string[] = [];
    for (const word of nextWords) {
      if (!word) {
        continue;
      }
      const sanitized = word.replace(/^[^\p{L}\p{N}/-]+|[^\p{L}\p{N}/-]+$/gu, "");
      if (!sanitized) {
        continue;
      }
      const lower = sanitized.toLowerCase();
      if (CATEGORY_FALLBACK_SKIP.has(lower)) {
        if (collected.length) {
          break;
        }
        continue;
      }
      if (CATEGORY_GROUP_TERMINATORS.has(lower)) {
        break;
      }
      collected.push(sanitized);
      if (collected.length === 2) {
        break;
      }
    }
    if (collected.length) {
      candidate = collected.join(" ");
    }
  }

  return normalizeCategory(candidate);
};

// Normalizes group names for fuzzy comparisons.
const normalizeGroupCandidate = (value: string) => {
  let working = value;
  for (const [pattern, replacement] of GROUP_SYNONYM_REPLACEMENTS) {
    working = working.replace(pattern, replacement);
  }
  working = working.replace(/[.,!?]+/g, " ");
  return working
    .toLowerCase()
    .replace(/\b(group|crew|team|fund|squad)\b/g, "")
    .replace(/\b(today|tonight|tomorrow|please|thanks|now)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// Converts normalized group names back into presentable Title Case.
const titleCaseGroup = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const normalized = normalizeGroupCandidate(value);
  if (!normalized) {
    return undefined;
  }
  return titleCase(normalized);
};

// Trims trailing connector phrases so we keep the actual group phrase.
const trimConnectorTail = (value: string) => {
  const match = value.match(
    /(.*?\b(group|crew|team|fund|squad)\b)(?:\s+(?:for|with|about|regarding|on|at|re)\b.*)$/i
  );
  if (match?.[1]) {
    return match[1].trim();
  }
  return value;
};

// Computes edit distance used for fuzzy matching of group names.
const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }

  const matrix: number[][] = Array.from({ length: b.length + 1 }, () =>
    Array(a.length + 1).fill(0)
  );

  for (let i = 0; i <= b.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
};

// Identifies which known group (if any) the utterance references.
const extractGroupFromSnapshot = (
  utterance: string,
  snapshot: MindExperienceSnapshot,
  slotHint?: SlotValue
): GroupResolution => {
  const normalizedUtterance = normalizeGroupCandidate(utterance);
  const debug: ExtractGroupDebug = {
    utterance,
    normalizedUtterance,
    slotHint: slotHint?.value,
    slotHintConfidence: slotHint?.confidence,
    regexCandidates: [],
    comparisons: [],
  };
  let bestMatch: GroupResolution | null = null;

  for (const group of snapshot.expenses.groups ?? []) {
    const normalizedName = normalizeGroupCandidate(group.name);
    if (!normalizedName) {
      continue;
    }
    if (
      normalizedUtterance.includes(normalizedName) ||
      normalizedName.includes(normalizedUtterance)
    ) {
      bestMatch = {
        name: group.name,
        matchedExisting: true,
        source: group.name,
        debug: {
          ...debug,
          matchType: "direct_phrase_match",
          matchedGroupName: group.name,
        },
      };
      break;
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  if (slotHint?.value) {
    const hintNormalized = normalizeGroupCandidate(slotHint.value);
    if (hintNormalized) {
      for (const group of snapshot.expenses.groups ?? []) {
        const normalizedName = normalizeGroupCandidate(group.name);
        if (!normalizedName) {
          continue;
        }
        if (
          normalizedName === hintNormalized ||
          normalizedName.includes(hintNormalized) ||
          hintNormalized.includes(normalizedName)
        ) {
          return {
            name: group.name,
            matchedExisting: true,
            source: slotHint.value,
            debug: {
              ...debug,
              matchType: "slot_hint_match",
              matchedGroupName: group.name,
            },
          };
        }
      }
    }
  }

  const GROUP_REGEX =
    /\b(?:in|to|under|for)\s+(?:the\s+)?(?<group>[a-z0-9][a-z0-9&'()\-.\s]{1,60})/gi;

  let match: RegExpExecArray | null = null;
  let candidate: string | undefined = slotHint?.value?.trim();
  if (candidate) {
    debug.regexCandidates.push(candidate);
  }

  while ((match = GROUP_REGEX.exec(utterance)) !== null) {
    const raw = match.groups?.group ?? "";
    if (!raw) {
      continue;
    }
    const trimmed = raw.trim();
    const normalized = normalizeGroupCandidate(trimmed);
    const trimmedLower = trimmed.toLowerCase();
    if (!normalized) {
      continue;
    }
    const hasHint = GROUP_HINT_WORDS.some((hint) =>
      normalized.includes(hint) || trimmedLower.includes(hint)
    );
    if (/^(?:for|gas|coffee|lunch|dinner|snacks)\b/i.test(trimmed)) {
      continue;
    }
    if (match[0].toLowerCase().startsWith("for ") && !hasHint) {
      continue;
    }
    const selected = trimConnectorTail(trimmed);
    if (!candidate) {
      candidate = selected;
    }
    debug.regexCandidates.push(trimmed);
  }

  if (!candidate) {
    return { name: undefined, matchedExisting: false, debug };
  }

  const trimmedCandidate = trimConnectorTail(candidate);
  debug.trimmedCandidate = trimmedCandidate;
  const normalizedCandidate = normalizeGroupCandidate(trimmedCandidate);
  debug.normalizedCandidate = normalizedCandidate;
  const candidateSingular = normalizedCandidate.endsWith("s")
    ? normalizedCandidate.slice(0, -1)
    : normalizedCandidate;
  debug.candidateSingular = candidateSingular;

  const fuzzyMatches: Array<{
    group: (typeof snapshot.expenses.groups)[number];
    normalized: string;
    distance: number;
  }> = [];

  for (const group of snapshot.expenses.groups ?? []) {
    const normalizedName = normalizeGroupCandidate(group.name);
    if (!normalizedName) {
      continue;
    }
    if (
      normalizedName === normalizedCandidate ||
      normalizedName.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedName)
    ) {
      debug.matchType = "direct_candidate_match";
      debug.matchedGroupName = group.name;
      return {
        name: group.name,
        matchedExisting: true,
        source: candidate,
        debug,
      };
    }
    const singular = normalizedName.endsWith("s")
      ? normalizedName.slice(0, -1)
      : normalizedName;
    const dist = Math.min(
      levenshteinDistance(normalizedName, normalizedCandidate),
      levenshteinDistance(singular, candidateSingular)
    );
    fuzzyMatches.push({ group, normalized: normalizedName, distance: dist });
    debug.comparisons.push({
      groupId: group.id,
      groupName: group.name,
      normalized: normalizedName,
      distance: dist,
    });
  }

  if (fuzzyMatches.length) {
    fuzzyMatches.sort((a, b) => a.distance - b.distance);
    const best = fuzzyMatches[0];
    const second = fuzzyMatches[1];
    const threshold = Math.max(2, Math.floor(normalizedCandidate.length * 0.3));
    if (
      best.distance <= threshold &&
      (second === undefined || best.distance + 1 < second.distance)
    ) {
      debug.matchType = "fuzzy_match";
      debug.matchedGroupName = best.group.name;
      return {
        name: best.group.name,
        matchedExisting: true,
        source: candidate,
        debug,
      };
    }
  }

  debug.matchType = "new_group";
  debug.matchedGroupName = titleCaseGroup(candidate) ?? undefined;
  return {
    name: titleCaseGroup(candidate),
    matchedExisting: false,
    source: candidate,
    debug,
  };
};

// Pulls a date reference such as "on Friday" or "yesterday".
const extractDate = (utterance: string) => {
  const onMatch = utterance.match(ON_DATE_REGEX);
  if (onMatch?.[1]) {
    return onMatch[1].trim();
  }
  const relativeMatch = utterance.match(RELATIVE_DATE_REGEX);
  if (relativeMatch?.[1]) {
    return relativeMatch[1].trim();
  }
  return undefined;
};

// Determines whether the utterance resembles an expense command.
const matchesIntent = (utterance: string) => {
  const normalized = utterance.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (ADD_EXPENSE_PREFIX.test(normalized.slice(0, 80))) {
    return true;
  }
  if (MONEY_FIRST_PATTERN.test(normalized)) {
    return true;
  }
  const hasVerbNearStart = LEADING_VERB_REGEX.test(normalized.slice(0, 24));
  const hasCurrencyToken = CURRENCY_TOKEN_REGEX.test(normalized);
  if (hasVerbNearStart && hasCurrencyToken) {
    return true;
  }
  if (hasCurrencyToken && EXPENSE_KEYWORD_REGEX.test(normalized)) {
    return true;
  }
  return false;
};

// Creates the expense description, falling back to trimmed utterance.
const buildDescription = (
  category: string | undefined,
  utterance: string
) => {
  if (category) {
    return titleCase(category);
  }
  const trimmed = utterance.trim();
  return trimmed.length > 120 ? trimmed.slice(0, 120) : trimmed;
};

// Deterministic parser that produces an add-expense intent when confident.
export const planDeterministicAddExpense = (
  utterance: string,
  snapshot: MindExperienceSnapshot
): DeterministicPlan | null => {
  if (!utterance || !utterance.trim()) {
    return null;
  }

  const intentSignal = matchesIntent(utterance);
  const amount = extractAmount(utterance);

  if (!intentSignal || !amount) {
    return null;
  }

  const debugTrace: MindDebugTrace[] = [
    {
      phase: "planner",
      description: "planDeterministicAddExpense matched intent heuristics",
      data: {
        intentSignal,
        amountMajor: amount.major,
        amountMinor: amount.minor,
        currency: amount.currency,
      },
    },
  ];

  const slotExtraction = extractTokenSlots(utterance);
  if (slotExtraction.tokenPredictions.length) {
    debugTrace.push({
      phase: "planner",
      description: "Token slot classifier output",
      data: slotExtraction,
    });
  }
  const slotHints = slotExtraction.slots;
  if (slotHints && Object.keys(slotHints).length > 0) {
    debugTrace.push({
      phase: "planner",
      description: "Token slot hints applied",
      data: slotHints,
    });
  }

  const category = extractCategory(utterance, amount);
  const group = extractGroupFromSnapshot(utterance, snapshot, slotHints.groupName);
  const occurredAt = extractDate(utterance);

  if (!group.name) {
    return null;
  }

  debugTrace.push({
    phase: "planner",
    description: "Expense category and timing extraction",
    data: {
      category,
      occurredAt,
    },
  });

  if (group.debug) {
    debugTrace.push({
      phase: "group_resolution",
      description: group.matchedExisting
        ? "Matched group from snapshot"
        : "No existing group match; suggested new group",
      data: group.debug,
    });
  }

  const slotDescription = slotHints.note?.value ?? slotHints.merchant?.value;
  const description = slotDescription ?? buildDescription(category, utterance);
  const paidByHint = slotHints.paidByHint?.value;
  const groupsList = (snapshot.expenses.groups ?? [])
    .map((group) => group.name)
    .filter((name): name is string => Boolean(name));
  const symbol =
    CURRENCY_SYMBOLS[(amount.currency ?? "USD").toUpperCase()] ?? "";
  const amountDisplay = `${symbol}${amount.major.toFixed(2)}`;
  const groupValue = group.name ?? "";

  const confidenceBase = intentSignal ? 0.6 : 0.45;
  const confidence =
    confidenceBase +
    (group.matchedExisting ? 0.2 : 0) +
    (category ? 0.05 : 0);

  const boundedConfidence = Math.max(
    0.35,
    Math.min(confidence, 0.92)
  );

  const intent: MindIntent = {
    tool: "add_expense",
    input: {
      amountMinor: amount.minor,
      currency: amount.currency,
      description,
      groupName: group.name,
      occurredAt,
      paidByHint: paidByHint ?? undefined,
    },
  };

  const messageParts = [
    "Queued a group expense",
    group.name ? `for ${group.name}` : "for review",
  ];
  if (category) {
    messageParts.push(`category ${titleCase(category)}`);
  }

  const editableMessage = {
    template: "Add {{amount}} to {{group}} for {{description}}?",
    fields: [
      {
        key: "amount",
        label: "Amount",
        value: amountDisplay,
        fieldType: "amount",
      },
      {
        key: "group",
        label: "Group",
        value: groupValue,
        fieldType: "group",
      },
      {
        key: "description",
        label: "Description",
        value: description,
        fieldType: "description",
      },
      {
        key: "paidByHint",
        label: "Paid by",
        value: paidByHint ?? "",
        fieldType: "payer",
      },
      {
        key: "occurredAt",
        label: "Date",
        value: occurredAt ?? "",
        fieldType: "date",
      },
    ] as MindEditableMessage["fields"],
  };

  if (!group.matchedExisting) {
    const available =
      groupsList.length > 0
        ? `Available groups: ${groupsList.join(", ")}.`
        : "You don't have any expense groups yet.";
    return {
      intent,
      confidence: 0.2,
      message: `I cannot recognize the group name "${
        group.source ?? group.name ?? "your request"
      }". ${available}`,
      editableMessage,
      debugTrace,
    };
  }

  return {
    intent,
    confidence: Number(boundedConfidence.toFixed(2)),
    message: messageParts.join(" ").trim(),
    editableMessage,
    debugTrace,
  };
};
