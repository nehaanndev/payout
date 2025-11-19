import { classifyUtterance } from "./classifier/index";
import { planDeterministicAddBudget } from "./rules/addBudgetRule";
import { planDeterministicAddExpense } from "./rules/addExpenseRule";
import { planDeterministicAddFlowTask } from "./rules/addFlowTaskRule";
import {
  MindDebugTrace,
  MindEditableMessage,
  MindExperienceSnapshot,
  MindIntent,
  MindRequest,
} from "./types";

export type PlannerInput = {
  request: MindRequest;
  snapshot: MindExperienceSnapshot;
};

export type PlannerResult = {
  intent: MindIntent;
  message: string;
  confidence?: number;
  editableMessage?: MindEditableMessage;
  debugTrace?: MindDebugTrace[];
};

export interface MindPlanner {
  plan(input: PlannerInput): Promise<PlannerResult>;
}

// Looks for an explicit money amount inside the utterance text.
const parseCurrencyAmount = (utterance: string): number | undefined => {
  const match =
    utterance.match(/([\d]+(?:[.,]\d{1,2})?)(?=\s?(?:usd|dollars|\$))/i) ??
    utterance.match(/\$?\s*([\d]+(?:[.,]\d{1,2})?)/);
  if (!match) {
    return undefined;
  }
  const normalized = match[1].replace(",", "");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : undefined;
};

// Converts an amount in major units into minor/cents when available.
const toMinorUnits = (amount: number | undefined) =>
  typeof amount === "number" ? Math.round(amount * 100) : undefined;

// Extracts a group name hint such as "for ski trip" from the utterance.
const extractGroupName = (utterance: string) => {
  const forMatch = utterance.match(/for\s+(.+)/i);
  if (forMatch) {
    return forMatch[1].trim();
  }
  const inMatch = utterance.match(/in\s+group\s+([a-zA-Z0-9\s]+)/i);
  if (inMatch) {
    return inMatch[1].trim();
  }
  return undefined;
};

