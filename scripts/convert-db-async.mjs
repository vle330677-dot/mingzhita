import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SERVER_DIR = path.join(ROOT, 'server');

const IMPORTED_ASYNC_HELPERS = new Set([
  'initDb',
  'runSchema',
  'runMigrate',
  'runSeed',
  'writeAdminLog',
  'loadPresenceByUserId',
  'loadPresenceByUserIds',
  'loadOnlinePresenceFallback',
]);

const DB_LIFECYCLE_NAMES = new Set(['exec', 'pragma', 'close']);
const DB_STATEMENT_NAMES = new Set(['get', 'all', 'run']);
const ARRAY_CALLBACK_METHODS = new Set(['map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every', 'flatMap', 'sort']);
const DB_LIKE_IDENTIFIERS = new Set(['db', 'source', 'target']);

const files = collectTsFiles(SERVER_DIR);
const changedFiles = [];
const skippedCallbacks = [];

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const preparedNames = new Set();
  const transactionNames = new Set();
  const importedAsyncNames = new Set();

  collectMetadata(sourceFile, preparedNames, transactionNames, importedAsyncNames);

  const localAsyncNames = new Set();
  const insertionMap = new Map();

  let stableKey = '';
  for (let pass = 0; pass < 12; pass += 1) {
    walk(sourceFile, (node) => {
      if (!ts.isCallExpression(node)) return;

      const enclosingFunction = findEnclosingFunction(node);
      if (!enclosingFunction) return;
      if (isInsideSkippedCallback(node, enclosingFunction)) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        skippedCallbacks.push(`${path.relative(ROOT, file)}:${line}`);
        return;
      }

      if (isAlreadyAwaitedOrVoided(node)) return;

      if (
        isDbStatementCall(node, preparedNames)
        || isDbLifecycleCall(node)
        || isTrackedAsyncCall(node, importedAsyncNames, localAsyncNames, transactionNames)
      ) {
        addAwaitInsertion(node, sourceFile, insertionMap);
        addAsyncInsertion(enclosingFunction, sourceFile, insertionMap, localAsyncNames);
      }
    });

    const nextKey = `${insertionMap.size}:${Array.from(localAsyncNames).sort().join(',')}`;
    if (nextKey === stableKey) break;
    stableKey = nextKey;
  }

  if (!insertionMap.size) continue;

  const updated = applyInsertions(original, Array.from(insertionMap.values()));
  if (updated !== original) {
    fs.writeFileSync(file, updated, 'utf8');
    changedFiles.push(path.relative(ROOT, file));
  }
}

console.log(`[convert-db-async] changed ${changedFiles.length} files`);
for (const file of changedFiles) {
  console.log(`[convert-db-async] updated ${file}`);
}

const uniqueSkipped = Array.from(new Set(skippedCallbacks)).sort();
if (uniqueSkipped.length) {
  console.log(`[convert-db-async] skipped callback-sensitive sites: ${uniqueSkipped.length}`);
  for (const entry of uniqueSkipped) {
    console.log(`[convert-db-async] review ${entry}`);
  }
}

function collectTsFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectTsFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!fullPath.endsWith('.ts')) continue;
    result.push(fullPath);
  }
  return result;
}

function collectMetadata(sourceFile, preparedNames, transactionNames, importedAsyncNames) {
  walk(sourceFile, (node) => {
    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
      for (const element of node.importClause.namedBindings.elements) {
        const importedName = (element.propertyName || element.name).text;
        if (!IMPORTED_ASYNC_HELPERS.has(importedName)) continue;
        importedAsyncNames.add(element.name.text);
      }
      return;
    }

    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    if (isPrepareFactory(node.initializer)) preparedNames.add(node.name.text);
    if (isTransactionFactory(node.initializer)) transactionNames.add(node.name.text);
  });
}

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function isPrepareFactory(node) {
  return ts.isCallExpression(node)
    && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === 'prepare';
}

function isTransactionFactory(node) {
  return ts.isCallExpression(node)
    && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === 'transaction';
}

