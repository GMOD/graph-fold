# @jbrowse/graph-fold

A pangenome graph stores many people's genomes on top of one reference genome.
Drawn as a tube map, every difference between them, even a single letter,
becomes a branch of its own, so a few thousand bases of DNA turn into thousands
of pieces and the large changes, the structural variants, are lost among them.

graph-fold merges every difference smaller than a threshold into the reference
and keeps the large ones, so the picture shows only what matters:

![Before: three people's DNA drawn along a gray reference genome, covered in tiny bumps wherever they differ, even by one letter. After: straight lines with only a deletion, an insertion and an inversion left. A panel on the right gives the rule: every difference sorted by size, and those under a line you pick, here 1,000 letters, merge into the reference while bigger ones are kept](docs/hero.svg)

- **In:** the nodes and tracks of a tube map, as
  [@jbrowse/tubemap-core](https://github.com/GMOD/tubemap-core)'s
  `layoutTubeMap` takes them, with the reference as the first track
- **Out:** fewer nodes and tracks in the same shape, plus the kept branches, who
  carries each one, and what was smoothed away on each walk
- It reads node lengths, never a base, and has no dependencies

Real windows of 464 human genomes, before and after, are in
[Windows folded](docs/windows.md).

## Install

```bash
npm install @jbrowse/graph-fold
```

## Usage

```ts
import { branchLabel, foldGraph } from '@jbrowse/graph-fold'
import { layoutTubeMap } from '@jbrowse/tubemap-core'

const fold = foldGraph(nodes, tracks, {
  threshold: 1000,
  referenceRevisits: tables.revisited,
})
const layout = layoutTubeMap(fold.nodes, fold.tracks, [], layoutOptions)
if (fold.folded) {
  for (const branch of fold.branches) {
    console.log(branchLabel(branch, fold.haplotypes)) // deletion 45.5 kb, 306 of 464
  }
}
```

- `nodes` are `{ name, sequenceLength }`; a node with `seq` and no
  `sequenceLength` takes its length from `seq`
- `tracks` are
  `{ name, sequence, freq, haplotype, indexOfFirstBase, sourceTrackID }`, where
  `sequence` lists node names with a `-` prefix for a reversed step, `freq`
  counts the haplotypes that take the walk, 1 when absent, and `haplotype` names
  the haplotype the walk is part of, see [Fragments](docs/folding.md#fragments).
  Any other field a track has comes back on the folded track
- `fold.nodes` and `fold.tracks` are `layoutTubeMap` input whether the window
  folded or not
- Reads are not folded. Lay a folded window out without its reads

## Options

| Option              | Default | Effect                                                                                                               |
| ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `threshold`         | 50      | bp at which a detour is kept as a branch                                                                             |
| `cluster`           | false   | Draw near-equal alleles at one site as one branch, marked as a cluster                                               |
| `clusterTolerance`  | 0.05    | How far two alleles may differ, as a share of the larger one's length                                                |
| `reference`         | 0       | Index of the reference track                                                                                         |
| `referenceRevisits` | none    | How many nodes the reference passes more than once in the whole graph, see [the gate](docs/folding.md#the-gate)      |
| `inversions`        | 'walk'  | `'walk'` steps the reference node reversed; `'box'` steps a copy of it, see [Inversions](docs/folding.md#inversions) |

## Docs

- [How a window folds](docs/folding.md): the rules, with options
- [The result](docs/result.md): every output field and label
- [Windows folded](docs/windows.md): real examples, before and after
- [Limits](docs/limits.md): what the fold can't tell apart
- [Migrating to 0.1.0](docs/migrating-to-0.1.0.md)

## License

MIT
