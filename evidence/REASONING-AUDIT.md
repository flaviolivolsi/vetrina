# Reasoning audit: ten pages that passed every check and were wrong anyway

The [v0 test](SCORECARD.md) asked whether an unaided agent produces a page worth looking at.
The [cold test](COLD-TEST.md) asked whether it notices when a page beats a paragraph. Both
came out well.

Neither asked whether the page is **true**.

## What was tested

Ten pages built for `gallery/`, each by a separate agent with no sight of the others, each
given the finding its page had to carry and never the layout. They were then put through an
automated harness at 320, 390 and 1440 pixels in light and dark, checking horizontal
overflow, network requests, console errors, and whether the numbers survive with the
stylesheet removed.

**All ten passed everything.** Zero overflow, zero requests, zero errors, right shapes, and
they did not converge: 113 to 579 lines, eight distinct combinations of drawing primitives,
three using none at all.

Then one page was read closely by a human, and a second model was asked to check the
reasoning in the other nine. The instruction was explicit: ignore layout, ignore
accessibility, ignore responsiveness, all of that is machine-checked. Look for internal
contradictions, arithmetic that does not hold, conclusions the stated evidence does not
support, and domain errors.

## Result

**None of the ten was sound.**

That is the finding. Not "some had rough edges": every page contained at least one claim
that was false, self-contradictory, or unsupported by anything else on the page.

### The one a human found

`10-blocked.html` closed with a recommendation and a reason:

> If I hear nothing by Thursday I'll ship B behind a flag, because B can be widened into A
> later without touching anyone's data, and A cannot be narrowed back.

Option B's own description, two paragraphs above, says the rides it leaves behind "stay
local and are gone at the next reinstall". So B destroys the data the widening would need.
The escape hatch is real for weeks and not forever, and the page says both things without
noticing.

The recommendation was right. The argument for it was not, and a better argument was
sitting unused on the same page: A's dedupe is last-write-wins over rows the account
already had, and that overwrite genuinely cannot be undone.

### The worst one

`01-eval-waterfall.html` is about a chess engine whose entire pitch is that it explains
its evaluation instead of being a black box. The page states its position as a FEN, which
makes every claim checkable, and four of them are wrong:

| Claim on the page | What the FEN says |
|---|---|
| "c2 and e2 can no longer advance to support d3" | Both pawns already defend d3. Advancing either *removes* a defender. |
| "leaves g3 as a permanent hole" | There is a white pawn standing on g3. |
| "the long light diagonal that now runs unobstructed to g1" | g1 is a dark square. The b1–h7 diagonal does not contain it and is blocked by c2 and d3. |
| "your rook owns the e-file two moves from now" | White's own e2 pawn blocks the file, and no line is given. |

A fifth, which the reviewing model did not catch and parsing the position did: "the
recapture on e5 pulls the f6 knight off the kingside" describes a move that cannot be
played. A knight on f6 cannot reach e5. Only `Nc6xe5` or `dxe5` are legal recaptures.

Meanwhile the arithmetic underneath all that prose is exact. Fifteen contributions summing
to +74, matching the stated evaluation; 4 + 10 + 18 = 32 concepts as claimed; 291 of 474
correctly reported as 61%. **The structured part was right and the sentences around it were
invented.**

### The rest

- **02** recommended resuming a completion stream on an HTTP 429. A 429 rejects the
  request; there is no stream to resume.
- **05** marked a rule enforced by evidence whose own annotation says "it restores no
  data", and printed an "enforcement points: 17" figure that no counting rule on the page
  produces.
- **06** labelled a stat "edits discarded: 1" on a page whose trace shows five forks, each
  of which discards a branch by definition. It also claimed a hybrid logical clock "stops
  depending on wall clocks entirely", when an HLC cannot rank two genuinely concurrent
  edits at all.
- **07** said "the four smallest cells are all FLEET" and called a nine-line file "the
  smallest thing in the repository", on a page whose own collapsed tail contains one-line
  env files. It also concluded "review attention tracks diff size almost perfectly" from
  data containing no review history.
- **08** said `precision: 0` truncates on insert, when Postgres rounds, and proposed a
  migration that adds `NOT NULL` before backfilling the nulls.
- **09** said an aside had "118 turns to the end" when its own footer places it at turn 61
  of 214, which leaves 153. It also called two items "third and second" when the same
  footer makes them second and fourth.

Every one of these is fixed. The corrections are in the pages; this file is the record of
what they were.

## The large caveat: these pages had nothing to check against

Every page here was built from invented data. There was no engine to run, no log to read,
no schema to diff, no telemetry to query. Every claim was therefore *composed*, and
composed prose is where all of these errors are.

That matters, because a page written inside a real repository is not in that position. In
Luxifare's own tree an agent can run the engine, dump the real evaluation decomposition and
check a position against a real board. "g3 is a permanent hole" does not survive contact
with an actual position, and "the f6 knight recaptures on e5" never gets written at all,
because a move generator will not produce it. The same is true of the rest: real telemetry
instead of an invented histogram, a real diff instead of an imagined schema drift, a real
receipt log instead of a reconstructed one.

**So a large class of what is above is an artifact of fabrication rather than a property of
the medium.** Where there is a system of record, the agent can verify instead of assert,
and most of these errors cannot be made.

What survives that argument is the more interesting half:

- **07** concluded that "review attention tracks diff size almost perfectly" from data
  containing no review history. You can write that sentence with entirely real numbers in
  front of you.
- **10** argued that B was the reversible option, on a page that had already said B
  destroys the data the reversal would need. That is not a fact anything could check. It is
  an argument, and it was wrong on its own terms.

Facts are checkable against a harness. Inferences are not, and the inferences are what a
page is for.

## Why it matters more than it looks

These are demo pages with invented data, so nothing real was misreported. The finding is
not about these ten pages. It is about what the harness can and cannot tell you.

**Machine-checkable constraints are necessary and nowhere near sufficient.** Overflow,
network requests, console errors, contrast, tap targets and whether a value survives
without CSS are all worth enforcing, and enforcing them caught real defects. None of them
has any purchase on whether the page is right, and "is it right" is the entire value of a
page that exists so the words can be short.

A project harness closes most of the gap and not all of it. It can settle every question of
the form "is this number what the system actually says". It cannot settle "does this
therefore follow", and the second kind of claim is the reason anyone reads a page instead
of a table.

A page that renders beautifully and reasons badly is **worse than a paragraph**, because it
looks authoritative. Every error above was fluent, plausible, and confidently phrased. That
is the default failure mode of generated prose, not an unlucky outcome.

It is also the third time this project has hit exactly this. The README once carried a
fabricated quotation inside quote marks. The one mechanical defect in the v0 evidence test
was misdiagnosed from reading the CSS, confidently and wrongly, and the wrong diagnosis sat
in the scorecard for two days until someone measured instead of reading. Now ten pages.

## What changed as a result

The skill now tells an agent to separate what it verified from what it asserted, and to
mark the difference on the page. Three of the ten did some version of this unprompted: the
incident page footnoted that its company and outage are fictional, the proportional map
disclosed that its areas stop being honest below about ninety-five lines, and the
blast-radius page insisted it was an inventory rather than a breach. The instinct exists.
It is not reliable, which is the same shape as the trigger problem in the cold test.

## What is still not tested

Whether a human reading one of these pages in real use would catch what an adversarial
reviewer caught while explicitly hunting. Probably not, and that is the uncomfortable part:
the errors here were found because someone went looking for them, on pages nobody depended
on.
