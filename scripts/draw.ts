import { curvePaths, nodeOutlinePath } from './tubemap.ts'

import type { Branch, FoldResult } from '../src/index.ts'
import type { layoutTubeMap } from '@jbrowse/tubemap-core'

type Layout = NonNullable<ReturnType<typeof layoutTubeMap>>

const kindColor = {
  insertion: '#1f77b4',
  deletion: '#d62728',
  inversion: '#8e44ad',
  other: '#e67e22',
}
const referenceColor = '#2b2b2b'
const haplotypeColor = '#aab4c0'
const severalKindsColor = '#0e8f80'
const pictureWidth = 1400
const margin = 24
const rowHeight = 17
const labelLimit = 14

export function bpText(bp: number) {
  return bp >= 1000
    ? `${(bp / 1000).toFixed(bp >= 100_000 ? 0 : 1)} kb`
    : `${bp} bp`
}

export function branchText(branch: Branch, total: number) {
  const size =
    branch.insertedBp > 0 && branch.deletedBp > 0
      ? `${bpText(branch.insertedBp)} for ${bpText(branch.deletedBp)}`
      : bpText(branch.length)
  const cluster = branch.cluster
    ? ` (${branch.cluster.members} lengths, ${bpText(branch.cluster.minLength)} to ${bpText(branch.cluster.maxLength)})`
    : ''
  return `${branch.description} ${size}${cluster}, ${branch.haplotypes} of ${total}`
}

const escapeXml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const nodeName = (step: string) => (step.startsWith('-') ? step.slice(1) : step)

function branchesOf(sequence: string[], fold: FoldResult) {
  const names = sequence.map(nodeName)
  const stepped = new Set(names)
  const reversed = new Set(
    sequence.filter(step => step.startsWith('-')).map(nodeName),
  )
  const copies = new Set(
    fold.nodes.flatMap(n => (n.invertedOf === undefined ? [] : [n.name])),
  )
  const jumps = new Set(
    names.flatMap((name, i) =>
      i === 0 ? [] : [`${names[i - 1]}>${name}`, `${name}>${names[i - 1]}`],
    ),
  )
  return fold.branches.filter(branch =>
    branch.kind === 'inversion'
      ? branch.nodes.some(n =>
          copies.has(n) ? stepped.has(n) : reversed.has(n),
        )
      : branch.nodes.length > 0
        ? branch.nodes.some(n => stepped.has(n))
        : jumps.has(`${branch.from}>${branch.to}`),
  )
}

function trackColors(layout: Layout, fold: FoldResult | undefined) {
  return new Map(
    layout.tracks.map(track => {
      const kinds = fold
        ? [...new Set(branchesOf(track.sequence, fold).map(b => b.kind))]
        : []
      return [
        track.id,
        track.id === 0
          ? referenceColor
          : kinds.length > 1
            ? severalKindsColor
            : kinds[0]
              ? kindColor[kinds[0]]
              : haplotypeColor,
      ]
    }),
  )
}

