import type { Branch, FoldedTrackFields } from './types.ts'

export function bpLabel(bp: number) {
  return bp >= 1000
    ? `${(bp / 1000).toFixed(bp >= 100_000 ? 0 : 1).replace(/\.0$/, '')} kb`
    : `${bp} bp`
}

function plural(count: number, noun: string) {
  return `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`
}

export function branchLabel(branch: Branch, haplotypes: number) {
  const { cluster, insertedBp, deletedBp, length } = branch
  const shortest = cluster ? bpLabel(cluster.minLength) : ''
  const longest = cluster ? bpLabel(cluster.maxLength) : ''
  const size = cluster
    ? shortest === longest
      ? `about ${longest}`
      : `${shortest} to ${longest}`
    : insertedBp > 0 && deletedBp > 0
      ? `${bpLabel(insertedBp)} for ${bpLabel(deletedBp)}`
      : bpLabel(length)
  const lengths = cluster
    ? ` (cluster of ${plural(cluster.members, 'length')})`
    : ''
  const cut = branch.open ? ', continues past the window' : ''
  return `${branch.description} ${size}${lengths}, ${branch.haplotypes} of ${haplotypes}${cut}`
}

export function trackLabel(freq: number, names: string[]) {
  return freq === 1 && names[0] !== undefined
    ? names[0]
    : plural(freq, 'haplotype')
}

export function variationLabel({ freq, variation }: FoldedTrackFields) {
  const { walks, foldedAwayBp } = variation
  const hidden =
    foldedAwayBp.max === 0
      ? 'nothing folded away'
      : foldedAwayBp.min === foldedAwayBp.max
        ? `${bpLabel(foldedAwayBp.max)} folded away in each`
        : `${bpLabel(foldedAwayBp.min)} to ${bpLabel(foldedAwayBp.max)} folded away in each`
  return `${plural(freq, 'haplotype')} on ${plural(walks, 'distinct walk')}, ${hidden}`
}
