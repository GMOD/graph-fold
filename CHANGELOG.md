## [1.2.0](https://github.com/GMOD/graph-fold/compare/v1.1.0...v1.2.0) (2026-11-25)

### Bug Fixes

- A stretch a cut did not load is a node of its own walk, flagged placeholder, never shared with another walk's allele at its site nor clustered with one, so a not-loaded 97 kb no longer draws as a loaded 94 kb two walks wide ([e527f13](https://github.com/GMOD/graph-fold/commit/e527f1364ea4ffae1d52dd08deaf0530648f4347))
- A stretch the caller did not load folds as the loaded allele of its length at its site, since a branch is named by site and bp, so a not-loaded stretch no longer draws its site twice; reverts e527f13 ([e1997b2](https://github.com/GMOD/graph-fold/commit/e1997b2d331075f3c61bcc62b68497df1b534973))
- A cluster's minLength and maxLength are its alleles' own bp, what each inserts or else deletes, and a clustered replacement's label says what it replaces, so 927 and 935 bp in place of 3.9 kb no longer span 3,852 bp ([705d665](https://github.com/GMOD/graph-fold/commit/705d6655125f6c9410f5a4d350f68d444ccdc22e))

### Documentation

- Name a haplotype only on a track that is one walk ([834e88b](https://github.com/GMOD/graph-fold/commit/834e88b69777024f799307f47c8a79a26c19c241))
- Say how a stretch not loaded folds, and what a step's largest hidden pieces are ([47e6ce0](https://github.com/GMOD/graph-fold/commit/47e6ce097ecfdfb6bf06122e386b990e33731190))

### Features

- Each folded step states the largest piece off the reference and the largest skip of it that the fold hid there, and foldProblems fails where either reaches the threshold ([183b2e5](https://github.com/GMOD/graph-fold/commit/183b2e5d7f0937fb67ef4157b2b7c1fcbbfca785))

### Styling

- Format the not-loaded and hidden-piece changes ([a747615](https://github.com/GMOD/graph-fold/commit/a747615f7d2ca539b950b63a0bfb4b03780e2376))

## [1.1.0](https://github.com/GMOD/graph-fold/compare/v1.0.1...v1.1.0) (2026-11-23)

### Features

- A track's haplotype names the haplotype its walk is part of, so the fragments of one haplotype count once ([a4b33c1](https://github.com/GMOD/graph-fold/commit/a4b33c11e3531da4d74d9c1babc0be3c67516856))

## [1.0.1](https://github.com/GMOD/graph-fold/compare/v1.0.0...v1.0.1) (2026-11-23)

### Bug Fixes

- Count a branch's carriers once, and read repeated, reversed and unwalked reference from the passes each walk makes ([1cd9179](https://github.com/GMOD/graph-fold/commit/1cd9179c52d0c3ff4697f0d81a66e2468cdf31c5))

### Documentation

- Prove the fold on chr14, C4 and AMY1, and say what duplications and nested inversions still do ([1c2b7e8](https://github.com/GMOD/graph-fold/commit/1c2b7e8dd170d5f21cd604d3f76bbe5e22c893f9))

## [1.0.0](https://github.com/GMOD/graph-fold/compare/v0.1.2...v1.0.0) (2026-11-23)

## [0.1.2](https://github.com/GMOD/graph-fold/compare/v0.1.1...v0.1.2) (2026-11-23)

### Bug Fixes

- The reference's label names the haplotypes identical to it where its track came with a count over one ([0585fcc](https://github.com/GMOD/graph-fold/commit/0585fcc31cfce8c8e81c2543f1bb2bab212cf2ac))

## [0.1.1](https://github.com/GMOD/graph-fold/compare/v0.1.0...v0.1.1) (2026-11-23)

### Bug Fixes

- A tube's summary gives one size where the least and most folded away round alike ([aa52260](https://github.com/GMOD/graph-fold/commit/aa522607d8a218bcbced3de9967e88b56033a451))

### Other Changes

- Bump deps: the proof scripts run on the released tubemap-core 2.2.0 and graph-walks 9.1.0 ([e1de69d](https://github.com/GMOD/graph-fold/commit/e1de69d79b363ee4ba9b0da0b253fc8d3dbfd65d))

## [0.1.0](https://github.com/GMOD/graph-fold/compare/v0.1.0...v0.1.0) (2026-11-23)

### Documentation

- The chr16 width under tubemap-core main, and the tarball kept out of git ([a4c740f](https://github.com/GMOD/graph-fold/commit/a4c740f51e5bcb635e0dc5196313331e8dd56903))

### Other Changes

- Fold detours under a threshold into the reference of a tube map's nodes and tracks, keeping large insertions, deletions and inversions as branches ([ac896e5](https://github.com/GMOD/graph-fold/commit/ac896e513754a9b30931e9b8bbe79486969ac527))
- Keep sequence that leaves the reference without rejoining in the window, and end a walk where it stops the threshold or more short of the reference ([8100751](https://github.com/GMOD/graph-fold/commit/8100751d601cf1dfb8fdba18d1ed4ae940b71b01))
- A proof script that folds three HPRC windows at 50 and 1000 bp, checks the invariants and draws each before and after, and a README with the rule, the options, the numbers and the limits ([2fa8e7f](https://github.com/GMOD/graph-fold/commit/2fa8e7ff7e55b04774bee945da111b0864897e46))
- An inversions option that steps carriers through a marked copy of the inverted block, a variation summary on every track of what it hides, and proof pictures drawn as one tube per distinct walk with chevrons, so the inversion loop reads ([7420b54](https://github.com/GMOD/graph-fold/commit/7420b546809d4d396be0e5386bf51303fa55fbae))
- The result carries what its consumers rebuilt: input fields and sourceTrackID on each folded track, a label and the bp folded away per track, the tracks that carry each branch, an anchored flag, the haplotype total, exported label text, and the caller's own nodes and tracks back where a window is not folded, a step on a missing node among the reasons ([9855ee7](https://github.com/GMOD/graph-fold/commit/9855ee7df4218869302c876331e7719aaedce964))
- Release setup after tubemap-core: push and publish workflows, git-cliff changelog, release notes and pack test scripts, the repository field, a README for the package and a note on moving from 0.0.0 ([81a8499](https://github.com/GMOD/graph-fold/commit/81a8499244b95cff813bdf47bc7c843a667101ad))
- A cluster's label says it is a cluster and gives one size where its ends round alike, and a whole number of kb drops its .0 ([948ea7a](https://github.com/GMOD/graph-fold/commit/948ea7a65a19b6c1f0fb6d386cfc2c773d84f956))
- A tube's distinct walks are counted by their steps, so the same walk given as two tracks counts once, and a branch the window cuts through says so in its label ([ec9a402](https://github.com/GMOD/graph-fold/commit/ec9a402e6f975c8968560b9814ae7855b2946c9a))

### Tests

- Each fold rule on a synthetic graph, and the chr15 window from a committed cut ([fbc5b32](https://github.com/GMOD/graph-fold/commit/fbc5b32ec6ee7f47a154bdc589246266e2ec0fe9))

