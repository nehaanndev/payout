---
description: Plan, execute, and report on UI tests for a specific feature using a browser subagent.
---

1. **Planning Phase**:
   - Analyze the requested feature and the codebase to understand the requirements and current implementation.
   - Create a `test_plan.md` artifact listing all intended test cases (happy path, edge cases, error states).
   - Use `notify_user` to request review of `test_plan.md`.
   - Iterate on the plan based on user feedback until approved. **Do not proceed until you have explicit approval.**

2. **Testing Phase**:
   - Once the plan is approved, start the `browser_subagent` to execute the tests.
   - **TaskName**: "UI Testing [Feature Name]"
   - **Task**: Provide a comprehensive prompt to the subagent including:
     - The approved `test_plan.md` content.
     - Instructions to perform full CRUD operations. Also do some exploratory things in the UI to discover new features and test them.
     - Instructions to explore edge cases.
     - Instructions to record every bug found with reproduction steps.
   - Wait for the subagent to complete.

3. **Reporting Phase**:
   - Compile findings from the subagent's report into a `bugs.md` artifact.
   - detailed description of each bug.
   - Reproduction steps.
   - Severity.
   - Use `notify_user` to request review of `bugs.md`.
   - Iterate on `bugs.md` based on user feedback until approved. **Do not proceed until you have explicit approval.**

4. **Issue Creation Phase**:
   - For every approved bug in `bugs.md`:
     - Construct a `gh issue create` command.
     - Include the bug title, body (description + repro steps), and appropriate labels (e.g., `bug`, `ui`).
   - Execute the commands using `run_command` (or confirm with user if appropriate, but the goal is automation).
   - Summarize the created issues to the user.