function chevrons(layout: Layout) {
  return layout.shapes.rectangles
    .flatMap(r => {
      const segment = layout.tracks
        .find(track => track.id === r.id)
        ?.path.find(s => s.y === r.yStart)
      const height = r.yEnd - r.yStart + 1
      const size = Math.min(5, height / 2 - 2)
      const way = segment?.isForward === false ? -1 : 1
      const middle = r.yStart + height / 2
      const count = Math.floor((r.xEnd - r.xStart - 16) / 34)
      return segment && size >= 3
        ? Array.from({ length: Math.max(0, count) }, (_, i) => {
            const x = r.xStart + 24 + i * 34
            return `<path d="M${x - way * size * 0.6} ${middle - size}L${x + way * size * 0.6} ${middle}L${x - way * size * 0.6} ${middle + size}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
          })
        : []
    })
    .join('')
}

function shapesSvg(
  layout: Layout,
  fold: FoldResult | undefined,
  tubes: boolean,
) {
  const colors = trackColors(layout, fold)
  const fill = (id: number) => colors.get(id) ?? haplotypeColor
  const parts: string[] = []
  const { rectangles, verticalRectangles, curves, corners } = layout.shapes
  const box = (x: number, y: number, w: number, h: number, id: number) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill(id)}"`
  for (const r of verticalRectangles) {
    parts.push(
      `${box(r.xStart, r.yStart, r.xEnd - r.xStart + 1, r.yEnd - r.yStart + 1, r.id)}/>`,
    )
  }
  for (const r of rectangles) {
    const height = r.yEnd - r.yStart + 1
    const read = tubes
      ? (layout.tracks.find(track => track.id === r.id)?.path ?? []).flatMap(
          segment => {
            const node =
              segment.node !== null && segment.y === r.yStart
                ? layout.nodes[segment.node]
                : undefined
            const from = Math.max(r.xStart, node?.x ?? Infinity)
            const to = Math.min(
              r.xEnd + 1,
              node ? node.x + node.pixelWidth : -Infinity,
            )
            return to > from ? [{ from, to }] : []
          },
        )
      : [{ from: r.xStart, to: r.xEnd + 1 }]
    if (tubes) {
      parts.push(
        `${box(r.xStart, r.yStart, r.xEnd - r.xStart + 1, height, r.id)} fill-opacity="0.45"/>`,
      )
    }
    for (const { from, to } of read) {
      parts.push(`${box(from, r.yStart, to - from, height, r.id)}/>`)
    }
  }
  for (const type of ['haplotype', 'read'] as const) {
    for (const c of curvePaths(
      curves.filter(curve => (curve.type ?? 'haplotype') === type),
      type,
    )) {
      parts.push(`<path d="${c.path}" fill="${fill(c.id)}"/>`)
    }
  }
  for (const c of corners) {
    parts.push(`<path d="${c.path}" fill="${fill(c.id)}"/>`)
  }
  const branchKind = new Map(
    (fold?.branches ?? []).flatMap(branch =>
      branch.kind === 'inversion' || branch.nodes.length === 1
        ? branch.nodes.map(node => [node, branch.kind] as const)
        : [],
    ),
  )
  if (tubes) {
    parts.push(chevrons(layout))
  }
  layout.nodes.forEach(node => {
    const kind = branchKind.get(node.name)
    parts.push(
      `<path d="${nodeOutlinePath(node)}" fill="none" stroke="${kind ? kindColor[kind] : '#111'}" stroke-width="${kind ? 3 : 1}"/>`,
    )
  })
  return parts.join('')
}

function placedNodes(layout: Layout) {
  return new Map(
    layout.nodes.flatMap(node =>
      node.order === undefined ? [] : [[node.name, node] as const],
    ),
  )
}

function anchors(layout: Layout, fold: FoldResult) {
  const nodes = placedNodes(layout)
  return fold.branches.flatMap(branch => {
    const boxes = branch.nodes.flatMap(name => {
      const node = nodes.get(name)
      return node ? [node] : []
    })
    const from = branch.from === undefined ? undefined : nodes.get(branch.from)
    const to = branch.to === undefined ? undefined : nodes.get(branch.to)
    const middle =
      from && to ? (from.x + from.pixelWidth + to.x) / 2 : Number.NaN
    const carriers = new Set(
      layout.tracks
        .filter(track => branchesOf(track.sequence, fold).includes(branch))
        .map(track => track.id),
    )
    const crossing = [...layout.shapes.rectangles, ...layout.shapes.curves]
      .filter(
        shape =>
          carriers.has(shape.id) &&
          shape.xStart <= middle &&
          shape.xEnd >= middle,
      )
      .sort((a, b) => a.xEnd - a.xStart - (b.xEnd - b.xStart))[0]
    return boxes.length > 0
      ? [
          {
            branch,
            x:
              (Math.min(...boxes.map(n => n.x)) +
                Math.max(...boxes.map(n => n.x + n.pixelWidth))) /
              2,
            y: Math.min(...boxes.map(n => n.y)),
          },
        ]
      : crossing
        ? [
            {
              branch,
              x: middle,
              y: (crossing.yStart + crossing.yEnd) / 2,
            },
          ]
        : []
  })
}

export function drawTubeMap(
  layout: Layout,
  lines: string[],
  fold?: FoldResult,
  tubesCrossBoxes = false,
) {
  const tubes =
    fold === undefined
      ? []
      : layout.tracks
          .flatMap(track => {
            const folded = fold.tracks.find(t => t.id === track.id)
            const first = layout.shapes.rectangles.find(r => r.id === track.id)
            return tubesCrossBoxes && folded && first && track.id !== 0
              ? [{ folded, first }]
              : []
          })
          .sort((a, b) => b.folded.freq - a.folded.freq)
          .slice(0, 8)
  const colors = trackColors(layout, fold)
  const { minX, maxX, minY, maxY } = layout.bounds
  const natural = maxX - minX + 20
  const scale = Math.min(1.5, (pictureWidth - 2 * margin) / natural)
  const total = fold?.tracks.reduce((sum, t) => sum + t.freq, 0) ?? 0
  const toX = (x: number) => margin + (x - minX + 10) * scale
  const anchored = fold ? anchors(layout, fold) : []
  const labelled = [...anchored]
    .sort((a, b) => b.branch.haplotypes - a.branch.haplotypes)
    .slice(0, labelLimit)
    .sort((a, b) => a.x - b.x)
  const rows: number[] = []
  const labels = labelled.map(({ branch, x, y }) => {
    const text = branchText(branch, total)
    const width = text.length * 6.6 + 8
    const left = Math.min(
      Math.max(margin, toX(x) - width / 2),
      pictureWidth - margin - width,
    )
    const free = rows.findIndex(end => end + 10 < left)
    const row = free === -1 ? rows.length : free
    rows[row] = left + width
    return { branch, text, left, width, row, x, y }
  })
  const unanchored = (fold?.branches ?? []).filter(
    branch => !anchored.some(a => a.branch === branch),
  )
  const unlabelled = anchored.length - labels.length
  const footer = [
    ...(fold
      ? [
          `${tubesCrossBoxes ? 'reference dark on top; one tube per distinct folded walk, wider with more haplotypes (log scale), chevrons point the way it runs, pale where it passes a box without reading it' : 'reference dark, bands sized by haplotype share'}; a ${tubesCrossBoxes ? 'tube' : 'band'} or box takes the colour of its branch${fold.nodes.some(node => node.invertedOf !== undefined) ? '; a box of arrows pointing left is a copy of the reference box it is tied to, reversed' : ''}:`,
        ]
      : []),
    ...tubes.map(({ folded }, i) => {
      const { walks, insertedBp, skippedBp } = folded.variation
      const most = Math.max(insertedBp.max, skippedBp.max)
      return `tube ${i + 1}: ${folded.freq} ${folded.freq === 1 ? 'haplotype' : 'haplotypes'}, ${walks} distinct ${walks === 1 ? 'walk' : 'walks'}, ${most === 0 ? 'nothing folded away' : `up to ${bpText(most)} folded away in one`}`
    }),
    ...unanchored
      .slice(0, 4)
      .map(branch => `no box or band of its own: ${branchText(branch, total)}`),
    ...(unlabelled > 0
      ? [
          `${unlabelled} more ${unlabelled === 1 ? 'branch is' : 'branches are'} drawn and not labelled`,
        ]
      : []),
  ]
  const headerHeight = lines.length * 20 + 12
  const labelsHeight = rows.length * rowHeight + (rows.length > 0 ? 30 : 0)
  const mapTop = headerHeight + labelsHeight
  const mapHeight = Math.max(6, (maxY - minY + 20) * scale)
  const toY = (y: number) => mapTop + (y - minY + 10) * scale
  const sizeLabels = fold
    ? [...placedNodes(layout).values()].flatMap(node =>
        node.pixelWidth * scale >= 34 &&
        fold.members[node.name]?.[0] !== undefined &&
        fold.nodes.find(n => n.name === node.name)?.kind === 'reference'
          ? [
              `<text x="${toX(node.x + node.pixelWidth / 2)}" y="${toY(node.y) - 5}" font-size="11" text-anchor="middle" fill="#444">${bpText(node.sequenceLength)}</text>`,
            ]
          : [],
      )
    : []
  const screenHeight =
    fold === undefined && scale < 1 ? Math.min(420, maxY - minY + 20) : 0
  const screenTop = mapTop + mapHeight + 34
  const screen =
    screenHeight > 0
      ? `<text x="${margin}" y="${screenTop - 8}" font-size="13" fill="#111">its first ${pictureWidth - 2 * margin} px at full size:</text><clipPath id="screen"><rect x="${margin}" y="${screenTop}" width="${pictureWidth - 2 * margin}" height="${screenHeight}"/></clipPath><g clip-path="url(#screen)"><g transform="translate(${margin - (minX - 10)} ${screenTop - (minY - 10)})">${shapesSvg(layout, fold, false)}</g></g>`
      : ''
  const placed = placedNodes(layout)
  const triangles = (
    from: number,
    to: number,
    y: number,
    leftward: boolean,
    color: string,
    opacity: number,
    outline = 'none',
  ) => {
    const count = Math.max(1, Math.floor((to - from - 30) / 44))
    const gap = (to - from) / (count + 1)
    return Array.from({ length: count }, (_, i) => {
      const x = from + gap * (i + 1)
      const tip = leftward ? x - 8 : x + 8
      const back = leftward ? x + 6 : x - 6
      return `<path d="M${tip} ${y}L${back} ${y - 7}L${back} ${y + 7}Z" fill="${color}" fill-opacity="${opacity}" stroke="${outline}" stroke-width="1.5"/>`
    }).join('')
  }
  const copies = (fold?.nodes ?? [])
    .flatMap(node => {
      const copy = placed.get(node.name)
      const mirrored =
        node.invertedOf === undefined ? undefined : placed.get(node.invertedOf)
      return copy && mirrored ? [{ copy, mirrored }] : []
    })
    .map(({ copy, mirrored }) => {
      const left = toX(copy.x)
      const right = toX(copy.x + copy.pixelWidth)
      const middle = toY(copy.y + copy.contentHeight / 2)
      const tieFrom = toY(mirrored.y + mirrored.contentHeight)
      const tieTo = toY(copy.y)
      const ties = [0.25, 0.75]
        .map(share => {
          const x = left + (right - left) * share
          return `<line x1="${x}" y1="${Math.min(tieFrom, tieTo) - 6}" x2="${x}" y2="${Math.max(tieFrom, tieTo) + 6}" stroke="${kindColor.inversion}" stroke-width="1.5" stroke-dasharray="4 3"/>`
        })
        .join('')
      const note =
        right - left > 330
          ? `<text x="${(left + right) / 2}" y="${middle - 12}" font-size="12" text-anchor="middle" fill="${tubesCrossBoxes ? '#fff' : kindColor.inversion}" stroke="${tubesCrossBoxes ? kindColor.inversion : '#fff'}" stroke-width="4" paint-order="stroke">the reference box above, reversed</text>`
          : ''
      return `${ties}${triangles(left, right, middle + (note ? 6 : 0), true, tubesCrossBoxes ? '#fff' : kindColor.inversion, 0.95, tubesCrossBoxes ? kindColor.inversion : 'none')}${note}${triangles(toX(mirrored.x), toX(mirrored.x + mirrored.pixelWidth), toY(mirrored.y + mirrored.contentHeight * 0.62), false, '#555', 0.35)}`
    })
    .join('')
  const legendTop =
    mapTop + mapHeight + 18 + (screenHeight > 0 ? screenHeight + 34 : 0)
  const badges = tubes
    .map(({ folded, first }, i) => {
      const x = toX(first.xStart) + 12
      const y = toY((first.yStart + first.yEnd) / 2)
      return `<circle cx="${x}" cy="${y}" r="8" fill="#fff" stroke="${colors.get(folded.id) ?? haplotypeColor}" stroke-width="1.5"/><text x="${x}" y="${y + 4}" font-size="11" text-anchor="middle" fill="#111">${i + 1}</text>`
    })
    .join('')
  const legend = fold
    ? Object.entries({ ...kindColor, 'several kinds': severalKindsColor })
        .map(
          ([kind, color], i) =>
            `<rect x="${margin + i * 115}" y="${legendTop + 8}" width="14" height="14" fill="${color}"/><text x="${margin + i * 115 + 20}" y="${legendTop + 20}" font-size="12" fill="#222">${kind}</text>`,
        )
        .join('')
    : ''
  const height =
    legendTop + (fold ? 30 : 0) + footer.length * 16 + (fold ? 8 : 0)
  const header = lines
    .map(
      (line, i) =>
        `<text x="${margin}" y="${22 + i * 20}" font-size="${i === 0 ? 15 : 13}" font-weight="${i === 0 ? 600 : 400}" fill="#111">${escapeXml(line)}</text>`,
    )
    .join('')
  const baselineOf = (row: number) =>
    headerHeight + (rows.length - row) * rowHeight
  const labelSvg = [
    ...labels.map(
      ({ branch, left, width, row, x, y }) =>
        `<line x1="${Math.min(Math.max(toX(x), left + 4), left + width - 4)}" y1="${baselineOf(row) + 4}" x2="${toX(x)}" y2="${toY(y)}" stroke="${kindColor[branch.kind]}" stroke-width="1"/>`,
    ),
    ...labels.map(
      ({ branch, text, left, row }) =>
        `<text x="${left + 4}" y="${baselineOf(row)}" font-size="12" fill="${kindColor[branch.kind]}" stroke="#fff" stroke-width="4" paint-order="stroke">${escapeXml(text)}</text>`,
    ),
  ].join('')
  const footerSvg = footer
    .map(
      (line, i) =>
        `<text x="${margin}" y="${legendTop + (i === 0 ? 0 : 32 + i * 16)}" font-size="12" fill="#444">${escapeXml(line)}</text>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pictureWidth}" height="${Math.ceil(height)}" viewBox="0 0 ${pictureWidth} ${Math.ceil(height)}" font-family="DejaVu Sans, Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/>${header}<g transform="translate(${margin - (minX - 10) * scale} ${mapTop - (minY - 10) * scale}) scale(${scale})">${shapesSvg(layout, fold, tubesCrossBoxes)}</g>${copies}${badges}${sizeLabels.join('')}${labelSvg}${screen}${footerSvg}${legend}</svg>`
}
