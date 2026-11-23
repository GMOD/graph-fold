import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { foldGraph, foldProblems } from '../src/index.ts'
import { bpText, branchText, drawTubeMap } from './draw.ts'
import { layoutTubeMap } from './tubemap.ts'
import { windows } from './windows.ts'

import type { FoldResult, InputNode, InputTrack } from '../src/index.ts'

interface Window {
  revisited: number
  nodes: InputNode[]
  tracks: InputTrack[]
}

const banded = {
  nodeWidthOption: 'compressed' as const,
  layers: [{ data: 'haplotypes' as const, stat: 'coarsen' as const }],
}
const unbanded = { nodeWidthOption: 'compressed' as const }

function layout(nodes: InputNode[], tracks: InputTrack[], options: object) {
  const laid = layoutTubeMap(
    nodes,
    tracks.map((track, id) => ({ sourceTrackID: id, ...track, id })),
    [],
    options,
  )
  if (!laid) {
    throw new Error('the layout came back empty')
  }
  return laid
}

function measure(nodes: InputNode[], tracks: InputTrack[]) {
  const [bandedLayout, unbandedLayout] = [banded, unbanded].map(options =>
    layout(nodes, tracks, options),
  )
  const size = (laid: ReturnType<typeof layout>) => ({
    columns: laid.maxOrder + 1,
    px: Math.round(laid.bounds.maxX - laid.bounds.minX),
  })
  return {
    nodes: nodes.length,
    walks: tracks.length,
    banded: size(bandedLayout!),
    unbanded: size(unbandedLayout!),
    bandedLayout: bandedLayout!,
  }
}

function picture(name: string, svg: string) {
  writeFileSync(`docs/${name}.svg`, svg)
  execFileSync('rsvg-convert', [
    '--zoom',
    '1.5',
    '--output',
    `docs/${name}.png`,
    `docs/${name}.svg`,
  ])
}

const count = (n: number) => n.toLocaleString('en-US')
const failures: string[] = []
const rows: string[] = []
const invariants: string[] = []
mkdirSync('docs', { recursive: true })

function expectBranch(
  id: string,
  fold: FoldResult,
  kind: string,
  minBp: number,
  haplotypes: number,
) {
  const found = fold.branches.find(
    b => b.kind === kind && b.length >= minBp && !b.open,
  )
  const line = `${id} at ${fold.threshold} bp: ${found ? branchText(found, 464) : `no ${kind} of ${bpText(minBp)} or more`}`
  invariants.push(line)
  if (found?.haplotypes !== haplotypes) {
    failures.push(`${line}; expected ${haplotypes} haplotypes`)
  }
}

for (const { id, title, file } of windows) {
  if (!existsSync(file)) {
    throw new Error(`${file} is missing; run pnpm fetch`)
  }
  const window: Window = JSON.parse(readFileSync(file, 'utf8'))
  const haplotypes = window.tracks.reduce((sum, t) => sum + (t.freq ?? 1), 0)
  const before = measure(window.nodes, window.tracks)
  const row = (label: string, m: ReturnType<typeof measure>) =>
    `| ${id} | ${label} | ${count(m.nodes)} | ${count(m.walks)} | ${count(m.banded.columns)} | ${count(m.banded.px)} | ${count(m.unbanded.columns)} | ${count(m.unbanded.px)} |`
  rows.push(row('before', before))
  picture(
    `${id}-before`,
    drawTubeMap(before.bandedLayout, [
      `${title}: before`,
      `${count(before.nodes)} nodes, ${count(before.walks)} distinct walks of ${haplotypes} haplotypes, ${count(before.banded.columns)} columns; the layout is ${count(before.banded.px)} px wide and is drawn here at ${((100 * 1352) / (before.banded.px + 20)).toFixed(1)}% of that`,
    ]),
  )

  const variants = [
    { threshold: 50, cluster: false },
    { threshold: 1000, cluster: false },
    { threshold: 5000, cluster: false },
    { threshold: 50, cluster: true },
    { threshold: 1000, cluster: true },
  ]
  for (const { threshold, cluster } of variants) {
    const started = performance.now()
    const fold = foldGraph(window.nodes, window.tracks, {
      threshold,
      cluster,
      referenceRevisits: window.revisited,
    })
    const ms = Math.round(performance.now() - started)
    const problems = foldProblems(window.nodes, window.tracks, fold)
    const label = `${threshold} bp${cluster ? ', clustered' : ''}`
    invariants.push(
      `${id} at ${label}: ${problems.length} problems over ${fold.walks.length} walks and ${fold.tracks.reduce((sum, t) => sum + t.freq, 0)} of ${haplotypes} haplotypes, ${fold.branches.length} branches, folded in ${ms} ms`,
    )
    failures.push(...problems.map(problem => `${id} at ${label}: ${problem}`))
    if (!fold.folded) {
      failures.push(`${id} at ${label}: not folded, ${fold.reason}`)
    }
    if (id === 'chr1-deletion' && threshold >= 1000) {
      expectBranch(id, fold, 'deletion', 45_000, 306)
    }
    if (id === 'chr16-inversion') {
      expectBranch(id, fold, 'inversion', 16_000, 439)
    }
    const drawn = threshold !== 5000 && (!cluster || id === 'chr1-deletion')
    if (drawn) {
      const after = measure(fold.nodes, fold.tracks)
      const basesPerPixel = Math.max(
        1,
        Math.ceil(
          fold.nodes.reduce((sum, node) => sum + node.sequenceLength, 0) / 1100,
        ),
      )
      const toScale = layout(fold.nodes, fold.tracks, {
        ...banded,
        nodeWidthOption: 'small',
        basesPerPixel,
      })
      rows.push(row(`folded at ${label}`, after))
      picture(
        `${id}-fold-${threshold}${cluster ? '-clustered' : ''}`,
        drawTubeMap(
          toScale,
          [
            `${title}: folded at ${label}`,
            `${count(after.nodes)} nodes, ${count(after.walks)} distinct walks of ${haplotypes} haplotypes, ${count(after.banded.columns)} columns; node width is linear, ${basesPerPixel} bp to the px; ${fold.branches.length} kept ${fold.branches.length === 1 ? 'branch' : 'branches'}`,
          ],
          fold,
        ),
      )
    }
  }
}

console.log(
  [
    '| window | graph | nodes | distinct walks | columns, banded | px wide, banded | columns, unbanded | px wide, unbanded |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    ...invariants.map(line => `- ${line}`),
  ].join('\n'),
)
if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exitCode = 1
}
