import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { walkFile, windows } from './windows.ts'

import type { GraphTables } from '@gmod/gfa-tabix'

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

const gfaTabix: typeof import('@gmod/gfa-tabix') = await import(
  process.env.GFA_TABIX ?? '@gmod/gfa-tabix'
)
const { CUT_PRESETS, WalkFile } = gfaTabix
const force = process.argv.includes('--force')
const walks = new WalkFile({ walksUrl: walkFile })
for (const { refName: contig, start, end, file } of windows) {
  if (force || !existsSync(file)) {
    const { graph, kept, fragments, refName } = await walks.getCutForRange(
      contig,
      start,
      end,
      { ...CUT_PRESETS.figure, expand: () => true, links: 'none' },
    )
    const tables = graph.tables(kept, fragments, [])
    const window = {
      source: walkFile,
      refName,
      start,
      end,
      revisited: tables.revisited,
      nodes: tables.nodes.names.map((name, i) => ({
        name,
        sequenceLength: tables.nodes.lengths[i]!,
      })),
      tracks: distinctTracks(tables, refName),
    }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(window))
    console.log(
      `${file}: ${window.nodes.length} nodes, ${window.tracks.length} distinct walks of ${tables.walks.names.length}`,
    )
  }
}
