import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile as readSourceFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { createServer } from 'vite';
import { EFFECTS, getAnimationSpeed, getRevealProgress } from '../src/lib/reveals.ts';

test('catalog identifiers stay unique and the timeline reaches each phase', () => {
  assert.equal(EFFECTS.length, 12);
  assert.equal(new Set(EFFECTS.map(effect => effect.id)).size, EFFECTS.length);
  assert.ok(EFFECTS.every(effect => /^[a-z]+(?:-[a-z]+)*$/.test(effect.id)));

  assert.equal(getRevealProgress(-1, 3), 0);
  assert.equal(getRevealProgress(0, 3), 0);
  assert.equal(getRevealProgress(1.5, 3), 0.5);
  assert.equal(getRevealProgress(3, 3), 1);
  assert.equal(getRevealProgress(30, 3), 1);
  assert.equal(getRevealProgress(1.2, 3, true), 0);
  assert.equal(getRevealProgress(4.2, 3, true), 1);
  assert.equal(getRevealProgress(5, 3, true), 1);
  assert.equal(getRevealProgress(5.7, 3, true), 0);
  assert.equal(getRevealProgress(0.05, 0), 0.5);
  assert.equal(getRevealProgress(1.5, Number.NaN), 0.5);
  for (const elapsed of [-Infinity, -1, 0, 0.1, 1000, Infinity, NaN]) {
    for (const duration of [-Infinity, -1, 0, 3, Infinity, NaN]) {
      for (const loop of [false, true]) {
        const progress = getRevealProgress(elapsed, duration, loop);
        assert.ok(Number.isFinite(progress) && progress >= 0 && progress <= 1);
      }
    }
  }
});

test('loading speed supports still motion, fractional rates, and bounded input', () => {
  assert.equal(getAnimationSpeed(), 1);
  for (const speed of [0, 0.5, 1, 3]) assert.equal(getAnimationSpeed(speed), speed);
  assert.equal(getAnimationSpeed(-1), 0);
  assert.equal(getAnimationSpeed(4), 3);
  for (const speed of [NaN, Infinity, -Infinity]) assert.equal(getAnimationSpeed(speed), 1);
});

