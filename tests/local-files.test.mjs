import assert from 'node:assert/strict';
import test from 'node:test';
import { File } from 'node:buffer';
import { LocalDocumentLibrary, folderNameForApplication, safeFolderPart, validateDocument } from '../public/local-files.js';

function missing() { const error = new Error('Not found'); error.name = 'NotFoundError'; return error; }
class MemFileHandle {
  constructor(name) { this.name = name; this.data = new Uint8Array(); }
  async getFile() { return new File([this.data], this.name); }
  async createWritable() {
    const parent = this;
    let content;
    return {
      async write(value) { content = new Uint8Array(await (value instanceof Uint8Array ? new Blob([value]) : value instanceof Blob ? value : new Blob([value])).arrayBuffer()); },
      async close() { parent.data = content; },
      async abort() { content = null; },
    };
  }
}
class MemDirectory {
  constructor(name) { this.kind='directory'; this.name=name; this.children=new Map(); }
  async getFileHandle(name, { create=false } = {}) {
    const current=this.children.get(name);
    if (current) { if (current.kind === 'directory') throw new Error('Wrong type'); return current; }
    if (!create) throw missing();
    const file = new MemFileHandle(name); file.kind='file'; this.children.set(name, file); return file;
  }
  async getDirectoryHandle(name, { create=false } = {}) {
    const current=this.children.get(name);
    if (current) { if (current.kind !== 'directory') throw new Error('Wrong type'); return current; }
    if (!create) throw missing();
    const dir = new MemDirectory(name); this.children.set(name,dir); return dir;
  }
  async removeEntry(name) { if (!this.children.delete(name)) throw missing(); }
  async *entries() { yield* this.children.entries(); }
}
const sample = (id, role='Data Analyst', company='Example Corp') => ({ id, job_title:role, company_name:company, date_applied:'2026-11-22', created_at:'2026-11-22T10:00:00Z' });
const id1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const pdf=(name,contents='%PDF-1.7\nResume version') => new File([contents], name,{type:'application/pdf'});

function testLibrary(root) {
  const library = new LocalDocumentLibrary();
  library.root=root; library.permission='granted'; return library;
}

test('folder names use role, company and date with Windows-safe parts', () => {
  assert.equal(folderNameForApplication(sample(id1)), 'Data Analyst - Example Corp - 2026-11-22');
  assert.equal(folderNameForApplication(sample(id1,'Data/SQL Analyst','ACME: India')),
    'Data SQL Analyst - ACME India - 2026-11-22');
  assert.equal(safeFolderPart('CON'), '_CON');
  assert.equal(safeFolderPart(''), 'Unknown');
});

test('validates PDF/Word signatures and file size locally', async () => {
  assert.equal((await validateDocument(pdf('Applied Resume.pdf'))).extension, 'pdf');
  await assert.rejects(() => validateDocument(new File(['not a pdf'], 'Fake.pdf')), /does not match/);
  await assert.rejects(() => validateDocument(new File(['abc'], 'Virus.exe')), /Only PDF/);
  await assert.rejects(() => validateDocument(new File([''], 'Empty.pdf')), /between 1 byte/);
});

test('saving, scanning, replacing, removing, and reloading are local-only', async () => {
  const root = new MemDirectory('My Job Documents');
  const first = testLibrary(root);
  const app=sample(id1);
  const folder = await first.save(app, 'resume', pdf('Resume applied.pdf'));
  assert.equal(folder, 'Data Analyst - Example Corp - 2026-11-22');
  await first.save(app, 'cover_letter', pdf('Letter applied.pdf'));
  assert.equal(root.children.size, 1);
  let records = await first.scan();
  assert.equal(records.length, 2);
  assert.deepEqual(records.map(x=>x.kind).sort(), ['cover_letter','resume']);
  assert.equal((await (await first.getFile(records.find(x=>x.kind==='resume'))).text()).startsWith('%PDF-'),true);
  await first.save(app, 'resume', pdf('Resume revised.pdf', '%PDF-1.7\nRevised!'));
  records=await first.scan();
  assert.equal(records.find(r=>r.kind==='resume').filename, 'Resume revised.pdf');
  // Load from disk without browser-local IndexedDB state.
  const second=testLibrary(root);
  assert.equal((await second.scan()).length, 2);
  await second.remove(records.find(r=>r.kind==='cover_letter'));
  assert.equal((await second.scan()).length, 1);
  assert.equal(root.children.size, 1, 'the application folder remains');
});

test('same company/role/date uses suffix and never writes into someone else\'s folder', async () => {
  const root=new MemDirectory('Jobs');
  const library=testLibrary(root);
  const app1=sample(id1); const app2=sample(id2);
  const untouched=await root.getDirectoryHandle(folderNameForApplication(app1),{create:true});
  await (await untouched.getFileHandle('Notes.txt',{create:true})).createWritable().then(w=>w.write('Do not touch').then(()=>w.close()));
  const first=await library.save(app1,'resume',pdf('One.pdf'));
  const second=await library.save(app2,'resume',pdf('Two.pdf'));
  assert.match(first,/\(2\)$/);
  assert.match(second,/\(3\)$/);
  assert.equal((await library.scan()).length,2);
  const orig=(await (await untouched.getFileHandle('Notes.txt')).getFile()).text();
  assert.equal(await orig,'Do not touch');
});

test('renamed application record still associates existing files through stable id', async () => {
  const library=testLibrary(new MemDirectory('Jobs'));
  await library.save(sample(id1),'resume',pdf('Original.pdf'));
  const newName=sample(id1,'Business Analyst','Changed Employer');
  const stored=await library.save(newName,'cover_letter',pdf('Letter.pdf'));
  assert.equal(stored,'Data Analyst - Example Corp - 2026-11-22');
  const records=await library.scan();
  assert.equal(records.length,2);
  assert.ok(records.every(r=>r.company_name==='Changed Employer'));
});
