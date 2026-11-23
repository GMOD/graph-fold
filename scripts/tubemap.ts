const core: typeof import('@jbrowse/tubemap-core') = await import(
  process.env.TUBEMAP_CORE ?? '@jbrowse/tubemap-core'
)

export const { layoutTubeMap, curvePaths, nodeOutlinePath } = core
