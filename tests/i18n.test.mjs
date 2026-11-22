import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const LANGUAGES = ['en', 'ka', 'uk', 'sr'];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(tsx?|jsx?|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function objectKeys(node) {
  if (!node || !ts.isObjectLiteralExpression(node)) return [];
  return node.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property))
      return [];
    const name = property.name;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
      return [name.text];
    return [];
  });
}

async function translationKeys() {
  const file = 'src/i18n.tsx';
  const source = await readFile(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const keys = Object.fromEntries(LANGUAGES.map((language) => [language, new Set()]));
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ['messages', 'extras'].includes(node.name.getText(ast)) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (ts.isPropertyAssignment(property) && LANGUAGES.includes(property.name.text))
          for (const key of objectKeys(property.initializer)) keys[property.name.text].add(key);
      }
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(ast) === 'Object.assign' &&
      node.arguments.length >= 2
    ) {
      const target = node.arguments[0].getText(ast).match(/^(?:messages|extras)\.(\w+)$/);
      if (target && LANGUAGES.includes(target[1]))
        for (const key of objectKeys(node.arguments[1])) keys[target[1]].add(key);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return keys;
}

async function usedKeys() {
  const used = new Map();
  for (const file of await walk('src')) {
    const source = await readFile(file, 'utf8');
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === 't') {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument)) {
          const line = ast.getLineAndCharacterOfPosition(argument.getStart(ast)).line + 1;
          if (!used.has(argument.text)) used.set(argument.text, []);
          used.get(argument.text).push(`${file}:${line}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  return used;
}

test('every literal t() key is translated for every language', async () => {
  const [keys, used] = await Promise.all([translationKeys(), usedKeys()]);
  for (const language of LANGUAGES) {
    for (const [key, locations] of used) {
      assert.ok(
        keys[language].has(key),
        `${language} is missing ${JSON.stringify(key)} used at ${locations.join(', ')}`,
      );
    }
  }
});
