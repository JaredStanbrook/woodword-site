// worker/views/admin/Generate.tsx

import { DEFAULT_AI_MODEL } from "@server/services/ai-product";
import { buttonPrimary, inputClass } from "@views/shop/parts";
import { AdminShell } from "./Shell";

const EXAMPLE =
  "A modern Scandinavian-style solid oak dining table. A thick rectangular top, slightly tapered legs, minimalist. Seats six comfortably. Warm oak finishes and a clean, architectural presentation.";

export const GeneratePage = ({
  aiEnabled,
  prompt,
  error,
}: {
  aiEnabled: boolean;
  prompt?: string;
  error?: string;
}) => (
  <AdminShell title="Create from a prompt" back={{ href: "/admin/products", label: "Products" }}>
    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        method="post"
        action="/admin/products/generate"
        class="space-y-4"
        hx-boost="false"
        data-generate-form
      >
        <label for="prompt" class="text-sm font-medium">
          Describe the piece
        </label>
        <textarea
          id="prompt"
          name="prompt"
          rows={8}
          required
          maxlength={4000}
          placeholder={EXAMPLE}
          class={`${inputClass} h-auto text-base leading-relaxed`}
        >
          {prompt ?? ""}
        </textarea>
        {error ? (
          <p
            class="rounded-sm border-2 border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {aiEnabled ? null : (
          <p class="rounded-sm border-2 bg-muted p-3 text-sm">
            Set the <code class="font-mono">ANTHROPIC_API_KEY</code> secret in the Cloudflare
            dashboard (Settings → Variables and Secrets, type Secret) to turn this on. Until then,
            create products with the form.
          </p>
        )}
        <button
          type="submit"
          class={buttonPrimary}
          disabled={!aiEnabled}
          onclick="if (!this.form.checkValidity()) return true; this.disabled = true; this.querySelector('[data-label]').textContent = 'Drafting… this can take a minute'; this.form.submit(); return false;"
        >
          <i data-lucide="sparkles" class="h-4 w-4"></i>
          <span data-label>Draft the product</span>
        </button>
      </form>
      <aside class="space-y-3 text-sm text-muted-foreground">
        <p class="font-medium text-foreground">What you get</p>
        <p>
          A <strong class="font-medium text-foreground">draft</strong>: name and copy, category,
          standard and limit dimensions, a component model with resize rules, pricing, timber and
          finish options, and a page layout, palette and typeface chosen for the brief.
        </p>
        <p>
          It is checked like a hand-entered product — the components must fill the stated size — and
          saved as a draft for you to review. Nothing is published.
        </p>
        <p>
          Then: build the model in Blender to match the components, upload the GLB, add photographs,
          and publish.
        </p>
        <p class="text-xs">Model: {DEFAULT_AI_MODEL} (override with the AI_MODEL variable).</p>
      </aside>
    </div>
  </AdminShell>
);
