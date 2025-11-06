import {
  MindEditableMessage,
  MindExperienceSnapshot,
  MindIntent,
} from "../types";

type DeterministicPlan = {
  intent: MindIntent;
  confidence: number;
  message: string;
  editableMessage?: MindEditableMessage;
};

type DurationMatch = {
  minutes: number;
  text: string;
};

type TimeMatch = {
  value: string;
  text: string;
};

type DateMatch = {
  value: string;
  display: string;
  text: string;
};

const FLOW_INTENT_REGEX =
  /\b(schedule|plan|block|set(?:\s+up)?|add|create|book|log)\b/i;
const FLOW_CONTEXT_REGEX =
  /\b(task|meeting|call|session|block|calendar|slot|flow|orbit|agenda|workout|focus)\b/i;
const MONEY_REGEX = /[$€£¥₹]\s*\d|\b\d+(?:[.,]\d{1,2})?\s*(dollars?|usd|eur|gbp|cad|aud|inr)\b/i;

const TITLE_CAPTURE_REGEX =
  /^\s*(?:please\s+)?(?:can you|could you|would you|will you|let's|lets|need to|help me|please)?\s*(?:please\s+)?(?:schedule|plan|block(?:\s+off)?|set(?:\s+up)?|add|create|put|book|log)\s+(?:a\s+|an\s+|the\s+)?(?<title>[a-z0-9&'()\-.\s]{2,120}?)(?=\s+(?:for|on|at|@|start|starting|beginning|lasting|go|runs)\b|[.,!?]|$)/i;

const DURATION_REGEXPS = [
  /\b(?:for|lasting|lasts|runs?\s*for|around|about)\s+(?<value>\d+(?:\.\d+)?)\s*(?<unit>minutes?|minute|min|mins|hours?|hour|hrs?|hr)\b/gi,
  /\b(?<value>\d+(?:\.\d+)?)\s*-\s*(?<unit>minute|min)\b/gi,
  /\b(?<value>\d+(?:\.\d+)?)\s*(?<unit>minutes?|minute|min|mins|hours?|hour|hrs?|hr)\b/gi,
];

const AN_HOUR_REGEX = /\b(an|a)\s+hour\b/i;
const HALF_HOUR_REGEX = /\bhalf(?:\s+an?)?\s+hour\b/i;
const QUARTER_HOUR_REGEX = /\bquarter\s+hour\b/i;

const TIME_REGEXPS = [
  /\b(?:starts?\s+at|starting\s+at|beginning\s+at|at)\s+(?<hour>\d{1,2})(?::(?<minute>\d{2}))?\s*(?<meridiem>am|pm)?(?=[^\d]|$)/gi,
  /@\s*(?<hour>\d{1,2})(?::(?<minute>\d{2}))?\s*(?<meridiem>am|pm)?(?=[^\d]|$)/gi,
  /\b(?<hour>\d{1,2})(?::(?<minute>\d{2}))?\s*(?<meridiem>am|pm)(?=[^\d]|$)/gi,
];

const NOON_REGEX = /\b(?:at\s+)?(noon)\b/i;
const MIDNIGHT_REGEX = /\b(?:at\s+)?(midnight)\b/i;

const RELATIVE_DATE_REGEX = /\b(tomorrow|today|tonight)\b/i;
const ISO_DATE_REGEX = /\b(?:on\s+)?(\d{4}-\d{2}-\d{2})\b/i;
const SLASH_DATE_REGEX = /\b(?:on\s+)?(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/i;
const MONTH_DATE_REGEX =
  /\b(?:on\s+)?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?)\b/i;
const WEEKDAY_DATE_REGEX =
  /\b(?:on\s+)?(?:(next|this)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

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

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const matchesIntent = (utterance: string) => {
  const normalized = utterance.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (MONEY_REGEX.test(normalized)) {
    return false;
  }
  if (!FLOW_INTENT_REGEX.test(normalized)) {
    return false;
  }
  if (FLOW_CONTEXT_REGEX.test(normalized)) {
    return true;
  }
  if (
    /\b(?:orbit|flow|calendar|time block|timeblock|time-block)\b/.test(
      normalized
    )
  ) {
    return true;
  }
  return false;
};

const parseMinutes = (value: string, unit: string) => {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit.startsWith("hour") || normalizedUnit.startsWith("hr")) {
    return Math.round(numeric * 60);
  }
  return Math.round(numeric);
};

