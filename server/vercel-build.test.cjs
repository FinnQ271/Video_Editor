const { test } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtemp, writeFile, rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join, resolve, dirname, basename } = require('node:path')
const { pathToFileURL } = require('node:url')
const { createServer } = require('node:http')
const ts = require('typescript')

test('compiled Vercel API boots as ESM and handles requests without TypeScript sources', async () => {
  const project = resolve(__dirname, '..')
  const directory = await mkdtemp(join(tmpdir(), 'video-editor-api-test-'))
  let server
  try {
    // Vercel discovers tsconfig.json, not the Vite project reference's compiler options.
    const config = ts.readConfigFile(join(project, 'tsconfig.json'), ts.sys.readFile)
    assert.equal(config.error, undefined)
    const parsed = ts.convertCompilerOptionsFromJson(config.config.compilerOptions || {}, project)
    const program = ts.createProgram([join(project, 'api/media/import.ts')], {
      ...parsed.options, noEmit: false, rootDir: project, outDir: directory,
    })
    const emitted = program.emit()
    const errors = [...parsed.errors, ...ts.getPreEmitDiagnostics(program), ...emitted.diagnostics]
      .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {
      getCanonicalFileName: file => file, getCurrentDirectory: () => project, getNewLine: () => '\n',
    }))
    await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'module' }))
    const { default: handler } = await import(pathToFileURL(join(directory, 'api/media/import.js')).href)
    assert.equal(typeof handler, 'function')
    server = createServer((req, res) => { void handler(req, res) })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = 'http://127.0.0.1:' + server.address().port
    assert.equal((await fetch(url)).status, 405)
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1/video.mp4' }),
    })
    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /địa chỉ nội bộ/)
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    if (dirname(directory) === tmpdir() && basename(directory).startsWith('video-editor-api-test-')) {
      await rm(directory, { recursive: true, force: true })
    }
  }
})
