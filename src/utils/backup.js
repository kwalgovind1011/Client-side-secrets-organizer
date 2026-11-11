/**
 * Encrypted Vault Backup & Restore Utility
 * Exports/imports the vault in its encrypted state so the backup file is secure anywhere.
 */

import { getVaultMeta, getAllEncryptedEntries, saveVaultMeta, saveEncryptedEntry, clearVaultDatabase } from "../storage/db";

/**
 * Trigger an encrypted backup download
 */
export async function exportEncryptedVaultToFile() {
  const meta = await getVaultMeta();
  if (!meta) {
    throw new Error("No active vault found to export.");
  }

  const entries = await getAllEncryptedEntries();

  const backupData = {
    app: "ClientSideSecretsOrganizer",
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    meta: {
      salt: meta.salt,
      iterations: meta.iterations,
      authVerifier: meta.authVerifier,
      autoLockMinutes: meta.autoLockMinutes || 5,
      vaultName: meta.vaultName || "My Secure Vault",
      createdAt: meta.createdAt,
    },
    entries: entries.map(e => ({
      id: e.id,
      encryptedPackage: e.encryptedPackage,
      updatedAt: e.updatedAt,
    })),
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `encrypted-vault-backup-${dateStr}.json`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { filename, entryCount: entries.length };
}

/**
 * Validate and restore an encrypted vault backup
 * @param {string} fileContent 
 * @returns {Promise<{ entryCount: number, meta: object }>}
 */
export async function importEncryptedVaultFromFile(fileContent) {
  let data;
  try {
    data = JSON.parse(fileContent);
  } catch {
    throw new Error("Invalid backup file: Not a valid JSON format.");
  }

  if (data.app !== "ClientSideSecretsOrganizer" || !data.meta?.salt || !data.meta?.authVerifier) {
    throw new Error("Invalid vault backup: Missing critical encryption metadata or unsupported file version.");
  }

  if (!Array.isArray(data.entries)) {
    throw new Error("Invalid backup: Entries must be an array.");
  }

  // Clear existing database and restore new data
  await clearVaultDatabase();

  // Save metadata
  await saveVaultMeta({
    salt: data.meta.salt,
    iterations: data.meta.iterations,
    authVerifier: data.meta.authVerifier,
    autoLockMinutes: data.meta.autoLockMinutes || 5,
    vaultName: data.meta.vaultName || "Restored Vault",
    createdAt: data.meta.createdAt || new Date().toISOString(),
  });

  // Save each encrypted entry
  for (const entry of data.entries) {
    if (entry.id && entry.encryptedPackage) {
      await saveEncryptedEntry({
        id: entry.id,
        encryptedPackage: entry.encryptedPackage,
        updatedAt: entry.updatedAt || new Date().toISOString(),
      });
    }
  }

  return {
    entryCount: data.entries.length,
    meta: data.meta,
  };
}
