---
name: roadmap
description: Discuss the overall goal of a new project or a larger topic with the person, write docs/roadmap.md with the specs in waves, the ADRs of the basic decisions and the specs of the next wave with their plans, ask for one approval, put every spec on its branch and continue with implement or wave. Only on explicit request (/roadmap <goal>).
when_to_use: Load when the user runs /roadmap, or asks to plan a new project or a larger goal as several specs. Not for a single change; that is /spec.
argument-hint: <goal in one sentence | next>
disable-model-invocation: true
---

# Roadmap

Decision 0019. Output: `docs/roadmap.md`, the ADRs of the basic decisions and the specs of the next
wave, approved by the person in this session (gate G0 for each spec), each spec committed on its
own branch. With `Freigeben und Welle umsetzen` the skill continues with `implement` (one spec) or
`wave` (several).

## 1. Read

- `harness/workflow.md`, `harness/policies/risk.md`, `harness/policies/adr.md`,
  `harness/architecture.md`, `harness/testing.md`.
- `docs/roadmap.md` when it exists. Argument `next`, or no new goal: go to step 4 with the next
  wave. A changed goal: steps 2 and 3 on the existing roadmap.
- `docs/domain/glossary.md`, `docs/architecture/overview.md`, `docs/adr/README.md`,
  `project-rules/*.md`, `harness/scripts/specs.sh` (the state of every spec).
- The code: in a new project the files of the bootstrap, otherwise the modules the goal touches.
- `doc_language` and `parallel_max` in `harness/config.yml`.

## 2. Ask

`AskUserQuestion`, at most four questions per call, as many rounds as needed, until each point is
answered or recorded under `## Offene Fragen`:

- the goal: what is different at the end, and for whom;
- the users and what they do with it;
- what is out of scope;
- quality targets: response time, availability, accessibility, languages, data retention;
- constraints: stack and hosting, existing systems, deadline;
- the first slice the person wants to see working.

Skip what the argument, the code or the roadmap answers. Offer concrete options with a
recommendation (for example two stacks that fit the constraints), not only open questions.

## 3. Roadmap

1. `docs/roadmap.md` from `.claude/skills/roadmap/template.md`, in `doc_language`. `Stand` today.
2. Basic decisions (stack, persistence, authentication, hosting): one ADR each with the steps of
   `.claude/skills/adr/SKILL.md`, status `proposed`, linked in the table. A decision that replaces
   a rule of `harness/architecture.md` or `harness/testing.md` names the rule number.
3. Specs: cut the goal into specs that each deliver something a person can check (a screen, an
   endpoint, a report) and fit one pull request. Numbers in order from the highest of
   `docs/specs/NNNN-*`, the spec table of the roadmap and the branch names `<type>/<NNNN>-*`
   (`git branch --list` and `git ls-remote --heads origin`), plus one.
4. Waves:
   - A new project (no source code besides the bootstrap): wave 1 is one spec, the skeleton:
     structure, build, real `test`, `typecheck` and `lint` targets, one path from a screen to the
     database, `project-rules/testing.md` filled in. Every other spec depends on it.
   - A spec goes into the first wave after every spec it depends on. A spec that needs an ADR of
     this run depends on the first spec of the wave, which carries the ADR.
   - Specs of one wave change separate areas. Two specs that both change `contracts/`, migrations,
     the same dependency manifest or a generated file go into different waves.
   - At most `parallel_max` specs per wave; the rest moves to the next wave.

## 4. Specs of the next wave

The next wave is the lowest wave with a spec that has no file yet or is `draft`. Write each of its
specs with steps 3.2 to 3.8 of `.claude/skills/spec/SKILL.md`, with the number from the roadmap.
Later waves stay rows; their specs are written when they are next, from the code that exists then.

Several specs in the wave: write each spec to a scratchpad file and run
`harness/scripts/wave-check.sh <files>`. A finding: change a plan, or move a spec to the next wave
and change the roadmap.

## 5. Approve

Print a summary: goal, non-goals, basic decisions (one line each), the waves (number, title,
risk), and for each spec of the next wave its criteria, its block `Entscheidungen` and its risk
level with the gates. Then one `AskUserQuestion` call with the open questions (at most three) and,
as the last question, the approval:

- `Freigeben und Welle umsetzen`: approve, then continue with `implement` or `wave`.
- `Nur freigeben`: approve and stop.
- `Ändern`: the person names the change; edit and ask again.

More than three open questions: ask them first. An open question that a spec of the wave needs
blocks the approval; it stays open and the skill stops.

On approval:

1. ADRs of this run: `Status: accepted`, rows in `docs/adr/README.md`. Specs of the wave:
   `status: approved`, `updated` today, `note: freigegeben in der Session`. Answered questions stay
   where they were asked: `- [x] <Frage> → <Antwort> (<Wer>, <Datum>)`.
2. The first spec of the wave lists `docs/roadmap.md`, the ADRs of this run and
   `docs/adr/README.md` under `Dateien:` when they changed.
3. `git fetch -q origin`. For each spec of the wave in number order:
   `git switch -c <type>/<NNNN>-<slug> origin/<default_branch>`, `git add` the spec (the first
   spec also the roadmap and the ADR files), commit `docs(specs): <NNNN> freigegeben` with the body
   `Freigabe in der Session durch <git user.name>, <date>.` and the attribution line from the
   session. The files of the other specs are untracked and move along with each switch. `<type>`
   is `feat`, `fix`, `refactor`, `docs` or `chore`.
4. A roadmap change without a spec of a wave: branch `docs/roadmap-<YYYY-MM-DD>` from
   `origin/<default_branch>`, commit, push, `gh pr create`, then the skill `review` with the PR
   number.
5. `Freigeben und Welle umsetzen`: one spec: stay on its branch and start the skill `implement`
   with `<NNNN>`. Several: `git switch <default_branch>`, then the skill `wave` with the numbers.

The branches stay local until `implement` pushes them. Summary for `Nur freigeben`: the roadmap,
the branches, and that `/implement <NNNN>` or `/wave <NNNN> <NNNN> …` starts the work.
