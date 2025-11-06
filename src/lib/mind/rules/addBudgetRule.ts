import {
  MindEditableMessage,
  MindExperienceSnapshot,
  MindIntent,
} from "../types";

type AmountParse = {
  minor: number;
  major: number;
  currency?: string;
  index: number;
  length: number;
  weight: number;
  hasSymbol: boolean;
  hasWord: boolean;
};

type DeterministicPlan = {
  intent: MindIntent;
  confidence: number;
  message: string;
  editableMessage?: MindEditableMessage;
};

const ADD_BUDGET_PREFIX =
  /\b(add|log|record|track|put|move)\b.{0,40}\b(budget|category|envelope|spend|spent|expense|allocate)\b/i;
const MONEY_FIRST_PATTERN =
  /^\s*[$€£¥₹]?\s*\d+(?:[.,]\d{1,2})?(?:\s+(usd|inr|eur|gbp|cad|aud|sgd|rs|rupees|bucks|dollars))?/i;
const GROUP_KEYWORDS =
  /\b(group|trip|crew|team|settle|split|owe|tab|reimburse|pay back)\b/i;

const MONEY_REGEX =
  /(?:(?<symbol>[$€£¥₹])\s*)?(?<amount>\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)(?:\s*(?<code>usd|inr|eur|gbp|cad|aud|sgd|chf|cny|jpy|nzd|zar|brl|mxn|rs|rupees|rupee|dollars|bucks|euro|euros|pounds|sterling|yen|yuan))?/gi;

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "CNY",
  "₹": "INR",
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

const CATEGORY_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "some",
  "my",
  "our",
  "in",
  "into",
  "to",
  "for",
  "on",
  "towards",
  "toward",
  "at",
  "with",
  "between",
  "among",
  "budget",
]);

const CATEGORY_SYNONYMS: Record<string, string> = {
  groceries: "groceries",
  grocery: "groceries",
  food: "food",
  dining: "dining",
  restaurant: "dining",
  restaurants: "dining",
  eating: "dining",
  lunch: "lunch",
  dinner: "dinner",
  breakfast: "breakfast",
  snacks: "snacks",
  snack: "snacks",
  gas: "gas",
  gasoline: "gas",
  petrol: "gas",
  fuel: "gas",
  utilities: "utilities",
  power: "utilities",
  electric: "utilities",
  electricity: "utilities",
  water: "utilities",
  rent: "rent",
  mortgage: "mortgage",
  insurance: "insurance",
  travel: "travel",
  vacation: "travel",
  holiday: "travel",
  supplies: "supplies",
  hardware: "hardware",
  safeway: "groceries",
  trader: "groceries",
  walmart: "groceries",
  target: "groceries",
  tech: "tech",
  gear: "tech",
};

const BUDGET_HINTS = [
  "home",
  "household",
  "family",
  "personal",
  "shared",
  "travel",
  "vacation",
  "wedding",
  "rent",
  "business",
  "side hustle",
  "grocery",
  "food",
  "utilities",
];

