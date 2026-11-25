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
  const replaced =
    insertedBp > 0 && deletedBp > 0 ? ` for ${bpLabel(deletedBp)}` : ''
  const size = cluster
    ? shortest === longest
      ? `about ${longest}${replaced}`
      : `${shortest} to ${longest}${replaced}`
    : insertedBp > 0 && deletedBp > 0
      ? `${bpLabel(insertedBp)} for ${bpLabel(deletedBp)}`
      : bpLabel(length)
  const lengths = cluster
    ? ` (cluster of ${plural(cluster.members, 'length')})`
    : ''
  const cut = branch.open ? ', continues past the window' : ''
  return `${branch.description} ${size}${lengths}, ${branch.haplotypes} of ${haplotypes}${cut}`
}

export function trackLabel(haplotypes: number, names: string[]) {
  return haplotypes === 1 && names[0] !== undefined
    ? names[0]
    : plural(haplotypes, 'haplotype')
}

export function referenceLabel(name: string, haplotypes: number) {
  return haplotypes > 1
    ? `${name} and ${plural(haplotypes - 1, 'identical haplotype')}`
    : name
}

export function variationLabel({
  haplotypes,
  variation,
}: Pick<FoldedTrackFields, 'haplotypes' | 'variation'>) {
  const { walks, foldedAwayBp } = variation
  const least = bpLabel(foldedAwayBp.min)
  const most = bpLabel(foldedAwayBp.max)
  const hidden =
    foldedAwayBp.max === 0
      ? 'nothing folded away'
      : foldedAwayBp.min === foldedAwayBp.max
        ? `${most} folded away in each`
        : least === most
          ? `about ${most} folded away in each`
          : `${least} to ${most} folded away in each`
  return `${plural(haplotypes, 'haplotype')} on ${plural(walks, 'distinct walk')}, ${hidden}`
}
