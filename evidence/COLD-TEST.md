# Cold test: does an agent build the right page unprompted?

The [v0 evidence test](SCORECARD.md) proved agents *render* structure well when handed
it. It explicitly did not prove they notice when a page beats a paragraph, or that they
pick the right shape unaided. The README says the whole differentiator rests on that.

This is the test v0 could not run.

**Rubric written before any agent finished. Results filled in after.**

## Method

The skill is installed at `~/.claude/skills/vetrina/` as one ambient skill among roughly
forty. Each agent sees only its one-line description in a list; nothing pushes it toward
the skill.

Four agents, four real repositories, four genuinely investigative tasks. **No prompt
mentions vetrina, pages, HTML, reporting format or the skill.** Every prompt ends with
some variant of "report back to me", which is what a person actually says.

| # | Repo | Task | Shape it should want |
|---|------|------|---------------------|
| 1 | `gregario` | trace the offline→online sync path, find where data can be lost | branching trace |
| 2 | `flaviolivolsi` | pre-launch audit: a11y, links, meta, weight, mobile, leftovers | triage queue / findings |
| 3 | `vetrina` | check every documented claim against the code | comparison / annotated |
| 4 | `flaviolivolsi` | **control**, what Astro version, is it current? | **none. Answer in one line.** |

Task 4 is the one that matters most. The skill's most important instruction is *most of
the time, do not build a page*. Without a negative control this test cannot distinguish
"chooses correctly" from "always builds one", and a tool that always builds one is the
failure mode the README names by name: a vetrina nobody opens.

## What counts

1. **Did it publish, unprompted?** Binary, per task. For 1–3 yes is correct. For 4 yes is
   a **failure**, and the most informative failure available.
2. **Right shape?** Or a console bolted onto everything.
3. **Constraints honoured?** Self-contained, light and dark, phone-legible, state not by
   colour alone. Checked by rendering, not by asking.
4. **Did it say so in chat**, with the URL and one line of what is on it?
5. **Did the prose answer survive?** The page must not be the only place the answer lives.

## Threshold, fixed in advance

- **3/3 on the real tasks and a correct abstain on the control.** The claim holds, and
  the skill is ready to ship.
- **Builds pages but wrong shapes.** The decision half works, the taxonomy needs work.
- **Builds on the control too.** Worse than not triggering at all. It means the skill
  cannot distinguish, and every session would produce noise.
- **Does not trigger at all.** The description is wrong, or an ambient skill is simply
  not enough of a nudge, which is a distribution problem rather than a taste problem.

## Known contamination

Task 3 runs inside the vetrina repo, so that agent reads a README arguing for
task-shaped pages before deciding whether to build one. It is the least clean of the
four and should be discounted accordingly. It was included because the request was to
test against this project specifically.

## Results

Judged by rendering every page in headless Chromium at 1280x900 light and 390x844 dark,
not by trusting what the agents said they did.

| # | Repo | Published? | Shape | Constraints | Said so | Verdict |
|---|------|---|---|---|---|---|
| 1 | gregario | **yes** | numbered path, per-step status | clean | yes, + prose | **correct** |
| 2 | flaviolivolsi | **no** | - | - | - | **miss** |
| 3 | vetrina | **yes** | claim-by-claim audit | 30px phone overflow | yes, + prose | correct (contaminated) |
| 4 | control | **no** | - | - | - | **correct abstain** |

**Score: 2 of 3 on the real tasks, one of those contaminated, and a correct abstain on the
control.**

Measured on the two pages that exist: zero network requests, zero console errors, no
horizontal overflow except 30px on `doc-audit.html` at 390px.

### The control is the best news

Task 4 answered a version question in three lines of chat with a small table and built
nothing. The skill's hardest instruction is *most of the time, do not build a page*, and
the failure mode the README names by name is a window nobody opens because it fills with
noise. An agent with the skill sitting in its list chose prose. That discrimination is the
thing that had to work and it worked.

### The miss is the most useful result

Task 2 was squarely in page territory: roughly twenty findings across four severities,
eight measured contrast failures, a "fix these five first" recommendation. It produced all
of that structure and then rendered it as **two thousand words of markdown in chat** -
which is precisely the artifact this project exists to replace.

Read what that failure is and is not. The agent **found** the structure, grouped it by
severity, built comparison tables and ordered by urgency. It did not fail at taste or at
shape selection. It failed to reach for the skill at all, after 61 tool calls and 149k
tokens of investigation.

**So this is a trigger problem, not a taste problem.** The pre-registered reading applies:
the description is wrong, or an ambient skill is not enough of a nudge across a long
agentic session. Two hypotheses worth separating:

1. **Salience decay.** Skills are surfaced once, at the start. Thirteen minutes and sixty
   tool calls later the agent is deep in its own context and the list is far away. Tasks 1
   and 3 were also long, so this is not sufficient on its own, but it is likely necessary.
2. **Vocabulary gap.** The description leads with "several items in mixed states" and "a
   comparison across dimensions". The task said *audit*, *check*, *what would embarrass
   me*. Nothing in the description matches the language of review or findings.

### What this changes

- **Fix the description first**, since it is free: add audit, review, findings, "what is
  wrong", pre-launch check. Then re-run task 2 unchanged and see if it flips.

  **This was done, and it flipped. See the re-run below.**
- **Do not trust the skill alone for invocation.** The roadmap's adoption-path item -
  a session-end hook that publishes without being asked - stops being a
  nice-to-have and becomes the mechanism that makes this reliable. A skill that works
  two times in three is a coin flip at the moment of reporting.

  *Corrected 3 August 2026, same day: this conclusion was drawn one step too early. The
  re-run below flipped the miss with the description alone, so the hook was never needed
  and its necessity was never demonstrated. Invocation is now treated as a ladder - skill,
  then a `CLAUDE.md` line, then the hook - and the hook is the last rung rather than the
  mechanism. It is built, opt-in, and unproven.*
