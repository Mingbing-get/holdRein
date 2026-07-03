---
name: bugfix
description: Use for diagnosing and fixing a reported defect after the expected behavior is fully understood.
---

# Bug Fix

Before changing code, confirm the expected behavior, observed behavior,
reproduction conditions, and success criteria. Read workspace files and existing
tests for context. If any part is unclear and cannot be established from the
repository, stop and ask the user instead of assuming.

## Diagnose before fixing

1. Reproduce the defect with the narrowest reliable command or scenario.
2. Trace the data and control flow from the symptom to its source.
3. Form a concrete root-cause hypothesis and verify it against evidence.
4. Write a focused regression test that demonstrates the expected behavior.
5. Run the test and confirm it fails for the diagnosed reason.
6. Make the smallest implementation change that fixes the root cause.
7. Run the regression test, relevant neighboring tests, and required static checks.
8. Refactor only after the tests pass, keeping behavior unchanged.

Do not patch symptoms, weaken assertions, or change tests merely to match current
behavior. Record the root cause and the evidence that the regression test would
have caught it.

Before you or any subagent writes TypeScript or JavaScript, install and use the
`ts-standards` skill.
