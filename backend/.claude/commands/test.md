# Run Tests

Run tests and auto-debug any failures.

**CRITICAL RULE:** When running any test, MUST auto-debug failures:
1. Run the test
2. Immediately check console output if test fails
3. Analyze the failure
4. Fix the issue
5. Re-run the test
6. Iterate until test passes

**Available test types:**
- Backend: `cd backend && bundle exec rspec`
- Frontend: `cd frontend && npm test`
- E2E: `cd frontend && npx playwright test`
- Bug Hunter Tests: Run via API or UI

**Usage:** Specify which tests to run.