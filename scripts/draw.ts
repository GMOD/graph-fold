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

function trackColors(layout: Layout, fold: FoldResult | undefined) {
  const kindOfNode = new Map<string, Branch['kind']>()
  const kindOfJump = new Map<string, Branch['kind']>()
  for (const branch of fold?.branches ?? []) {
    if (branch.kind !== 'inversion') {
      for (const node of branch.nodes) {
        kindOfNode.set(node, branch.kind)
      }
      if (branch.nodes.length === 0 && branch.from && branch.to) {
        kindOfJump.set(`${branch.from}>${branch.to}`, branch.kind)
        kindOfJump.set(`${branch.to}>${branch.from}`, branch.kind)
      }
    }
  }
  const reference = fold?.tracks[0]?.name
  return new Map(
    layout.tracks.map(track => {
      const names = track.sequence.map(nodeName)
      const kind =
        names.map(name => kindOfNode.get(name)).find(k => k !== undefined) ??
        kindOfJump.get(names.join('>')) ??
        (track.sequence.some(step => step.startsWith('-'))
          ? 'inversion'
          : undefined)
      return [
        track.id,
        track.id === 0 || track.name === reference
          ? referenceColor
          : fold && kind
            ? kindColor[kind]
            : haplotypeColor,
      ]
    }),
  )
}

function shapesSvg(layout: Layout, fold: FoldResult | undefined) {
  const colors = trackColors(layout, fold)
  const fill = (id: number) => colors.get(id) ?? haplotypeColor
  const parts: string[] = []
  const { rectangles, verticalRectangles, curves, corners } = layout.shapes
  for (const r of [...rectangles, ...verticalRectangles]) {
    parts.push(
      `<rect x="${r.xStart}" y="${r.yStart}" width="${r.xEnd - r.xStart + 1}" height="${r.yEnd - r.yStart + 1}" fill="${fill(r.id)}"/>`,
    )
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
  const trackOfJump = new Map(
    layout.tracks.map(track => [track.sequence.map(nodeName).join('>'), track]),
  )
  return fold.branches.flatMap(branch => {
    const boxes = branch.nodes.flatMap(name => {
      const node = nodes.get(name)
      return node ? [node] : []
    })
    const jump =
      branch.from && branch.to
        ? (trackOfJump.get(`${branch.from}>${branch.to}`) ??
          trackOfJump.get(`${branch.to}>${branch.from}`))
        : undefined
    const jumpShapes = jump
      ? [...layout.shapes.rectangles, ...layout.shapes.curves].filter(
          shape => shape.id === jump.id,
        )
      : []
    const widest = jumpShapes.sort(
      (a, b) => b.xEnd - b.xStart - (a.xEnd - a.xStart),
    )[0]
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
      : widest
        ? [
            {
              branch,
              x: (widest.xStart + widest.xEnd) / 2,
              y: Math.min(widest.yStart, widest.yEnd),
            },
          ]
        : []
  })
}

export function drawTubeMap(
  layout: Layout,
  lines: string[],
  fold?: FoldResult,
) {
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
          'reference dark, bands sized by haplotype share; a band or box takes the colour of its branch:',
        ]
      : []),
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
      ? `<text x="${margin}" y="${screenTop - 8}" font-size="13" fill="#111">its first ${pictureWidth - 2 * margin} px at full size:</text><clipPath id="screen"><rect x="${margin}" y="${screenTop}" width="${pictureWidth - 2 * margin}" height="${screenHeight}"/></clipPath><g clip-path="url(#screen)"><g transform="translate(${margin - (minX - 10)} ${screenTop - (minY - 10)})">${shapesSvg(layout, fold)}</g></g>`
      : ''
  const legendTop =
    mapTop + mapHeight + 18 + (screenHeight > 0 ? screenHeight + 34 : 0)
  const legend = fold
    ? Object.entries(kindColor)
        .map(
          ([kind, color], i) =>
            `<rect x="${margin + i * 110}" y="${legendTop + 8}" width="14" height="14" fill="${color}"/><text x="${margin + i * 110 + 20}" y="${legendTop + 20}" font-size="12" fill="#222">${kind}</text>`,
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pictureWidth}" height="${Math.ceil(height)}" viewBox="0 0 ${pictureWidth} ${Math.ceil(height)}" font-family="DejaVu Sans, Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/>${header}<g transform="translate(${margin - (minX - 10) * scale} ${mapTop - (minY - 10) * scale}) scale(${scale})">${shapesSvg(layout, fold)}</g>${sizeLabels.join('')}${labelSvg}${screen}${footerSvg}${legend}</svg>`
}
