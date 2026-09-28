import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../lib/persona/state.ts";
import { onboardingGoals } from "../lib/persona/assessment-view.ts";

const live = { ai: true, voice: true, gmail: true };

test("fresh onboarding shows four open goals and unavailable Gmail distinctly", () => {
  const goals = onboardingGoals(initialState(), { ...live, gmail: false });
  assert.deepEqual(goals.map((goal) => goal.key), ["agent", "user", "gmail", "need"]);
  assert.deepEqual(goals.map((goal) => goal.status), ["open", "open", "unavailable", "open"]);
});

test("Gmail deferral and failed authorization are distinct", () => {
  const fresh = initialState();
  assert.equal(onboardingGoals({ ...fresh, gmail: "deferred" }, live)[2].status, "deferred");
  assert.equal(onboardingGoals({ ...fresh, gmail: "failed" }, live)[2].status, "failed");
});

test("verified email and captured task display bounded confirmed values", () => {
  const state = {
    ...initialState(),
    agentName: "Milo",
    userName: "Alex",
    gmail: "connected" as const,
    gmailEmail: "alex@example.com",
    need: "Draft a recruiter follow-up",
  };
  const goals = onboardingGoals(state, live);
  assert.deepEqual(goals.map((goal) => goal.status), ["complete", "complete", "complete", "complete"]);
  assert.equal(goals[2].value, "alex@example.com");
  assert.equal(goals[3].value, "Draft a recruiter follow-up");
});
