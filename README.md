# @jbrowse/graph-fold

graph-fold merges the small variation of a pangenome graph window into its
reference, so a sequence tube map of the window shows its structural variants.

- **In:** the nodes and tracks a tube map is laid out from, as
  [@jbrowse/tubemap-core](https://github.com/GMOD/tubemap-core)'s
  `layoutTubeMap` takes them, with the reference as the first track
- **Out:** fewer nodes and tracks in the same shape, plus what each merged node
  holds, the kept branches with their carriers, and what was folded away on each
  walk
- It reads node lengths and never a base, and has no dependencies

A 21 kb window of the HPRC v2.1 Minigraph-Cactus graph,
chr16:75,204,000-75,225,000, is 1,655 nodes. Folded at 1000 bp it is 3, and the
inversion 439 of its 464 haplotypes carry is a tube that loops back through the
block:

![chr16 folded at 1000 bp: the carriers' tube loops back through the 16.6 kb block](docs/chr16-inversion-fold-1000.png)

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

- [How a window folds](docs/folding.md): the rule, fragments, stretches not
  loaded, inversions, clustering and the gate that refuses a window
- [The result](docs/result.md): every field of `FoldResult`, the label helpers,
  `foldProblems`, what a tube hides and drawing conventions
- [Windows folded](docs/windows.md): HPRC windows before and after, with
  pictures and the numbers `pnpm prove` checks
- [Limits](docs/limits.md): what the fold does not tell apart
- [Migrating to 0.1.0](docs/migrating-to-0.1.0.md)

## License

MIT