function isDbStatementCall(node, preparedNames) {
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  if (!DB_STATEMENT_NAMES.has(node.expression.name.text)) return false;

  const owner = unwrap(node.expression.expression);
  if (isPrepareFactory(owner)) return true;
  return ts.isIdentifier(owner) && preparedNames.has(owner.text);
}

function isDbLifecycleCall(node) {
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  if (!DB_LIFECYCLE_NAMES.has(node.expression.name.text)) return false;

  const owner = unwrap(node.expression.expression);
  if (ts.isIdentifier(owner)) return DB_LIKE_IDENTIFIERS.has(owner.text);
  return ts.isPropertyAccessExpression(owner) && owner.name.text === 'db';
}

function isTrackedAsyncCall(node, importedAsyncNames, localAsyncNames, transactionNames) {
  const callee = unwrap(node.expression);
  if (!ts.isIdentifier(callee)) return false;
  return importedAsyncNames.has(callee.text) || localAsyncNames.has(callee.text) || transactionNames.has(callee.text);
}

function unwrap(node) {
  let current = node;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current) || ts.isTypeAssertionExpression(current)) {
    current = current.expression;
  }
  return current;
}

function isAlreadyAwaitedOrVoided(node) {
  let current = node.parent;
  while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current))) {
    current = current.parent;
  }
  return Boolean(current && (ts.isAwaitExpression(current) || ts.isVoidExpression(current)));
}

function findEnclosingFunction(node) {
  let current = node.parent;
  while (current) {
    if (ts.isArrowFunction(current) || ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current) || ts.isMethodDeclaration(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function isInsideSkippedCallback(node, enclosingFunction) {
  if (!ts.isArrowFunction(enclosingFunction) && !ts.isFunctionExpression(enclosingFunction)) return false;
  const call = enclosingFunction.parent;
  if (!call || !ts.isCallExpression(call)) return false;
  const callee = unwrap(call.expression);
  if (!ts.isPropertyAccessExpression(callee)) return false;
  if (!ARRAY_CALLBACK_METHODS.has(callee.name.text)) return false;

  const callback = call.arguments.find((arg) => arg === enclosingFunction);
  return Boolean(callback && isDescendantOf(node, enclosingFunction.body));
}

function isDescendantOf(node, ancestor) {
  let current = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function addAwaitInsertion(node, sourceFile, insertionMap) {
  const pos = node.getStart(sourceFile);
  const key = `await:${pos}`;
  if (!insertionMap.has(key)) {
    insertionMap.set(key, { pos, text: 'await ' });
  }
}

function addAsyncInsertion(node, sourceFile, insertionMap, localAsyncNames) {
  if (hasAsyncModifier(node)) return;

  const insertPos = getAsyncInsertPos(node, sourceFile);
  const insertText = getAsyncInsertText(node);
  const key = `async:${insertPos}`;
  if (!insertionMap.has(key)) {
    insertionMap.set(key, { pos: insertPos, text: insertText });
  }

  const name = getFunctionName(node);
  if (name) localAsyncNames.add(name);
}

function hasAsyncModifier(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword));
}

function getAsyncInsertPos(node, sourceFile) {
  if (ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) {
    return node.getStart(sourceFile);
  }

  const functionKeyword = node.getChildren(sourceFile).find((child) => child.kind === ts.SyntaxKind.FunctionKeyword);
  if (functionKeyword) return functionKeyword.getStart(sourceFile);
  return node.getStart(sourceFile);
}

function getAsyncInsertText(node) {
  if (ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) {
    return 'async ';
  }
  return 'async ';
}

function getFunctionName(node) {
  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name) {
    return node.name.text;
  }
  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.parent && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
    return node.parent.name.text;
  }
  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
    return node.name.text;
  }
  return null;
}

function applyInsertions(text, insertions) {
  const sorted = insertions
    .slice()
    .sort((a, b) => b.pos - a.pos || a.text.localeCompare(b.text));

  let next = text;
  for (const edit of sorted) {
    next = `${next.slice(0, edit.pos)}${edit.text}${next.slice(edit.pos)}`;
  }
  return next;
}
