import type { Context, HttpRequest } from "@yaakapp/api";
import { type BodySnapshot, listVariants } from "./variants";

// Order-insensitive JSON rendering so body objects compare by content,
// not by the key order a serialization round-trip happens to produce.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const entries = Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(obj[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sameBody(a: BodySnapshot, b: BodySnapshot): boolean {
  return a.bodyType === b.bodyType && canonical(a.body) === canonical(b.body);
}

/**
 * Ask the user to pick one of the request's saved variants. Returns null when
 * nothing is saved (after telling the user so) or the dialog is cancelled.
 *
 * Preselects the variant whose snapshot equals the request's current body —
 * the "active" one is inferred from content rather than tracked as state, so
 * editing the body simply makes no variant match and the first name wins.
 */
export async function pickVariant(
  ctx: Context,
  httpRequest: HttpRequest,
  dialog: { id: string; title: string; description: string; confirmText?: string },
): Promise<{ name: string; snapshot: BodySnapshot } | null> {
  const variants = await listVariants(ctx, httpRequest.id);
  const names = Object.keys(variants).sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    await ctx.toast.show({
      color: "notice",
      icon: "info",
      message: "No body variants saved for this request yet",
    });
    return null;
  }

  const current: BodySnapshot = { body: httpRequest.body, bodyType: httpRequest.bodyType };
  const active = names.find((name) => {
    const snapshot = variants[name];
    return snapshot != null && sameBody(snapshot, current);
  });
  const preselected = active ?? names[0];

  const values = await ctx.prompt.form({
    ...dialog,
    inputs: [
      {
        type: "select",
        name: "variant",
        label: "Variant",
        defaultValue: preselected,
        options: names.map((name) => ({ label: name, value: name })),
      },
    ],
  });
  // A cancelled dialog resolves null; a confirmed one only carries values
  // the user touched, so an untouched select means whatever was preselected.
  if (values == null) return null;
  const name = typeof values.variant === "string" ? values.variant : preselected;
  const snapshot = name == null ? undefined : variants[name];
  if (name == null || snapshot === undefined) return null;
  return { name, snapshot };
}
