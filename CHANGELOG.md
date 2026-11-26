## [1.3.0](https://github.com/GMOD/graph-fold/compare/v1.2.0...v1.3.0) (2026-11-26)

### Bug Fixes

- A walk with no step on the reference is one node of its own bp, named by the walk and shared with no other, in foldGraph as in foldRuns, where each of its steps was a node of its own; the oracle test names this allowance ([8f9226b](https://github.com/GMOD/graph-fold/commit/8f9226b537858099d29c6bc1863e3ebd4bd8d864))
- The variation line no longer counts distinct walks, which a cut with stand-in nodes overcounts and runs undercount, and a track's variation drops its walks field; the oracle test names this allowance ([ebc2c87](https://github.com/GMOD/graph-fold/commit/ebc2c87857857c069357940e6722935f85ed0323))
- Ends take graph-walks' four kinds, beyond, elsewhere, edge and ends; at an edge, and at a departure the fold does not draw, the walk is neither said to end inside the window nor to continue past it ([d6370c2](https://github.com/GMOD/graph-fold/commit/d6370c2ed2256e8e681e8c263c116f5089dfebdc))
- An open branch whose far end is reversed or out of order states its own bp as its own, not as a size of the reversal or the displacement ([233fe3e](https://github.com/GMOD/graph-fold/commit/233fe3ef10d1ebd7953aeb06f89ba84cb79b763c))
- Walks that differ past an end are separate tracks, so a branch's tracks hold its carriers alone; an inversion at an end the walk truly has is not open; a far end reversed or out of order is one branch whichever way the contig is written, its node named by side; ends are checked and may be graph-walks' END_KINDS numbers; foldRuns takes ends only in its input; and a test holds each open branch to the whole graph's branch the window cuts ([b381cab](https://github.com/GMOD/graph-fold/commit/b381cab9687da56de1477e47358732cde4668b7d))
- The fourth end kind is nowhere, as gfa-tabix now names it, in END_KINDS and the strings accepted; the runs page says elsewhere is every other departure and that a host reads runs contained ([75c9204](https://github.com/GMOD/graph-fold/commit/75c92047cb71eb22c11784cc09b726c7415fae79))
- Only a beyond departure draws an open branch; at every other end given, edge, elsewhere, nowhere or a departure that lacks bp, the piece's own bp past its last reference step fold into the reference node, with no lead or tail node and no event, since that length is the reader's cut and not the haplotype's; a nowhere end keeps its walk-end sentence, which the limits page says is true of the contig ([3099361](https://github.com/GMOD/graph-fold/commit/309936193f3cb8817a405d50b381724f7299194e))

### Chores

- Fetch windows with @gmod/gfa-tabix 10, the renamed @jbrowse/graph-walks ([62c0f1f](https://github.com/GMOD/graph-fold/commit/62c0f1fc460acbd2a522b88144e351eab059d65a))

### Documentation

- Shorten the README and move the rule, result, windows and limits into docs/ ([1a51606](https://github.com/GMOD/graph-fold/commit/1a5160610f97db92d6a569bd75c88d22ab5b2a0f))
- A before-and-after diagram as the README hero, in plain words, and the real windows' pictures move to docs/windows.md ([ac84721](https://github.com/GMOD/graph-fold/commit/ac847214bfea29e24e7d40a5b76bbc7682775fd7))
- The README hero sorts each difference by size against the threshold, drawn by scripts/hero.py ([8e8a430](https://github.com/GMOD/graph-fold/commit/8e8a43047603dbf5518ced3b073a29fe56b27d74))
- The hero's size rule is a vertical panel on the right, so its scale is not read as genome position ([081ff4e](https://github.com/GMOD/graph-fold/commit/081ff4e1c17a26f40da6001568557f2338f486b8))
- Shorter Docs entries in the README ([07fba26](https://github.com/GMOD/graph-fold/commit/07fba262953da3e84d94e9a9bf1a97e2d2346ea6))
- The README's usage and options say less; every input field moves to docs/result.md ([480d5fd](https://github.com/GMOD/graph-fold/commit/480d5fd22f6baecc0a151d2ae0d4ea7a2b16910f))
- A tighter README: shorter intro, no repeated links, plainer usage ([a7aa2ea](https://github.com/GMOD/graph-fold/commit/a7aa2ea70791e13b2fe5e6b4eb070cf6336eaaee))
- Runs, open ends and the off-reference walk rule move to docs, in a new Runs and open ends page, with the README naming foldRuns and ends in a line and linking the page ([ecbf14c](https://github.com/GMOD/graph-fold/commit/ecbf14c5e0457bb659a3b9de6f1b9716d3cf1038))
- Pnpm prove redraws the pictures whose tube lines named a count of distinct walks ([0bd4b7b](https://github.com/GMOD/graph-fold/commit/0bd4b7b4e85722cba14bcf7c53cec6aa6b04ba5a))

### Features

- FoldRuns folds walks given as runs, stretches of the reference and the bp of their own between them, by expanding them to steps on the existing core, and foldRunsProblems checks its result; it equals foldGraph of the same walks as steps outside members and the distinct-walk count on every fixture and 1,450 random graphs ([cf14bdb](https://github.com/GMOD/graph-fold/commit/cf14bdbfe2774a28e2b5d7fe08cb889bfca7d60a))
- Ends, an option of foldGraph and a field of the runs input, says what lies past each end of a walk's piece; a departure whose far breakpoint lies past the window becomes a branch of its true sizes that continues past the window, with beyond, clamped to the window, its own bp a node over the threshold, clustering only with open branches of the same breakpoints, where the piece was said to start or end inside the window ([cc80bfe](https://github.com/GMOD/graph-fold/commit/cc80bfe1f735a34e2a67c18ad1a5f573af7388a7))

### Performance Improvements

- Each anchor is a range of consecutive reference steps, trimmed where a repeat of reference is dropped and walked segment by segment, so the fold's work scales with ranges, and foldRuns builds ranges straight from stretches without steps; foldRuns takes positions from the reference starts and refuses starts that leave a gap, a threshold under 1 bp is refused, and the step reader makes one lookup per step ([6e0c513](https://github.com/GMOD/graph-fold/commit/6e0c5132442a1b69f704c01f876a823b5d61e5bf))

### Tests

- Freeze 1.2.0's fold and its imports under test/oracle, and check foldGraph against it on every fixture at 50, 236, 1000 and 5000 bp, clustered or not, inversions walked or boxed, and on 3,000 seeded random graphs ([534480f](https://github.com/GMOD/graph-fold/commit/534480f7da41bc270c9481093b851c599bfa7e2f))

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