const extractDuration = (utterance: string): DurationMatch | null => {
  for (const regex of DURATION_REGEXPS) {
    regex.lastIndex = 0;
    const match = regex.exec(utterance);
    if (match?.groups?.value && match.groups.unit) {
      const minutes = parseMinutes(match.groups.value, match.groups.unit);
      if (minutes) {
        return {
          minutes,
          text: match[0],
        };
      }
    }
  }

  if (AN_HOUR_REGEX.test(utterance)) {
    const match = utterance.match(AN_HOUR_REGEX);
    if (match) {
      return { minutes: 60, text: match[0] };
    }
  }

  if (HALF_HOUR_REGEX.test(utterance)) {
    const match = utterance.match(HALF_HOUR_REGEX);
    if (match) {
      return { minutes: 30, text: match[0] };
    }
  }

  if (QUARTER_HOUR_REGEX.test(utterance)) {
    const match = utterance.match(QUARTER_HOUR_REGEX);
    if (match) {
      return { minutes: 15, text: match[0] };
    }
  }

  return null;
};

const normalizeTimeValue = (
  hours: number,
  minutes: number,
  meridiem?: string | null
) => {
  let hrs = hours;
  let mins = minutes;
  let suffix: string | null = null;

  if (meridiem) {
    const lower = meridiem.toLowerCase();
    suffix = lower;
    if (lower === "pm" && hrs < 12) {
      hrs += 12;
    } else if (lower === "am" && hrs === 12) {
      hrs = 0;
    }
  }

  if (hrs > 23 || mins > 59) {
    return null;
  }

  if (suffix) {
    const displayHour = ((hrs + 11) % 12) + 1;
    return `${displayHour}:${mins.toString().padStart(2, "0")}${suffix}`;
  }

  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
};

const extractTime = (utterance: string): TimeMatch | null => {
  for (const regex of TIME_REGEXPS) {
    regex.lastIndex = 0;
    const match = regex.exec(utterance);
    if (match?.groups?.hour) {
      const hour = Number.parseInt(match.groups.hour, 10);
      const minute = match.groups.minute
        ? Number.parseInt(match.groups.minute, 10)
        : 0;
      if (!Number.isFinite(hour) || hour <= 0) {
        continue;
      }
      const value = normalizeTimeValue(hour, minute, match.groups.meridiem);
      if (value) {
        return {
          value,
          text: match[0],
        };
      }
    }
  }

  const noonMatch = utterance.match(NOON_REGEX);
  if (noonMatch) {
    return {
      value: "12:00pm",
      text: noonMatch[0],
    };
  }

  const midnightMatch = utterance.match(MIDNIGHT_REGEX);
  if (midnightMatch) {
    return {
      value: "12:00am",
      text: midnightMatch[0],
    };
  }

  return null;
};

const ensureFourDigitYear = (year: number) => {
  if (year < 100) {
    return 2000 + year;
  }
  return year;
};

const toIsoDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return date.toISOString().slice(0, 10);
};

const parseSlashDate = (input: string, base: Date) => {
  const parts = input
    .split(/[/-]/)
    .map((part) => part.replace(/\D/g, ""))
    .filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const month = Number.parseInt(parts[0], 10);
  const day = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  let year = parts[2]
    ? ensureFourDigitYear(Number.parseInt(parts[2], 10))
    : base.getUTCFullYear();
  if (!Number.isFinite(year)) {
    year = base.getUTCFullYear();
  }
  return toIsoDate(year, month, day);
};

const MONTH_LOOKUP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const parseMonthDate = (input: string, base: Date) => {
  const match = input
    .trim()
    .replace(/\s+/g, " ")
    .match(
      /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{2,4}))?$/i
    );
  if (!match) {
    return null;
  }
  const month = MONTH_LOOKUP[match[1].toLowerCase()];
  const day = Number.parseInt(match[2], 10);
  const year = match[3]
    ? ensureFourDigitYear(Number.parseInt(match[3], 10))
    : base.getUTCFullYear();
  if (!month || !Number.isFinite(day)) {
    return null;
  }
  return toIsoDate(year, month, day);
};

