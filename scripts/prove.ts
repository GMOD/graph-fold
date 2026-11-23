import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { bpLabel, branchLabel, foldGraph, foldProblems } from '../src/index.ts'
import { drawTubeMap } from './draw.ts'
import { layoutTubeMap } from './tubemap.ts'
import { windows } from './windows.ts'

import type { Folded, InputNode, InputTrack } from '../src/index.ts'

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
  fold: Folded,
  kind: string,
  minBp: number,
  haplotypes: number,
) {
  const found = fold.branches.find(
    b => b.kind === kind && b.length >= minBp && !b.open,
  )
  const line = `${id} at ${fold.threshold} bp: ${found ? branchLabel(found, 464) : `no ${kind} of ${bpLabel(minBp)} or more`}`
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

  const walk = 'walk' as const
  const box = 'box' as const
  const variants = [
    { threshold: 50, cluster: false, inversions: walk },
    { threshold: 1000, cluster: false, inversions: walk },
    { threshold: 5000, cluster: false, inversions: walk },
    { threshold: 50, cluster: true, inversions: walk },
    { threshold: 1000, cluster: true, inversions: walk },
    { threshold: 50, cluster: false, inversions: box },
    { threshold: 1000, cluster: false, inversions: box },
    { threshold: 5000, cluster: false, inversions: box },
  ]
  for (const { threshold, cluster, inversions } of variants) {
    const started = performance.now()
    const fold = foldGraph(window.nodes, window.tracks, {
      threshold,
      cluster,
      inversions,
      referenceRevisits: window.revisited,
    })
    const ms = Math.round(performance.now() - started)
    const problems = foldProblems(window.nodes, window.tracks, fold)
    const label = `${threshold} bp${cluster ? ', clustered' : ''}${inversions === 'box' ? ', inversions boxed' : ''}`
    invariants.push(
      `${id} at ${label}: ${problems.length} problems over ${fold.walks.length} walks and ${fold.haplotypes} of ${haplotypes} haplotypes, ${fold.branches.length} branches, folded in ${ms} ms`,
    )
    failures.push(...problems.map(problem => `${id} at ${label}: ${problem}`))
    if (!fold.folded) {
      failures.push(`${id} at ${label}: not folded, ${fold.reason}`)
    }
    if (fold.folded && id === 'chr1-deletion' && threshold >= 1000) {
      expectBranch(id, fold, 'deletion', 45_000, 306)
    }
    if (fold.folded && id === 'chr16-inversion') {
      expectBranch(id, fold, 'inversion', 16_000, 439)
    }
    const drawn =
      fold.folded &&
      threshold !== 5000 &&
      (!cluster || id === 'chr1-deletion') &&
      (inversions === 'walk' ||
        (id === 'chr16-inversion' && threshold === 1000))
    if (drawn) {
      const after = measure(fold.nodes, fold.tracks)
      const basesPerPixel = Math.max(
        1,
        Math.ceil(
          fold.nodes.reduce((sum, node) => sum + node.sequenceLength, 0) / 1100,
        ),
      )
      rows.push(row(`folded at ${label}`, after))
      const boxed = inversions === 'box'
      const tubes = layout(fold.nodes, fold.tracks, {
        ...(boxed ? banded : {}),
        nodeWidthOption: 'small',
        basesPerPixel,
        freqWidth: 'log',
      })
      const inversion = fold.branches.find(
        b => b.kind === 'inversion' && !b.open,
      )
      picture(
        `${id}-fold-${threshold}${cluster ? '-clustered' : ''}${inversions === 'box' ? '-box' : ''}`,
        drawTubeMap(
          tubes,
          [
            `${title}: folded at ${label}`,
            `${count(after.nodes)} nodes, ${count(after.walks)} distinct walks of ${haplotypes} haplotypes, ${count(after.unbanded.columns)} columns; node width is linear, ${basesPerPixel} bp to the px; ${fold.branches.length} kept ${fold.branches.length === 1 ? 'branch' : 'branches'}`,
            ...(inversion
              ? [
                  inversions === 'box'
                    ? `${inversion.haplotypes} haplotypes take the lower box, which is the ${bpLabel(inversion.length)} reference box above it read right to left`
                    : `${inversion.haplotypes} haplotypes pass under the ${bpLabel(inversion.length)} block, turn, run it right to left, turn again and go on: follow the chevrons`,
                ]
              : []),
          ],
          fold,
          !boxed,
        ),
      )
      if (
        (id === 'chr1-deletion' && cluster && threshold === 1000) ||
        (id === 'chr15-alleles' && threshold === 50)
      ) {
        picture(
          `${id}-fold-${threshold}${cluster ? '-clustered' : ''}-banded`,
          drawTubeMap(
            layout(fold.nodes, fold.tracks, {
              ...banded,
              nodeWidthOption: 'small',
              basesPerPixel,
            }),
            [
              `${title}: folded at ${label}, banded`,
              `${count(after.nodes)} nodes, ${count(after.banded.columns)} columns; one band per step between two nodes, sized by the haplotypes that take it`,
            ],
            fold,
          ),
        )
      }
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
