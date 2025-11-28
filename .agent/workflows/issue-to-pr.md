---
description: Read a GitHub issue, create an issue branch, implement a fix, run tests, and open a PR.
---

1. Ask the user for:
   - The GitHub issue number (e.g. 123).
   - An optional short slug for the branch/PR title (e.g. "null-profile-crash").

2. Open the GitHub issue in THIS repository that matches the given issue number.
   - Carefully read the title, body, comments, and any linked stack traces or screenshots.
   - Summarize:
     - The problem.
     - Expected behavior.
     - Reproduction steps (if given).
     - Acceptance criteria (what “done” means).
   - Show this summary and a rough implementation plan to the user and wait for confirmation before making any code changes.

3. Ensure the local repo is clean before proceeding.
   - Check for uncommitted changes.
   - If there are uncommitted changes, show them to the user and ask whether to:
     - stash them,
     - commit them separately, or
     - abort the workflow.

4. Switch to the main branch and pull the latest changes.
   // turbo
5. Run git checkout main
   // turbo
6. Run git pull origin main

7. Create and switch to a new issue branch using the pattern issue/[issue-number]-[slug].
   - Example: issue/123-null-profile-crash
   // turbo
8. Run git checkout -b issue/[issue-number]-[slug]

9. Locate the most relevant code and tests for this issue.
   - Use search and code navigation to find the modules, functions, and tests that likely need changes.
   - Identify which files to edit and what kinds of changes are required (e.g., bug fix in function X, adding validation, updating API contract, etc.).
   - Propose a concrete implementation plan that lists:
     - Files to change.
     - High-level code changes.
     - New or updated tests.
   - Show this plan to the user and get explicit approval before editing code.

10. Implement the fix according to the approved plan.
    - Make minimal, focused changes that directly address the issue.
    - Follow the existing project style and conventions.
    - Avoid unrelated refactors.
    - Update or add tests that clearly demonstrate the bug is fixed or the feature works as requested.

11. Run the project tests using the provided test command (if it is not "none").
    // turbo
12. Run [test-command]

13. If tests fail:
    - Read the failure output carefully.
    - Diagnose whether the issue is with:
      - the new changes,
      - flaky or pre-existing tests,
      - or environment/setup problems.
    - Attempt small, scoped fixes limited to this issue.
    - Re-run tests after each attempt.
    - If you cannot get to a passing state without large or risky changes, stop and:
      - summarize what you tried,
      - provide the failing logs,
      - and ask the user how to proceed.

14. Once tests pass (or if no tests are available and the user has agreed to proceed), prepare the commit.
    - Show the diff of all changes to the user.
    - Ask for any final adjustments (naming, comments, small refactors).

15. Stage and commit the changes with a clear message referencing the issue number.
    // turbo
16. Run git status
    // turbo
17. Run git add .
    // turbo
18. Run git commit -m "Fix #[issue-number]: [short-summary]"

19. Push the branch to origin.
    // turbo
20. Run git push -u origin issue/[issue-number]-[slug]

21. Open a GitHub Pull Request targeting main from this branch.
    - Use the GitHub integration or CLI in this workspace.
    - Title: "[Auto] Fix #[issue-number]: [issue-title-or-short-summary]".
    - Body:
      - Link to the issue (e.g. "Fixes #[issue-number]").
      - Short summary of the fix.
      - List of key files changed.
      - Test command that was run and its result.
      - Any known limitations or follow-up work.

22. Present the PR URL and a concise recap to the user, including:
    - What changed.
    - How to reproduce the original problem and confirm the fix.
    - Any caveats, risks, or next steps.
