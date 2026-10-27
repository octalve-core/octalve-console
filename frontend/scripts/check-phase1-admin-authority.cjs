"use strict";
// Regression: exact API record identity, no synthetic admin links, no unintended PATCH writes.
// Node 22's built-in type stripping executes the pure TS normalizer without a test framework.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "../src");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
(async () => {
  const normalizer = await import(pathToFileURL(path.join(root, "features/admin/utils/admin-record-normalizer.ts")).href);
  const { unwrapAdminList, getAdminRecordId, findExactAdminRecord, normalizeAdminRecord } = normalizer;
  const staff = await import(pathToFileURL(path.join(root, "features/staff/utils/staff-record-normalizer.ts")).href);
  const client = await import(pathToFileURL(path.join(root, "features/client/utils/client-record-normalizer.ts")).href);
  for (const unwrap of [staff.unwrapStaffList, client.unwrapClientList]) {
    assert.deepEqual(unwrap([{id: 1}]), [{id: 1}]);
    assert.deepEqual(unwrap({results: []}), []);
    for (const invalid of [undefined, null, {}, {results:null}, {results:"incorrect"}, [null], [[]]]) {
      assert.throws(() => unwrap(invalid), /Invalid authorized API list response/);
    }
  }
  for (const file of ["features/admin/views/AdminResourceListView.tsx",
    "features/admin/operations/views/AdminOperationListView.tsx",
    "features/admin/workspace/views/AdminWorkspaceView.tsx"]) {
    const contents = read(file);
    assert.match(contents, /unwrapAdminList\(response\)\.map/);
    assert.doesNotMatch(contents, /function unwrapList\(/);
  }
  const records = [{ id: 42, name: "Actual account", status: "pending" }];
  assert.deepEqual(unwrapAdminList(records), records);
  assert.deepEqual(unwrapAdminList({results: records}), records);
  for (const bad of [undefined, null, {}, {results: null}, {results: "none"}, [{name:"No id"}], [null]]) {
    if (Array.isArray(bad) && bad.length && bad[0] && !("id" in bad[0])) {
      assert.throws(() => bad.map(normalizeAdminRecord), /stable identifier|Invalid/);
    } else if (Array.isArray(bad) && bad.length && bad[0] === null) {
      assert.throws(() => unwrapAdminList(bad), /Invalid/);
    } else {
      assert.throws(() => unwrapAdminList(bad), /Invalid/);
    }
  }
  assert.equal(getAdminRecordId(records[0]), "42");
  assert.throws(() => getAdminRecordId({name:"Unverified"}), /stable identifier/);
  assert.equal(findExactAdminRecord(records, "42"), records[0]);
  assert.equal(findExactAdminRecord(records, "43"), null);
  assert.throws(() => findExactAdminRecord([{id:"x"}, {id:"x"}], "x"), /Ambiguous/);
  assert.equal(normalizeAdminRecord(records[0], "customers").id, "42");
  assert.equal(normalizeAdminRecord({id: 2}, "customers").status, "Unknown");

  const editor = read("features/admin/views/AdminResourceEditorView.tsx");
  const mapper = read("lib/api/payload-mappers.ts");
  assert.match(editor, /findExactAdminRecord\(authorizedRows, activeId\)/);
  assert.match(editor, /buildInitialState\(editorConfig.fields, exactRecord\)/);
  assert.match(editor, /if \(field\.type === "password"\) return ""/);
  assert.match(editor, /touchedFields\.includes\(key\)/);
  assert.match(editor, /if \(Object\.keys\(payload\)\.length === 0\)/);
  assert.doesNotMatch(editor, /record\.meta\s*,?\s*\n\s*description:/);
  assert.doesNotMatch(editor, /setTimeout\s*\(/);
  assert.doesNotMatch(mapper, /payload\.currency \|\| "NGN"/);
  assert.doesNotMatch(mapper, /payload\.display_name \|\| payload\.name/);
  assert.match(mapper, /\.\.\.\(cleanString\(payload\.fulfillment_model\)/);
  console.log("PASS: exact identities, malformed API rejection across all Console roles, write-only secrets and changed-field PATCH guards");
})().catch(error => { console.error(error); process.exitCode = 1; });
