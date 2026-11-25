# vetrina-cli

**Chat only ever grows. A page is rewritten in place.**

An hour with a coding agent leaves you with a pile: what it did, what it explained at
length, the asides you dropped in while it was busy, the second task you started in the
same thread. All of it interleaved in the order it happened rather than the order it
matters, and none of it addressable.

A *vetrina* is a window your agents publish into. Each page is scoped to one task, and
every time the work moves the agent rewrites it in place, so it stays one screen and shows
the current state rather than the history of arriving at it.

```
npx vetrina-cli
```

That is the entire onboarding. It prints a URL and a QR code. Point your phone at it.

**Run it from anywhere, and run it once.** It does not care what directory you are in.
There is one window at `~/vetrina`, on one port, at one URL you bookmark once, and every
project publishes into it. Each subdirectory is a **space**, and the index filters by
space, so five projects are five chips rather than five tabs. If it is already running,
you do not need another.

## Teaching your agents to use it

```
npx skills add -g flaviolivolsi/vetrina
```

The skill tells an agent when a page beats a paragraph, which shape to reach for, and,
most of the time, to say it in two sentences and build nothing. It installs through the
[skills](https://github.com/vercel-labs/skills) ecosystem rather than a vetrina-specific
installer, so it lands wherever your tools keep skills instead of assuming you run one
particular agent.

If you run long sessions and an agent reports in chat anyway, add one line to that
project's `CLAUDE.md` or `AGENTS.md`, where standing context does not scroll away:

```
When you finish an audit, review, migration or investigation, publish a
vetrina page rather than a long chat report, unless the answer fits in
two sentences.
```

In testing that was not necessary once the skill's own wording was fixed.

## Publishing to it

Writing an HTML file into a directory is the whole API. No SDK, no client library, no
registration, no second file.

```
~/vetrina/<space>/<name>.html
```

The first path segment is the **space**, meaning whoever is publishing: a project, an agent, a
session. Files sitting flat at the root land in a space called `loose`. The index groups
and filters by it, which is why there is no author field anywhere: the directory already
carries that.

Anything that can write a file can publish. Claude Code, Codex, Cursor, Aider, a cron job,
a CI run, a shell script.

## What it does

- Serves `~/vetrina`, generating a **newest-first index** with per-space filter chips.
- **Live reload** over server-sent events, injected into every page. The agent rewrites a
  page as work lands and the tab in your hand updates without a refresh.
- **Binds to your tailnet if you have one, otherwise loopback.** Never `0.0.0.0`. There is
  no application-level authentication, so the bind address is the entire security model.
  A public bind is refused outright rather than warned about.

## Tailscale is optional

It is the nicest way to read the window from a phone, and it is not required.

- **With a tailnet**, vetrina binds it and prints a QR code. Scan it and the window is on
  your phone, from anywhere, with no port forwarding and nothing exposed to the internet.
- **Without one**, it binds `127.0.0.1` and says so. That works on the machine you are
  sitting at, which is enough if you never wanted the phone half.
- **To reach it from another device without a tailnet**, pass `--bind` with your LAN
  address. The startup message suggests the right one. Every device on that network can
  then read every page, so it is opt-in rather than the default, and it is a bad idea on
  shared wifi.

## Options

| | |
|---|---|
| `--root DIR` | where pages live (default `~/vetrina`) |
| `--port N` | port to serve on (default `7777`) |
| `--bind ADDR` | address to bind (default tailnet, else loopback) |
| `--no-qr` | do not print the QR code |

That is every option. There are no subcommands.

## What a page should be

One self-contained HTML file. No CDN, no external font, no network at render time, because it
gets read on a phone with no signal. Light and dark. Legible one-handed. State encoded in
form and not colour alone.

An optional kit ships with the daemon. Link it in one line:

```html
<link rel="stylesheet" href="/_vetrina/kit.css">
```

It is inlined at serve time, so a page saved from the browser or promoted into a repo is
still self-contained. Override any token on `:root` to inherit the host project's look. Its
layout primitives collapse on their own. The only mechanical defect across ten evidence
pages was a hand-rolled grid that never collapsed, so the kit ships grids that have no
width to get wrong.

**The link is a dependency on the daemon, and that is a real cost.** An earlier version of
this file said a page opened straight off the filesystem was "unstyled rather than broken".
Measured, that was too generous: unstyled, the kit's own self-test page overflows a phone
by 275px and logs a console error for the failed stylesheet. If a page needs to survive
being emailed, saved or read off disk, inline the CSS in the page instead of linking it.

Beyond that, whatever shape the task actually wants. A migration is a before-and-after
table. An incident is a timeline. A prompt audit is the rendered string with the defects
marked in place. That is the point: the page is shaped like the task, which is the one
thing a general dashboard shipped to everybody structurally cannot be.

## Pages that ask

Since 0.4.0 a page can hand a decision back and get the answer back on disk. Load the
helper with one more line, then mark a form:

```html
<link rel="stylesheet" href="/_vetrina/kit.css">
<script src="/_vetrina/answers.js"></script>

<form data-vetrina-answers>
  <fieldset class="v-q">
    <legend>Which cache?</legend>
    <label class="v-choice"><input type="radio" name="cache" value="redis" checked>
      <span>Redis <span class="v-pick">my pick</span><small>already in the stack</small></span></label>
    <label class="v-choice"><input type="radio" name="cache" value="none">
      <span>No cache</span></label>
    <textarea class="v-note" name="cache_note" placeholder="Anything to add"></textarea>
  </fieldset>
  <div class="v-actions"><button class="v-submit">Send answers</button></div>
</form>
```

Submit writes `~/vetrina/<space>/<name>.answers.json`, which is what the agent reads:

```json
{ "savedAt": "2026-11-25T15:11:00.847Z", "page": "demo/decide.html",
  "answers": { "cache": "redis", "cache_note": "" } }
```

A checkbox group is always an array, a radio group is its value or `null`, anything else is
a string. The helper is inlined at serve time like the kit. It restores saved answers on
load, keeps a draft in the browser so a live reload mid-answer loses nothing, and when it
cannot save (page opened off disk, daemon down) it shows the answers as text with a copy
button. Saving does not reload the tab and answers files are not listed in the index.

Behind it is `POST /__vetrina/answers/<space>/<name>.html` (and `GET` to read back). It only
writes beside a page that already exists, only a JSON object, only up to 64 KB, atomically,
with the same path and symlink containment as serving. It requires `application/json` and a
same-origin `Origin`, so another site open in your browser cannot post to it. It is still
unauthenticated: anyone who can reach the bind address can answer your agent's questions.

## Not a vault

A page written about your work contains your work: file paths, source, architecture, log
lines, and whatever else was in the agent's output. That is the point of it, and it means
the root deserves the same care as the repository it describes.

There is no authentication, so **the bind address is the entire access control.** A tailnet
is private and authenticated; loopback is one machine. A LAN bind is readable by everyone
on that network, which is why it is opt-in and a bad idea on shared wifi. A public bind is
refused outright rather than warned about.

## Status

Early. The daemon, the kit and the skill all work. The skill picks the right shape reliably
and *triggers* unreliably, which is what the three rungs above are for.

MIT.
