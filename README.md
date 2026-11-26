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

- `nodes` and `tracks` are what `layoutTubeMap` takes, the reference track
  first, and `fold.nodes` and `fold.tracks` go straight back into it
- Every input field is in [Input](docs/result.md#input), every output field in
  [The result](docs/result.md)

## Options

| Option              | Default | Effect                                                                                                               |
| ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `threshold`         | 50      | Smallest difference, in bp, kept as a branch                                                                         |
| `cluster`           | false   | Draw near-equal alleles at one site as one branch                                                                    |
| `clusterTolerance`  | 0.05    | How near, as a share of the larger allele                                                                            |
| `reference`         | 0       | Index of the reference track                                                                                         |
| `referenceRevisits` | none    | Nodes the reference passes twice in the whole graph; above 0 it won't fold, see [the gate](docs/folding.md#the-gate) |
| `inversions`        | 'walk'  | How an inversion is drawn, see [Inversions](docs/folding.md#inversions)                                              |

## Docs

- [How a window folds](docs/folding.md): the rules, with options
- [Input and result](docs/result.md): every field in and out, and labels
- [Windows folded](docs/windows.md): real examples, before and after
- [Limits](docs/limits.md): what the fold can't tell apart
- [Migrating to 0.1.0](docs/migrating-to-0.1.0.md)

## License

MIT
