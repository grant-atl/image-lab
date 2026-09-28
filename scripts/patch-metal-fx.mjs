import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

// metal-fx 1.0.4 lets an old canvas's loss event stop a replacement renderer.
// Remove this patch when upstream guards its context handlers by canvas identity.
const root = `${process.cwd()}/node_modules/metal-fx`
const { version } = JSON.parse(await readFile(`${root}/package.json`, 'utf8'))
assert.equal(version, '1.0.4', 'Review the metal-fx context patch before upgrading the package.')

const patches = [
  {
    file: 'index.es.js',
    before: '05c694abd7a4a9323e96dd53f6d8c866dd676b012a4eee65e7576530683c22fa',
    after: '8779d9fb103a83bca4217962a3ccd8fdbcd7d698efd0a4cfce7edeeadd508c4b',
    edits: [
      ['u.preventDefault(), i && (i.contextLost = !0);', 'u.preventDefault(), i && i.glCanvas === o && (i.contextLost = !0);'],
      ['if (!i) return;\n    const u = ke(i.gl);', 'if (!i || i.glCanvas !== o) return;\n    const u = ke(i.gl);'],
    ],
  },
  {
    file: 'index.cjs.js',
    before: '3e7037281ac55b8d3152b89522089eff7d7f7fd8998a73089795b570a5c3d74c',
    after: 'deb38ad2e185153366ba079ef961113cef07a07ed1a162274ba947306c34a179',
    edits: [
      ['u.preventDefault(),i&&(i.contextLost=!0)', 'u.preventDefault(),i&&i.glCanvas===o&&(i.contextLost=!0)'],
      ['c=()=>{if(!i)return;const u=Ee(i.gl);', 'c=()=>{if(!i||i.glCanvas!==o)return;const u=Ee(i.gl);'],
    ],
  },
]

const hash = (source) => createHash('sha256').update(source).digest('hex')
// Validate both bundles before changing either one.
const updates = await Promise.all(patches.map(async ({ file, before, after, edits }) => {
  const path = `${root}/dist/${file}`
  let source = await readFile(path, 'utf8')
  if (hash(source) === after) return null
  assert.equal(hash(source), before, `Unexpected metal-fx source: ${file}`)
  for (const [original, replacement] of edits) source = source.replace(original, replacement)
  assert.equal(hash(source), after, `The metal-fx patch did not match: ${file}`)
  return { path, source }
}))
for (const update of updates) if (update) await writeFile(update.path, update.source)
