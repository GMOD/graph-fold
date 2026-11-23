# From 0.0.0 to 0.1.0

What changed in `foldGraph`'s result since the 0.0.0 tarball. No option was
renamed: `threshold`, `cluster`, `clusterTolerance`, `reference`,
`referenceRevisits` and `inversions` are as they were, and so are `invertedOf`,
`members`, `cluster` and `alleles`.

## Changed

- **The result is `Folded | Unfolded`.** Check `fold.folded` before reading
  `nodes[].kind`, `tracks[].variation` or `tracks[].names`; TypeScript asks for
  it
- **Unfolded returns the caller's own arrays.** `nodes` and `tracks` are the
  arrays passed in, not copies with `kind`, `id`, `names` and `variation` added.
  `members` is `{}` and `walks` is `[]`, where they held every node and one walk
  per track
- **A step on a node missing from `nodes` no longer throws.** The result is
  unfolded and `reason` names the track and node
- **`walks[i]` is input track `i`.** The reference's walk was first; it is now
  at the reference's index, which is the same place when `reference` is 0
- **`tracks[].sourceTrackID` is the input track's.** It was the folded track's
  index, and still is when the input track has none
- **A walk-end branch gives a position.** For `walk starts inside the window`
  and `walk ends inside the window`, `refStart` and `refEnd` are both where the
  walk starts or ends. They were the span of reference left unwalked, whose bp
  are still in `length`
- **An inversion has `from` and `to`.** A test of
  `from !== undefined && to !== undefined` no longer means a jump: use
  `nodes.length === 0`, or `kind`

## Added

- `haplotypes` on the result: the summed `freq` of the input tracks
- On each folded track: every field of its first input walk, `label`, and
  `variation.foldedAwayBp`
- On each branch: `tracks`, the ids of the folded tracks that carry it, and
  `anchored`
- Exports `branchLabel`, `variationLabel`, `bpLabel` and `trackLabel`, and the
  types `Folded`, `Unfolded` and `FoldedTrackFields`. `FoldResult` and
  `FoldedTrack` take the caller's node and track types

## Removed from a consumer

- The remap of `sourceTrackID` through `walks[i].track`
- A per-tube table counted from `walks`: read `tracks[].variation`
- A haplotype total summed from `tracks`: read `haplotypes`
- Label text for a branch or a tube: call `branchLabel` and `variationLabel`
