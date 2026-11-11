import React, { useState } from "react";
import { useVault } from "../context/VaultContext";
import { importEncryptedVaultFromFile } from "../utils/backup";
import { Lock, Unlock, Eye, EyeOff, AlertCircle, RefreshCw, Upload, ShieldAlert, KeyRound } from "lucide-react";

export default function UnlockScreen() {
  const { vaultMeta, unlockVault, resetVault, refreshVaultStatus } = useVault();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!password) return;

    setError("");
    setLoading(true);

    try {
      await unlockVault(password);
    } catch (err) {
      setError(err.message || "Failed to unlock vault. Check your master password.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setLoading(false);
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setError("");
      const text = await file.text();
      const result = await importEncryptedVaultFromFile(text);
      refreshVaultStatus();
      alert(`Restored ${result.entryCount} entries. Please unlock with that backup's master password.`);
    } catch (err) {
      setError(err.message || "Failed to restore backup.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl transition-all ${
          shake ? "animate-shake border-rose-500/50" : ""
        }`}
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-4 shadow-lg shadow-cyan-500/10">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {vaultMeta?.vaultName || "Client Secrets Vault"}
          </h1>
          <p className="text-slate-400 text-xs mt-1.5 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Vault is encrypted & locked</span>
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Master Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                placeholder="Enter master password to unlock"
                required
              />
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Deriving Key & Verifying...</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>Unlock Vault</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <label className="flex items-center gap-1.5 hover:text-slate-200 cursor-pointer transition">
            <Upload className="w-3.5 h-3.5" />
            <span>{importing ? "Restoring..." : "Restore Backup"}</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportBackup}
              disabled={importing}
            />
          </label>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1 hover:text-rose-400 transition"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Vault</span>
          </button>
        </div>

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <ShieldAlert className="w-6 h-6 flex-shrink-0" />
                <h3 className="font-semibold text-white">Reset Vault?</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                This will permanently delete all encrypted entries and vault keys stored in your browser's IndexedDB. If you don't have a backup file, all secrets will be irrecoverable.
              </p>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await resetVault();
                    setShowResetConfirm(false);
                  }}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-xl font-medium transition shadow-lg shadow-rose-600/20"
                >
                  Confirm Wipe
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