const BUDGET_SYNONYM_MAP: Record<string, string> = {
  vacation: "travel",
  holidays: "travel",
  holiday: "travel",
  household: "family",
  bills: "utilities",
  outdoor: "adventure",
  adventures: "adventure",
  future: "savings",
  "future savings": "savings",
  reno: "home renovation",
  renovation: "home renovation",
};
const BUDGET_REGEX =
  /\b(?:in|into|to|for)\s+(?:the\s+)?(?<budget>[a-z0-9&'()\-.\s]{2,60}?)(?=\s+budget\b)/gi;
const INLINE_BUDGET_REGEX =
  /\b(?<budget>[a-z0-9&'()\-.\s]{2,60})\s+budget\b/i;

const MERCHANT_REGEX =
  /\bat\s+(?<merchant>[a-z0-9&'()\-.\s]{2,40}?)(?=\s+(?:to|for|in|into|under|with)\b|[,.!?]|$)/i;

const CATEGORY_REGEX =
  /\b(?:to|for|on|towards?)\s+(?<category>[a-z][a-z0-9&'/-\s]{1,40}?)(?=\s+(?:in|into|to|for|with|at|between|among|under)\b|[,.!?]|$)/gi;

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

const normalizeCurrencyWord = (code?: string | null) => {
  if (!code) {
    return undefined;
  }
  const normalized = code.toLowerCase();
  return WORD_TO_CURRENCY[normalized] ?? undefined;
};

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

const extractAmount = (utterance: string): AmountParse | null => {
  MONEY_REGEX.lastIndex = 0;
  const candidates: AmountParse[] = [];
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

  return candidates[0];
};

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
  const tokens = trimmed
    .split(" ")
    .filter((token) => token && !CATEGORY_STOPWORDS.has(token));
  if (!tokens.length) {
    return undefined;
  }
  for (const token of tokens) {
    if (CATEGORY_SYNONYMS[token]) {
      return CATEGORY_SYNONYMS[token];
    }
  }
  return tokens.join(" ");
};

const extractCategory = (utterance: string, amountParse: AmountParse | null) => {
  CATEGORY_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let candidate: string | undefined;

  while ((match = CATEGORY_REGEX.exec(utterance)) !== null) {
    const raw = match.groups?.category ?? "";
    if (!raw) {
      continue;
    }
    if (/\b(budget|plan)\b/i.test(raw)) {
      continue;
    }
    candidate = raw.trim();
    break;
  }

  if (!candidate && amountParse) {
    const afterAmount = utterance
      .slice(amountParse.index + amountParse.length)
      .trim();
    const nextWords = afterAmount.split(/\s+/);
    if (nextWords.length) {
      const first = nextWords[0];
      if (first && !/^(in|into|to|for|at)$/i.test(first)) {
        candidate = first;
      }
    }
  }

  return normalizeCategory(candidate);
};

const extractMerchant = (utterance: string) => {
  const match = utterance.match(MERCHANT_REGEX);
  if (!match?.groups?.merchant) {
    return undefined;
  }
  const cleaned = match.groups.merchant.trim();
  if (!cleaned) {
    return undefined;
  }
  return titleCase(cleaned);
};

const normalizeBudgetCandidate = (value: string) =>
  value
    .toLowerCase()
    .replace(/\bbudget\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const singularizeToken = (token: string) => {
  if (token.endsWith("ies")) {
    return token.slice(0, -3) + "y";
  }
  if (token.endsWith("s") && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
};

const singularizePhrase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map(singularizeToken)
    .join(" ");

const cleanBudgetCandidate = (value: string) => {
  let working = value.trim().replace(/^(?:the\s+)/i, "");
  const trailing = working.match(
    /(?:in|into|for|to)\s+(?:the\s+)?([a-z0-9&'()\-.\s]+)$/i
  );
  if (trailing?.[1]) {
    working = trailing[1].trim();
  }
  working = working.replace(/\bbudget\b/gi, "").trim();
  return working;
};

const computeBudgetSimilarity = (
  doc: { normalized: string; singular: string },
  normalized: string,
  singular: string
) => {
  let score = 0;
  if (doc.normalized.includes(normalized)) {
    score = Math.max(score, normalized.length);
  }
  if (normalized.includes(doc.normalized)) {
    score = Math.max(score, doc.normalized.length);
  }
  if (doc.singular.includes(singular)) {
    score = Math.max(score, singular.length);
  }
  if (singular.includes(doc.singular)) {
    score = Math.max(score, doc.singular.length);
  }
  return score;
};

const resolveBudget = (
  utterance: string,
  snapshot: MindExperienceSnapshot
) => {
  const documents = snapshot.budget.documents ?? [];
  const matches: string[] = [];

  BUDGET_REGEX.lastIndex = 0;
  let regexMatch: RegExpExecArray | null = null;
  while ((regexMatch = BUDGET_REGEX.exec(utterance)) !== null) {
    const candidate = regexMatch.groups?.budget?.trim();
    if (candidate) {
      matches.push(candidate);
    }
  }

  if (!matches.length) {
    const inlineMatch = utterance.match(INLINE_BUDGET_REGEX);
    if (inlineMatch?.groups?.budget) {
      matches.push(inlineMatch.groups.budget.trim());
    }
  }

  const normalizedMatches = matches
    .map((value) => {
      const cleaned = cleanBudgetCandidate(value);
      return {
        raw: cleaned,
        normalized: normalizeBudgetCandidate(cleaned),
      };
    })
    .filter((entry) => entry.normalized.length > 0);

  const documentsWithNormalized = documents.map((doc) => ({
    ...doc,
    normalized: normalizeBudgetCandidate(doc.title ?? ""),
    singular: singularizePhrase(normalizeBudgetCandidate(doc.title ?? "")),
  }));

  for (const match of normalizedMatches) {
    const matchSingular = singularizePhrase(match.normalized);
    const synonymTarget =
      BUDGET_SYNONYM_MAP[match.normalized] ??
      BUDGET_SYNONYM_MAP[matchSingular] ??
      null;
    const exact = documentsWithNormalized.find(
      (doc) =>
        doc.normalized === match.normalized ||
        doc.singular === matchSingular
    );
    if (exact) {
      return {
        id: exact.id,
        title: exact.title,
        matchedExisting: true,
        source: match.raw,
      };
    }

    if (synonymTarget) {
      const synonymDoc = documentsWithNormalized.find(
        (doc) =>
          doc.normalized === synonymTarget ||
          doc.singular === synonymTarget
      );
      if (synonymDoc) {
        return {
          id: synonymDoc.id,
          title: synonymDoc.title,
          matchedExisting: true,
          source: match.raw,
        };
      }
    }

    const bestCandidate = documentsWithNormalized
      .map((doc) => ({
        doc,
        score: computeBudgetSimilarity(doc, match.normalized, matchSingular),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (bestCandidate) {
      return {
        id: bestCandidate.doc.id,
        title: bestCandidate.doc.title,
        matchedExisting: true,
        source: match.raw,
      };
    }
  }

  if (normalizedMatches.length) {
    const preferred = normalizedMatches[0];
    const hinted = BUDGET_HINTS.find((hint) =>
      preferred.normalized.includes(hint)
    );
    return {
      id: undefined,
      title: titleCase(preferred.raw),
      matchedExisting: Boolean(hinted),
      source: preferred.raw,
    };
  }

  if (documents.length) {
    const active = documents.find(
      (doc) => doc.id === snapshot.budget.activeBudgetId
    );
    const fallback = active ?? documents[0];
    return {
      id: fallback.id,
      title: fallback.title,
      matchedExisting: true,
    };
  }

  return {
    id: snapshot.budget.activeBudgetId ?? undefined,
    title: snapshot.budget.activeBudgetId ? "Budget" : "Home Budget",
    matchedExisting: Boolean(snapshot.budget.activeBudgetId),
  };
};

const formatAmountDisplay = (
  amountMajor: number,
  currency?: string,
  fallbackCurrency?: string | null
) => {
  const currencyCode = (currency ?? fallbackCurrency ?? "USD").toUpperCase();
  const symbol = CURRENCY_SYMBOLS[currencyCode] ?? "";
  const formatted = amountMajor.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`.trim();
};

const matchesIntent = (utterance: string) => {
  const normalized = utterance.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (ADD_BUDGET_PREFIX.test(normalized.slice(0, 80))) {
    return true;
  }
  if (MONEY_FIRST_PATTERN.test(normalized)) {
    return true;
  }
  if (normalized.includes("budget") || normalized.includes("envelope")) {
    return true;
  }
  if (/\b(add|allocate|put|move|log|record|track)\b/.test(normalized)) {
    return true;
  }
  return false;
};

const buildDescription = (
  category: string | undefined,
  merchant: string | undefined
) => {
  if (category && merchant) {
    return `${titleCase(category)} at ${merchant}`;
  }
  if (category) {
    return titleCase(category);
  }
  if (merchant) {
    return merchant;
  }
  return "This entry";
};

export const planDeterministicAddBudget = (
  utterance: string,
  snapshot: MindExperienceSnapshot
): DeterministicPlan | null => {
  if (!utterance || !utterance.trim()) {
    return null;
  }

  if (GROUP_KEYWORDS.test(utterance)) {
    return null;
  }

  const amount = extractAmount(utterance);
  const intentSignal = matchesIntent(utterance);

  if (!amount || !intentSignal) {
    return null;
  }

  const category = extractCategory(utterance, amount);
  const merchant = extractMerchant(utterance);
  const budget = resolveBudget(utterance, snapshot);

  const description = buildDescription(category, merchant);
  const budgetTitle = budget.title ?? "Home Budget";
  const amountDisplay = formatAmountDisplay(
    amount.major,
    amount.currency,
    snapshot.budget.currency
  );

  const confidenceBase = 0.65;
  const confidence =
    confidenceBase +
    (budget.matchedExisting ? 0.1 : 0) +
    (category ? 0.05 : 0) +
    (merchant ? 0.05 : 0);
  const boundedConfidence = Math.max(0.45, Math.min(confidence, 0.92));

  const amountMinor = amount.minor;
  if (!(amountMinor > 0)) {
    return null;
  }

  const intent: MindIntent = {
    tool: "add_budget_entry",
    input: {
      budgetId: budget.id ?? snapshot.budget.activeBudgetId ?? undefined,
      amountMinor,
      merchant: merchant ?? null,
      note: description,
      occurredOn: null,
    },
  };

  const template =
    "Should I add {{amount}} to {{budget}} for {{description}}?";
  const editableMessage: MindEditableMessage = {
    template,
    fields: [
      {
        key: "amount",
        label: "Amount",
        value: amountDisplay,
        fieldType: "amount",
      },
      {
        key: "budget",
        label: "Budget name",
        value: budgetTitle,
        fieldType: "budget",
      },
      {
        key: "description",
        label: "Description",
        value: description,
        fieldType: "description",
      },
    ],
  };

  const message = template
    .replace("{{amount}}", amountDisplay)
    .replace("{{budget}}", budgetTitle)
    .replace("{{description}}", description);

  return {
    intent,
    confidence: Number(boundedConfidence.toFixed(2)),
    message,
    editableMessage,
  };
};
