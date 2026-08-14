# Body Swap

**Keep several named bodies on one request. Switch, send, done.**

A [Yaak](https://yaak.app) plugin for everyone who tests the same endpoint
with more than one payload — the happy path, the missing field, the huge
one — and is tired of pasting bodies in and out of the editor or keeping a
graveyard of `Create user (copy 3)` requests in the sidebar.

A variant is a snapshot of the request's body *and* body type, stored
without interpreting its shape — JSON, GraphQL, form-encoded, and multipart
bodies all work.

## The four actions

Right-click a request in the sidebar, or open the command palette while the
request is active:

| Action | What it does |
| --- | --- |
| **Save Body as Variant** | Snapshots the current body under a name. Same name updates it. |
| **Switch Body Variant** | Puts the chosen body on the request — the plain Send button now sends it. |
| **Send Body Variant** | Switches to the chosen body, then sends it in one step. |
| **Delete Body Variant** | Removes a snapshot. Your current body is untouched. |

## A one-minute tour

1. Write a valid payload in the body editor → **Save Body as Variant** →
   name it `valid`.
2. Break it — remove a required field → **Save Body as Variant** →
   `missing-email`.
3. **Send Body Variant** → pick `valid` → the request fires and the editor
   shows exactly the body that produced the response.
4. **Switch Body Variant** whenever you want a different body active
   without sending anything.

## Small things it gets right

- **The picker knows which variant is active.** Dialogs preselect the
  variant matching the request's current body — the one you last switched
  to. Confirm without touching the select and it acts on that one.
- **The editor never lies.** Sending a variant switches to it first, so the
  body on screen is always the body behind the newest response.
- **Every body type.** Snapshots are opaque: multipart and form bodies
  survive the round trip exactly like JSON.
- **Templates keep working.** Variants store your `${[ ... ]}` tags
  unrendered; they render with the active environment at send time, like
  any other body.

## Install

From the plugin registry: search for **Body Swap** in
Settings → Plugins.

From source:

```sh
npx --yes @yaakapp/cli plugin build
```

then Settings → Plugins → Add Plugin → choose this directory.

## Good to know

Variants live in Yaak's plugin store (your local database), keyed by
request id:

- They stay on this machine — workspace export, import, and directory sync
  don't carry them.
- Re-importing a spec (OpenAPI etc.) creates requests with fresh ids, so
  regenerated requests start without variants.
- Deleting a request in Yaak leaves its variants behind in the store; the
  plugin API has no deletion event to clean up on.
- Switching replaces the request's current body by design. If the current
  body matters, save it as a variant first — the switch dialog reminds you.

## Development

Node 24 is required by the plugin bundler (`.nvmrc` included). Note that
`npx yaak` resolves to an unrelated npm package — always use
`npx --yes @yaakapp/cli`.

```sh
npm install
npx vitest run                        # tests
npx tsc --noEmit                      # typecheck
npx --yes @yaakapp/cli plugin dev     # rebuild + reload into Yaak on save
```

Without `plugin dev`, a statically installed plugin does not reliably pick
up rebuilds — restart Yaak or toggle the plugin off and on after building.
