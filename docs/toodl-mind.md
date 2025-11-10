# Toodl Mind scaffold

This introduces the first slices of the “Toodl Mind” experience so any surface in the app can delegate natural-language work to a central brain.

## High-level architecture

- `src/app/api/mind/ask/route.ts` exposes a single POST endpoint that receives a `MindRequest` and returns a `MindResponse`.
- `src/lib/mind/orchestrator.ts` orchestrates requests. It gathers state snapshots, asks the planner for an intent, and (optionally) executes domain tools.
- `src/lib/mind/snapshot.ts` fetches cross-product context (expense groups, budget month, flow plans, recent shares) so prompts land on current data.
- `src/lib/mind/planner.ts` picks an intent. It uses OpenAI if `OPENAI_API_KEY` is present; otherwise, it falls back to a lightweight rule-based heuristic.
- `src/components/mind/ToodlMindProvider.tsx` adds a React context (`useToodlMind`) that any component can call to talk to the `/api/mind/ask` route.

## Environment configuration

Set the following in your hosting environment (or `.env.local` for local development):

- `OPENAI_API_KEY` – required to enable the OpenAI planner. If missing, Toodl Mind falls back to a rule-based plan that still returns structured intents.
- `OPENAI_MIND_MODEL` (optional) – override the default OpenAI model (`gpt-4o-mini`).

No other secrets are pulled; Firestore usage relies on the existing client SDK configuration (`src/lib/firebase.ts`).

## Client usage

Wrap the app with `ToodlMindProvider` (already done in `src/app/layout.tsx`). Consumers can then call:

```tsx
const { ask, pending, history } = useToodlMind();

await ask({
  utterance: "Add $30 to groceries",
  contextHints: { budgetId },
  user: { userId, email, timezone },
});
```

- If `user` is omitted, make sure to call `setIdentity()` once to prime the provider.
- The context stores request history, pending state, and the last response so UI can surface confirmations or follow-up prompts.

## Execution gaps / TODOs

The orchestrator currently stops after planning. It returns `needs_confirmation` by default, and the executor stub marks each tool as unimplemented. When ready:

1. Map expense intents to a concrete group ID, then call `addExpense()` with correctly constructed splits.
2. Translate budget intents into ledger entries and write via `saveBudgetMonth()`.
3. Slot Flow intents into the appropriate `FlowPlan` and persist with `overwriteFlowTasks()` or `saveFlowPlan()`.

Each tool should update the snapshot (or request a refresh) before replying so the assistant can reflect the latest state.

## Extending the planner

- Expand `trimSnapshot()` or tweak the prompt to include additional domains (journal, scratchpad).
- Add explicit tool schemas in the OpenAI payload once the execution layer is ready, enabling reliable function-calling instead of free-form JSON.
- Layer in guardrails such as confidence thresholds; if the planner is unsure, keep `autoExecute` off and ask the user for clarification.

## Linear classifier workflow

Parsing now routes through a small TF-IDF + logistic regression classifier before heuristics run. This keeps chit-chat out of the deterministic rules and nudges them toward the most likely intent.

1. Labeled data lives in `data/mind_classifier/data.jsonl` (`text`, `label`, and optional `intent` that should match `MindIntent['tool']`). Add as many synthetic variations as you like.
2. Train (and regenerate JSON weights) with `python3 scripts/mind_classifier/train_classifier.py`. Install requirements once via `python3 -m pip install scikit-learn pandas joblib`.
3. The script emits joblib artifacts plus manual JSON to `src/lib/mind/classifier/models/`. Those JSON files are imported directly by the browser inference helper in `src/lib/mind/classifier/index.ts`.
4. `RuleBasedMindPlanner` consumes `classifyUtterance()` to (a) short-circuit non-commands and (b) prioritize the matching heuristic. Debug traces show the probability and predicted intent so we can inspect routing decisions.

When the training data changes, rerun the script and commit the regenerated JSON so the client bundle stays in sync.

### Token slot classifier

Expense parsing now also runs a token-level classifier to pull structured spans (group names, merchants/notes, payer hints) directly from the utterance.

1. Examples live in `data/mind_classifier/token_examples.jsonl` with parallel `tokens`/`labels` arrays. Labels follow a light BIO scheme: `B_GROUP`, `I_GROUP`, `B_MERCHANT`, `B_PAYER`, `B_NOTE`, etc. Add more sequences to teach the model new phrasings.
2. Train with `python3 scripts/mind_classifier/train_token_classifier.py`. This fits a multinomial logistic regression over hand-crafted token features and exports `token_manual.json`.
3. At runtime, `src/lib/mind/classifier/tokenClassifier.ts` rebuilds the DictVectorizer features, does the softmax, and merges contiguous spans. `planDeterministicAddExpense` consumes these slots before running its fuzzy matching so regexes are no longer the sole source of truth for `groupName`, `paidByHint`, or descriptive text.
4. The extracted tokens (and their probabilities) are appended to the planner debug trace, so you can inspect how span predictions influence downstream matching.

## Testing ideas

- Mock the `/api/mind/ask` route with Vercel’s test client or `supertest` to ensure identity validation, error handling, and planner fallbacks behave.
- Add parser unit tests for the rule-based planner so we can evolve heuristics without regression.
- Include storybook or local UI experiments that drive the provider to validate end-to-end flows.
