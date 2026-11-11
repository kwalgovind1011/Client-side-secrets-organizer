import React, { useState, useEffect } from "react";
import { useVault } from "../context/VaultContext";
import { calculatePasswordStrength } from "../utils/passwordStrength";
import GeneratorModal from "./GeneratorModal";
import { X, Lock, Eye, EyeOff, Sparkles, Globe, User, Tag, FileText, Star, CreditCard, KeyRound } from "lucide-react";

export default function EntryModal({ isOpen, onClose, entryToEdit = null }) {
  const { addEntry, updateEntry } = useVault();

  const [category, setCategory] = useState("login");
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (entryToEdit) {
      setCategory(entryToEdit.category || "login");
      setTitle(entryToEdit.title || "");
      setUsername(entryToEdit.username || "");
      setPassword(entryToEdit.password || "");
      setUrl(entryToEdit.url || "");
      setNotes(entryToEdit.notes || "");
      setTagsInput(Array.isArray(entryToEdit.tags) ? entryToEdit.tags.join(", ") : "");
      setFavorite(Boolean(entryToEdit.favorite));
    } else {
      setCategory("login");
      setTitle("");
      setUsername("");
      setPassword("");
      setUrl("");
      setNotes("");
      setTagsInput("");
      setFavorite(false);
    }
    setError("");
  }, [entryToEdit, isOpen]);

  if (!isOpen) return null;

  const strength = calculatePasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title for this secret entry.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const payload = {
        category,
        title: title.trim(),
        username: username.trim(),
        password,
        url: url.trim(),
        notes: notes.trim(),
        tags,
        favorite,
      };

      if (entryToEdit?.id) {
        await updateEntry(entryToEdit.id, payload);
      } else {
        await addEntry(payload);
      }

      onClose();
    } catch (err) {
      setError(err.message || "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 backdrop-blur-xl my-8 space-y-4 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-cyan-400" />
              <span>{entryToEdit ? "Edit Secret Entry" : "New Secret Entry"}</span>
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex gap-2">
            {[
              { id: "login", label: "Login Credential", icon: User },
              { id: "note", label: "Secure Note", icon: FileText },
              { id: "card", label: "Payment Card", icon: CreditCard },
            ].map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-medium transition ${
                    category === cat.id
                      ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-400"
                      : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-300"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {/* Title & Favorite */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-slate-400 font-medium mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GitHub Account, Personal Email, Wi-Fi"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setFavorite(!favorite)}
                title={favorite ? "Remove from favorites" : "Add to favorites"}
                className={`mt-5 p-2 rounded-xl border transition ${
                  favorite
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                    : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                }`}
              >
                <Star className={`w-4 h-4 ${favorite ? "fill-amber-400" : ""}`} />
              </button>
            </div>

            {/* Username / Email (if login or card) */}
            {category !== "note" && (
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  {category === "card" ? "Cardholder Name / Account" : "Username or Email"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="user@example.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>
            )}

            {/* Password / Secret */}
            {category !== "note" && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-400 font-medium">
                    {category === "card" ? "Card Number / PIN / CVV" : "Password / Secret"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGenerator(true)}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium text-[11px]"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Strong Password</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Secret value"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Strength:</span>
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
            )}

            {/* Website URL */}
            {category === "login" && (
              <div>
                <label className="block text-slate-400 font-medium mb-1">Website URL</label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">Tags (comma separated)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="social, banking, work, personal"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <Tag className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">Secure Notes</label>
              <textarea
                rows={category === "note" ? 6 : 3}
                placeholder="End-to-end encrypted notes, recovery codes, or private details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs resize-y"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-xl transition shadow-lg shadow-cyan-600/20 disabled:opacity-60 flex items-center gap-1.5"
              >
                {saving ? "Encrypting & Saving..." : entryToEdit ? "Update Entry" : "Save Entry"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Embedded Generator Modal */}
      <GeneratorModal
        isOpen={showGenerator}
        onClose={() => setShowGenerator(false)}
        onSelectPassword={(newPass) => setPassword(newPass)}
      />
    </>
  );
}
