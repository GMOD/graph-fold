# Input and result

## Input

- `nodes` are `{ name, sequenceLength }`; a node with `seq` and no
  `sequenceLength` takes its length from `seq`
- `tracks` are
  `{ name, sequence, freq, haplotype, indexOfFirstBase, sourceTrackID }`, where
  `sequence` lists node names with a `-` prefix for a reversed step, `freq`
  counts the haplotypes that take the walk, 1 when absent, and `haplotype` names
  the haplotype the walk is part of, see [Fragments](folding.md#fragments). Any
  other field a track has comes back on the folded track
- `fold.nodes` and `fold.tracks` are `layoutTubeMap` input whether the window
  folded or not
- Reads are not folded. Lay a folded window out without its reads

## Result

`foldGraph` and `foldRuns` return a `FoldResult`, which is `Folded` or
`Unfolded` by its `folded`. Both have:

- `threshold`, and `haplotypes`, the distinct haplotypes of every input track,
  the reference among them: the summed `freq` where no track has a `haplotype`
- `nodes` and `tracks`, `layoutTubeMap` input
- `members`, `branches` and `walks`, empty when `folded` is false

### Unfolded

- `reason` says why the window was not folded
- `nodes` and `tracks` are the arrays the caller passed, untouched

### Folded

- `nodes`:
  `{ name, sequenceLength, kind, refStart, refEnd, cluster, invertedOf }`,
  `kind` being `reference` for a backbone node and `branch` for any other
- `tracks`: the reference first, then one per distinct folded walk. Each is its
  first input walk's own fields, `sourceTrackID` among them, with these set:
  - `id`: its index in `tracks`
  - `name`: the first walk's name, and `names`: every walk's
  - `label`: the one walk's name, the haplotype where several walks of one
    haplotype share the track, or `439 haplotypes`
  - `sequence`
  - `freq`: the walks it holds, each by its own `freq`, and `haplotypes`: the
    distinct haplotypes they are
  - `sourceTrackID`: its `id` when the input walk had none
  - `variation`: what the track hides, see
    [What a tube hides](#what-a-tube-hides)
- `members`: for each folded node, the original node names it holds. A backbone
  node lists its reference nodes in order and then the nodes of the variants
  folded into it; an insertion lists the nodes of every allele drawn as it
- `branches`, in reference order:
  - `kind`: `insertion`, `deletion`, `inversion` or `other`, and `description`,
    which says which `other`: `replacement`, `reference walked twice`,
    `reference walked 2 to 3 times`, `reference walked twice, once reversed`,
    `reference walked out of order`, `walk starts inside the window`, and so on
  - `length`, `insertedBp`, `deletedBp`, `refStart`, `refEnd`: positions are on
    the reference, counted from the reference track's `indexOfFirstBase`
  - `haplotypes`: the distinct haplotypes of the walks that carry it, each once
    however many of its walks take the branch and however often, and `tracks`:
    the `id` of each folded track that does
  - `copies`, only on a repeat: one `{ passes, reversed, haplotypes, tracks }`
    for each number of passes its carriers make, `reversed` being how many of
    the passes run against the walk's own direction. The track's `sequence`
    steps the nodes that many times, so a tube map draws the loops
  - `nodes`: the folded nodes that are the branch, the insertion's node or the
    inverted backbone nodes
  - `from` and `to`: the backbone nodes on either side of it. A deletion is the
    step from `from` to `to`; an inversion at the edge of the window lacks one
    of them
  - `anchored`: false for a branch with no node and no step of its own to label,
    such as `walk ends inside the window`. Its `refStart` and `refEnd` are both
    the position where the walk starts or ends, and `length` the reference it
    leaves unwalked past there. Place it at that position or list it beside the
    picture
  - `open`: an inversion the window cuts through, or a departure that continues
    past the window, see [Open ends](runs.md#open-ends)
  - `beyond`, only on a departure that continues past the window: where on the
    reference its far end is
  - `cluster` and `alleles`, only on a clustered branch
- `walks`: one per input track, in the order of the input: `track` is the `id`
  of its folded track, and
  `originalBp = foldedBp - skippedBp - clippedBp + insertedBp`. `steps` lists
  each step of the folded track where the walk differs from the node drawn:
  `insertedBp` it has and the node lacks, `skippedBp` of the node it leaves out,
  `clippedBp` of the node past the walk's end, and the largest single piece of
  each the fold hid there: `largestInsertedBp`, the most bp off the reference
  between two consecutive reference steps the walk keeps, and
  `largestSkippedBp`, the most reference between two such steps. Both are under
  the threshold

### Labels

Every renderer should print the same text, so the package makes it:

- `branchLabel(branch, fold.haplotypes)`: `deletion 45.5 kb, 306 of 464`,
  `replacement 15.7 kb for 6.3 kb, 1 of 464`, and for a cluster its range and
  member count, `insertion 8.9 kb to 9.5 kb (cluster of 56 lengths), 129 of 464`
  or `replacement 927 bp to 935 bp for 3.9 kb (cluster of 2 lengths), 2 of 3`
- `variationLabel(track)`: `439 haplotypes, 8 bp to 795 bp folded away in each`
- `bpLabel(bp)`: `584 bp`, `45.5 kb`
- `track.label`, or `trackLabel(haplotypes, names)`
- The reference's `label` is its name, followed by `and 1 identical haplotype`
  where its track came with a `freq` over 1; `referenceLabel(name, haplotypes)`
  gives the same text
- Every count a label prints is of haplotypes, never of walks

`foldProblems(nodes, tracks, result)` lists every broken invariant: a step on a
node that is not there, a jump no branch reports, a haplotype count that
changed, a track whose `haplotypes` is not its walks', a walk whose bp do not
reconcile, a branch that counts more haplotypes than its tracks hold, a step
that hides a piece off the reference or a skip of it at or over the threshold.

## What a tube hides

A track groups the walks that fold to the same steps in the same directions, so
it is exact about its route and silent about every difference under the
threshold. On chr16 at 1000 bp the looping track is 439 haplotypes. Lowering the
threshold separates them: at 50 bp the 439 are a track of 413 and a track of 26
that carry a 584 bp deletion as well.

- How many distinct walks a track stands for is not stated: a caller that cuts
  pieces it did not load stands one node in for each, which makes walks of one
  route look distinct, and [runs](runs.md) name no nodes to tell them apart
- `variation.foldedAwayBp` is the `min`, `median` and `max`, over the track's
  haplotypes, of the bp each differs from the nodes drawn: what it has and they
  lack plus what they have and it skips. This is the figure a renderer should
  quote, and `variationLabel` does
- `variation.insertedBp` and `variation.skippedBp` are the two halves, each with
  its own spread. Their sums are not `foldedAwayBp`'s, since the walk with the
  most inserted need not be the one with the most skipped

## Drawing conventions

- **Solid where a tube reads a node, pale where it passes one.** A deletion's
  tube is pale over the reference it leaves out, and an inversion's is pale on
  the two passes under the block and solid on the pass back through it
- **Chevrons point the way the tube runs,** so the pass through an inverted
  block points against the reference
- **A clustered box says it is a cluster,** by `cluster` on the node and the
  branch: `branchLabel` prints the range
- **A copy box says what it copies,** see [Inversions](folding.md#inversions)
- **An unanchored branch is listed or placed, never dropped**
