import React, { useState } from "react";
import { useVault } from "../context/VaultContext";
import { calculatePasswordStrength } from "../utils/passwordStrength";
import { exportEncryptedVaultToFile, importEncryptedVaultFromFile } from "../utils/backup";
import {
  X,
  Shield,
  KeyRound,
  Download,
  Upload,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Users,
  Award,
} from "lucide-react";

export default function SettingsModal({ isOpen, onClose }) {
  const {
    vaultMeta,
    updateAutoLockSetting,
    changeMasterPassword,
    resetVault,
    refreshVaultStatus,
  } = useVault();

  const [activeTab, setActiveTab] = useState("security"); // "security" | "backup" | "about"
  
  // Auto-lock state
  const [autoLockMinutes, setAutoLockMinutes] = useState(vaultMeta?.autoLockMinutes ?? 5);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  // Backup state
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupError, setBackupError] = useState("");

  // Danger wipe
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  if (!isOpen) return null;

  const strength = calculatePasswordStrength(newPassword);

  const handleSaveAutoLock = async (val) => {
    setAutoLockMinutes(val);
    await updateAutoLockSetting(val);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");

    if (newPassword.length < 8) {
      setPassError("New master password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError("New passwords do not match.");
      return;
    }

    try {
      setChangingPass(true);
      await changeMasterPassword(currentPassword, newPassword);
      setPassSuccess("Master password changed and all vault entries re-encrypted successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPassError(err.message || "Failed to change master password.");
    } finally {
      setChangingPass(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setExporting(true);
      setBackupError("");
      const res = await exportEncryptedVaultToFile();
      setBackupMessage(`Exported ${res.entryCount} encrypted entries into ${res.filename}`);
    } catch (err) {
      setBackupError(err.message || "Failed to export vault.");
    } finally {
      setExporting(false);
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setBackupError("");
      const text = await file.text();
      const res = await importEncryptedVaultFromFile(text);
      setBackupMessage(`Restored ${res.entryCount} entries. Re-lock or refresh to unlock with your backup's master password.`);
      setTimeout(() => {
        refreshVaultStatus();
      }, 1000);
    } catch (err) {
      setBackupError(err.message || "Failed to import backup file.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 backdrop-blur-xl my-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span>Vault Settings & Security</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`py-2 rounded-lg transition ${
              activeTab === "security"
                ? "bg-slate-800 text-cyan-400 shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Security & Key
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("backup")}
            className={`py-2 rounded-lg transition ${
              activeTab === "backup"
                ? "bg-slate-800 text-cyan-400 shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Backup & Data
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("about")}
            className={`py-2 rounded-lg transition ${
              activeTab === "about"
                ? "bg-slate-800 text-cyan-400 shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            About & Project
          </button>
        </div>

        {/* Tab 1: Security Settings */}
        {activeTab === "security" && (
          <div className="space-y-5 text-xs">
            {/* Auto-Lock Timer */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Auto-Lock on Inactivity</span>
                </div>
                <select
                  value={autoLockMinutes}
                  onChange={(e) => handleSaveAutoLock(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-cyan-500"
                >
                  <option value={1}>1 Minute</option>
                  <option value={2}>2 Minutes</option>
                  <option value={5}>5 Minutes (Default)</option>
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={0}>Never (Not recommended)</option>
                </select>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Automatically discards in-memory cryptographic keys and decrypted items if no mouse, keyboard, or touch activity is detected.
              </p>
            </div>

            {/* Change Master Password */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-slate-200 font-semibold">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Change Master Password</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Re-encrypts your entire vault with a newly derived 256-bit AES-GCM key and fresh cryptographic salt.
              </p>

              {passError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{passError}</span>
                </div>
              )}
              {passSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1">Current Master Password</label>
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-400">New Master Password</label>
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="text-slate-500 hover:text-slate-300 flex items-center gap-1"
                    >
                      {showPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPass ? "Hide" : "Show"}</span>
                    </button>
                  </div>
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white"
                  />
                  {newPassword && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400">New Password Strength:</span>
                        <span className={`font-semibold ${strength.textColor}`}>{strength.label}</span>
                      </div>
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${strength.color}`}
                          style={{ width: `${strength.percentage}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Confirm New Master Password</label>
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={changingPass}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg transition disabled:opacity-60"
                  >
                    {changingPass ? "Re-encrypting Vault..." : "Update Master Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Backup & Data Management */}
        {activeTab === "backup" && (
          <div className="space-y-4 text-xs">
            {backupMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{backupMessage}</span>
              </div>
            )}
            {backupError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{backupError}</span>
              </div>
            )}

            {/* Export */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-200">Export Encrypted Backup</h4>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Downloads an authenticated JSON file. All credentials remain fully AES-256-GCM encrypted.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium transition flex-shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exporting ? "Exporting..." : "Export .json"}</span>
              </button>
            </div>

            {/* Import */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-200">Restore Encrypted Backup</h4>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Import a previously exported backup file to restore your credentials on this browser.
                </p>
              </div>
              <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium cursor-pointer transition flex-shrink-0 border border-slate-700">
                <Upload className="w-3.5 h-3.5" />
                <span>{importing ? "Restoring..." : "Restore File"}</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportBackup}
                  disabled={importing}
                />
              </label>
            </div>

            {/* Emergency Vault Wipe */}
            <div className="bg-rose-950/20 p-4 rounded-xl border border-rose-900/30 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-rose-300">Wipe / Destroy Vault</h4>
                  <p className="text-rose-400/80 text-[11px] mt-0.5">
                    Permanently purges all IndexedDB data and cryptographic salts from this device.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWipeConfirm(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl font-medium transition flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Wipe Vault</span>
                </button>
              </div>
            </div>

            {showWipeConfirm && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-600 rounded-xl space-y-2">
                <p className="font-semibold text-rose-300">Are you absolutely sure?</p>
                <p className="text-slate-300 text-[11px]">
                  All entries will be deleted immediately. You will lose access to all credentials unless you have an encrypted backup file.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowWipeConfirm(false)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await resetVault();
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold"
                  >
                    Yes, Delete Everything
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: About & Academic Project Info */}
        {activeTab === "about" && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Award className="w-4 h-4" />
                <span>GLA University – CEA Department</span>
              </div>
              <p className="text-slate-300">
                <strong>Project Title:</strong> Client-Side Secrets Organizer (Mini Project – 1)
              </p>
              <p className="text-slate-400">
                <strong>Faculty Mentor:</strong> Mr. Anurag Das
              </p>
              <p className="text-slate-400">
                <strong>Batch:</strong> Batch 7 | <strong>Section:</strong> AC | <strong>Semester:</strong> V
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 text-slate-200 font-semibold">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Team Members & Roles</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-semibold text-white">Kanha Pandey (2415000755)</div>
                  <div className="text-cyan-400 text-[10px]">Backend & Crypto Logic</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-semibold text-white">Harsh Pachahara (2415000648)</div>
                  <div className="text-cyan-400 text-[10px]">Frontend Development & UI/UX</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-semibold text-white">Govind Khandelwal (2415000614)</div>
                  <div className="text-cyan-400 text-[10px]">Vault Storage & Data Handling</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-semibold text-white">Jitendra Chauhan (2415000735)</div>
                  <div className="text-cyan-400 text-[10px]">Testing & Documentation</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 col-span-1 sm:col-span-2">
                  <div className="font-semibold text-white">Gagan Kumar (2415000582)</div>
                  <div className="text-cyan-400 text-[10px]">Research & Presentation</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-200">Security Specifications</div>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>PBKDF2-HMAC-SHA256 with 600,000 iterations & random 128-bit salt</li>
                <li>AES-256-GCM authenticated encryption with unique 96-bit IV per secret</li>
                <li>IndexedDB zero-knowledge persistent storage engine</li>
                <li>RAM-only keys with automatic inactivity lock and instant memory wipe</li>
              </ul>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
