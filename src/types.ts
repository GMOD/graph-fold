export interface InputNode {
  name: string
  sequenceLength?: number
  seq?: string
}

export interface InputTrack {
  name?: string
  sequence: string[]
  freq?: number
  haplotype?: string
  indexOfFirstBase?: number
  sourceTrackID?: number
}

export interface FoldOptions {
  threshold?: number
  cluster?: boolean
  clusterTolerance?: number
  reference?: number
  referenceRevisits?: number
  inversions?: 'walk' | 'box'
}

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
  walks: number
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

export type FoldedTrack<T extends InputTrack = InputTrack> = T &
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

export interface Folded<T extends InputTrack = InputTrack> extends FoldSummary {
  folded: true
  nodes: FoldedNode[]
  tracks: FoldedTrack<T>[]
}

export interface Unfolded<
  N extends InputNode = InputNode,
  T extends InputTrack = InputTrack,
> extends FoldSummary {
  folded: false
  reason: string
  nodes: N[]
  tracks: T[]
}

export type FoldResult<
  N extends InputNode = InputNode,
  T extends InputTrack = InputTrack,
> = Folded<T> | Unfolded<N, T>
