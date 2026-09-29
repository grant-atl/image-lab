import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

// metal-fx 1.0.4 lets an old canvas's loss event stop a replacement renderer.
// It also labels its CommonJS entry as ESM. Remove this patch when both are fixed upstream.
const root = `${process.cwd()}/node_modules/metal-fx`
const packagePath = `${root}/package.json`
const metadata = JSON.parse(await readFile(packagePath, 'utf8'))
assert.equal(metadata.version, '1.0.4', 'Review the metal-fx patch before upgrading the package.')

// The package is ESM, so require needs .cjs code and .d.cts declarations.
assert.ok(['dist/index.cjs.js', 'dist/index.cjs'].includes(metadata.main), 'Unexpected metal-fx main entry.')
assert.ok(['./dist/index.cjs.js', './dist/index.cjs'].includes(metadata.exports?.['.']?.require?.default), 'Unexpected metal-fx require entry.')
assert.ok(['./dist/index.d.ts', './dist/index.d.cts'].includes(metadata.exports?.['.']?.require?.types), 'Unexpected metal-fx require types.')

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

// Keep the original bundle so hash validation still works on repeated installs.
await writeFile(`${root}/dist/index.cjs`, await readFile(`${root}/dist/index.cjs.js`))
await writeFile(`${root}/dist/index.d.cts`, await readFile(`${root}/dist/index.d.ts`))
metadata.main = 'dist/index.cjs'
metadata.exports['.'].require.default = './dist/index.cjs'
metadata.exports['.'].require.types = './dist/index.d.cts'
await writeFile(packagePath, `${JSON.stringify(metadata, null, 2)}\n`)
