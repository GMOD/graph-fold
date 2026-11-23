import type { InputTrack } from './types.ts'

export function haplotypeKey(tracks: InputTrack[], index: number) {
  return tracks[index]?.haplotype ?? index
}

export function haplotypeCounter(tracks: InputTrack[]) {
  return (indices: Iterable<number>) => {
    const weights = new Map<string | number, number>()
    for (const index of indices) {
      const key = haplotypeKey(tracks, index)
      weights.set(
        key,
        Math.max(weights.get(key) ?? 0, tracks[index]?.freq ?? 1),
      )
    }
    return [...weights.values()].reduce((sum, weight) => sum + weight, 0)
  }
}
