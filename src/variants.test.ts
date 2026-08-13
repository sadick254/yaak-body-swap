import type { Context } from "@yaakapp/api";
import { describe, expect, test } from "vitest";
import { deleteVariant, listVariants, saveVariant } from "./variants";

function fakeStoreCtx() {
  const stored = new Map<string, unknown>();
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
  } as unknown as Context;
  return { ctx, stored };
}

describe("variant store", () => {
  test("lists no variants for an unknown request", async () => {
    const { ctx } = fakeStoreCtx();
    expect(await listVariants(ctx, "req_1")).toEqual({});
  });

  test("round-trips a snapshot under its name", async () => {
    const { ctx } = fakeStoreCtx();
    const snapshot = { body: { text: '{"a":1}' }, bodyType: "application/json" };
    const { replaced } = await saveVariant(ctx, "req_1", "minimal", snapshot);
    expect(replaced).toBe(false);
    expect(await listVariants(ctx, "req_1")).toEqual({ minimal: snapshot });
  });

  test("reports a replace when saving under an existing name", async () => {
    const { ctx } = fakeStoreCtx();
    await saveVariant(ctx, "req_1", "minimal", { body: { text: "a" }, bodyType: "text/plain" });
    const { replaced } = await saveVariant(ctx, "req_1", "minimal", {
      body: { text: "b" },
      bodyType: "text/plain",
    });
    expect(replaced).toBe(true);
    expect((await listVariants(ctx, "req_1")).minimal?.body).toEqual({ text: "b" });
  });

  test("keeps requests isolated from each other", async () => {
    const { ctx } = fakeStoreCtx();
    await saveVariant(ctx, "req_1", "minimal", { body: { text: "a" }, bodyType: "text/plain" });
    expect(await listVariants(ctx, "req_2")).toEqual({});
  });

  test("deletes one variant and keeps the rest", async () => {
    const { ctx } = fakeStoreCtx();
    await saveVariant(ctx, "req_1", "minimal", { body: { text: "a" }, bodyType: "text/plain" });
    await saveVariant(ctx, "req_1", "full", { body: { text: "b" }, bodyType: "text/plain" });
    expect(await deleteVariant(ctx, "req_1", "minimal")).toBe(true);
    expect(Object.keys(await listVariants(ctx, "req_1"))).toEqual(["full"]);
  });

  test("drops the store row when the last variant is deleted", async () => {
    const { ctx, stored } = fakeStoreCtx();
    await saveVariant(ctx, "req_1", "minimal", { body: { text: "a" }, bodyType: "text/plain" });
    await deleteVariant(ctx, "req_1", "minimal");
    expect(stored.size).toBe(0);
  });

  test("reports false for a name that was never saved", async () => {
    const { ctx } = fakeStoreCtx();
    expect(await deleteVariant(ctx, "req_1", "minimal")).toBe(false);
  });
});
