/**
 * Browser-only laptop document storage. Never sends document bytes to the Worker.
 * Requires a folder explicitly selected by the user in a Chromium browser.
 * Metadata is saved next to the files, so clearing browser data does not lose the index.
 */
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const MANIFEST_FILE = '.tracker-application.json';
const FILE_KINDS = Object.freeze({ resume: 'Resume', cover_letter: 'Cover Letter' });
const MEDIA = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
});

export function safeFolderPart(value, limit = 55) {
  const cleaned = String(value || 'Unknown')
    .replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '').slice(0, limit).trim();
  const safe = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(cleaned) ? `_${cleaned}` : cleaned;
  return safe || 'Unknown';
}

export function folderNameForApplication(application) {
  const match = String(application.date_applied || application.created_at || '').match(/^\d{4}-\d{2}-\d{2}/);
  const day = match ? match[0] : 'Undated';
  return `${safeFolderPart(application.job_title)} - ${safeFolderPart(application.company_name)} - ${day}`;
}

function validApplicationId(id) { return /^[a-f\d-]{36}$/i.test(String(id || '')); }
function safeStoredName(name, kind) {
  return typeof name === 'string' && /^(Resume|Cover Letter)\.(pdf|docx|doc)$/i.test(name)
    && name.startsWith(FILE_KINDS[kind] + '.') && !name.includes('/') && !name.includes('\\');
}

export async function validateDocument(file) {
  if (!file || !file.name) throw new Error('Select a PDF or Word document.');
  const match = file.name.match(/\.(pdf|docx|doc)$/i);
  if (!match) throw new Error('Only PDF, DOCX and DOC documents are supported.');
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) {
    throw new Error('Document must be between 1 byte and 8 MB.');
  }
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const extension = match[1].toLowerCase();
  const pdf = signature.length >= 5 && String.fromCharCode(...signature.slice(0, 5)) === '%PDF-';
  const docx = signature[0] === 0x50 && signature[1] === 0x4b && [3, 5, 7].includes(signature[2]);
  const doc = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((v, i) => signature[i] === v);
  if (!({ pdf, docx, doc })[extension]) throw new Error('The file content does not match its extension.');
  return { extension, media_type: MEDIA[extension] };
}

async function getManifest(dir) {
  let handle;
  try { handle = await dir.getFileHandle(MANIFEST_FILE); }
  catch (error) { if (error.name === 'NotFoundError') return null; throw error; }
  try {
    const value = JSON.parse(await (await handle.getFile()).text());
    return validApplicationId(value?.application_id) && value?.files && typeof value.files === 'object' ? value : null;
  } catch { return null; }
}

async function putManifest(dir, metadata) {
  const handle = await dir.getFileHandle(MANIFEST_FILE, { create: true });
  const writer = await handle.createWritable();
  try {
    await writer.write(JSON.stringify(metadata, null, 2) + '\n');
    await writer.close();
  } catch (error) {
    try { await writer.abort(); } catch { /* Best effort */ }
    throw error;
  }
}

function openStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('hyderabad-job-radar-local-documents', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('handles');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savedRoot() {
  const db = await openStore();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('handles', 'readonly').objectStore('handles').get('root');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

async function rememberRoot(handle) {
  const db = await openStore();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'root');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export class LocalDocumentLibrary {
  constructor() {
    this.root = null;
    this.permission = 'prompt';
    this.folders = new Map();
  }

  get supported() {
    return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
      && typeof indexedDB !== 'undefined';
  }
  get ready() { return Boolean(this.root && this.permission === 'granted'); }
  get folderName() { return this.root?.name || ''; }

  async restore() {
    if (!this.supported) return false;
    try {
      this.root = await savedRoot();
      if (!this.root) return false;
      this.permission = await this.root.queryPermission({ mode: 'readwrite' });
      return this.ready;
    } catch { return false; }
  }

  async chooseFolder() {
    if (!this.supported) throw new Error('Use Google Chrome or Microsoft Edge on your laptop to save documents into folders.');
    // Must be invoked directly from the user click, without awaiting anything first.
    const handle = await window.showDirectoryPicker({ id: 'tracker-job-documents', mode: 'readwrite' });
    this.root = handle;
    this.permission = await handle.queryPermission({ mode: 'readwrite' });
    if (this.permission !== 'granted') this.permission = await handle.requestPermission({ mode: 'readwrite' });
    if (!this.ready) throw new Error('Please allow read/write access to your selected folder.');
    await rememberRoot(handle);
    return this.scan();
  }

  async reconnect() {
    if (!this.root) throw new Error('Choose a laptop folder first.');
    this.permission = await this.root.requestPermission({ mode: 'readwrite' });
    if (!this.ready) throw new Error('Folder access not granted.');
    return this.scan();
  }

  assertReady() {
    if (!this.ready) throw new Error('Open Documents and choose or reconnect your local folder first.');
  }

  async scan() {
    this.assertReady();
    this.folders.clear();
    const files = [];
    for await (const [name, handle] of this.root.entries()) {
      if (handle.kind !== 'directory') continue;
      const manifest = await getManifest(handle);
      if (!manifest) continue;
      if (this.folders.has(manifest.application_id)) continue;
      this.folders.set(manifest.application_id, { handle, name, manifest });
      for (const kind of Object.keys(FILE_KINDS)) {
        const entry = manifest.files?.[kind];
        if (!entry || !safeStoredName(entry.stored_name, kind)) continue;
        try {
          const file = await (await handle.getFileHandle(entry.stored_name)).getFile();
          files.push({
            id: `${manifest.application_id}:${kind}`, application_id: manifest.application_id,
            company_name: String(manifest.company_name || ''), job_title: String(manifest.job_title || ''),
            kind, filename: String(entry.original_name || entry.stored_name),
            stored_name: entry.stored_name, media_type: MEDIA[entry.stored_name.split('.').pop().toLowerCase()],
            file_size: file.size, uploaded_at: entry.uploaded_at || '', folder_name: name,
          });
        } catch (error) { if (error.name !== 'NotFoundError') throw error; }
      }
    }
    return files.sort((a,b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)));
  }

  async applicationFolder(app) {
    this.assertReady();
    if (!validApplicationId(app.id)) throw new Error('Save the application record before attaching documents.');
    if (this.folders.has(app.id)) return this.folders.get(app.id);
    const base = folderNameForApplication(app);
    for (let suffix = 1; suffix <= 999; suffix++) {
      const name = suffix === 1 ? base : `${base} (${suffix})`;
      let handle;
      let created = false;
      try { handle = await this.root.getDirectoryHandle(name); }
      catch (error) {
        if (error.name !== 'NotFoundError') throw error;
        handle = await this.root.getDirectoryHandle(name, { create: true });
        created = true;
      }
      const existing = await getManifest(handle);
      if (existing?.application_id === app.id) {
        const result = { name, handle, manifest: existing };
        this.folders.set(app.id, result);
        return result;
      }
      // Never take over an unrelated folder or one without our manifest.
      if (!created || existing || await this.hasChildren(handle)) continue;
      const metadata = {
        version: 1, application_id: app.id, company_name: app.company_name,
        job_title: app.job_title, date_applied: app.date_applied || '',
        created_at: new Date().toISOString(), files: {},
      };
      await putManifest(handle, metadata);
      const result = { name, handle, manifest: metadata };
      this.folders.set(app.id, result);
      return result;
    }
    throw new Error('Too many matching folders. Choose a different destination.');
  }

  async hasChildren(dir) { for await (const _ of dir.entries()) return true; return false; }

  async save(app, kind, file) {
    if (!FILE_KINDS[kind]) throw new Error('Unsupported document type.');
    const { extension } = await validateDocument(file);
    const folder = await this.applicationFolder(app);
    const storedName = `${FILE_KINDS[kind]}.${extension}`;
    const previous = folder.manifest.files[kind]?.stored_name;
    const handle = await folder.handle.getFileHandle(storedName, { create: true });
    const writer = await handle.createWritable();
    try {
      await writer.write(file);
      await writer.close();
    } catch (error) {
      try { await writer.abort(); } catch { /* Best effort */ }
      throw error;
    }
    folder.manifest.company_name = app.company_name;
    folder.manifest.job_title = app.job_title;
    folder.manifest.date_applied = app.date_applied || '';
    folder.manifest.files[kind] = {
      stored_name: storedName, original_name: file.name, uploaded_at: new Date().toISOString(),
    };
    await putManifest(folder.handle, folder.manifest);
    if (previous && previous !== storedName && safeStoredName(previous, kind)) {
      try { await folder.handle.removeEntry(previous); } catch { /* Leave old file rather than lose a document */ }
    }
    return folder.name;
  }

  async getFile(record) {
    this.assertReady();
    const folder = this.folders.get(record.application_id);
    if (!folder || !safeStoredName(record.stored_name, record.kind)) throw new Error('Document missing. Click Refresh files.');
    return (await folder.handle.getFileHandle(record.stored_name)).getFile();
  }

  async remove(record) {
    this.assertReady();
    const folder = this.folders.get(record.application_id);
    const current = folder?.manifest.files?.[record.kind];
    if (!current || !safeStoredName(current.stored_name, record.kind)) throw new Error('Document missing. Refresh files.');
    // Removing the file on disk is intentional and requires confirmation in the UI.
    await folder.handle.removeEntry(current.stored_name);
    delete folder.manifest.files[record.kind];
    await putManifest(folder.handle, folder.manifest);
  }
}
