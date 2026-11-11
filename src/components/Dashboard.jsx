import React, { useState, useEffect } from "react";
import { useVault } from "../context/VaultContext";
import EntryModal from "./EntryModal";
import GeneratorModal from "./GeneratorModal";
import SettingsModal from "./SettingsModal";
import {
  Shield,
  Lock,
  Search,
  Plus,
  KeyRound,
  Settings,
  Star,
  User,
  FileText,
  CreditCard,
  Tag,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Edit2,
  Trash2,
  Clock,
  Sparkles,
  ShieldCheck,
  FolderLock,
  Layers,
} from "lucide-react";

export default function Dashboard() {
  const {
    vaultMeta,
    entries,
    filteredEntries,
    allTags,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    lockVault,
    removeEntry,
    updateEntry,
    lastActivity,
  } = useVault();

  // Modals state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Password visibility per entry
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedId, setCopiedId] = useState("");
  const [copiedType, setCopiedType] = useState(""); // "username" | "password"

  // Time until auto-lock calculation
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const autoLockMinutes = vaultMeta?.autoLockMinutes ?? 5;

  useEffect(() => {
    if (autoLockMinutes <= 0) {
      setRemainingSeconds(null);
      return;
    }

    const updateTimer = () => {
      const elapsedMs = Date.now() - lastActivity;
      const totalMs = autoLockMinutes * 60 * 1000;
      const remainingMs = Math.max(0, totalMs - elapsedMs);
      setRemainingSeconds(Math.ceil(remainingMs / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lastActivity, autoLockMinutes]);

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopy = async (text, id, type) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setCopiedType(type);
      setTimeout(() => {
        setCopiedId("");
        setCopiedType("");
      }, 2000);
    } catch {
      // clipboard access fallback
    }
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      await removeEntry(id);
    }
  };

  const handleToggleFavorite = async (entry) => {
    await updateEntry(entry.id, { favorite: !entry.favorite });
  };

  const openCreateModal = () => {
    setEditingEntry(null);
    setIsEntryModalOpen(true);
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setIsEntryModalOpen(true);
  };

  // Counts
  const counts = {
    all: entries.length,
    favorites: entries.filter((e) => e.favorite).length,
    login: entries.filter((e) => e.category === "login").length,
    note: entries.filter((e) => e.category === "note").length,
    card: entries.filter((e) => e.category === "card").length,
  };

  const formatTimer = (seconds) => {
    if (seconds === null) return "Disabled";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Vault info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-500/10">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm sm:text-base tracking-tight">
                  Secrets Organizer
                </span>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  AES-256-GCM
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[150px] sm:max-w-xs">
                {vaultMeta?.vaultName || "Personal Vault"}
              </p>
            </div>
          </div>

          {/* Search Box in Header */}
          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search credentials, websites, tags... (/)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Action Tools & Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Auto-Lock Indicator */}
            {remainingSeconds !== null && (
              <div
                title="Vault will automatically re-lock if inactive"
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-[11px] font-mono">{formatTimer(remainingSeconds)}</span>
              </div>
            )}

            {/* Password Generator Button */}
            <button
              type="button"
              onClick={() => setIsGeneratorOpen(true)}
              title="Open Password Generator"
              className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition flex items-center gap-1.5"
            >
              <KeyRound className="w-4 h-4 text-cyan-400" />
              <span className="hidden md:inline">Generator</span>
            </button>

            {/* Settings Button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Vault Settings & Backup"
              className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition flex items-center gap-1.5"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="hidden md:inline">Settings</span>
            </button>

            {/* Manual Lock Now */}
            <button
              type="button"
              onClick={lockVault}
              title="Immediately lock vault and wipe key from memory"
              className="px-3 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-medium rounded-xl shadow-md shadow-rose-600/20 transition flex items-center gap-1.5"
            >
              <Lock className="w-4 h-4" />
              <span>Lock Now</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="w-56 hidden md:flex flex-col gap-5 flex-shrink-0">
          {/* New Secret Action */}
          <button
            type="button"
            onClick={openCreateModal}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Secret Entry</span>
          </button>

          {/* Navigation Categories */}
          <div className="space-y-1 text-xs">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Vault Categories
            </span>

            {[
              { id: "all", label: "All Items", icon: Layers, count: counts.all },
              { id: "favorites", label: "Favorites", icon: Star, count: counts.favorites },
              { id: "login", label: "Logins", icon: User, count: counts.login },
              { id: "note", label: "Secure Notes", icon: FileText, count: counts.note },
              { id: "card", label: "Payment Cards", icon: CreditCard, count: counts.card },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = selectedCategory === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedCategory(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition ${
                    isActive
                      ? "bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/30"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                      isActive ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-900 text-slate-500"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div className="space-y-1.5 text-xs">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Tags
              </span>
              <div className="flex flex-wrap gap-1 px-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedCategory(selectedCategory === tag ? "all" : tag)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1 ${
                      selectedCategory === tag
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    <Tag className="w-2.5 h-2.5" />
                    <span>{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Security Info Card */}
          <div className="mt-auto bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2 text-[11px]">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold">
              <FolderLock className="w-4 h-4" />
              <span>RAM-Only Session</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[10px]">
              Decryption keys exist only in transient browser state. No plaintext ever writes to disk or IndexedDB.
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 flex flex-col space-y-4">
          {/* Mobile Search and New Entry button */}
          <div className="flex sm:hidden gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
              />
            </div>
            <button
              onClick={openCreateModal}
              className="p-2 bg-cyan-600 text-white rounded-xl flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Header Row: Title & Count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white capitalize">
                {selectedCategory === "all"
                  ? "All Secrets"
                  : selectedCategory === "favorites"
                  ? "Favorite Secrets"
                  : selectedCategory}
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                ({filteredEntries.length} {filteredEntries.length === 1 ? "item" : "items"})
              </span>
            </div>

            {/* Quick button for mobile or tablet */}
            <button
              type="button"
              onClick={openCreateModal}
              className="hidden sm:inline-flex md:hidden items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-xl transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Entry</span>
            </button>
          </div>

          {/* Entries Grid/List */}
          {filteredEntries.length === 0 ? (
            <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-8 bg-slate-900/40 border border-slate-800/80 rounded-2xl text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">No secrets found</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                {searchQuery
                  ? "No items match your active search terms. Try searching for a different keyword or tag."
                  : "Your encrypted vault is empty. Add your first login credential, private note, or payment card."}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-cyan-600/20 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Secret</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {filteredEntries.map((entry) => {
                const isPasswordShown = Boolean(visiblePasswords[entry.id]);
                const isUsernameCopied = copiedId === entry.id && copiedType === "username";
                const isPasswordCopied = copiedId === entry.id && copiedType === "password";

                return (
                  <div
                    key={entry.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition shadow-md hover:shadow-xl group space-y-3"
                  >
                    {/* Entry Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            entry.category === "card"
                              ? "bg-purple-500/15 border border-purple-500/30 text-purple-400"
                              : entry.category === "note"
                              ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                              : "bg-cyan-500/15 border border-cyan-500/30 text-cyan-400"
                          }`}
                        >
                          {entry.category === "card" ? (
                            <CreditCard className="w-4 h-4" />
                          ) : entry.category === "note" ? (
                            <FileText className="w-4 h-4" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-white text-sm truncate flex items-center gap-1.5">
                            <span>{entry.title}</span>
                          </h3>
                          {entry.url && (
                            <a
                              href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 truncate mt-0.5 hover:underline"
                            >
                              <span>{entry.url.replace(/^https?:\/\//, "")}</span>
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Top actions: Favorite, Edit, Delete */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(entry)}
                          className={`p-1.5 rounded-lg transition ${
                            entry.favorite
                              ? "text-amber-400 hover:text-amber-300"
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          <Star className={`w-4 h-4 ${entry.favorite ? "fill-amber-400" : ""}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(entry)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                          title="Edit Secret"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id, entry.title)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                          title="Delete Secret"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Entry Credential Fields */}
                    <div className="space-y-2 text-xs">
                      {/* Username */}
                      {entry.username && (
                        <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800/80">
                          <span className="text-slate-400 text-[11px] truncate">{entry.username}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(entry.username, entry.id, "username")}
                            className="text-slate-400 hover:text-cyan-400 p-1 rounded transition flex items-center gap-1 text-[10px]"
                            title="Copy Username"
                          >
                            {isUsernameCopied ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400 font-medium">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Password / Secret */}
                      {entry.password && (
                        <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800/80">
                          <span className="font-mono text-cyan-300 text-[11px] truncate pr-2">
                            {isPasswordShown ? entry.password : "••••••••••••••••"}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(entry.id)}
                              className="text-slate-400 hover:text-slate-200 p-1 rounded transition"
                              title={isPasswordShown ? "Hide Secret" : "Reveal Secret"}
                            >
                              {isPasswordShown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(entry.password, entry.id, "password")}
                              className="text-slate-400 hover:text-cyan-400 p-1 rounded transition flex items-center gap-1 text-[10px]"
                              title="Copy Password"
                            >
                              {isPasswordCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400 font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Secure Note Preview */}
                      {entry.notes && (
                        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 text-slate-300 font-mono text-[11px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                          {entry.notes}
                        </div>
                      )}

                      {/* Tags */}
                      {Array.isArray(entry.tags) && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 text-[10px] font-medium border border-slate-700/60"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Entry Modal */}
      <EntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        entryToEdit={editingEntry}
      />

      {/* Password Generator Modal */}
      <GeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
      />

      {/* Settings & Backup Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
