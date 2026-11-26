export interface InputNode {
  name: string
  sequenceLength?: number
  seq?: string
}

export interface WalkFields {
  name?: string
  freq?: number
  haplotype?: string
  indexOfFirstBase?: number
  sourceTrackID?: number
}

export interface InputTrack extends WalkFields {
  sequence: string[]
}

export type EndKind = 'departure' | 'end' | 'unknown'

export interface EndTable {
  kinds: readonly EndKind[]
  pos: ArrayLike<number>
  reversed: ArrayLike<number>
  ownBp: ArrayLike<number>
  missingBp: ArrayLike<number>
}

export interface WalkEnds {
  before: EndTable
  after: EndTable
}

export interface ReferenceNode {
  name: string
  sequenceLength: number
}

export interface RunsReference<T extends WalkFields = WalkFields> {
  track: T
  nodes: ReferenceNode[]
  starts: ArrayLike<number>
}

export interface RunsStretches {
  starts: ArrayLike<number>
  bp: ArrayLike<number>
  against: ArrayLike<number>
  offBefore: ArrayLike<number>
}

export interface RunsInput<T extends WalkFields = WalkFields> {
  reference: RunsReference<T>
  tracks: T[]
  offsets: ArrayLike<number>
  stretches: RunsStretches
  leadBp: ArrayLike<number>
  tailBp: ArrayLike<number>
  ends?: WalkEnds
}

export interface FoldOptions {
  threshold?: number
  cluster?: boolean
  clusterTolerance?: number
  reference?: number
  referenceRevisits?: number
  inversions?: 'walk' | 'box'
  ends?: WalkEnds
}

export type RunsFoldOptions = Omit<FoldOptions, 'reference'>

export interface ClusterInfo {
  members: number
  minLength: number
  maxLength: number
  haplotypes: number
}

export interface FoldedNode {
  name: string
  sequenceLength: number
  kind: 'reference' | 'branch'
  refStart?: number
  refEnd?: number
  cluster?: ClusterInfo
  invertedOf?: string
}

export interface BpSpread {
  min: number
  median: number
  max: number
}

export interface TrackVariation {
  foldedAwayBp: BpSpread
  insertedBp: BpSpread
  skippedBp: BpSpread
}

export interface FoldedTrackFields {
  id: number
  name: string
  label: string
  sequence: string[]
  freq: number
  haplotypes: number
  sourceTrackID: number
  names: string[]
  variation: TrackVariation
}

export type FoldedTrack<T extends WalkFields = InputTrack> = T &
  FoldedTrackFields

export type BranchKind = 'insertion' | 'deletion' | 'inversion' | 'other'

export interface BranchAllele {
  refStart: number
  refEnd: number
  insertedBp: number
  deletedBp: number
  haplotypes: number
}

export interface BranchCopies {
  passes: number
  reversed: number
  haplotypes: number
  tracks: number[]
}

export interface Branch {
  kind: BranchKind
  description: string
  length: number
  insertedBp: number
  deletedBp: number
  refStart: number
  refEnd: number
  haplotypes: number
  tracks: number[]
  anchored: boolean
  nodes: string[]
  from?: string
  to?: string
  open?: boolean
  beyond?: number
  cluster?: ClusterInfo
  alleles?: BranchAllele[]
  copies?: BranchCopies[]
}

export interface FoldedStep {
  step: number
  node: string
  insertedBp: number
  skippedBp: number
  clippedBp: number
  largestInsertedBp: number
  largestSkippedBp: number
}

export interface FoldedWalk {
  name: string
  freq: number
  track: number
  originalBp: number
  foldedBp: number
  insertedBp: number
  skippedBp: number
  clippedBp: number
  steps: FoldedStep[]
}

interface FoldSummary {
  threshold: number
  haplotypes: number
  members: Record<string, string[]>
  branches: Branch[]
  walks: FoldedWalk[]
}

export interface Folded<T extends WalkFields = InputTrack> extends FoldSummary {
  folded: true
  nodes: FoldedNode[]
  tracks: FoldedTrack<T>[]
}

export interface Unfolded<
  N extends InputNode = InputNode,
  T extends WalkFields = InputTrack,
> extends FoldSummary {
  folded: false
  reason: string
  nodes: N[]
  tracks: T[]
}

export type FoldResult<
  N extends InputNode = InputNode,
  T extends WalkFields = InputTrack,
> = Folded<T> | Unfolded<N, T>