const computeWeekdayDate = (
  prefix: string | undefined,
  weekday: string,
  base: Date
) => {
  const targetIndex = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  if (targetIndex === -1) {
    return null;
  }
  const baseIndex = base.getUTCDay();
  let offset = targetIndex - baseIndex;

  if (prefix === "next") {
    if (offset <= 0) {
      offset += 7;
    }
    offset += 7;
  } else if (prefix === "this") {
    if (offset < 0) {
      offset += 7;
    }
  } else {
    if (offset < 0) {
      offset += 7;
    }
  }

  const result = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + offset,
      12,
      0,
      0,
      0
    )
  );
  return result.toISOString().slice(0, 10);
};

const extractDate = (utterance: string): DateMatch | null => {
  const base = new Date();

  const relative = utterance.match(RELATIVE_DATE_REGEX);
  if (relative) {
    const keyword = relative[1].toLowerCase();
    const value =
      keyword === "tomorrow" ? "tomorrow" : keyword === "today" ? "today" : "today";
    const display =
      keyword === "tomorrow" ? "Tomorrow" : keyword === "today" ? "Today" : "Today";
    return {
      value,
      display,
      text: relative[0],
    };
  }

  const iso = utterance.match(ISO_DATE_REGEX);
  if (iso) {
    const value = iso[1];
    return {
      value,
      display: formatDateDisplay(value),
      text: iso[0],
    };
  }

  const slash = utterance.match(SLASH_DATE_REGEX);
  if (slash) {
    const value = parseSlashDate(slash[1], base);
    if (value) {
      return {
        value,
        display: formatDateDisplay(value),
        text: slash[0],
      };
    }
  }

  const month = utterance.match(MONTH_DATE_REGEX);
  if (month) {
    const cleaned = month[1].replace(/,\s*/g, ", ");
    const value = parseMonthDate(cleaned, base);
    if (value) {
      return {
        value,
        display: formatDateDisplay(value),
        text: month[0],
      };
    }
  }

  const weekday = utterance.match(WEEKDAY_DATE_REGEX);
  if (weekday) {
    const prefix = weekday[1]?.toLowerCase();
    const day = weekday[2].toLowerCase();
    if (prefix || weekday[0].toLowerCase().includes("on")) {
      const value = computeWeekdayDate(prefix, day, base);
      if (value) {
        return {
          value,
          display: formatDateDisplay(value),
          text: weekday[0],
        };
      }
    }
  }

  return null;
};

const removeSegments = (input: string, segments: string[]) => {
  let working = input;
  for (const segment of segments) {
    if (!segment) {
      continue;
    }
    const escaped = escapeRegExp(segment);
    const pattern = new RegExp(escaped, "i");
    working = working.replace(pattern, " ");
  }
  return normalizeWhitespace(working);
};

const TITLE_GENERIC_FILTER = new Set([
  "for",
  "with",
  "around",
  "about",
  "total",
  "start",
  "starting",
  "starts",
  "beginning",
  "runs",
  "lasting",
  "lasts",
  "at",
  "on",
  "to",
  "into",
  "in",
  "go",
]);

