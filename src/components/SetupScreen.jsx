import React, { useState } from "react";
import { useVault } from "../context/VaultContext";
import { calculatePasswordStrength } from "../utils/passwordStrength";
import { importEncryptedVaultFromFile } from "../utils/backup";
import { Shield, Lock, Eye, EyeOff, KeyRound, Sparkles, AlertCircle, Upload, CheckCircle2 } from "lucide-react";

export default function SetupScreen() {
  const { setupVault, refreshVaultStatus } = useVault();
  const [vaultName, setVaultName] = useState("Personal Vault");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState("");

  const strength = calculatePasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter a master password.");
      return;
    }

    if (password.length < 8) {
      setError("Master password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await setupVault(password, vaultName);
    } catch (err) {
      setError("Failed to initialize vault: " + err.message);
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
      setImportSuccess(`Vault successfully restored (${result.entryCount} encrypted entries). Unlocking screen loaded.`);
      setTimeout(() => {
        refreshVaultStatus();
      }, 1000);
    } catch (err) {
      setError(err.message || "Failed to restore backup file.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-4 shadow-lg shadow-cyan-500/10">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Client-Side Secrets Organizer
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Zero-knowledge, end-to-end encrypted storage powered entirely in your browser by the native Web Cryptography API.
          </p>
        </div>

        {/* Security Highlights Banner */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 mb-6 text-xs text-slate-300 space-y-1.5">
          <div className="flex items-center gap-2 text-cyan-400 font-medium">
            <Sparkles className="w-4 h-4" />
            <span>Zero-Knowledge Architecture</span>
          </div>
          <p className="text-slate-400 pl-6 leading-relaxed">
            Your master password is never stored or sent anywhere. It derives a 256-bit AES-GCM key in browser memory via PBKDF2 (600,000 iterations).
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {importSuccess && (
          <div className="mb-6 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-400 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{importSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Vault Name
            </label>
            <input
              type="text"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              placeholder="e.g. My Personal Vault"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Create Master Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                placeholder="Choose a strong, memorable master password"
                required
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Meter */}
            {password && (
              <div className="mt-2.5 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Strength:</span>
                  <span className={`font-semibold ${strength.textColor}`}>{strength.label} (~{strength.entropy} bits)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${strength.percentage}%` }}
                  />
                </div>
                {strength.feedback[0] && (
                  <p className="text-[11px] text-slate-400">{strength.feedback[0]}</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Confirm Master Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                placeholder="Re-enter master password"
                required
              />
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Deriving Key & Initializing Vault...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Create Encrypted Vault</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Existing Backup Import Option */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400 mb-3">Already have an encrypted vault backup?</p>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl cursor-pointer transition border border-slate-700">
            <Upload className="w-3.5 h-3.5" />
            <span>{importing ? "Restoring..." : "Restore From Encrypted Backup (.json)"}</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportBackup}
              disabled={importing}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
