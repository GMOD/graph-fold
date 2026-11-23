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

