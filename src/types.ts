export interface InputNode {
  name: string
  sequenceLength?: number
  seq?: string
}

export interface InputTrack {
  name?: string
  sequence: string[]
  freq?: number
  indexOfFirstBase?: number
}

export interface FoldOptions {
  threshold?: number
  cluster?: boolean
  clusterTolerance?: number
  reference?: number
  referenceRevisits?: number
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
}

export interface FoldedTrack {
  id: number
  name: string
  sequence: string[]
  freq: number
  sourceTrackID: number
  indexOfFirstBase?: number
  names: string[]
}

export type BranchKind = 'insertion' | 'deletion' | 'inversion' | 'other'

export interface BranchAllele {
  refStart: number
  refEnd: number
  insertedBp: number
  deletedBp: number
  haplotypes: number
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
  nodes: string[]
  from?: string
  to?: string
  open?: boolean
  cluster?: ClusterInfo
  alleles?: BranchAllele[]
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

export interface FoldResult {
  folded: boolean
  reason?: string
  threshold: number
  nodes: FoldedNode[]
  tracks: FoldedTrack[]
  members: Record<string, string[]>
  branches: Branch[]
  walks: FoldedWalk[]
}