const cleanTitle = (
  utterance: string,
  matches: Array<DurationMatch | TimeMatch | DateMatch | null>
) => {
  const captured = utterance.match(TITLE_CAPTURE_REGEX);
  let working = captured?.groups?.title ?? utterance;

  working = working.replace(/\b(to|in|on|into)\s+(?:orbit|my\s+calendar|the\s+calendar|calendar)\b/gi, " ");
  working = working.replace(/\bto\s+orbit\b/gi, " ");

  const segments = matches
    .filter((value): value is DurationMatch | TimeMatch | DateMatch => Boolean(value))
    .map((value) => value.text);

  working = removeSegments(working, segments);

  working = working
    .replace(/\b(?:please|kindly|thanks)\b/gi, " ")
    .replace(/\b\d+(?:-|\s*)(?:minute|min|minutes)\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:hour|hours|hr|hrs)\b/gi, " ")
    .replace(/\b(?:for|start|starting|starts|beginning|total|around|about|go|runs|lasting|lasts)\b/gi, " ")
    .replace(/\btask\b(?=$|\s)/gi, " ")
    .replace(/[,.;:?!"']/g, " ");

  working = normalizeWhitespace(working);
  working = working.replace(/^(?:a|an|the)\s+/i, "");

  if (!working) {
    working = captured?.groups?.title ?? utterance;
  }

  working = normalizeWhitespace(working);

  return working ? titleCase(working) : null;
};

const formatDurationDisplay = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} hr${hours === 1 ? "" : "s"}`);
  }
  if (remaining > 0 || parts.length === 0) {
    parts.push(`${remaining} min${remaining === 1 ? "" : "s"}`);
  }
  return parts.join(" ");
};

function formatDateDisplay(value: string) {
  if (value === "today") {
    return "Today";
  }
  if (value === "tomorrow") {
    return "Tomorrow";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return titleCase(value);
  }
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const buildEditableMessage = (
  title: string,
  dateDisplay: string,
  timeValue: string,
  durationDisplay: string
): MindEditableMessage => {
  const templateParts = ["Schedule {{title}}"];
  if (dateDisplay) {
    templateParts.push("on {{date}}");
  }
  if (timeValue) {
    templateParts.push("at {{time}}");
  }
  if (durationDisplay) {
    templateParts.push("for {{duration}}");
  }
  const template = `${templateParts.join(" ")}?`.replace(/\s{2,}/g, " ").trim();

  return {
    template,
    fields: [
      {
        key: "title",
        label: "Title",
        value: title,
        fieldType: "title",
      },
      {
        key: "date",
        label: "Date",
        value: dateDisplay || "Today",
        fieldType: "date",
      },
      {
        key: "time",
        label: "Start time",
        value: timeValue || "Anytime",
        fieldType: "time",
      },
      {
        key: "duration",
        label: "Duration",
        value: durationDisplay,
        fieldType: "duration",
      },
    ],
  };
};

export const planDeterministicAddFlowTask = (
  utterance: string,
  _snapshot: MindExperienceSnapshot
): DeterministicPlan | null => {
  if (!utterance || !utterance.trim()) {
    return null;
  }

  if (!matchesIntent(utterance)) {
    return null;
  }

  const durationMatch = extractDuration(utterance);
  const timeMatch = extractTime(utterance);
  const dateMatch = extractDate(utterance);
  const title = cleanTitle(utterance, [durationMatch, timeMatch, dateMatch]);

  if (!title) {
    return null;
  }

  const durationMinutes = durationMatch?.minutes ?? 30;
  const scheduledFor = dateMatch?.value;
  const startsAt = timeMatch?.value;
  const dateDisplay = dateMatch?.display ?? "Today";
  const timeDisplay = startsAt ?? "Anytime";
  const durationDisplay = formatDurationDisplay(durationMinutes);

  const intent: MindIntent = {
    tool: "add_flow_task",
    input: {
      title,
      durationMinutes,
      scheduledFor: scheduledFor ?? undefined,
      startsAt: startsAt ?? undefined,
    },
  };

  const editableMessage = buildEditableMessage(
    title,
    dateDisplay,
    timeDisplay,
    durationDisplay
  );

  const details: string[] = [`"${title}"`];
  if (dateMatch) {
    details.push(`on ${dateMatch.display}`);
  }
  if (timeMatch) {
    details.push(`at ${timeDisplay}`);
  }
  if (durationMinutes) {
    details.push(`for ${durationDisplay}`);
  }

  const message = `Ready to schedule ${details.join(" ")}.`;

  const confidenceBase = 0.6;
  let confidence =
    confidenceBase +
    (durationMatch ? 0.15 : 0) +
    (dateMatch ? 0.1 : 0) +
    (timeMatch ? 0.05 : 0);

  const boundedConfidence = Math.max(
    0.4,
    Math.min(confidence, 0.92)
  );

  return {
    intent,
    confidence: Number(boundedConfidence.toFixed(2)),
    message,
    editableMessage,
  };
};
