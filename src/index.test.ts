import type { Context, HttpRequest, HttpResponse, JsonPrimitive } from "@yaakapp/api";
import { describe, expect, test } from "vitest";
import { plugin } from "./index";
import { listVariants, saveVariant } from "./variants";

type FormValues = { [key: string]: JsonPrimitive } | null;

function fakeCtx(
  prompts: { text?: string | null; form?: FormValues } = {},
  response: Partial<HttpResponse> = { status: 200, error: null },
) {
  const stored = new Map<string, unknown>();
  const toasts: Array<{ message: string }> = [];
  const updates: Array<Partial<HttpRequest>> = [];
  const sends: Array<{ httpRequest: Partial<HttpRequest> }> = [];
  const formCalls: unknown[] = [];
  const ctx = {
    store: {
      async get(key: string) {
        return stored.get(key);
      },
      async set(key: string, value: unknown) {
        stored.set(key, value);
      },
      async delete(key: string) {
        return stored.delete(key);
      },
    },
    toast: {
      async show(toast: { message: string }) {
        toasts.push(toast);
      },
    },
    prompt: {
      async text() {
        return prompts.text ?? null;
      },
      async form(args: unknown) {
        formCalls.push(args);
        return prompts.form ?? null;
      },
    },
    httpRequest: {
      async update(args: Partial<HttpRequest>) {
        updates.push(args);
        return args;
      },
      async send(args: { httpRequest: Partial<HttpRequest> }) {
        sends.push(args);
        return response as HttpResponse;
      },
    },
  } as unknown as Context;
  return { ctx, toasts, updates, sends, formCalls };
}

function action(label: string) {
  const found = plugin.httpRequestActions?.find((a) => a.label === label);
  if (!found) throw new Error(`no action labeled "${label}"`);
  return found;
}

// Carries the fields a real request has beyond the body pair: the update()
// assertions rely on them to tell "full model" apart from a bare partial.
const request = {
  id: "req_1",
  workspaceId: "wk_1",
  folderId: null,
  name: "Create user",
  method: "POST",
  url: "https://api.example.com/users",
  headers: [{ name: "X-Trace", value: "1", enabled: true }],
  body: { text: '{"email":"a@b.c"}' },
  bodyType: "application/json",
} as unknown as HttpRequest;

describe("Save Body as Variant", () => {
  test("snapshots the current body under the prompted name", async () => {
    const { ctx, toasts } = fakeCtx({ text: "minimal" });
    await action("Save Body as Variant").onSelect(ctx, { httpRequest: request });
    expect(await listVariants(ctx, "req_1")).toEqual({
      minimal: { body: { text: '{"email":"a@b.c"}' }, bodyType: "application/json" },
    });
    expect(toasts[0]?.message).toContain('Saved body variant "minimal"');
  });

  test("does nothing when the prompt is cancelled", async () => {
    const { ctx, toasts } = fakeCtx({ text: null });
    await action("Save Body as Variant").onSelect(ctx, { httpRequest: request });
    expect(await listVariants(ctx, "req_1")).toEqual({});
    expect(toasts).toEqual([]);
  });
});

