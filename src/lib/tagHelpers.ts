const TAG_PATTERN = /#[0-9A-Za-z][0-9A-Za-z_-]*/g;

const cleanTag = (raw: string) => raw.replace(/^#+/, "").trim();

const normalise = (raw: string) => cleanTag(raw).toLowerCase();

/**
 * Extracts hashtag tokens like `#travel` from arbitrary input text.
 * Returns the cleaned tags without the prepended `#` while preserving casing.
 */
export const extractTagsFromText = (input?: string | null) => {
  if (typeof input !== "string" || !input.trim()) {
    return [];
  }
  const matches = input.match(TAG_PATTERN) ?? [];
  return dedupeTags(matches.map((token) => token.slice(1)));
};

/**
 * Deduplicates and cleans multiple tag sources.
 */
export const dedupeTags = (sources: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of sources) {
    if (!raw) {
      continue;
    }
    const cleaned = cleanTag(raw);
    if (!cleaned) {
      continue;
    }
    const normalized = normalise(cleaned);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(cleaned);
  }
  return result;
};

/**
 * Combines multiple tag arrays, cleaning and deduping them by case-insensitive match.
 */
export const mergeTagLists = (...lists: Array<Array<string | null | undefined>>) =>
  dedupeTags(lists.flat());
