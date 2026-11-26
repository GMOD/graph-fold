export interface Site {
  left: number
  right: number
  inserted: number
}

export function siteKey({ left, right, inserted }: Site) {
  return `${left}:${right}:${inserted}`
}

function near(a: Site, b: Site, offsets: number[], tolerance: number) {
  const deleted = (s: Site) => offsets[s.right]! - offsets[s.left]!
  const slack =
    tolerance * Math.max(a.inserted, b.inserted, deleted(a), deleted(b))
  return (
    a.inserted > 0 === b.inserted > 0 &&
    a.right > a.left === b.right > b.left &&
    Math.abs(offsets[a.left]! - offsets[b.left]!) <= slack &&
    Math.abs(offsets[a.right]! - offsets[b.right]!) <= slack &&
    Math.abs(a.inserted - b.inserted) <= slack
  )
}

export function clusterLeaders(
  tally: Map<string, { site: Site; haplotypes: number }>,
  offsets: number[],
  tolerance: number,
) {
  const leaders: Site[] = []
  const leaderOf = new Map<string, Site>()
  const mostCarriedFirst = [...tally.values()].sort(
    (a, b) =>
      b.haplotypes - a.haplotypes ||
      a.site.left - b.site.left ||
      a.site.right - b.site.right ||
      a.site.inserted - b.site.inserted,
  )
  for (const { site } of mostCarriedFirst) {
    const leader = leaders.find(l => near(l, site, offsets, tolerance))
    leaderOf.set(siteKey(site), leader ?? site)
    if (leader === undefined) {
      leaders.push(site)
    }
  }
  return leaderOf
}
