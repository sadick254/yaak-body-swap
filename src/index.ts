import type { PluginDefinition } from "@yaakapp/api";
import { pickVariant } from "./picker";
import { deleteVariant, listVariants, saveVariant } from "./variants";

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
        const picked = await pickVariant(ctx, httpRequest.id, {
          id: "body-variants.switch",
          title: "Switch Body Variant",
          description:
            "Replaces the current body. Save it as a variant first if you want to keep it.",
        });
        if (picked == null) return;

        await ctx.httpRequest.update({
          id: httpRequest.id,
          body: picked.snapshot.body,
          bodyType: picked.snapshot.bodyType,
        });
        await ctx.toast.show({
          color: "success",
          icon: "check",
          message: `Switched body to variant "${picked.name}"`,
        });
      },
    },
    {
      label: "Send Body Variant",
      icon: "copy",
      async onSelect(ctx, { httpRequest }) {
        const picked = await pickVariant(ctx, httpRequest.id, {
          id: "body-variants.send",
          title: "Send Body Variant",
          description:
            "Sends a copy of this request with the chosen body. The request itself is left untouched.",
        });
        if (picked == null) return;

        const response = await ctx.httpRequest.send({
          httpRequest: {
            ...httpRequest,
            body: picked.snapshot.body,
            bodyType: picked.snapshot.bodyType,
          },
        });
        if (response.error != null) {
          await ctx.toast.show({
            color: "danger",
            icon: "alert_triangle",
            message: `Body variant "${picked.name}" failed: ${response.error}`,
          });
          return;
        }
        await ctx.toast.show({
          color: response.status < 400 ? "success" : "warning",
          icon: response.status < 400 ? "check" : "alert_triangle",
          message: `Sent body variant "${picked.name}" — HTTP ${response.status}`,
        });
      },
    },
    {
      label: "Delete Body Variant",
      icon: "trash",
      async onSelect(ctx, { httpRequest }) {
        const picked = await pickVariant(ctx, httpRequest.id, {
          id: "body-variants.delete",
          title: "Delete Body Variant",
          description:
            "Deletes the saved snapshot. The request's current body is not affected.",
          confirmText: "Delete",
        });
        if (picked == null) return;

        await deleteVariant(ctx, httpRequest.id, picked.name);
        await ctx.toast.show({
          color: "success",
          icon: "trash",
          message: `Deleted body variant "${picked.name}"`,
        });
      },
    },
  ],
};