// Returns the merchant or note captured after an "at" qualifier.
const extractMerchantOrNote = (utterance: string) => {
  const atMatch = utterance.match(/at\s+([a-zA-Z0-9\s']+)/i);
  if (atMatch) {
    return atMatch[1].trim();
  }
  return undefined;
};

// Finds duration-related hints and normalizes to minutes.
const parseDurationMinutes = (utterance: string): number | undefined => {
  const minutesMatch = utterance.match(/(\d+)\s*(minutes|min)/i);
  if (minutesMatch) {
    return Number.parseInt(minutesMatch[1], 10);
  }
  const hoursMatch = utterance.match(/(\d+(?:\.\d+)?)\s*(hours|hrs|hour)/i);
  if (hoursMatch) {
    const hours = Number.parseFloat(hoursMatch[1]);
    if (Number.isFinite(hours)) {
      return Math.round(hours * 60);
    }
  }
  return undefined;
};

// Safe fallback intent that explains current capabilities.
const defaultSummarizeIntent: PlannerResult = {
  intent: {
    tool: "summarize_state",
    input: { focus: "overview" },
  },
  message:
    "I didn't understand that request. Right now, I can help with simple requests to add an expense to a budget or group, or add an item to your schedule. My capabilities will evolve over time.",
  confidence: 0.4,
  debugTrace: [
    {
      phase: "planner",
      description: "Fell back to summarize_state default",
    },
  ],
};

// Deterministic planner composed of handwritten rules.
class RuleBasedMindPlanner implements MindPlanner {
  // Evaluates the utterance against the rule set and returns an intent.
  async plan({ request, snapshot }: PlannerInput): Promise<PlannerResult> {
    const utterance = request.utterance ?? "";
    const normalized = utterance.toLowerCase();

    const classifier = classifyUtterance(utterance);
    const classifierTrace: MindDebugTrace = {
      phase: "planner",
      description: "Linear classifier routing result",
      data: {
        probCommand: Number(classifier.probCommand.toFixed(3)),
        threshold: 0.6,
        isCommand: classifier.isCommand,
        topIntent: classifier.topIntent?.label,
        topIntentProbability: classifier.topIntent
          ? Number(classifier.topIntent.probability.toFixed(3))
          : undefined,
      },
    };

    const attachClassifierTrace = (result: PlannerResult): PlannerResult => ({
      ...result,
      debugTrace: [classifierTrace, ...(result.debugTrace ?? [])],
    });

    if (!classifier.isCommand) {
      return attachClassifierTrace({
        ...defaultSummarizeIntent,
        message:
          "That request didn't sound like something I can execute yet. I can add expenses, log budget entries, or schedule Flow tasks.",
      });
    }

    type DeterministicRule = {
      tool: MindIntent["tool"];
      run: (
        utterance: string,
        snapshot: MindExperienceSnapshot
      ) => PlannerResult | null;
    };

    const deterministicRules: DeterministicRule[] = [
      { tool: "add_budget_entry", run: planDeterministicAddBudget },
      { tool: "add_expense", run: planDeterministicAddExpense },
      { tool: "add_flow_task", run: planDeterministicAddFlowTask },
    ];

    const predictedTool = classifier.topIntent?.label as MindIntent["tool"] | undefined;
    const orderedRules =
      predictedTool && deterministicRules.some((rule) => rule.tool === predictedTool)
        ? [
            ...deterministicRules.filter((rule) => rule.tool === predictedTool),
            ...deterministicRules.filter((rule) => rule.tool !== predictedTool),
          ]
        : deterministicRules;

    for (const rule of orderedRules) {
      const deterministicPlan = rule.run(utterance, snapshot);
      if (deterministicPlan) {
        return attachClassifierTrace(deterministicPlan);
      }
    }

    const amountMajor = parseCurrencyAmount(utterance);
    const merchant = extractMerchantOrNote(utterance);
    const durationMinutes = parseDurationMinutes(utterance);

    const mentionsSchedule =
      normalized.includes("schedule") ||
      normalized.includes("calendar") ||
      normalized.includes("flow") ||
      normalized.includes("plan day") ||
      normalized.includes("task for");

    const mentionsBudget =
      normalized.includes("budget") ||
      normalized.includes("category") ||
      normalized.includes("grocery") ||
      normalized.includes("envelope") ||
      normalized.includes("spending");

    if (durationMinutes || mentionsSchedule) {
      const debugTrace: MindDebugTrace[] = [
        {
          phase: "planner",
          description: "Heuristic matched Flow scheduling request",
          data: {
            durationMinutes,
            mentionsSchedule,
            utterance,
          },
        },
      ];
      return attachClassifierTrace({
        intent: {
          tool: "add_flow_task",
          input: {
            title: utterance,
            durationMinutes: durationMinutes ?? 30,
            scheduledFor: mentionsSchedule ? "today" : undefined,
            category: normalized.includes("yoga") ? "wellness" : undefined,
            startsAt: merchant ?? undefined,
          },
        },
        message: "Planning to add a Flow task based on your request.",
        confidence: 0.55,
        debugTrace,
      });
    }

    if (mentionsBudget) {
      const debugTrace: MindDebugTrace[] = [
        {
          phase: "planner",
          description: "Heuristic matched budget-related phrasing",
          data: {
            mentionsBudget,
            amountMajor,
            utterance,
          },
        },
      ];
      const input = {
        amountMinor: toMinorUnits(amountMajor),
        merchant: merchant ?? null,
        note: utterance,
      };
      return attachClassifierTrace({
        intent: {
          tool: "add_budget_entry",
          input,
        },
        message: "Looks like a budget entry. I'll prep it for your budget.",
        confidence: 0.5,
        debugTrace,
      });
    }

    if (amountMajor) {
      const debugTrace: MindDebugTrace[] = [
        {
          phase: "planner",
          description: "Heuristic matched expense entry",
          data: {
            amountMajor,
            merchant,
            utterance,
          },
        },
      ];
      return attachClassifierTrace({
        intent: {
          tool: "add_expense",
          input: {
            amountMinor: toMinorUnits(amountMajor),
            description: utterance,
            groupName: extractGroupName(utterance),
            paidByHint: merchant,
            splitStrategy: "even",
          },
        },
        message:
          "Interpreting this as a new expense for your groups. Ready when you are.",
        confidence: 0.45,
        debugTrace,
      });
    }

    return attachClassifierTrace({ ...defaultSummarizeIntent });
  }
}

type OpenAIPlan = {
  tool: MindIntent["tool"];
  input: Record<string, unknown>;
  message?: string;
  confidence?: number;
};

// Captures fenced ```json blocks so we can parse the tool selection.
const JSON_BLOCK_REGEX = /```json([\s\S]*?)```/i;

// Normalizes various fenced/unfenced formats down to raw JSON text.
const extractJson = (content: string): string => {
  const trimmed = content.trim();
  const fenced = trimmed.match(JSON_BLOCK_REGEX);
  if (fenced) {
    return fenced[1].trim();
  }
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/```/g, "").trim();
  }
  return trimmed;
};

// Model used when the environment does not override OPENAI_MIND_MODEL.
const defaultModel = "gpt-4o-mini";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class OpenAIMindPlanner implements MindPlanner {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = process.env.OPENAI_MIND_MODEL ?? defaultModel
  ) {}

  async plan(input: PlannerInput): Promise<PlannerResult> {
    const payload = this.buildPayload(input);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[mind] OpenAI response error", response.status, errorText);
      return defaultSummarizeIntent;
    }

    const result = await response.json();
    const content: string | undefined =
      result?.choices?.[0]?.message?.content ?? "";
    if (!content || typeof content !== "string") {
      return defaultSummarizeIntent;
    }

    let parsed: OpenAIPlan | null = null;
    try {
      parsed = JSON.parse(extractJson(content)) as OpenAIPlan;
    } catch (error) {
      console.error("[mind] failed to parse planner json", error, content);
      return defaultSummarizeIntent;
    }

    if (!parsed?.tool || !parsed?.input) {
      return defaultSummarizeIntent;
    }

    return {
      intent: {
        tool: parsed.tool,
        input: parsed.input as MindIntent["input"],
      } as MindIntent,
      message:
        parsed.message ??
        "LLM proposed an action. Review before we run it.",
      confidence: parsed.confidence ?? 0.6,
    };
  }

  private buildPayload({ request, snapshot }: PlannerInput) {
    return {
      model: this.model,
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Toodl Mind, an assistant that converts natural language requests into structured intents for expenses, budgets, and schedules. Respond ONLY with valid JSON describing the planned tool call.",
        },
        {
          role: "user",
          content: JSON.stringify({
            utterance: request.utterance,
            user: request.user,
            contextHints: request.contextHints,
            snapshot: trimSnapshot(snapshot),
          }),
        },
      ],
    };
  }
}

// Produces a pruned snapshot so prompts remain small.
const trimSnapshot = (snapshot: MindExperienceSnapshot) => ({
  expenses: {
    groups: snapshot.expenses.groups
      .slice(0, 3)
      .map((group) => ({
        ...group,
        recentExpenses: group.recentExpenses.slice(0, 3),
      })),
  },
  budget: {
    ...snapshot.budget,
    documents: snapshot.budget.documents?.slice(0, 5) ?? [],
  },
  flow: {
    today: snapshot.flow.today
      ? {
          ...snapshot.flow.today,
          tasks: snapshot.flow.today.tasks.slice(0, 5),
        }
      : null,
    upcomingTasks: (snapshot.flow.upcomingTasks ?? []).slice(0, 5),
  },
  shares: {
    recent: snapshot.shares.recent.slice(0, 5),
  },
});

export const createMindPlanner = (): MindPlanner => {
  //const apiKey = process.env.OPENAI_API_KEY;
  //if (apiKey) {
  //  return new OpenAIMindPlanner(apiKey);
  // }
  return new RuleBasedMindPlanner();
};