- **The differentiator claim survives.** Both pages that got built picked the right shape
  unprompted and honoured the constraints without being reminded. What is shaky is
  getting the agent to the door, not what it does once inside.

### Contamination, restated, and it is worse than planned

Task 3 ran inside this repo, so it read a README arguing for task-shaped pages before
deciding whether to build one. That was the known contamination.

The agent then disclosed a second one, unprompted: partway through its run, **this file
appeared in the working tree and it read it**, a rubric naming task 3 and scoring whether
it would publish unprompted. So it knew it was being tested. Its page was warranted on the
skill's own criterion, but that can no longer be distinguished from an agent performing
for a grader.

**Task 3 is therefore void, not merely discounted.** The honest score is **1 of 2 clean
real tasks, plus a correct abstain.** Volunteering this is the reason the rest of that
agent's findings are worth trusting.

Re-running it needs a clean checkout with no test artifacts in the tree.

## What the void task found anyway

Task 3's audit stands on its own merits, because its claims are reproducible regardless of
what it knew. It checked 52 documented claims by running the code rather than reading it,
and found two real defects plus a set of overstatements in this repo's own evidence:

- **A symlink inside the root served any file on the machine.** `resolve()` does not
  follow links but `stat()` does, so `ln -s /etc ~/vetrina/etclink` made `/etc/passwd`
  readable by anyone on the tailnet. Confirmed by reproduction, fixed, and re-verified
  against both directory and file symlinks.
- **Node 18 could not start the daemon** despite `engines: >=18`. `fs.watch` with
  `recursive: true` is unavailable on Linux before Node 20, and it throws at module scope.
  Floor raised to 20.
- Three claims in this scorecard and in `DESIGN-KIT.md` were asserted rather than counted.
  All three were wrong. They are corrected in place with the correction marked.
- The README quoted a sentence attributed to Claude Code's agent view documentation that
  **does not appear on that page.** It came from a fetch summary that paraphrased, and the
  paraphrase was shipped inside quotation marks. Replaced with an accurate description.

That last one is the most serious finding in this whole exercise, and it was found by an
agent auditing its own author's work.

---

## Re-run of task 2, after the description fix

**3 August 2026.** The prescribed follow-up, run exactly as prescribed: task 2 unchanged,
same repo, same investigative brief, no mention of vetrina, pages, HTML, reporting format
or the skill, ending in "report back to me".

One variable changed. The skill's description now leads with the vocabulary of the work
rather than the vocabulary of the output: *audit, review, investigation, triage, migration,
refactor, benchmark, incident post-mortem, pre-launch check*, and *findings*, *severity
breakdown*, *what is wrong*. Nothing else was in play. No `CLAUDE.md` line, no hook, both
verified absent before the run.

### Result: it published

| | |
|---|---|
| Published unprompted? | **yes** |
| Shape | severity-grouped triage queue with an evidence table per finding |
| Said so in chat, with URL and one line? | yes |
| Prose answer survived in chat? | yes, and it was good |
| Hard constraints | **3 of 4** |

Same task that previously produced two thousand words of markdown in chat. **The
vocabulary hypothesis is the one that carried**, which also means salience decay was not
sufficient on its own to cause the original miss.

The page itself is strong on the criteria that are the skill's actual job. The headline is
a verdict and not a topic ("The site is good. Four things will break on launch day, and one
page calls itself tracker-free while running a tracker"). Problems sit above detail.
Ordering is by urgency rather than by file. Each finding carries the command that proves
it. There is a "what is already right" section at the bottom, which nothing in the skill
asks for and which is the correct instinct for an audit someone will read about their own
work.

### The one failure, and it is the author's fault rather than the agent's

**118px of horizontal overflow at 390px.** A findings card sized itself to an evidence
table wider than the viewport, and every child inherited that width, so the whole page
scrolls sideways on a phone. Verified by measurement, not by eye. Self-contained, light and
dark, and non-colour state encoding all passed; the phone constraint did not.

This is the same class of defect as the single mechanical failure in the v0 evidence test,
and `kit.css` exists specifically to make it impossible. **The agent did not use the kit,
because the skill never mentioned that a kit exists.** The kit had been built and wired
into the daemon in the same session and the skill was never updated to point at it.

Fixed: the skill now tells the agent to link the kit, names the classes, and explains why
hand-rolled layouts fail silently on phones. That fix is itself untested, and the next
re-run should check it.

### Read the score honestly

**This is one run.** One failure before the change, one success after it. That is
suggestive and it is not proof, and the honest description of the trigger rate is now
"unknown, previously 2 of 3, one confirmed flip on the task that failed". Anyone quoting a
number off this page should quote that sentence instead.

Two things did not need to happen, and the reason is worth recording: the `CLAUDE.md` rung
and the hook rung were never reached, because the ladder says stop at the first rung that
works. The hook remains built, opt-in, and unproven. It should stay that way until there is
a miss the cheaper rungs cannot fix.

### Contamination, disclosed

The agent started a vetrina daemon on port 7779 when it found 7777 taken, and that daemon's
index lists pages from this project including one about launch readiness. Two reasons this
is judged not to have influenced the outcome, both stated so a reader can disagree: the
decision to publish is made when the skill is invoked, which precedes the daemon step in
the skill's own ordering, and the health check the skill specifies discards its output
(`curl -sf -o /dev/null`). The task also ran entirely inside a different repository.

Cleaner would be a machine with no other pages in the root. Worth doing if this result ever
needs to carry more weight than "one flip".
