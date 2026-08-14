import type { Context, HttpRequest } from "@yaakapp/api";

/**
 * A saved body is the opaque {body, bodyType} pair from the request model.
 * The shape of `body` depends on bodyType, so it is stored and restored
 * without interpretation. That is what keeps form and multipart bodies
 * working, not just text ones.
 */
export type BodySnapshot = {
  body: HttpRequest["body"];
  bodyType: HttpRequest["bodyType"];
};

export type VariantsByName = Record<string, BodySnapshot>;

// One store entry per request. ctx.store is already plugin-scoped; the
// prefix only leaves room for future non-variant keys.
const storeKey = (requestId: string) => `variants.${requestId}`;

export async function listVariants(ctx: Context, requestId: string): Promise<VariantsByName> {
  return (await ctx.store.get<VariantsByName>(storeKey(requestId))) ?? {};
}

export async function saveVariant(
  ctx: Context,
  requestId: string,
  name: string,
  snapshot: BodySnapshot,
): Promise<{ replaced: boolean }> {
  const variants = await listVariants(ctx, requestId);
  const replaced = name in variants;
  variants[name] = snapshot;
  await ctx.store.set(storeKey(requestId), variants);
  return { replaced };
}

export async function deleteVariant(
  ctx: Context,
  requestId: string,
  name: string,
): Promise<boolean> {
  const variants = await listVariants(ctx, requestId);
  if (!(name in variants)) return false;
  delete variants[name];
  // Drop the row entirely with the last variant, so deleted or abandoned
  // requests leave nothing behind in the plugin store.
  if (Object.keys(variants).length === 0) {
    await ctx.store.delete(storeKey(requestId));
  } else {
    await ctx.store.set(storeKey(requestId), variants);
  }
  return true;
}
