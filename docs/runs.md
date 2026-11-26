# Runs and open ends

## Walks as runs

The fold reads a walk as stretches of the reference and the bp it has of its own
between them, so it can take the walks in that form too, without a node for
every step:

```ts
import { foldRuns } from '@jbrowse/graph-fold'

const fold = foldRuns(
  {
    reference: { track: { name: 'GRCh38#0#chr6' }, nodes, starts },
    tracks,
    offsets,
    stretches: { starts: stretchStarts, bp, against, offBefore },
    leadBp,
    tailBp,
  },
  { threshold: 1000 },
)
```

- `reference.nodes` are the reference's nodes in its order, each
  `{ name, sequenceLength }` of 1 bp or more, and `starts` where each begins
- `tracks` are the other walks, each
  `{ name, freq, haplotype, sourceTrackID, indexOfFirstBase }` as in
  [Input](result.md#input) without `sequence`
- Walk `t`'s stretches are entries `offsets[t]` to `offsets[t + 1]` of the
  `stretches` arrays, in the walk's order. A stretch is reference nodes the walk
  steps one after another: it starts at the start of a reference node,
  `starts[k]`, and covers `bp[k]` of whole nodes. `against[k]` is not 0 where
  the walk takes them against the reference, last node first, and `offBefore[k]`
  is the bp the walk has of its own between the stretch before and this one. A
  walk's first stretch has `offBefore` 0
- `leadBp[t]` and `tailBp[t]` are the bp the walk has of its own before its
  first stretch and after its last
- The options are `foldGraph`'s, without `reference`
- The result is the one `foldGraph` gives for the same walks as steps, with the
  reference first and the tracks after it, except for `members`, which lists
  only reference nodes: the sequence off the reference has no node names here
- Positions are `starts`, so `reference.track.indexOfFirstBase` may be left out;
  given, it must be `starts[0]`
- Runs the fold cannot read come back unfolded, with `reason` naming the walk or
  node: a stretch that does not start and end on reference nodes, own bp before
  a first stretch given in its `offBefore`, a reference node of 0 bp, whose
  position no stretch can tell from its neighbour's, and reference nodes whose
  starts leave a gap or overlap
- `foldRunsProblems(input, result)` lists the broken invariants `foldProblems`
  lists
- Its work grows with the stretches and what lies between them, not with the
  reference steps they cover, so a window of many walks over the same reference
  folds without a node for each of their steps. `foldGraph` reads every step
  once and then works the same way

## Open ends

A walk's piece in a window can start or end inside it: the walk may truly end
there, or leave the reference outside the window and rejoin it inside, or the
other way round. The tracks alone cannot tell these apart, so without more the
fold lists such a piece as `walk starts inside the window` or
`walk ends inside the window`. `ends`, an option of `foldGraph` and a field of
the runs input, says what lies past each end:

```ts
const ends = {
  before: { kinds, pos, reversed, ownBp, missingBp },
  after: { kinds, pos, reversed, ownBp, missingBp },
}
```

- `before` describes what lies before each walk's first step, `after` what lies
  after its last, one entry per track: for `foldGraph` per input track, the
  reference's entry unread; for `foldRuns` per walk of `tracks`
- `kinds[t]` is what lies past that end, in the words of the runs reader of
  @gmod/gfa-tabix, formerly @jbrowse/graph-walks: `beyond`, a departure whose
  far end is next on the reference past the stretch read, the same way round;
  `elsewhere`, a departure whose far end is reversed or on the other side;
  `edge`, no departure, and the end lies on the edge of the stretch read, so
  what the walk does next is not known; `ends`, the walk has no further step on
  the reference past it
- For a departure, `pos` is its far breakpoint on the reference, where the walk
  leaves it before the piece or rejoins it after, `reversed` is not 0 where the
  far step runs against the reference, `ownBp` is the bp the walk has of its own
  between the two breakpoints, the piece's own bp before its first or after its
  last reference step among them, and `missingBp` how many of them the file
  lacks

Where a departure's far breakpoint lies past the window and none of its bp are
missing:

- The fold makes a branch of it by the rule's sizes, from its whole own bp and
  the reference between its two breakpoints, with `open: true` and `beyond`, the
  far breakpoint. `refStart` and `refEnd` are clamped to the window, and
  `branchLabel` prints
  `replacement 2.4 kb for 3 kb, 2 of 3, continues past the window`
- At or over the threshold, its own bp are a node,
  `open:<node>:<side>:<bp>:<beyond>`, `<side>` being `left` or `right` of the
  reference node it hangs from, that the walk steps at the breakpoint inside the
  window in place of the `lead:` or `tail:` node. The walk's `clippedBp` there
  is the departure's own bp that lie outside the piece. Under the threshold,
  nothing is drawn, and the piece's few own bp fold into the reference node it
  meets
- A far step that runs against the walk's piece at that end is
  `joins the reference outside the window, reversed`, and a far breakpoint on
  the side the piece is heading, not coming from, is
  `joins the reference outside the window, out of order`, kind `other`, with the
  departure's own bp. The words do not depend on which way the contig is
  written, so both directions of one junction are one branch
- With `cluster`, open branches of one breakpoint inside the window and one
  beyond it cluster by own bp as other alleles do. An open branch never joins
  one inside the window

A walk that has no further step on the reference past an end inside the window,
`ends`, is listed as before, and an inversion at that end is not marked `open`.
An `edge`, and a departure the fold does not draw, one that lacks bp or whose
far breakpoint lies inside the window, are listed as nothing: the walk is
neither said to end there nor to continue past the window.

- Walks that fold to the same steps but differ past their ends, an open branch
  or a walk end one has and another lacks, are separate tracks, so a branch's
  `tracks` hold its carriers alone
- `kinds` may also be the numbers of that reader's `END_KINDS`, which this
  package exports in the same order
- Ends the fold cannot read come back unfolded with a reason: a table of another
  length than the walks, a kind not among the four, or a departure without a
  finite `pos`, `ownBp` and `missingBp`
