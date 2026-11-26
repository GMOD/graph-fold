# Limits

- **Driven by steps, or runs, and by ends only where given.** The fold reads the
  tracks handed to the layout, so it folds a graph from any source. Without
  [`ends`](runs.md#open-ends), a walk whose piece in the window starts or ends
  inside it is listed as `walk starts inside the window` or
  `walk ends inside the window`, whatever lies past that end
- **An open end is not joined to the walk's other piece in the window.** A
  departure whose far end is inside the window leaves its two pieces as two
  walks. Given `ends`, neither is said to start or end there, and the departure
  draws no branch, so a branch at its site does not count that walk. Without
  `ends`, each is listed as starting or ending inside the window
- **A walk whose departure spans the whole window is not in it.** It has no
  piece there, so it is in no count of the window
- **An insertion is its site and its length.** Two alleles of one length at one
  site are one branch whatever their sequence; `members` lists the nodes of both
- **A duplication the graph holds off the reference is an insertion.** C4 and
  the KIV-2 repeat fold as insertions and replacements; nothing says the
  inserted sequence is a copy
- **A jump is a deletion even where the walk comes back.** On AMY1 a walk jumps
  94.2 kb and later walks part of that reference on another pass. The branch
  says `deletion`, which is the step the walk takes there and not a statement
  that the haplotype lacks the sequence; the repeat branches over the same
  reference say what it walks
- **A repeat is cut where the pass count changes.** A walk with three copies of
  one stretch and two of the next gets two repeat branches, and walks with
  different ends get different branches, so AMY1 at 5000 bp has 23 of them. They
  are not clustered
- **Sequence between two runs is not clustered.** AMY1 keeps 95 branches of
  `sequence off the reference between two breakpoints`, most within a few bp of
  75 kb
- **An inversion inside an inversion is two inversions.** `A -D C -B E` reports
  `B` and `D` inverted and `C` not, which is the route and not the nesting. No
  window with one was found: none of the 142 windows over the inversions of the
  HPRC structural record table has a walk of that shape at 50 bp
- **Nothing is nested.** A variant inside a kept insertion changes that
  insertion's length and makes it another allele. A big detour inside an
  inversion is kept
- **Close breakpoints leave short backbone nodes.** The chr1 window keeps a 1 bp
  node between a deletion's end and a replacement's end one bp apart; chr14
  keeps one of 1 bp and C4 ones of 6 and 9 bp
- **A walk that lies wholly inside an inversion** takes every step reversed, as
  does a walk written against the reference. The fold cannot tell them apart,
  reports no inversion for either, and draws both reversed over the merged
  nodes. A walk whose two ends run opposite ways takes the direction most of its
  reference runs
- **Fragments are walks unless the caller names their haplotype.** Without
  `haplotype`, a haplotype in two walks counts twice in `haplotypes` and in a
  branch both walks carry. The AMY1 window has 490 walks under 464 haplotype
  names, the reference among them, and the windows above are counted by walk
- **Passes are counted walk by walk.** A haplotype whose walks pass a repeat a
  different number of times counts under each of their entries in `copies`, so
  those can add up to more than the branch's `haplotypes`
- **A graph whose reference revisits a node is never folded,** however far the
  revisit is from the window. No pggb window of a human graph was run
