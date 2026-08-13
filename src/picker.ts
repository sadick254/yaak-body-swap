import type { Context } from "@yaakapp/api";
import { type BodySnapshot, listVariants } from "./variants";

/**
 * Ask the user to pick one of the request's saved variants. Returns null when
 * nothing is saved (after telling the user so) or the dialog is cancelled.
 */
export async function pickVariant(
  ctx: Context,
  requestId: string,
  dialog: { id: string; title: string; description: string; confirmText?: string },
): Promise<{ name: string; snapshot: BodySnapshot } | null> {
  const variants = await listVariants(ctx, requestId);
  const names = Object.keys(variants).sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    await ctx.toast.show({
      color: "notice",
      icon: "info",
      message: "No body variants saved for this request yet",
    });
    return null;
  }

  const values = await ctx.prompt.form({
    ...dialog,
    inputs: [
      {
        type: "select",
        name: "variant",
        label: "Variant",
        defaultValue: names[0],
        options: names.map((name) => ({ label: name, value: name })),
      },
    ],
  });
  const name = typeof values?.variant === "string" ? values.variant : null;
  const snapshot = name == null ? undefined : variants[name];
  if (name == null || snapshot === undefined) return null;
  return { name, snapshot };
}
