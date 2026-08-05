---
name: vetrina
description: "Publish a task-shaped HTML page instead of reporting in a wall of chat text. Use at the end of any audit, review, investigation, triage, migration, refactor, benchmark, incident post-mortem or pre-launch check - anything that ends in findings, a list of what is wrong, a severity breakdown, or a recommendation spanning several items. Also use when what you are about to report has structure a paragraph would flatten, such as items in mixed states, a comparison across dimensions, a path through a system, a sequence where the gaps matter, a decision the human has to make, or long-running work they might check from a phone. Also when the user asks for a page, a report, a dashboard, or a summary of what you did or found."
---

# Vetrina

A window the human keeps open. You publish by writing one self-contained HTML file into
`~/vetrina/<space>/<name>.html`. That is the entire API - no SDK, no registration.

**A transcript only grows. A page is rewritten in place.** That is the whole point. Chat
accumulates: your output, their asides, three tasks interleaved in the order things
happened rather than the order they matter. A page is scoped to one task and rewritten
every time the work moves, so it stays one screen and shows the current state.

## Decide first: does this want a page?

**Most of the time, no.** Say it in two sentences and move on.

Build a page when the reader would otherwise have to hold **more than about three things
in their head at once**. That is the whole test, and it is about the reader, not the work.

Concretely, yes when you are reporting:

- items with mixed state - some done, some blocked, one needing a decision
- a comparison across several dimensions - three options against six criteria
- something spatial - a path through a system, a call graph, a before-and-after
- a sequence where the gaps matter - an incident, a run, a race
- a decision you are handing back, with everything needed to make it
- long-running work they might check from somewhere else
- asides they dropped mid-task that you have not dealt with yet

No when:

- the answer is a sentence
- it is one diff or one file - show the diff
- the session is a conversation - talking is right for talking
- you are near the end and want to look thorough
- nothing changed since the last page - rewrite that one instead

When in doubt, do not. **A vetrina built for every session is a vetrina nobody opens**,
and one unnecessary page costs you the odds anyone opens the next one.

**The one reliable self-check.** If you are about to write chat output containing a
severity grouping, a table, more than about six bullets of findings, or the phrase "fix
these first" - you have already decided the answer has structure. Build the page. In
testing, the failure was never bad taste; it was an agent finding twenty findings across
four severities, ordering them by urgency, and then typing all of it into chat anyway.

## Then pick the shape, before writing any markup

| If the work is | Shape |
|---|---|
| mixed states, some needing attention | triage queue |
| many items that are secretly few causes | ranked clusters |
| options to narrow against hard requirements | filterable list |
| a path through a system, and where it breaks | branching trace |
| a number that moved, and what moved it | chart + attribution |
| the real artifact, with defects marked in place | annotated artifact |
| mutually exclusive paths a human must choose | decision matrix |
| a sequence where the gap between tracks is the point | dual-track timeline |
| several agents working at once | urgency-sorted lanes |
| asides the human dropped, and what became of each | parking lot |

A console bolted onto a problem that wanted a timeline throws away the entire premise.
If the task genuinely wants a shape not listed, build that one.

## Write it

Same frame every time; only the middle changes.

1. **A verdict headline, not a topic.** "23 failing tests. 4 causes. 1 is urgent." not
   "Test results". If the headline would have been true *before* you started, it is a
   topic. Rewrite it.
2. **A standfirst** - the same finding in three sentences.
3. **A stat strip** - four to six numbers. The two-second read.
4. **Problems before data.** Never make someone scroll to learn whether anything is wrong.
5. **Order by urgency**, not by file order, chronology or size. If the ordering is
   counter-intuitive, say so on the page so it is trusted.
6. **Collapse the bulk.** Thirty-two mechanical changes are a tally and a folded table.

**Separate what you checked from what you are asserting.** Ten pages built for this
project's gallery passed every automated check, and an adversarial read found a false or
self-contradicting claim in every one of them: an argument that contradicted a caveat two
paragraphs above it, a stat that disagreed with the table under it, chess that the page's
own FEN disproved. The numbers were right and the sentences around them were invented,
which is the normal failure and not an unlucky one.

So: run the thing, count the thing, open the file. Where you did, the page can say so.
Where you did not, say that instead of writing around it, and mark the difference on the
page. "Reconstructed from the receipt log", "this is an inventory, not an incident",
"honest down to about ninety-five lines" are all real examples from those pages, and they
cost one line each. A page that renders beautifully and reasons badly is worse than a
paragraph, because it looks authoritative.

Four hard constraints, all non-negotiable:

- **Self-contained.** No CDN, no external font, no remote image, no network at render
  time. It gets read on a phone with no signal.
- **Light and dark**, via `prefers-color-scheme`.
- **Legible on a phone**, one-handed. Every multi-column grid collapses.
- **State in form, not colour alone.** A glyph, a word, a border treatment, a position.

**Use the kit unless you have a reason not to.** One line, and the daemon inlines it at
serve time so the page stays self-contained:

```html
<link rel="stylesheet" href="/_vetrina/kit.css">
```

It gives you the frame classes (`v-wrap`, `v-kicker`, `v-headline`, `v-standfirst`,
`v-meta`, `v-stats`/`v-stat`, `v-section`, `v-card` with `is-urgent`/`is-warn`/`is-ok`/
`is-idle`, `v-table`, `v-details`, `v-chips`) and layout primitives that collapse on their
own. Override any `--v-*` token on `:root` to match the host project.

The reason this matters: **hand-rolled layouts fail on phones and they fail silently.** A
table or a wide card sized by its content will push the whole page sideways, and you will
not notice because you are not looking at it on a phone. The kit's grids and tables have
no width to get wrong. If you do hand-roll, put `overflow-x: clip` on the root, give every
scrollable thing `max-width: 100%`, and check at 390px before you say you are done.

Inherit the host project's tokens when they exist - look for `CLAUDE.md`, a theme file, a
`global.css`. A page that matches the project reads as part of it.

## Publish it

```bash
mkdir -p ~/vetrina/<space>
# write the file to ~/vetrina/<space>/<name>.html
```

`<space>` is the project name. Reuse the same filename when you rewrite - a new file per
update turns the index into noise.

Then check the window is running, and start it if not:

```bash
curl -sf -o /dev/null http://127.0.0.1:7777/ || (npx -y vetrina-cli >/dev/null 2>&1 &)
```

**Always say so in chat**, in one line: that you made a page, the URL, and what is on it.
A tab that changes silently is a tab nobody looks at. And never make the page the only
place an answer lives - if they asked a question, answer it in chat too.

## Rewriting

Rewrite as the work moves; the open tab updates on its own. Rewrite because the *work*
changed, never because a file changed. When something resolves, show that it resolved - an
item that quietly disappears reads as a bug.

## Do not get precious

Pages are disposable and unmaintained by design. Generate something elaborate and
single-use and let it expire. If a page turns out to be worth keeping, that is a signal it
should become a real artifact in the repo. **The moment you are maintaining a vetrina
page, it has outgrown the window.**
