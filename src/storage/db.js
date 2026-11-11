/**
 * Client-Side IndexedDB Storage Module
 * Manages persistent storage for vault metadata and encrypted entries.
 */

const DB_NAME = "ClientSecretsVaultDB";
const DB_VERSION = 1;
const STORE_META = "vault_meta";
const STORE_ENTRIES = "vault_entries";
const META_KEY = "vault_config";

/**
 * Open or upgrade the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store for vault metadata (salt, authVerifier, autoLock settings)
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "id" });
      }

      // Store for individual encrypted secrets entries
      if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
        const entryStore = db.createObjectStore(STORE_ENTRIES, { keyPath: "id" });
        entryStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(new Error("Failed to open IndexedDB: " + event.target.error?.message));
    };
  });
}

/**
 * Retrieve the vault metadata (salt, authVerifier, settings)
 * @returns {Promise<object|null>}
 */
export async function getVaultMeta() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_META], "readonly");
    const store = transaction.objectStore(STORE_META);
    const request = store.get(META_KEY);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = (e) => {
      reject(new Error("Error fetching vault metadata: " + e.target.error?.message));
    };
  });
}

/**
 * Save or update vault metadata
 * @param {object} meta 
 * @returns {Promise<void>}
 */
export async function saveVaultMeta(meta) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_META], "readwrite");
    const store = transaction.objectStore(STORE_META);
    const record = {
      ...meta,
      id: META_KEY,
      updatedAt: new Date().toISOString(),
    };
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(new Error("Failed to save vault metadata: " + e.target.error?.message));
  });
}

/**
 * Retrieve all encrypted entries from IndexedDB
 * @returns {Promise<Array<object>>}
 */
export async function getAllEncryptedEntries() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_ENTRIES], "readonly");
    const store = transaction.objectStore(STORE_ENTRIES);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = (e) => {
      reject(new Error("Failed to fetch entries: " + e.target.error?.message));
    };
  });
}

/**
 * Save or update a single encrypted entry
 * @param {object} entryRecord { id, encryptedPackage, updatedAt }
 * @returns {Promise<void>}
 */
export async function saveEncryptedEntry(entryRecord) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_ENTRIES], "readwrite");
    const store = transaction.objectStore(STORE_ENTRIES);
    const request = store.put(entryRecord);

    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(new Error("Failed to save entry: " + e.target.error?.message));
  });
}

/**
 * Delete a specific entry by its ID
 * @param {string} id 
 * @returns {Promise<void>}
 */
export async function deleteEncryptedEntry(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_ENTRIES], "readwrite");
    const store = transaction.objectStore(STORE_ENTRIES);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(new Error("Failed to delete entry: " + e.target.error?.message));
  });
}

/**
 * Completely wipe the vault database (for reset or import overwrite)
 * @returns {Promise<void>}
 */
export async function clearVaultDatabase() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_META, STORE_ENTRIES], "readwrite");
    
    transaction.objectStore(STORE_META).clear();
    transaction.objectStore(STORE_ENTRIES).clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = (e) => reject(new Error("Failed to clear vault: " + e.target.error?.message));
  });
}
