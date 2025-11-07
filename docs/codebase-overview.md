# Toodl Codebase Reference

[Users & Auth] ─┐
│
v
┌─────────────────────────────────────────────────────────────────┐
│ Next.js App Router (src/app) │
│ • Landing + Split (page.tsx, expense_splitter.tsx) │
│ • Vertical apps: /budget, /journal, /flow, /scratch-pad, etc. │
└─────────────────────────────────────────────────────────────────┘
│
v
┌─────────────────────────────────────────────────────────────────┐
│ Shared UI + State (src/components, src/lib) │
│ • AppTopBar/AppUserMenu, feature panels, dialogs │
│ • Firebase service layer, currency/finance helpers, types │
└─────────────────────────────────────────────────────────────────┘
│
v
┌─────────────────────────────────────────────────────────────────┐
│ Firebase / Firestore data │
│ • groups, budgets, journals, flow plans, shared links │
│ • accessed via firebaseUtils, budgetService, etc. │
└─────────────────────────────────────────────────────────────────┘
│
v
┌─────────────────────────────────────────────────────────────────┐
│ Toodl Mind Stack │
│ • Client context & launcher (ToodlMindProvider, Launcher) │
│ • Identity bridge + auth │
│ • API route /api/mind/ask │
│ • Orchestrator → Snapshot → Planner/Rules → (future tools) │
└─────────────────────────────────────────────────────────────────┘



---

## 1. App-Level Architecture

- **Root layout (`src/app/layout.tsx`)** – wraps every page with `ToodlMindProvider`, the Firebase-aware `MindIdentityBridge`, the floating `ToodlMindLauncher`, and a shared footer. This makes the conversational assistant available everywhere.
- **App Router structure** – each vertical lives under `src/app/<product>` with an `page.tsx` entry and supporting UI/logic in `src/components/<product>`. Shared informational pages (`about`, `faq`, `privacy`, etc.) sit alongside the product routes.

---

## 2. Shared Component & Service Layer

- **UI shell**: `AppTopBar` + `AppUserMenu` (`src/components/AppTopBar.tsx`, `src/components/AppUserMenu.tsx`) provide branded headers, role-aware navigation, and cross-app jump links. They’re reused across expense, budget, journal, and sign-in gates.
- **Core utilities (`src/lib`)**:
  - `firebase.ts` boots the client SDK; `firebaseUtils.ts` abstracts groups, expenses, settlements.
  - Domain services like `budgetService.ts`, `journalService.ts`, `flowService.ts`, `shareService.ts` encapsulate Firestore queries/mutations.
  - Helpers for currency math (`currency.ts`, `currency_core.ts`), finance calculations (`financeUtils.ts`), IDs, avatars, and user utilities are shared across experiences.
- **Types (`src/types`)** centralize domain models (groups, budgets, flows, shares, mind intents). Keeping them aligned with Firestore documents prevents drift between features.

---

## 3. Feature Verticals

### Split (`src/app/page.tsx`, `src/app/expense_splitter.tsx`, `src/components/ExpensesPanel.tsx`)
- The landing page doubles as the expense experience. When a session or anon identity is present, it renders `ExpenseSplitter`; otherwise it shows the marketing hero plus identity/onboarding flows.
- `ExpenseSplitter` orchestrates wizard steps (group details → expenses), tracks settlements, manages anonymous identities, and passes down memoized maps to `ExpensesPanel`.
- `ExpensesPanel` handles form state, receipt uploads, splits (percentage/weight), and interacts with Firestore via `addExpense`, `updateExpense`, `deleteExpense`.

### Pulse (`src/app/budget`, `src/components/budget/BudgetExperience.tsx`)
- Heavy use of React state + effects to hydrate budgets, months, and metadata. Auth is required (guarding branch at `src/components/budget/BudgetExperience.tsx:2428`), but the redesigned gate now shows the top bar and cross-app menu for signed-out visitors.
- Writes to Firestore through `budgetService` helpers; debounced persistence ensures ledger changes sync without spamming writes.

### Story (`src/app/journal`, `src/components/journal/JournalExperience.tsx`)
- Similar pattern: gating for signed-in users, guiding steps to create entries, browse history, and share read-only views.
- Uses `journalService` for CRUD, `AppTopBar`/`AppUserMenu` for consistent shell, and “sign-in required” branch now keeps the top navigation visible (`src/components/journal/JournalExperience.tsx:796`).

### Flow / Scratch / Orbit
- Each vertical follows the same template: route-level entry under `src/app/<product>`, UI logic in `src/components/<product>`, and data access via dedicated services under `src/lib`.

---

## 4. Data & Firebase Integration

- **Firestore collections**: groups (with nested expenses + settlements), budgets, journals, flow plans, shared links, etc.
- **Access patterns**:
  - Expense + group operations via `firebaseUtils.ts`.
  - Budgets via `budgetService.ts` (month snapshots, metadata, sharing).
  - Journal entries via `journalService.ts`.
  - Flow plans + tasks via `flowService.ts`.
- These services hide Firestore specifics (converters, server timestamps, batch operations) so components remain declarative.

---

## 5. Toodl Mind Deep Dive

Refer to `docs/toodl-mind.md` for the product brief—here’s how the code implements it:

