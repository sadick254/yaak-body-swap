import type { Context, HttpRequest, JsonPrimitive } from "@yaakapp/api";
import { describe, expect, test } from "vitest";
import { plugin } from "./index";
import { listVariants, saveVariant } from "./variants";

type FormValues = { [key: string]: JsonPrimitive } | null;

function fakeCtx(prompts: { text?: string | null; form?: FormValues } = {}) {
  const stored = new Map<string, unknown>();
  const toasts: Array<{ message: string }> = [];
  const updates: Array<Partial<HttpRequest>> = [];
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
    },
  } as unknown as Context;
  return { ctx, toasts, updates, formCalls };
}

function action(label: string) {
  const found = plugin.httpRequestActions?.find((a) => a.label === label);
  if (!found) throw new Error(`no action labeled "${label}"`);
  return found;
}

const request = {
  id: "req_1",
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
  test("writes the chosen snapshot back onto the request", async () => {
    const { ctx, updates } = fakeCtx({ form: { variant: "empty" } });
    await saveVariant(ctx, "req_1", "empty", { body: { text: "{}" }, bodyType: "application/json" });
    await action("Switch Body Variant").onSelect(ctx, { httpRequest: request });
    expect(updates).toEqual([
      { id: "req_1", body: { text: "{}" }, bodyType: "application/json" },
    ]);
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