test('download uses native MetalFx and preserves the applicable effect settings', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { buildComponent, buildUsage, metalFxFixPrompt } = await server.ssrLoadModule('/src/lib/export.ts');
    assert.ok(
      metalFxFixPrompt.includes(await readSourceFile(resolve('scripts/patch-metal-fx.mjs'), 'utf8'))
      && metalFxFixPrompt.includes('metal-fx@1.0.4')
      && metalFxFixPrompt.includes('node scripts/patch-metal-fx.mjs'),
      'The AI fix prompt must include the complete current patch, pinned version, and run command.');
    const settings = { effect: 'liquid-metal', duration: 4.5, speed: 0.5, intensity: 0.35, color: '#123abc' };
    const source: string = buildComponent(settings);
    const usage: string = buildUsage(settings);
    assert.match(source, /^'use client';/);
    assert.match(source, /MIT License/);
    assert.match(source, /<MetalFx\b/);
    assert.match(source, /\bpreset=["']chromatic["']/);
    assert.match(source, /\btheme=["']dark["']/);
    assert.match(source, /\bstrength=\{1\}/);
    assert.match(source, /export function ImageReveal\(/);
    assert.ok(source.includes(usage));
    assert.ok(usage.includes('effect="liquid-metal"'));
    assert.ok(usage.includes('duration={4.5}'));
    assert.doesNotMatch(usage, /\b(?:speed|intensity|color)=/);
    assert.ok(usage.includes('loading={isGenerating}'));
    const shaderUsage: string = buildUsage({ ...settings, effect: 'pixel-mosaic' });
    assert.ok(shaderUsage.includes('effect="pixel-mosaic"'));
    assert.ok(shaderUsage.includes('duration={4.5}'));
    assert.ok(shaderUsage.includes('speed={0.5}'));
    assert.ok(shaderUsage.includes('intensity={0.35}'));
    assert.ok(shaderUsage.includes('color="#123abc"'));

    const componentPath = resolve('src/__ImageRevealExportCheck.tsx');
    const usagePath = resolve('src/__ImageRevealUsageCheck.tsx');
    const shaderUsagePath = resolve('src/__ImageRevealShaderUsageCheck.tsx');
    const component = ts.createSourceFile(componentPath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    const imports = component.statements.filter(ts.isImportDeclaration);
    assert.deepEqual(imports.map(statement => (statement.moduleSpecifier as ts.StringLiteral).text).sort(), ['metal-fx', 'react']);
    const metalImport = imports.find(statement => (statement.moduleSpecifier as ts.StringLiteral).text === 'metal-fx');
    const bindings = metalImport?.importClause?.namedBindings;
    assert.ok(bindings && ts.isNamedImports(bindings) && bindings.elements.some(binding => binding.name.text === 'MetalFx'));
    for (const { id } of EFFECTS) assert.ok(source.includes(`'${id}'`), `Missing effect: ${id}`);

    const files = new Map([
      [componentPath, source],
      [usagePath, `declare const imageUrl: string;\ndeclare const isGenerating: boolean;\n${usage.replace("'./ImageReveal'", "'./__ImageRevealExportCheck'")};\n<ImageReveal src={imageUrl} />;`],
      [shaderUsagePath, `declare const imageUrl: string;\ndeclare const isGenerating: boolean;\n${shaderUsage.replace("'./ImageReveal'", "'./__ImageRevealExportCheck'")};`],
    ]);
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: ['react'],
    };
    const host = ts.createCompilerHost(options);
    const readFile = host.readFile.bind(host);
    const fileExists = host.fileExists.bind(host);
    const getSourceFile = host.getSourceFile.bind(host);
    host.readFile = path => files.get(path) ?? readFile(path);
    host.fileExists = path => files.has(path) || fileExists(path);
    host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => {
      const content = files.get(path);
      return content === undefined
        ? getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile)
        : ts.createSourceFile(path, content, languageVersion, true, ts.ScriptKind.TSX);
    };
    const program = ts.createProgram([...files.keys()], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: path => path,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    }));

    const directory = await mkdtemp(resolve('node_modules/.image-export-'));
    try {
      await writeFile(`${directory}/package.json`, '{"type":"commonjs"}\n');
      const nodeComponentPath = `${directory}/ImageReveal.tsx`;
      await writeFile(nodeComponentPath, source);
      const nodeDiagnostics = ts.getPreEmitDiagnostics(ts.createProgram([nodeComponentPath], {
        ...options, module: ts.ModuleKind.Node16, moduleResolution: ts.ModuleResolutionKind.Node16,
      }));
      assert.equal(nodeDiagnostics.length, 0, nodeDiagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'));

      for (const [module, extension] of [[ts.ModuleKind.CommonJS, 'cjs'], [ts.ModuleKind.ESNext, 'mjs']] as const) {
        await writeFile(`${directory}/ImageReveal.${extension}`, ts.transpileModule(source, {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module, jsx: ts.JsxEmit.ReactJSX },
        }).outputText);
        const consumer = spawnSync(process.execPath, ['--input-type=module', '--eval', `
          import assert from 'node:assert/strict';
          import { createElement } from 'react';
          import { renderToString } from 'react-dom/server';
          import { ImageReveal, EFFECTS } from './ImageReveal.${extension}';
          for (const { id } of EFFECTS) {
            const html = renderToString(createElement(ImageReveal, { effect: id, src: '', loading: true }));
            assert.match(html, /<canvas/);
            assert.match(html, /aria-busy="true"/);
          }
        `], { cwd: directory, encoding: 'utf8', timeout: 10000 });
        assert.equal(consumer.status, 0, consumer.error?.message ?? consumer.stderr);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  } finally {
    await server.close();
  }
});
