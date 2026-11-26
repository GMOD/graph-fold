export interface Site {
  left: number
  right: number
  inserted: number
  beyond?: number
}

export function siteKey({ left, right, inserted, beyond }: Site) {
  return beyond === undefined
    ? `${left}:${right}:${inserted}`
    : `${left}:${right}:${inserted}:${beyond}`
}

function near(
  a: Site,
  b: Site,
  offsets: number[],
  tolerance: number,
  deleted: (site: Site) => number,
) {
  const slack =
    tolerance * Math.max(a.inserted, b.inserted, deleted(a), deleted(b))
  return (
    a.beyond === b.beyond &&
    (a.beyond === undefined || (a.left === b.left && a.right === b.right)) &&
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
  deleted: (site: Site) => number,
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
    const leader = leaders.find(l => near(l, site, offsets, tolerance, deleted))
    leaderOf.set(siteKey(site), leader ?? site)
    if (leader === undefined) {
      leaders.push(site)
    }
  }
  return leaderOf
}