### 5.1 Client Context & Launcher
- **`ToodlMindProvider` (`src/components/mind/ToodlMindProvider.tsx`)** exposes `useToodlMind`, tracking identity, pending state, last response, and conversation history. `ask()` posts to `/api/mind/ask` and records request/response turns.
- **`MindIdentityBridge` (`src/components/mind/MindIdentityBridge.tsx`)** listens to Firebase auth changes and seeds the provider with the current user (id/email/displayName/timezone). It intentionally ignores `null` events to avoid clobbering guest identities.
- **`ToodlMindLauncher` (`src/components/mind/ToodlMindLauncher.tsx`)** is the floating UI: opens a sheet, captures utterances, shows assistant replies, handles “confirm & execute” flows, and injects context hints (like `intentOverride` or `autoExecute`) for follow-up calls.

### 5.2 API Endpoint
- **`src/app/api/mind/ask/route.ts`** receives `MindRequest`, validates JSON, and delegates to `ToodlMindOrchestrator`. Errors are normalized (`status: "failed"`) so the client can surface them uniformly.

### 5.3 Orchestrator & Execution (`src/lib/mind/orchestrator.ts`)
- Validates identity, builds a context snapshot, optionally applies overrides from `contextHints`, and asks the planner for an intent.
- Respects `autoExecute` hints; otherwise returns `needs_confirmation` so the UI can present editable templates.
- Implements three executors today:
  - `executeAddExpense` – finds the best-matching group, validates participants, and calls `addExpense`.
  - `executeAddBudgetEntry` – loads the current month, appends a ledger entry, and persists via `saveBudgetMonth`.
  - `executeAddFlowTask` – ensures a flow plan exists and appends a new task.
  - A “summarize” tool returns cached snapshot info without write operations.

### 5.4 Snapshot Builder (`src/lib/mind/snapshot.ts`)
- Pulls contextual data before planning:
  - Expense groups + recent expenses + balances (leveraging `firebaseUtils`, `financeUtils`, and currency helpers).
  - Budget metadata + selected month (with heuristics for `budgetId`/`month` hints).
  - Flow plans/task queues.
  - Shared links, orbit items, etc.
- Hints in `MindRequest.contextHints` can narrow the scope (`groupId`, `budgetId`, `month`).

### 5.5 Planner (`src/lib/mind/planner.ts` + `src/lib/mind/rules/*`)
- Defaults to a rule-based planner unless `OPENAI_API_KEY` is configured.
- Heuristics parse amounts (`$45` → `amountMinor`), merchants (`at Trader Joe’s`), targets (`for ski trip group`), and scheduling hints.
- Rule modules (`addExpenseRule.ts`, `addBudgetRule.ts`, `addFlowTaskRule.ts`) capture domain-specific phrases; the planner falls back to a summary intent when it can’t infer a supported action.
- The planner returns an intent + message + optional editable template so the UI can let the user tweak fields before execution.

### 5.6 Types & Future Hooks (`src/lib/mind/types.ts`, `docs/toodl-mind.md`)
- `MindRequest`, `MindIntent`, `MindResponse`, `MindToolExecution`, etc., define the contract between UI, API, planner, and executor.
- TODOs in the docs outline upcoming work: integrating OpenAI function calling, expanding snapshots to more domains, and hardening executors.

---

## 6. Putting It Together

1. **User signs in (or continues as a guest)** on the landing page (`src/app/page.tsx`). `MindIdentityBridge` mirrors that identity into `ToodlMindProvider`.
2. **Feature surfaces** (Split, Pulse, Story, Flow, Orbit) render with shared chrome (`AppTopBar`/`AppUserMenu`). Data flows through service helpers into Firebase.
3. **Toodl Mind** can be launched anywhere:
   - UI sends an utterance via `useToodlMind().ask`.
   - API builds a fresh snapshot and plans an intent.
   - Executors call the same service layer the UI would use, so Mind-driven actions stay consistent with manual ones.

---

## 7. Suggested Reading Order

1. `src/app/page.tsx` – see how sessions, anon identities, and vertical routing work.
2. `src/app/expense_splitter.tsx` + `src/components/ExpensesPanel.tsx` – representative feature.
3. `src/lib/firebaseUtils.ts`, `budgetService.ts`, `journalService.ts` – data helpers.
4. `docs/toodl-mind.md` → `src/components/mind/*` → `src/app/api/mind/ask/route.ts` → `src/lib/mind/*` – end-to-end Toodl Mind flow.

---

## 8. Quick File Reference

- Root shell: `src/app/layout.tsx`
- Expense experience: `src/app/page.tsx`, `src/app/expense_splitter.tsx`, `src/components/ExpensesPanel.tsx`
- Budget experience: `src/app/budget/page.tsx`, `src/components/budget/BudgetExperience.tsx`
- Journal experience: `src/app/journal/page.tsx`, `src/components/journal/JournalExperience.tsx`
- Shared chrome: `src/components/AppTopBar.tsx`, `src/components/AppUserMenu.tsx`
- Firebase services: `src/lib/firebaseUtils.ts`, `src/lib/budgetService.ts`, `src/lib/journalService.ts`, `src/lib/flowService.ts`
- Mind stack: `src/components/mind/*`, `src/app/api/mind/ask/route.ts`, `src/lib/mind/*`, `docs/toodl-mind.md`



