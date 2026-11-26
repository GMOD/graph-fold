# @jbrowse/graph-fold

A pangenome graph stores many people's genomes on one reference genome. Drawn as
a tube map, every difference, even a single letter, is a branch of its own, and
the large changes, the structural variants, are lost among thousands of small
ones.

`@jbrowse/graph-fold` merges every difference smaller than a threshold into the
reference and keeps the large ones:

![Before: three people's DNA drawn along a gray reference genome, covered in tiny bumps wherever they differ, even by one letter. After: straight lines with only a deletion, an insertion and an inversion left. A panel on the right gives the rule: every difference sorted by size, and those under a line you pick, here 1,000 letters, merge into the reference while bigger ones are kept](docs/hero.svg)

- **In:** the nodes and tracks of a tube map, as
  [@jbrowse/tubemap-core](https://github.com/GMOD/tubemap-core)'s
  `layoutTubeMap` takes them, with the reference as the first track
- **Out:** fewer nodes and tracks in the same shape, plus the kept branches, who
  carries each one, and what was smoothed away on each walk
- It reads node lengths, never a base, and has no dependencies

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
- `tables` is the cut's tables from
  [@gmod/gfa-tabix](https://github.com/GMOD/gfa-tabix-js)
- `foldRuns` takes the same walks as stretches of the reference instead of node
  steps, and `ends` says what lies past each end of a walk's piece in the
  window, see [Runs and open ends](docs/runs.md)

## Options

| Option              | Default | Effect                                                                                                               |
| ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `threshold`         | 50      | Smallest difference, in bp, kept as a branch; 1 or more                                                              |
| `cluster`           | false   | Draw near-equal alleles at one site as one branch                                                                    |
| `clusterTolerance`  | 0.05    | How near, as a share of the larger allele                                                                            |
| `reference`         | 0       | Index of the reference track                                                                                         |
| `referenceRevisits` | none    | Nodes the reference passes twice in the whole graph; above 0 it won't fold, see [the gate](docs/folding.md#the-gate) |
| `inversions`        | 'walk'  | How an inversion is drawn, see [Inversions](docs/folding.md#inversions)                                              |
| `ends`              | none    | What lies past each walk's ends, see [Open ends](docs/runs.md#open-ends)                                             |

## Docs

- [How a window folds](docs/folding.md): what is kept and what is merged
- [Input and result](docs/result.md): every field in and out, and labels
- [Runs and open ends](docs/runs.md): walks as stretches, and what lies past a
  window's edge
- [Windows folded](docs/windows.md): real examples, before and after
- [Limits](docs/limits.md): what the fold can't tell apart
- [Migrating to 0.1.0](docs/migrating-to-0.1.0.md)

## License

MIT
