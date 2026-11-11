import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  generateSalt,
  deriveKeyFromPassword,
  encryptData,
  decryptData,
  createAuthVerifier,
  verifyAuthVerifier,
} from "../crypto/crypto";
import {
  getVaultMeta,
  saveVaultMeta,
  getAllEncryptedEntries,
  saveEncryptedEntry,
  deleteEncryptedEntry,
  clearVaultDatabase,
} from "../storage/db";

const VaultContext = createContext(null);

export const VAULT_STATUS = {
  LOADING: "LOADING",
  UNINITIALIZED: "UNINITIALIZED",
  LOCKED: "LOCKED",
  UNLOCKED: "UNLOCKED",
};

export function VaultProvider({ children }) {
  const [status, setStatus] = useState(VAULT_STATUS.LOADING);
  const [cryptoKey, setCryptoKey] = useState(null);
  const [vaultMeta, setVaultMeta] = useState(null);
  const [entries, setEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Check vault status on initialization
  const refreshVaultStatus = useCallback(async () => {
    try {
      const meta = await getVaultMeta();
      if (!meta) {
        setStatus(VAULT_STATUS.UNINITIALIZED);
        setVaultMeta(null);
      } else {
        setVaultMeta(meta);
        setStatus(VAULT_STATUS.LOCKED);
      }
    } catch (err) {
      console.error("Failed to load vault status:", err);
      setStatus(VAULT_STATUS.UNINITIALIZED);
    }
  }, []);

  useEffect(() => {
    refreshVaultStatus();
  }, [refreshVaultStatus]);

  // Lock the vault, explicitly flushing key and plaintext records from RAM
  const lockVault = useCallback(() => {
    setCryptoKey(null);
    setEntries([]);
    setStatus(VAULT_STATUS.LOCKED);
    setSearchQuery("");
  }, []);

  // Setup a brand new vault
  const setupVault = async (masterPassword, vaultName = "Personal Vault") => {
    const salt = generateSalt();
    const iterations = 600000;
    const key = await deriveKeyFromPassword(masterPassword, salt, iterations);
    const authVerifier = await createAuthVerifier(key);

    const meta = {
      salt,
      iterations,
      authVerifier,
      autoLockMinutes: 5,
      vaultName,
      createdAt: new Date().toISOString(),
    };

    await saveVaultMeta(meta);
    setVaultMeta(meta);
    setCryptoKey(key);
    setEntries([]);
    setStatus(VAULT_STATUS.UNLOCKED);
    setLastActivity(Date.now());
  };

  // Unlock existing vault
  const unlockVault = async (masterPassword) => {
    if (!vaultMeta) {
      throw new Error("Vault not found.");
    }

    const key = await deriveKeyFromPassword(
      masterPassword,
      vaultMeta.salt,
      vaultMeta.iterations || 600000
    );

    const isValid = await verifyAuthVerifier(vaultMeta.authVerifier, key);
    if (!isValid) {
      throw new Error("Incorrect master password.");
    }

    // Load and decrypt all stored entries
    const encryptedList = await getAllEncryptedEntries();
    const decryptedList = [];

    for (const record of encryptedList) {
      try {
        const itemData = await decryptData(record.encryptedPackage, key);
        decryptedList.push({
          ...itemData,
          id: record.id,
          updatedAt: record.updatedAt,
        });
      } catch (err) {
        console.warn(`Could not decrypt entry ${record.id}:`, err);
      }
    }

    setCryptoKey(key);
    setEntries(decryptedList);
    setStatus(VAULT_STATUS.UNLOCKED);
    setLastActivity(Date.now());
  };

  // Add a new entry
  const addEntry = async (entryData) => {
    if (!cryptoKey) throw new Error("Vault is locked");

    const id = "entry_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    const timestamp = new Date().toISOString();

    const fullEntry = {
      id,
      title: entryData.title || "Untitled Secret",
      username: entryData.username || "",
      password: entryData.password || "",
      url: entryData.url || "",
      notes: entryData.notes || "",
      category: entryData.category || "login",
      tags: Array.isArray(entryData.tags) ? entryData.tags : [],
      favorite: Boolean(entryData.favorite),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const encryptedPackage = await encryptData(fullEntry, cryptoKey);
    await saveEncryptedEntry({
      id,
      encryptedPackage,
      updatedAt: timestamp,
    });

    setEntries((prev) => [fullEntry, ...prev]);
    setLastActivity(Date.now());
    return fullEntry;
  };

  // Update an existing entry
  const updateEntry = async (id, updatedFields) => {
    if (!cryptoKey) throw new Error("Vault is locked");

    const existingIndex = entries.findIndex((e) => e.id === id);
    if (existingIndex === -1) throw new Error("Entry not found");

    const timestamp = new Date().toISOString();
    const merged = {
      ...entries[existingIndex],
      ...updatedFields,
      id,
      updatedAt: timestamp,
    };

    const encryptedPackage = await encryptData(merged, cryptoKey);
    await saveEncryptedEntry({
      id,
      encryptedPackage,
      updatedAt: timestamp,
    });

    setEntries((prev) => {
      const copy = [...prev];
      copy[existingIndex] = merged;
      return copy;
    });
    setLastActivity(Date.now());
    return merged;
  };

  // Delete an entry
  const removeEntry = async (id) => {
    await deleteEncryptedEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setLastActivity(Date.now());
  };

  // Change master password and re-encrypt all entries
  const changeMasterPassword = async (currentPassword, newPassword) => {
    if (!cryptoKey || !vaultMeta) throw new Error("Vault must be unlocked to change password");

    // Verify current password first
    const testKey = await deriveKeyFromPassword(
      currentPassword,
      vaultMeta.salt,
      vaultMeta.iterations || 600000
    );
    const isValid = await verifyAuthVerifier(vaultMeta.authVerifier, testKey);
    if (!isValid) {
      throw new Error("Current master password is incorrect.");
    }

    // Generate new credentials
    const newSalt = generateSalt();
    const iterations = 600000;
    const newKey = await deriveKeyFromPassword(newPassword, newSalt, iterations);
    const newAuthVerifier = await createAuthVerifier(newKey);

    const updatedMeta = {
      ...vaultMeta,
      salt: newSalt,
      iterations,
      authVerifier: newAuthVerifier,
      updatedAt: new Date().toISOString(),
    };

    // Re-encrypt every existing entry with the new key
    for (const item of entries) {
      const encryptedPackage = await encryptData(item, newKey);
      await saveEncryptedEntry({
        id: item.id,
        encryptedPackage,
        updatedAt: item.updatedAt || new Date().toISOString(),
      });
    }

    await saveVaultMeta(updatedMeta);
    setVaultMeta(updatedMeta);
    setCryptoKey(newKey);
    setLastActivity(Date.now());
  };

  // Update auto-lock duration
  const updateAutoLockSetting = async (minutes) => {
    if (!vaultMeta) return;
    const updated = {
      ...vaultMeta,
      autoLockMinutes: Number(minutes),
      updatedAt: new Date().toISOString(),
    };
    await saveVaultMeta(updated);
    setVaultMeta(updated);
  };

  // Completely wipe the vault database
  const resetVault = async () => {
    await clearVaultDatabase();
    setCryptoKey(null);
    setEntries([]);
    setVaultMeta(null);
    setStatus(VAULT_STATUS.UNINITIALIZED);
  };

  // Filtered entries memoized for fast search and category filtering
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return entries.filter((item) => {
      // Category filter
      if (selectedCategory === "favorites" && !item.favorite) return false;
      if (
        selectedCategory !== "all" &&
        selectedCategory !== "favorites" &&
        item.category !== selectedCategory &&
        !item.tags?.includes(selectedCategory)
      ) {
        return false;
      }

      // Search query filter
      if (!q) return true;
      return (
        item.title?.toLowerCase().includes(q) ||
        item.username?.toLowerCase().includes(q) ||
        item.url?.toLowerCase().includes(q) ||
        item.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [entries, searchQuery, selectedCategory]);

  // Aggregate tags for sidebar
  const allTags = useMemo(() => {
    const tagSet = new Set();
    entries.forEach((item) => {
      if (Array.isArray(item.tags)) {
        item.tags.forEach((t) => {
          if (t && t.trim()) tagSet.add(t.trim().toLowerCase());
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [entries]);

  // Auto-lock countdown and inactivity handler
  const autoLockMinutes = vaultMeta?.autoLockMinutes ?? 5;

  useEffect(() => {
    if (status !== VAULT_STATUS.UNLOCKED || autoLockMinutes <= 0) return;

    const interval = setInterval(() => {
      const elapsedMinutes = (Date.now() - lastActivity) / 60000;
      if (elapsedMinutes >= autoLockMinutes) {
        lockVault();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [status, lastActivity, autoLockMinutes, lockVault]);

  // Reset inactivity timer on user interaction
  useEffect(() => {
    if (status !== VAULT_STATUS.UNLOCKED) return;

    const handleUserActivity = () => {
      setLastActivity(Date.now());
    };

    window.addEventListener("mousemove", handleUserActivity, { passive: true });
    window.addEventListener("keydown", handleUserActivity, { passive: true });
    window.addEventListener("click", handleUserActivity, { passive: true });
    window.addEventListener("touchstart", handleUserActivity, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
      window.removeEventListener("touchstart", handleUserActivity);
    };
  }, [status]);

  const value = {
    status,
    vaultMeta,
    entries,
    filteredEntries,
    allTags,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    lastActivity,
    setupVault,
    unlockVault,
    lockVault,
    addEntry,
    updateEntry,
    removeEntry,
    changeMasterPassword,
    updateAutoLockSetting,
    resetVault,
    refreshVaultStatus,
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return context;
}
