export interface Anchor {
  from: number
  to: number
  reversed: boolean
  at: number
  bp: number
}

export interface Run {
  reversed: boolean
  anchors: Anchor[]
}

export function firstRef({ from, to, reversed }: Anchor) {
  return reversed ? to - 1 : from
}

export function lastRef({ from, to, reversed }: Anchor) {
  return reversed ? from : to - 1
}

export function endStep({ from, to, at }: Anchor) {
  return at + to - from
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
      (anchor.reversed
        ? firstRef(anchor) < lastRef(last)
        : firstRef(anchor) > lastRef(last))
    ) {
      run.anchors.push(anchor)
    } else {
      runs.push({ reversed: anchor.reversed, anchors: [anchor] })
    }
  }
  return runs
}

export function runBounds({ anchors }: Run) {
  const first = anchors[0]!
  const last = anchors.at(-1)!
  return {
    start: Math.min(first.from, last.from),
    end: Math.max(first.to, last.to),
  }
}

function trimmedPast(
  anchor: Anchor,
  reached: number,
  offsets: number[],
): Anchor[] {
  const { from, to, reversed, at, bp } = anchor
  const cut = reversed ? Math.min(to, reached) : Math.max(from, reached + 1)
  const dropped = reversed ? to - cut : cut - from
  const droppedBp = reversed
    ? offsets[to]! - offsets[cut]!
    : offsets[cut]! - offsets[from]!
  return (reversed ? cut <= from : cut >= to)
    ? []
    : [
        {
          from: reversed ? from : cut,
          to: reversed ? cut : to,
          reversed,
          at: at + dropped,
          bp: bp + droppedBp,
        },
      ]
}

function withoutRepeat(runs: Run[], offsets: number[], threshold: number) {
  const r = runs.findIndex((run, k) => {
    const before = runs[k - 1]
    const reached = before === undefined ? 0 : lastRef(before.anchors.at(-1)!)
    const first = firstRef(run.anchors[0]!)
    const repeatedBp = run.reversed
      ? offsets[first + 1]! - offsets[reached]!
      : offsets[reached + 1]! - offsets[first]!
    return (
      before !== undefined &&
      before.reversed === run.reversed &&
      repeatedBp < threshold
    )
  })
  const reached = r > 0 ? lastRef(runs[r - 1]!.anchors.at(-1)!) : Number.NaN
  return r > 0
    ? runs.map((run, k) =>
        k === r
          ? {
              ...run,
              anchors: run.anchors.flatMap(anchor =>
                trimmedPast(anchor, reached, offsets),
              ),
            }
          : run,
      )
    : undefined
}

function withoutShortInnerRun(
  runs: Run[],
  offsets: number[],
  threshold: number,
) {
  let shortest = -1
  let shortestBp = threshold
  for (let r = 1; r < runs.length - 1; r++) {
    const { start, end } = runBounds(runs[r]!)
    const bp = offsets[end]! - offsets[start]!
    if (bp < shortestBp) {
      shortest = r
      shortestBp = bp
    }
  }
  return shortest > 0 ? runs.filter((_, r) => r !== shortest) : undefined
}

export function chain(anchors: Anchor[], offsets: number[], threshold: number) {
  let runs = runsOf(anchors)
  let settled = false
  while (!settled) {
    const changed =
      withoutRepeat(runs, offsets, threshold) ??
      withoutShortInnerRun(runs, offsets, threshold)
    if (changed === undefined) {
      settled = true
    } else {
      runs = runsOf(changed.flatMap(run => run.anchors))
    }
  }
  return runs
}
