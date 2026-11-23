#!/usr/bin/env bash
# Packs the package, installs the tarball into a scratch dir, and folds a
# fixture through the ESM and CJS entries. `pnpm test` runs against src/ and
# cannot see the package's shape.

set -euo pipefail

PKG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

cd "$PKG_DIR"
TARBALL="$(npm pack --silent --pack-destination "$SCRATCH")"
FIXTURE="$PKG_DIR/test/fixtures/chr15-92768150-92768700.json"

cd "$SCRATCH"
cat >package.json <<'JSON'
{
  "name": "graph-fold-pack-test",
  "version": "0.0.0",
  "private": true,
  "type": "module"
}
JSON
npm install --silent --no-audit --no-fund "./$TARBALL" >/dev/null

if [ -d node_modules/@jbrowse/graph-fold/node_modules ] ||
  [ "$(ls node_modules/@jbrowse | wc -l)" -ne 1 ] ||
  [ "$(ls node_modules | grep -cv '^@jbrowse$')" -ne 0 ]; then
  echo 'the package installed a dependency' >&2
  exit 1
fi

cat >smoke.mjs <<JS
import { readFileSync } from 'node:fs'
import { foldGraph, foldProblems, branchLabel } from '@jbrowse/graph-fold'
const { nodes, tracks } = JSON.parse(readFileSync('$FIXTURE', 'utf8'))
const fold = foldGraph(nodes, tracks, { threshold: 50 })
if (!fold.folded || fold.branches.length !== 7) throw new Error('not folded (ESM)')
if (foldProblems(nodes, tracks, fold).length > 0) throw new Error('problems (ESM)')
console.log(\`esm: \${fold.nodes.length} nodes, \${branchLabel(fold.branches[0], fold.haplotypes)} ok\`)
JS

cat >smoke.cjs <<JS
const { readFileSync } = require('node:fs')
const { foldGraph } = require('@jbrowse/graph-fold')
const { nodes, tracks } = JSON.parse(readFileSync('$FIXTURE', 'utf8'))
const fold = foldGraph(nodes, tracks, { threshold: 50 })
if (!fold.folded || fold.branches.length !== 7) throw new Error('not folded (CJS)')
console.log(\`cjs: \${fold.nodes.length} nodes ok\`)
JS

node smoke.mjs
node smoke.cjs
