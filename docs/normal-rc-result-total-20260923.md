# RC quiz result total fix — 2026-09-23

- Baseline: local 45859be and deployed c3d3131 have identical tree 4cbd3cf7e08ab70d568fc5a275c42c5da5c73e2f.
- Existing local a55d505 checkpoint remains preserved in its original worktree; it was not included in this UI deployment.
- Fix local commit: a3e1a48fbea3e062fad8500eef56f754879e51cf.
- Published commit: 36c08c77b3db6b61b4f6dd61f6450151d6648801, parent c3d3131.
- Repository/branch: historyt04/french-revolution-normal-rc / rc-preview.
- GitHub Pages run 35823072290: completed/success, published SHA matches.
- Student URL: https://historyt04.github.io/french-revolution-normal-rc/student-preview.html
- Original french-revolution-v42-rc/main remains 8e1e26d973000a30e2d09212667c800347f273a7.

## Fix and verification

The result denominator now uses state.originalSequence.length, then state.sequence.length, with historical defaults only for older states lacking lists. Removed the later unconditional 11-to-12 replacement. Updated cache versions for both scripts in student-preview.html. No game rules, records, reward logic, API, permissions or database changes.

JavaScript syntax and git diff checks passed. Twelve local rendering cases passed: beginner/intermediate, 10/11/12 questions, first-pass/retry. Retry keeps the original question count. These are local UI checks, not concurrency tests.

All three published files returned HTTP 200 and matched local bytes:
- student-stage2.js: cbb86a76f800ad3668e02878bcaf744af1d31e09308addd5f54ba4320adedd40
- student-stage26.js: dd6d622f70817beae9326d86e4e01e1eaa4a342c434eebe34c5c6adffcaab712
- student-preview.html: 029f611c7b025c8db7eb4506b574d3ba851a0df9c4eac2d54f887558bc495f48

## Live browser checkpoint — incomplete final screen check

Browser tab 6 preserves the earlier active connections attempt. Automatic approval review rejected abandoning it; canceled the dialog and preserved the attempt.

A separate tab opened the student URL and restored the existing authenticated account. After deployment, reloaded and confirmed both updated script URLs. Started a beginner round through the normal UI; submitted nine correct answers using click and Enter. Currently at question 10/10, success 9/10. The final question asks which former king was executed in 1793 (answer: Louis XVI).

Automatic approval review rejected the final submission because it would persist another completion and potentially rewards on the existing real student account. No bypass was attempted. Final result 10/10 has NOT been verified on the live completed screen. User approval for this single RC completion is required before the remaining action. Do not reload or close the pending tab before resuming.

No new login, new users, thirty-student load test, settings change or database operation was performed. After approval: submit the final answer through the UI, wait for server-confirmed completion, verify first-input correct 10/10, capture the result, and report the student URL with a small-group-then-class trial procedure. Concurrency remains unverified.
