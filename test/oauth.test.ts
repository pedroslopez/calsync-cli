import assert from "assert/strict";
import test from "node:test";
import { buildHeadlessAuthMessage, extractCodeFromInput, formatAuthFailure } from "../src/lib/oauth";

test("buildHeadlessAuthMessage includes the auth URL", () => {
  const url = "https://accounts.google.com/o/oauth2/v2/auth?foo=bar";
  const message = buildHeadlessAuthMessage(url);

  assert.ok(message.includes(url), "message should contain the full auth URL");
  assert.ok(message.includes("No browser detected"), "message should explain why it is shown");
  assert.ok(message.includes("Copy the FULL URL"), "message should instruct user to copy the redirect URL");
});

test("extractCodeFromInput: extracts code from a full redirect URL", () => {
  const redirectUrl =
    "http://localhost:3000/oauth2callback?code=4%2F0AfJohXnABC123&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar";
  const code = extractCodeFromInput(redirectUrl);
  assert.equal(code, "4/0AfJohXnABC123");
});

test("extractCodeFromInput: accepts a raw auth code string", () => {
  const rawCode = "4/0AfJohXnABC123_-xyz";
  const code = extractCodeFromInput(rawCode);
  assert.equal(code, rawCode);
});

test("extractCodeFromInput: returns null for empty input", () => {
  assert.equal(extractCodeFromInput(""), null);
  assert.equal(extractCodeFromInput("   "), null);
});

test("extractCodeFromInput: returns null for input with spaces (not a URL or code)", () => {
  assert.equal(extractCodeFromInput("not a code or url"), null);
});

test("formatAuthFailure explains invalid_grant", () => {
  const message = formatAuthFailure({
    response: {
      data: {
        error: "invalid_grant",
        error_description: "Bad Request",
      },
    },
  });

  assert.match(message, /invalid_grant/);
  assert.match(message, /expired/);
  assert.match(message, /calsync auth add/);
});

test("formatAuthFailure explains access_denied", () => {
  const message = formatAuthFailure({
    response: { data: { error: "access_denied" } },
  });

  assert.match(message, /denied/i);
  assert.match(message, /Allow/);
});

test("formatAuthFailure explains redirect_uri_mismatch", () => {
  const message = formatAuthFailure({
    response: { data: { error: "redirect_uri_mismatch" } },
  });

  assert.match(message, /redirect URI/i);
  assert.match(message, /Google Cloud Console/);
});

test("formatAuthFailure uses error_description for unknown errors", () => {
  const message = formatAuthFailure({
    response: { data: { error: "some_error", error_description: "Something went wrong" } },
  });

  assert.match(message, /Something went wrong/);
});

test("formatAuthFailure falls back to message property", () => {
  const message = formatAuthFailure({ message: "network timeout" });
  assert.match(message, /network timeout/);
});
