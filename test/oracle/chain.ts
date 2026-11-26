export interface Anchor {
  ref: number
  reversed: boolean
  step: number
}

export interface Run {
  reversed: boolean
  anchors: Anchor[]
}

export function runsOf(anchors: Anchor[]) {
  const runs: Run[] = []
  for (const anchor of anchors) {
    const run = runs.at(-1)
    const last = run?.anchors.at(-1)
    if (
      run !== undefined &&
      last !== undefined &&
      run.reversed === anchor.reversed &&
      (anchor.reversed ? anchor.ref < last.ref : anchor.ref > last.ref)
    ) {
      run.anchors.push(anchor)
    } else {
      runs.push({ reversed: anchor.reversed, anchors: [anchor] })
    }
  }
  return runs
}

export function runBounds({ anchors }: Run) {
  const first = anchors[0]!.ref
  const last = anchors.at(-1)!.ref
  return { start: Math.min(first, last), end: Math.max(first, last) + 1 }
}

function repeatedAnchors(runs: Run[], offsets: number[], threshold: number) {
  const repeated: Anchor[] = []
  for (let r = 1; r < runs.length && repeated.length === 0; r++) {
    const before = runs[r - 1]!
    const run = runs[r]!
    if (before.reversed === run.reversed) {
      const reached = before.anchors.at(-1)!.ref
      const first = run.anchors[0]!.ref
      const repeatedBp = run.reversed
        ? offsets[first + 1]! - offsets[reached]!
        : offsets[reached + 1]! - offsets[first]!
      if (repeatedBp < threshold) {
        repeated.push(
          ...run.anchors.filter(a =>
            run.reversed ? a.ref >= reached : a.ref <= reached,
          ),
        )
      }
    }
  }
  return repeated
}

function shortestInnerRun(runs: Run[], offsets: number[], threshold: number) {
  let shortest: Run | undefined
  let shortestBp = threshold
  for (const run of runs.slice(1, -1)) {
    const { start, end } = runBounds(run)
    const bp = offsets[end]! - offsets[start]!
    if (bp < shortestBp) {
      shortest = run
      shortestBp = bp
    }
  }
  return shortest?.anchors ?? []
}

export function chain(anchors: Anchor[], offsets: number[], threshold: number) {
  let kept = anchors
  let runs = runsOf(kept)
  let settled = false
  while (!settled) {
    const repeated = repeatedAnchors(runs, offsets, threshold)
    const dropped = new Set(
      repeated.length > 0
        ? repeated
        : shortestInnerRun(runs, offsets, threshold),
    )
    if (dropped.size > 0) {
      kept = kept.filter(a => !dropped.has(a))
      runs = runsOf(kept)
    } else {
      settled = true
    }
  }
  return runs
}
