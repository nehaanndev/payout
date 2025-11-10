import { Expense, Member } from "@/types/group";
import { BudgetMonth } from "@/types/budget";
import { FlowPlan, FlowTask } from "@/types/flow";
import { SharedLink } from "@/types/share";

export type MindUserIdentity = {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  timezone?: string | null;
};

export type MindDebugTrace = {
  phase: "planner" | "group_resolution" | "budget_resolution" | "flow_resolution";
  description: string;
  data?: Record<string, unknown>;
};

export type MindExperienceSnapshot = {
  expenses: {
    groups: Array<{
      id: string;
      name: string;
      currency: string;
      outstandingBalanceMinor: number;
      youOweMinor: number;
      owedToYouMinor: number;
      recentExpenses: Expense[];
      members: Member[];
      memberCount: number;
      primaryMemberId?: string | null;
    }>;
  };
  budget: {
    activeBudgetId?: string | null;
    month?: BudgetMonth | null;
    netPlannedMinor?: number;
    netSpentMinor?: number;
    currency?: string | null;
    monthKey?: string | null;
    documents?: Array<{
      id: string;
      title: string;
      currency?: string | null;
    }>;
  };
  flow: {
    today?: FlowPlan | null;
    tomorrow?: FlowPlan | null;
    upcomingTasks?: FlowTask[];
  };
  shares: {
    recent: SharedLink[];
  };
};

export type MindToolName =
  | "add_expense"
  | "add_budget_entry"
  | "add_flow_task"
  | "summarize_state";

export type MindIntent =
  | {
      tool: "add_expense";
      input: {
        groupName?: string;
        amountMinor?: number;
        currency?: string;
        description?: string;
        paidByHint?: string;
        splitStrategy?: "even" | "custom";
        participants?: string[];
        occurredAt?: string;
      };
    }
  | {
      tool: "add_budget_entry";
      input: {
        budgetId?: string;
        requestedBudgetName?: string;
        category?: string;
        amountMinor?: number;
        merchant?: string | null;
        note?: string | null;
        occurredOn?: string | null;
      };
    }
  | {
      tool: "add_flow_task";
      input: {
        title?: string;
        durationMinutes?: number;
        category?: string;
        scheduledFor?: string;
        startsAt?: string | null;
      };
    }
  | {
      tool: "summarize_state";
      input: {
        focus?: "expenses" | "budget" | "flow" | "shares" | "overview";
      };
    };

export type MindRequest = {
  user: MindUserIdentity;
  utterance: string;
  contextHints?: Record<string, unknown>;
};

export type MindToolExecution = {
  name: MindToolName;
  input: Record<string, unknown>;
  success: boolean;
  resultSummary?: string;
  error?: string;
};

export type MindEditableMessageField = {
  key: string;
  label: string;
  value: string;
  fieldType?: "amount" | "budget" | "description" | string;
};

export type MindEditableMessage = {
  template: string;
  fields: MindEditableMessageField[];
};

export type MindResponse =
  | {
      status: "needs_confirmation";
      intent: MindIntent;
      message: string;
      editableMessage?: MindEditableMessage;
      debug?: MindDebugTrace[];
    }
  | {
      status: "executed";
      message: string;
      actions: MindToolExecution[];
      snapshot?: MindExperienceSnapshot;
      editableMessage?: MindEditableMessage;
      debug?: MindDebugTrace[];
    }
  | {
      status: "failed";
      error: string;
      debug?: MindDebugTrace[];
    };
