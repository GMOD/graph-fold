import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { walkFile, windows } from './windows.ts'

import type { GraphTables } from '@jbrowse/graph-walks'

function distinctTracks({ nodes, walks }: GraphTables, reference: string) {
  const groups = new Map<
    string,
    { name: string; sequence: string[]; freq: number; indexOfFirstBase: number }
  >()
  walks.names.forEach((name, p) => {
    const sequence: string[] = []
    for (let s = walks.offsets[p]!; s < walks.offsets[p + 1]!; s++) {
      const node = nodes.names[walks.steps[s]!]!
      sequence.push(walks.reversed[s] ? `-${node}` : node)
    }
    const key = name === reference ? reference : sequence.join()
    const group = groups.get(key)
    if (group) {
      group.freq++
    } else {
      groups.set(key, {
        name,
        sequence,
        freq: 1,
        indexOfFirstBase: walks.starts[p]!,
      })
    }
  })
  return [...groups.values()].sort(
    (a, b) => Number(b.name === reference) - Number(a.name === reference),
  )
}

const graphWalks: typeof import('@jbrowse/graph-walks') = await import(
  process.env.GRAPH_WALKS ?? '@jbrowse/graph-walks'
)
const { CUT_PRESETS, WalkReader } = graphWalks
const force = process.argv.includes('--force')
const reader = WalkReader.open(walkFile)
const { references } = await reader.header()
for (const { refName, start, end, file } of windows) {
  if (force || !existsSync(file)) {
    const anchor = await reader.sequenceFor(references[0] ?? '', refName)
    if (anchor === undefined) {
      throw new Error(`the walk file has no sequence ${refName}`)
    }
    const { graph, kept, fragments } = await reader.cut(
      anchor,
      { start, end },
      { ...CUT_PRESETS.figure, expand: () => true, links: 'none' },
    )
    const tables = graph.tables(kept, fragments, [])
    const window = {
      source: walkFile,
      refName: anchor,
      start,
      end,
      revisited: tables.revisited,
      nodes: tables.nodes.names.map((name, i) => ({
        name,
        sequenceLength: tables.nodes.lengths[i]!,
      })),
      tracks: distinctTracks(tables, anchor),
    }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(window))
    console.log(
      `${file}: ${window.nodes.length} nodes, ${window.tracks.length} distinct walks of ${tables.walks.names.length}`,
    )
  }
}
