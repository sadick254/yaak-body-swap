import type { PluginDefinition } from "@yaakapp/api";
import { listVariants, saveVariant } from "./variants";

export const plugin: PluginDefinition = {
  httpRequestActions: [
    {
      label: "Save Body as Variant",
      icon: "pin",
      async onSelect(ctx, { httpRequest }) {
        const existing = Object.keys(await listVariants(ctx, httpRequest.id));
        const rawName = await ctx.prompt.text({
          id: "body-variants.save",
          title: "Save Body as Variant",
          label: "Variant name",
          placeholder: "e.g. minimal, full-payload, invalid-email",
          description:
            existing.length > 0
              ? `Saving under an existing name updates it. Existing: ${existing.join(", ")}`
              : undefined,
          required: true,
        });
        const name = rawName?.trim();
        if (!name) return;

        const { replaced } = await saveVariant(ctx, httpRequest.id, name, {
          body: httpRequest.body,
          bodyType: httpRequest.bodyType,
        });
        await ctx.toast.show({
          color: "success",
          icon: "check",
          message: `${replaced ? "Updated" : "Saved"} body variant "${name}"`,
        });
      },
    },
    {
      label: "Switch Body Variant",
      icon: "chevron_down",
      async onSelect(ctx, { httpRequest }) {
        const variants = await listVariants(ctx, httpRequest.id);
        const names = Object.keys(variants).sort((a, b) => a.localeCompare(b));
        if (names.length === 0) {
          await ctx.toast.show({
            color: "notice",
            icon: "info",
            message: "No body variants saved for this request yet",
          });
          return;
        }

        const values = await ctx.prompt.form({
          id: "body-variants.switch",
          title: "Switch Body Variant",
          description:
            "Replaces the current body. Save it as a variant first if you want to keep it.",
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
        if (name == null || snapshot === undefined) return;

        await ctx.httpRequest.update({
          id: httpRequest.id,
          body: snapshot.body,
          bodyType: snapshot.bodyType,
        });
        await ctx.toast.show({
          color: "success",
          icon: "check",
          message: `Switched body to variant "${name}"`,
        });
      },
    },
    {
      label: "Send Body Variant",
      icon: "copy",
      async onSelect(ctx, { httpRequest }) {
        const variants = await listVariants(ctx, httpRequest.id);
        const names = Object.keys(variants).sort((a, b) => a.localeCompare(b));
        if (names.length === 0) {
          await ctx.toast.show({
            color: "notice",
            icon: "info",
            message: "No body variants saved for this request yet",
          });
          return;
        }

        const values = await ctx.prompt.form({
          id: "body-variants.send",
          title: "Send Body Variant",
          description:
            "Sends a copy of this request with the chosen body. The request itself is left untouched.",
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
        if (name == null || snapshot === undefined) return;

        const response = await ctx.httpRequest.send({
          httpRequest: {
            ...httpRequest,
            body: snapshot.body,
            bodyType: snapshot.bodyType,
          },
        });
        if (response.error != null) {
          await ctx.toast.show({
            color: "danger",
            icon: "alert_triangle",
            message: `Body variant "${name}" failed: ${response.error}`,
          });
          return;
        }
        await ctx.toast.show({
          color: response.status < 400 ? "success" : "warning",
          icon: response.status < 400 ? "check" : "alert_triangle",
          message: `Sent body variant "${name}" — HTTP ${response.status}`,
        });
      },
    },
  ],
};