describe("Switch Body Variant", () => {
  test("writes the whole request back with the chosen snapshot", async () => {
    const { ctx, updates } = fakeCtx({ form: { variant: "empty" } });
    await saveVariant(ctx, "req_1", "empty", { body: { text: "{}" }, bodyType: "application/json" });
    await action("Switch Body Variant").onSelect(ctx, { httpRequest: request });
    // The full model matters: the app deserializes update() args with serde
    // defaults and overwrites every column, so a partial blanks the request.
    expect(updates).toEqual([
      { ...request, body: { text: "{}" }, bodyType: "application/json" },
    ]);
  });

  test("treats an untouched dialog as picking the preselected first variant", async () => {
    // The app's form dialog only records inputs the user touches: it renders
    // the select's defaultValue but returns {} when confirmed as-is.
    const { ctx, updates } = fakeCtx({ form: {} });
    await saveVariant(ctx, "req_1", "b-full", { body: { text: "b" }, bodyType: "text/plain" });
    await saveVariant(ctx, "req_1", "a-min", { body: { text: "a" }, bodyType: "text/plain" });
    await action("Switch Body Variant").onSelect(ctx, { httpRequest: request });
    expect(updates).toEqual([{ ...request, body: { text: "a" }, bodyType: "text/plain" }]);
  });

  test("toasts instead of prompting when nothing is saved", async () => {
    const { ctx, toasts, updates, formCalls } = fakeCtx();
    await action("Switch Body Variant").onSelect(ctx, { httpRequest: request });
    expect(toasts[0]?.message).toContain("No body variants");
    expect(formCalls).toEqual([]);
    expect(updates).toEqual([]);
  });

  test("does nothing when the dialog is cancelled", async () => {
    const { ctx, updates } = fakeCtx({ form: null });
    await saveVariant(ctx, "req_1", "empty", { body: { text: "{}" }, bodyType: "application/json" });
    await action("Switch Body Variant").onSelect(ctx, { httpRequest: request });
    expect(updates).toEqual([]);
  });
});

describe("Send Body Variant", () => {
  test("sends a copy with the chosen body and leaves the request untouched", async () => {
    const { ctx, sends, updates, toasts } = fakeCtx({ form: { variant: "empty" } });
    await saveVariant(ctx, "req_1", "empty", { body: { text: "{}" }, bodyType: "application/json" });
    await action("Send Body Variant").onSelect(ctx, { httpRequest: request });
    expect(sends).toEqual([
      { httpRequest: { ...request, body: { text: "{}" }, bodyType: "application/json" } },
    ]);
    expect(updates).toEqual([]);
    expect(toasts[0]?.message).toBe('Sent body variant "empty" — HTTP 200');
  });

  test("reports a transport error instead of a status", async () => {
    const { ctx, toasts } = fakeCtx(
      { form: { variant: "empty" } },
      { status: 0, error: "dns lookup failed" },
    );
    await saveVariant(ctx, "req_1", "empty", { body: { text: "{}" }, bodyType: "application/json" });
    await action("Send Body Variant").onSelect(ctx, { httpRequest: request });
    expect(toasts[0]?.message).toBe('Body variant "empty" failed: dns lookup failed');
  });

  test("toasts instead of prompting when nothing is saved", async () => {
    const { ctx, toasts, sends, formCalls } = fakeCtx();
    await action("Send Body Variant").onSelect(ctx, { httpRequest: request });
    expect(toasts[0]?.message).toContain("No body variants");
    expect(formCalls).toEqual([]);
    expect(sends).toEqual([]);
  });

  test("does nothing when the dialog is cancelled", async () => {
    const { ctx, sends } = fakeCtx({ form: null });
    await saveVariant(ctx, "req_1", "empty", { body: { text: "{}" }, bodyType: "application/json" });
    await action("Send Body Variant").onSelect(ctx, { httpRequest: request });
    expect(sends).toEqual([]);
  });
});

describe("Delete Body Variant", () => {
  test("removes the chosen snapshot and nothing else", async () => {
    const { ctx, toasts, updates } = fakeCtx({ form: { variant: "empty" } });
    await saveVariant(ctx, "req_1", "empty", { body: { text: "{}" }, bodyType: "application/json" });
    await saveVariant(ctx, "req_1", "full", { body: { text: "{...}" }, bodyType: "application/json" });
    await action("Delete Body Variant").onSelect(ctx, { httpRequest: request });
    expect(Object.keys(await listVariants(ctx, "req_1"))).toEqual(["full"]);
    expect(updates).toEqual([]);
    expect(toasts[0]?.message).toBe('Deleted body variant "empty"');
  });

  test("does nothing when the dialog is cancelled", async () => {
    const { ctx, toasts } = fakeCtx({ form: null });
    await saveVariant(ctx, "req_1", "empty", { body: { text: "{}" }, bodyType: "application/json" });
    await action("Delete Body Variant").onSelect(ctx, { httpRequest: request });
    expect(Object.keys(await listVariants(ctx, "req_1"))).toEqual(["empty"]);
    expect(toasts).toEqual([]);
  });
});
