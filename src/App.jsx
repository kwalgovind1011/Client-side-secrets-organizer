import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  generateSalt,
  deriveKeyFromPassword,
  encryptData,
  decryptData,
  createAuthVerifier,
  verifyAuthVerifier,
} from "./crypto/crypto";
import {
  getVaultMeta,
  saveVaultMeta,
  getAllEncryptedEntries,
  saveEncryptedEntry,
  deleteEncryptedEntry,
  clearVaultDatabase,
} from "./storage/db";
import { generatePassword } from "./utils/passwordGenerator";
import { calculatePasswordStrength } from "./utils/passwordStrength";
import { exportEncryptedVaultToFile, importEncryptedVaultFromFile } from "./utils/backup";

const navigation = [
  { id: "vault", label: "My vault", icon: "▦" },
  { id: "generator", label: "Password generator", icon: "✳" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

const CATEGORY_COLORS = {
  Personal: "blue",
  Work: "dark",
  Entertainment: "red",
  Finance: "green",
  Social: "pink",
};

function Icon({ children, className = "" }) {
  return <span aria-hidden="true" className={`icon ${className}`}>{children}</span>;
}

export default function App() {
  const [activePage, setActivePage] = useState("vault");
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return window.localStorage.getItem("hush-theme") === "dark";
    } catch {
      return false;
    }
  });

  // Vault lifecycle and cryptographic state
  const [vaultInitialized, setVaultInitialized] = useState(null); // null: loading, false: no vault, true: exists
  const [vaultMeta, setVaultMeta] = useState(null);
  const [cryptoKey, setCryptoKey] = useState(null);
  const [authUser, setAuthUser] = useState("");
  const [authMode, setAuthMode] = useState("signin"); // "signin" | "signup"
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showAuthPassword, setShowAuthPassword] = useState(false);

  // Decrypted vault secrets (held strictly in memory while unlocked)
  const [secrets, setSecrets] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All items");
  const [visibleIds, setVisibleIds] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Password Generator tab state
  const [generatorLength, setGeneratorLength] = useState(18);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [useUppercase, setUseUppercase] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState(() =>
    generatePassword({ length: 18, includeNumbers: true, includeSymbols: true, includeUppercase: true })
  );

  // New Secret form modal state
  const [form, setForm] = useState({ title: "", username: "", password: "", category: "Personal", notes: "" });

  // Settings: Change Password state
  const [oldPassword, setOldPassword] = useState("");
  const [newMasterPassword, setNewMasterPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [passMessage, setPassMessage] = useState("");
  const [autoLockSetting, setAutoLockSetting] = useState(5);

  // Check existing vault in IndexedDB on mount
  const checkVaultStatus = useCallback(async () => {
    try {
      const meta = await getVaultMeta();
      if (meta) {
        setVaultMeta(meta);
        setVaultInitialized(true);
        setAuthMode("signin");
        setAutoLockSetting(meta.autoLockMinutes ?? 5);
      } else {
        setVaultMeta(null);
        setVaultInitialized(false);
        setAuthMode("signup");
      }
    } catch (err) {
      console.error("Failed to check vault status:", err);
      setVaultInitialized(false);
      setAuthMode("signup");
    }
  }, []);

  useEffect(() => {
    checkVaultStatus();
  }, [checkVaultStatus]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function toggleTheme() {
    const nextDarkMode = !darkMode;
    setDarkMode(nextDarkMode);
    try {
      window.localStorage.setItem("hush-theme", nextDarkMode ? "dark" : "light");
    } catch {
      notify("Theme changed, but your preference could not be saved");
    }
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${label} copied to clipboard`);
    } catch {
      notify("Clipboard access is unavailable in this browser");
    }
  }

  // Lock the vault: immediately zero-out cryptographic key and plaintext records from RAM
  const lockVault = useCallback(() => {
    setCryptoKey(null);
    setSecrets([]);
    setAuthUser("");
    setActivePage("vault");
    notify("Vault locked. Memory keys cleared.");
  }, []);

  // Inactivity auto-lock monitor
  useEffect(() => {
    if (!cryptoKey || autoLockSetting <= 0) return;

    const interval = setInterval(() => {
      const elapsedMinutes = (Date.now() - lastActivity) / 60000;
      if (elapsedMinutes >= autoLockSetting) {
        lockVault();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [cryptoKey, lastActivity, autoLockSetting, lockVault]);

  // Track activity to reset idle timer
  useEffect(() => {
    if (!cryptoKey) return;

    const onActivity = () => setLastActivity(Date.now());
    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    window.addEventListener("click", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("touchstart", onActivity);
    };
  }, [cryptoKey]);

  // Authentication Submit (Sign Up or Sign In)
  async function submitAuth(event) {
    event.preventDefault();
    setAuthError("");

    if (authMode === "signup") {
      if (authForm.password.length < 8) {
        setAuthError("Master password must be at least 8 characters long.");
        return;
      }
      if (authForm.password !== authForm.confirmPassword) {
        setAuthError("Passwords do not match. Please try again.");
        return;
      }

      try {
        setAuthLoading(true);
        const salt = generateSalt();
        const iterations = 600000;
        const key = await deriveKeyFromPassword(authForm.password, salt, iterations);
        const authVerifier = await createAuthVerifier(key);

        const displayName = authForm.name.trim() || authForm.email.split("@")[0] || "User";
        const meta = {
          salt,
          iterations,
          authVerifier,
          autoLockMinutes: 5,
          vaultName: `${displayName}'s Vault`,
          ownerName: displayName,
          ownerEmail: authForm.email.trim(),
          createdAt: new Date().toISOString(),
        };

        await saveVaultMeta(meta);
        setVaultMeta(meta);
        setVaultInitialized(true);
        setCryptoKey(key);
        setAuthUser(displayName);
        setSecrets([]);
        setLastActivity(Date.now());
        notify("Vault initialized with PBKDF2 & AES-256-GCM encryption!");
      } catch (err) {
        setAuthError("Failed to initialize vault: " + err.message);
      } finally {
        setAuthLoading(false);
      }
    } else {
      // Sign In / Unlock
      if (!authForm.password) {
        setAuthError("Please enter your master password.");
        return;
      }

      try {
        setAuthLoading(true);
        const meta = vaultMeta || (await getVaultMeta());
        if (!meta) {
          setAuthError("No existing vault found. Please create a new account.");
          setAuthMode("signup");
          setVaultInitialized(false);
          return;
        }

        const key = await deriveKeyFromPassword(
          authForm.password,
          meta.salt,
          meta.iterations || 600000
        );

        const isValid = await verifyAuthVerifier(meta.authVerifier, key);
        if (!isValid) {
          setAuthError("Incorrect master password. Authentication failed.");
          return;
        }

        // Decrypt all stored entries from IndexedDB
        const encryptedList = await getAllEncryptedEntries();
        const decryptedList = [];

        for (const record of encryptedList) {
          try {
            const data = await decryptData(record.encryptedPackage, key);
            decryptedList.push({
              ...data,
              id: record.id,
              updatedAt: record.updatedAt,
            });
          } catch (err) {
            console.warn(`Could not decrypt entry ${record.id}:`, err);
          }
        }

        setCryptoKey(key);
        setVaultMeta(meta);
        setSecrets(decryptedList);
        const displayName = meta.ownerName || meta.vaultName || "User";
        setAuthUser(displayName);
        setLastActivity(Date.now());
        notify(`Welcome back, ${displayName}! ${decryptedList.length} secrets decrypted.`);
      } catch (err) {
        setAuthError(err.message || "Failed to unlock vault.");
      } finally {
        setAuthLoading(false);
      }
    }
  }

  // Save new secret into IndexedDB encrypted
  async function saveSecret(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.password) return;
    if (!cryptoKey) {
      notify("Vault is locked. Cannot save secret.");
      return;
    }

    try {
      const id = Date.now().toString();
      const initials = form.title
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();

      const color = CATEGORY_COLORS[form.category] || "purple";

      const newSecret = {
        id,
        title: form.title.trim(),
        username: form.username.trim(),
        password: form.password,
        category: form.category || "Personal",
        notes: form.notes || "",
        color,
        initials,
        createdAt: new Date().toISOString(),
      };

      // Encrypt with AES-256-GCM
      const encryptedPackage = await encryptData(newSecret, cryptoKey);
      await saveEncryptedEntry({
        id,
        encryptedPackage,
        updatedAt: new Date().toISOString(),
      });

      setSecrets((items) => [newSecret, ...items]);
      setForm({ title: "", username: "", password: "", category: "Personal", notes: "" });
      setModalOpen(false);
      notify("Secret encrypted with AES-256-GCM and saved to IndexedDB");
    } catch (err) {
      notify("Error saving secret: " + err.message);
    }
  }

  // Delete secret from IndexedDB
  async function deleteSecret(secret) {
    if (!window.confirm(`Delete "${secret.title}"?`)) return;

    try {
      await deleteEncryptedEntry(secret.id);
      setSecrets((items) => items.filter((item) => item.id !== secret.id));
      notify(`Deleted "${secret.title}" from vault`);
    } catch (err) {
      notify("Failed to delete entry: " + err.message);
    }
  }

  // Password generator regeneration
  function generateNewPassword() {
    const generated = generatePassword({
      length: generatorLength,
      includeNumbers: useNumbers,
      includeSymbols: useSymbols,
      includeUppercase: useUppercase,
    });
    setGeneratedPassword(generated);
  }

  // Change Master Password and re-encrypt all entries
  async function handleChangeMasterPassword(e) {
    e.preventDefault();
    setPassMessage("");

    if (!cryptoKey || !vaultMeta) {
      setPassMessage("Vault must be unlocked to change password.");
      return;
    }
    if (newMasterPassword.length < 8) {
      setPassMessage("New master password must be at least 8 characters long.");
      return;
    }
    if (newMasterPassword !== confirmNewPassword) {
      setPassMessage("New passwords do not match.");
      return;
    }

    try {
      setChangingPass(true);
      // Verify old password
      const oldKey = await deriveKeyFromPassword(oldPassword, vaultMeta.salt, vaultMeta.iterations || 600000);
      const isValid = await verifyAuthVerifier(vaultMeta.authVerifier, oldKey);
      if (!isValid) {
        setPassMessage("Current master password is incorrect.");
        return;
      }

      // Generate new salt and key
      const newSalt = generateSalt();
      const iterations = 600000;
      const newKey = await deriveKeyFromPassword(newMasterPassword, newSalt, iterations);
      const newAuthVerifier = await createAuthVerifier(newKey);

      // Re-encrypt all existing secrets with new key
      for (const secret of secrets) {
        const encryptedPackage = await encryptData(secret, newKey);
        await saveEncryptedEntry({
          id: secret.id,
          encryptedPackage,
          updatedAt: new Date().toISOString(),
        });
      }

      const updatedMeta = {
        ...vaultMeta,
        salt: newSalt,
        iterations,
        authVerifier: newAuthVerifier,
        updatedAt: new Date().toISOString(),
      };
      await saveVaultMeta(updatedMeta);
      setVaultMeta(updatedMeta);
      setCryptoKey(newKey);

      setOldPassword("");
      setNewMasterPassword("");
      setConfirmNewPassword("");
      setPassMessage("Master password updated and all secrets re-encrypted!");
      notify("Master password updated successfully!");
    } catch (err) {
      setPassMessage("Error: " + err.message);
    } finally {
      setChangingPass(false);
    }
  }

  // Export encrypted backup
  async function handleExport() {
    try {
      const res = await exportEncryptedVaultToFile();
      notify(`Exported ${res.entryCount} encrypted secrets into ${res.filename}`);
    } catch (err) {
      notify("Export failed: " + err.message);
    }
  }

  // Import encrypted backup
  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await importEncryptedVaultFromFile(text);
      notify(`Restored ${res.entryCount} encrypted entries! Please sign in with backup password.`);
      lockVault();
      checkVaultStatus();
    } catch (err) {
      notify("Restore failed: " + err.message);
    }
  }

  // Wipe vault
  async function handleWipeVault() {
    if (window.confirm("PERMANENT DATA LOSS WARNING:\nThis will permanently destroy all encrypted secrets and salts stored in this browser.\nAre you sure?")) {
      await clearVaultDatabase();
      lockVault();
      checkVaultStatus();
      notify("Vault wiped clean.");
    }
  }

  // Filtered secrets list
  const visibleSecrets = useMemo(() => {
    return secrets.filter((secret) => {
      const matchesSearch = `${secret.title} ${secret.username} ${secret.category} ${secret.notes || ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchesSearch && (filter === "All items" || secret.category === filter);
    });
  }, [secrets, search, filter]);

  // Overall password health score
  const healthAssessment = useMemo(() => {
    if (secrets.length === 0) return { label: "No passwords yet", score: 0 };
    let totalScore = 0;
    secrets.forEach((s) => {
      const st = calculatePasswordStrength(s.password);
      totalScore += st.score;
    });
    const avg = totalScore / secrets.length;
    if (avg >= 3.2) return { label: "Excellent", score: 5 };
    if (avg >= 2.5) return { label: "Looking good", score: 4 };
    if (avg >= 1.8) return { label: "Moderate", score: 3 };
    return { label: "Needs attention", score: 2 };
  }, [secrets]);

  // Generator strength
  const genStrength = calculatePasswordStrength(generatedPassword);

  return !authUser ? (
    <div className={`auth-page ${darkMode ? "dark-mode" : ""}`}>
      <header className="auth-header">
        <a className="auth-brand" href="#" onClick={(event) => event.preventDefault()} aria-label="Hush home">
          <span className="brand-mark"><Icon>◈</Icon></span>
          <span>hush<span className="brand-period">.</span></span>
        </a>
        <div className="auth-header-actions">
          <span className="auth-demo-label">ZERO-KNOWLEDGE · CLIENT-SIDE</span>
          <button
            className="auth-theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}
            aria-pressed={darkMode}
          >
            {darkMode ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <main className="auth-card">
        <section className="auth-form-panel">
          <div className="auth-form-inner">
            <div className="auth-eyebrow"><span className="eyebrow-dot" /> YOUR PRIVATE SPACE</div>
            <h1>{authMode === "signin" ? "Unlock your vault" : "Create your vault"}</h1>
            <p className="auth-subtitle">
              {authMode === "signin"
                ? "Enter your master password to derive the key and decrypt your vault."
                : "Choose a master password to initialize your client-side encrypted vault."}
            </p>

            <form className="auth-form" onSubmit={submitAuth}>
              {authMode === "signup" && (
                <label className="auth-field">
                  <span>YOUR NAME</span>
                  <span className="auth-input-wrap">
                    <Icon>♙</Icon>
                    <input
                      autoComplete="name"
                      required
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      placeholder="Alex Morgan"
                    />
                  </span>
                </label>
              )}

              {authMode === "signup" && (
                <label className="auth-field">
                  <span>EMAIL ADDRESS (OPTIONAL)</span>
                  <span className="auth-input-wrap">
                    <Icon>✉</Icon>
                    <input
                      type="email"
                      autoComplete="email"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="you@example.com"
                    />
                  </span>
                </label>
              )}

              <label className="auth-field">
                <span>MASTER PASSWORD</span>
                <span className="auth-input-wrap">
                  <Icon>▣</Icon>
                  <input
                    type={showAuthPassword ? "text" : "password"}
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                    minLength={8}
                    required
                    value={authForm.password}
                    onChange={(e) => {
                      setAuthForm({ ...authForm, password: e.target.value });
                      setAuthError("");
                    }}
                    placeholder="Enter your master password"
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowAuthPassword((v) => !v)}
                    aria-label={showAuthPassword ? "Hide password" : "Show password"}
                  >
                    {showAuthPassword ? "◉" : "◎"}
                  </button>
                </span>
              </label>

              {authMode === "signup" && (
                <label className="auth-field">
                  <span>CONFIRM MASTER PASSWORD</span>
                  <span className="auth-input-wrap">
                    <Icon>▣</Icon>
                    <input
                      type={showAuthPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={authForm.confirmPassword}
                      onChange={(e) => {
                        setAuthForm({ ...authForm, confirmPassword: e.target.value });
                        setAuthError("");
                      }}
                      placeholder="Re-enter your master password"
                    />
                  </span>
                </label>
              )}

              {authError && <p className="auth-error" role="alert">{authError}</p>}

              <button className="auth-submit" type="submit" disabled={authLoading}>
                {authLoading ? (
                  <span>DERIVING KEY (600,000 ROUNDS)...</span>
                ) : authMode === "signin" ? (
                  <>UNLOCK VAULT <span aria-hidden="true">→</span></>
                ) : (
                  <>INITIALIZE ENCRYPTED VAULT <span aria-hidden="true">→</span></>
                )}
              </button>

              <p className="auth-switch">
                {authMode === "signin" ? "Need a new vault?" : "Already have a vault?"}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "signin" ? "signup" : "signin");
                    setAuthError("");
                  }}
                >
                  {authMode === "signin" ? "Create an account" : "Unlock existing vault"}
                </button>
              </p>
            </form>

            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p className="auth-demo-note">
                <Icon>🔒</Icon> AES-256-GCM + PBKDF2 (600,000 iterations). Keys stay in RAM only.
              </p>
              <label style={{ fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline", color: "inherit", opacity: 0.8 }}>
                Restore Backup
                <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
              </label>
            </div>
          </div>
        </section>

        <aside className="auth-welcome-panel">
          <span className="auth-panel-brand">HUSH · CLIENT-SIDE ENCRYPTED</span>
          <div className="auth-welcome-copy">
            <span className="auth-welcome-icon">◈</span>
            <h2>{authMode === "signin" ? "A little more peace of mind." : "Your private space starts here."}</h2>
            <p>
              {authMode === "signin"
                ? "Every secret is encrypted inside your browser before saving to IndexedDB. No server ever sees your password."
                : "Create a vault with a single master password. Your cryptographic key never leaves your browser."}
            </p>
            <button
              className="auth-panel-button"
              type="button"
              onClick={() => {
                setAuthMode(authMode === "signin" ? "signup" : "signin");
                setAuthError("");
              }}
            >
              {authMode === "signin" ? "CREATE VAULT" : "UNLOCK VAULT"}
            </button>
          </div>
          <div className="auth-panel-footer">
            <span>✦ GLA University Mini Project – 1</span>
            <span>Zero-Knowledge Storage</span>
          </div>
        </aside>
      </main>
    </div>
  ) : (
    <div className={`app-shell ${darkMode ? "dark-mode" : ""}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()} aria-label="Hush home">
          <span className="brand-mark"><Icon>◈</Icon></span>
          <span>hush<span className="brand-period">.</span></span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              className={`nav-link ${activePage === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => setActivePage(item.id)}
            >
              <Icon>{item.icon}</Icon>
              <span>{item.label}</span>
              {item.id === "vault" && <span className="nav-count">{secrets.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="privacy-card">
          <div className="privacy-icon"><Icon>✦</Icon></div>
          <strong>Zero-Knowledge Active</strong>
          <p>Secrets are encrypted in browser memory with AES-256-GCM. 0 bytes sent over network.</p>
          <button onClick={() => setActivePage("settings")}>Security details <span aria-hidden="true">↗</span></button>
        </div>
        <div className="profile">
          <div className="avatar">
            {authUser.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="profile-info">
            <strong>{authUser}</strong>
            <span>Encrypted Vault</span>
          </div>
          <button className="more-button" onClick={lockVault} aria-label="Lock vault" title="Lock vault">
            🔒
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{navigation.find((item) => item.id === activePage)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-pill" title="Keys in RAM only; 0 bytes transmitted">
              <span style={{ backgroundColor: "#10b981" }} /> AES-256-GCM
            </span>
            <button
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}
              aria-pressed={darkMode}
              title={`Switch to ${darkMode ? "light" : "dark"} mode`}
            >
              {darkMode ? "☀" : "☾"}
            </button>
            <button
              className="icon-button sign-out-button"
              onClick={lockVault}
              aria-label="Lock vault now"
              title="Lock vault now"
            >
              🔒
            </button>
            <button className="icon-button help-button" onClick={() => setActivePage("settings")} aria-label="Help">
              ?
            </button>
          </div>
        </header>

        {/* VAULT PAGE */}
        {activePage === "vault" && (
          <section className="page-content">
            <div className="page-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PRIVATE SPACE</div>
                <h1>Welcome, {authUser.split(/\s+/)[0]} <span className="wave">✳</span></h1>
                <p className="page-subtitle">Everything important, safely encrypted in one place.</p>
              </div>
              <button className="primary-button" onClick={() => setModalOpen(true)}>
                <span>＋</span> Add a secret
              </button>
            </div>

            <div className="summary-grid">
              <div className="summary-card vault-summary">
                <div className="summary-top">
                  <span className="summary-icon purple-icon">◈</span>
                  <span className="summary-kicker">YOUR VAULT</span>
                  <span className="summary-menu">···</span>
                </div>
                <div className="summary-value">{secrets.length.toString().padStart(2, "0")}<span> items</span></div>
                <div className="summary-foot"><span className="tiny-lock">▣</span> Encrypted with AES-256-GCM</div>
              </div>
              <div className="summary-card security-summary">
                <div className="summary-top">
                  <span className="summary-icon green-icon">✓</span>
                  <span className="summary-kicker">PASSWORD HEALTH</span>
                  <span className="health-label">{healthAssessment.label}</span>
                </div>
                <div className="health-meter">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      style={{
                        backgroundColor: i <= healthAssessment.score ? "#10b981" : "rgba(100,116,139,0.3)"
                      }}
                    />
                  ))}
                </div>
                <div className="summary-foot">Calculated in real-time from vault entropy.</div>
              </div>
              <div className="summary-card tip-summary">
                <div className="tip-decoration">✳</div>
                <div className="tip-content">
                  <span className="summary-kicker">A LITTLE REMINDER</span>
                  <p>Never reuse your passwords across accounts.</p>
                  <button onClick={() => setActivePage("generator")}>Make a strong one <span>→</span></button>
                </div>
              </div>
            </div>

            <section className="vault-section">
              <div className="section-heading">
                <div>
                  <h2>Your secrets <span className="item-count">{secrets.length}</span></h2>
                  <p>Decrypted on demand in browser memory.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    setFilter("All items");
                    setSearch("");
                  }}
                >
                  View all <span>→</span>
                </button>
              </div>
              <div className="list-toolbar">
                <label className="search-field">
                  <Icon>⌕</Icon>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search your vault..."
                    aria-label="Search your vault"
                  />
                  {search && <button onClick={() => setSearch("")} aria-label="Clear search">×</button>}
                  {!search && <kbd>⌘ K</kbd>}
                </label>
                <label className="filter-select-wrap">
                  <Icon>☷</Icon>
                  <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by category">
                    <option>All items</option>
                    {["Personal", "Work", "Entertainment", "Finance", "Social"].map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                  <span className="select-caret">⌄</span>
                </label>
              </div>
              <div className="secret-list">
                <div className="list-header">
                  <span>NAME</span>
                  <span>USERNAME</span>
                  <span>PASSWORD</span>
                  <span>CATEGORY</span>
                  <span />
                </div>
                {visibleSecrets.map((secret) => {
                  const isVisible = visibleIds.includes(secret.id);
                  return (
                    <article className="secret-row" key={secret.id}>
                      <div className="secret-name">
                        <div className={`service-icon ${secret.color || "purple"}`}>{secret.initials}</div>
                        <div>
                          <strong>{secret.title}</strong>
                          <span>{secret.notes ? secret.notes.slice(0, 30) : "Account secret"}</span>
                        </div>
                      </div>
                      <div className="secret-username">
                        {secret.username ? (
                          <span
                            style={{ cursor: "pointer" }}
                            title="Click to copy username"
                            onClick={() => copyText(secret.username, "Username")}
                          >
                            {secret.username}
                          </span>
                        ) : (
                          <span className="muted">No username</span>
                        )}
                      </div>
                      <div className="secret-password">
                        <span className={isVisible ? "revealed-password" : "password-dots"}>
                          {isVisible ? secret.password : "••••••••••••"}
                        </span>
                        <button
                          className="row-action"
                          onClick={() =>
                            setVisibleIds((ids) =>
                              isVisible ? ids.filter((id) => id !== secret.id) : [...ids, secret.id]
                            )
                          }
                          aria-label={isVisible ? "Hide password" : "Show password"}
                        >
                          {isVisible ? "◉" : "◎"}
                        </button>
                        <button
                          className="row-action copy-action"
                          onClick={() => copyText(secret.password, "Password")}
                          aria-label="Copy password"
                        >
                          ▢
                        </button>
                      </div>
                      <div>
                        <span className={`category-tag ${(secret.category || "personal").toLowerCase()}`}>
                          {secret.category}
                        </span>
                      </div>
                      <button
                        className="row-menu"
                        onClick={() => deleteSecret(secret)}
                        aria-label={`Delete ${secret.title}`}
                        title="Delete entry"
                      >
                        🗑
                      </button>
                    </article>
                  );
                })}
                {visibleSecrets.length === 0 && (
                  <div className="empty-state">
                    <span>⌕</span>
                    <strong>No secrets found</strong>
                    <p>{search ? "Try another search keyword." : "Your vault is empty. Click '+ Add a secret' to store your first login!"}</p>
                  </div>
                )}
              </div>
              <div className="list-footer">
                <span>Showing <strong>{visibleSecrets.length}</strong> of <strong>{secrets.length}</strong> items</span>
                <span className="encrypted-note">
                  <span>◈</span> Stored in IndexedDB · Encrypted with AES-256-GCM
                </span>
              </div>
            </section>
            <footer className="page-footer">
              <span>GLA University – CEA Department · Mini Project 1</span>
              <span>Client-Side Secrets Organizer <span className="heart">♥</span></span>
            </footer>
          </section>
        )}

        {/* PASSWORD GENERATOR PAGE */}
        {activePage === "generator" && (
          <section className="page-content secondary-page">
            <div className="page-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" /> BUILT FOR BETTER SECURITY</div>
                <h1>Password generator <span className="wave">✳</span></h1>
                <p className="page-subtitle">Create a unique, cryptographically unbiased password.</p>
              </div>
            </div>
            <div className="generator-layout">
              <section className="generator-card">
                <div className="generator-card-heading">
                  <div className="large-generator-icon">✳</div>
                  <div>
                    <h2>Your new password</h2>
                    <p>Generated in browser with window.crypto.getRandomValues.</p>
                  </div>
                </div>
                <div className="generated-output">
                  <span>{generatedPassword}</span>
                  <button onClick={() => copyText(generatedPassword, "Password")} aria-label="Copy generated password">
                    ▢
                  </button>
                </div>
                <div className="strength-row">
                  <div className="strength-bars">
                    {[1, 2, 3, 4].map((bar) => (
                      <span className={bar <= genStrength.score ? "filled" : ""} key={bar} />
                    ))}
                  </div>
                  <span>{genStrength.label} ({genStrength.entropy} bits)</span>
                </div>
                <button className="primary-button generate-button" onClick={generateNewPassword}>
                  <span>⟳</span> Generate new password
                </button>
              </section>
              <section className="options-card">
                <div className="section-heading">
                  <div>
                    <h2>Customize it</h2>
                    <p>Set your preferred character set.</p>
                  </div>
                </div>
                <label className="length-label">
                  <span>Password length</span>
                  <strong>{generatorLength} characters</strong>
                </label>
                <input
                  className="length-slider"
                  type="range"
                  min="8"
                  max="48"
                  value={generatorLength}
                  onChange={(e) => {
                    setGeneratorLength(Number(e.target.value));
                    setGeneratedPassword(
                      generatePassword({
                        length: Number(e.target.value),
                        includeNumbers: useNumbers,
                        includeSymbols: useSymbols,
                        includeUppercase: useUppercase,
                      })
                    );
                  }}
                  aria-label="Password length"
                />
                <div className="range-labels">
                  <span>8</span>
                  <span>48</span>
                </div>
                <div className="option-divider" />
                <label className="toggle-row">
                  <span>
                    <strong>Include numbers</strong>
                    <small>Add digits (0-9)</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={useNumbers}
                    onChange={(e) => {
                      setUseNumbers(e.target.checked);
                      setGeneratedPassword(
                        generatePassword({
                          length: generatorLength,
                          includeNumbers: e.target.checked,
                          includeSymbols: useSymbols,
                          includeUppercase: useUppercase,
                        })
                      );
                    }}
                  />
                  <span className="toggle-ui" />
                </label>
                <label className="toggle-row">
                  <span>
                    <strong>Include symbols</strong>
                    <small>Add special characters like ! @ # $ %</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={useSymbols}
                    onChange={(e) => {
                      setUseSymbols(e.target.checked);
                      setGeneratedPassword(
                        generatePassword({
                          length: generatorLength,
                          includeNumbers: useNumbers,
                          includeSymbols: e.target.checked,
                          includeUppercase: useUppercase,
                        })
                      );
                    }}
                  />
                  <span className="toggle-ui" />
                </label>
                <label className="toggle-row">
                  <span>
                    <strong>Include uppercase letters</strong>
                    <small>Add capital letters (A-Z)</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={useUppercase}
                    onChange={(e) => {
                      setUseUppercase(e.target.checked);
                      setGeneratedPassword(
                        generatePassword({
                          length: generatorLength,
                          includeNumbers: useNumbers,
                          includeSymbols: useSymbols,
                          includeUppercase: e.target.checked,
                        })
                      );
                    }}
                  />
                  <span className="toggle-ui" />
                </label>
              </section>
            </div>
            <div className="info-banner">
              <span>✦</span>
              <p>
                <strong>Security tip:</strong> Using distinct, high-entropy passwords for each service prevents credential stuffing if one provider suffers a data breach.
              </p>
            </div>
          </section>
        )}

        {/* SETTINGS PAGE */}
        {activePage === "settings" && (
          <section className="page-content secondary-page">
            <div className="page-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" /> MAKE IT YOURS</div>
                <h1>Settings & Security</h1>
                <p className="page-subtitle">Configure auto-lock, manage encrypted backups, and review system specs.</p>
              </div>
            </div>

            {/* Auto-Lock Inactivity */}
            <section className="settings-card">
              <div className="settings-icon">⏱</div>
              <div style={{ flex: 1 }}>
                <h2>Auto-Lock on Inactivity</h2>
                <p>Purges the encryption key and decrypted records from browser memory after being idle.</p>
                <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <select
                    value={autoLockSetting}
                    onChange={async (e) => {
                      const mins = Number(e.target.value);
                      setAutoLockSetting(mins);
                      if (vaultMeta) {
                        const updated = { ...vaultMeta, autoLockMinutes: mins };
                        await saveVaultMeta(updated);
                        setVaultMeta(updated);
                        notify(`Auto-lock set to ${mins === 0 ? "Disabled" : mins + " minutes"}`);
                      }
                    }}
                    style={{
                      padding: "0.4rem 0.8rem",
                      borderRadius: "6px",
                      border: "1px solid rgba(100,116,139,0.4)",
                      background: darkMode ? "#1e293b" : "#fff",
                      color: "inherit"
                    }}
                  >
                    <option value={1}>1 Minute</option>
                    <option value={2}>2 Minutes</option>
                    <option value={5}>5 Minutes (Recommended)</option>
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={0}>Disabled</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Change Master Password */}
            <section className="settings-card">
              <div className="settings-icon">🔑</div>
              <div style={{ flex: 1 }}>
                <h2>Change Master Password</h2>
                <p>Derives a new 256-bit AES-GCM key and re-encrypts all current secrets in IndexedDB.</p>
                {passMessage && (
                  <div style={{ padding: "0.5rem", margin: "0.5rem 0", background: "rgba(16,185,129,0.1)", borderRadius: "6px", fontSize: "0.85rem" }}>
                    {passMessage}
                  </div>
                )}
                <form onSubmit={handleChangeMasterPassword} style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem", maxWidth: "340px" }}>
                  <input
                    type="password"
                    placeholder="Current Master Password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    style={{ padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid rgba(100,116,139,0.4)", background: darkMode ? "#1e293b" : "#fff", color: "inherit" }}
                  />
                  <input
                    type="password"
                    placeholder="New Master Password (8+ chars)"
                    required
                    value={newMasterPassword}
                    onChange={(e) => setNewMasterPassword(e.target.value)}
                    style={{ padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid rgba(100,116,139,0.4)", background: darkMode ? "#1e293b" : "#fff", color: "inherit" }}
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Master Password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    style={{ padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid rgba(100,116,139,0.4)", background: darkMode ? "#1e293b" : "#fff", color: "inherit" }}
                  />
                  <button className="primary-button" type="submit" disabled={changingPass} style={{ justifySelf: "start", marginTop: "0.25rem" }}>
                    {changingPass ? "Re-encrypting..." : "Update Master Password"}
                  </button>
                </form>
              </div>
            </section>

            {/* Encrypted Backup & Restore */}
            <section className="settings-card">
              <div className="settings-icon">💾</div>
              <div style={{ flex: 1 }}>
                <h2>Encrypted Backup & Restore</h2>
                <p>Download your vault as an authenticated `.json` file. All secrets remain 100% AES-256-GCM encrypted.</p>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                  <button className="primary-button" type="button" onClick={handleExport}>
                    <span>⬇</span> Export Encrypted Backup (.json)
                  </button>
                  <label className="primary-button" style={{ cursor: "pointer", background: "transparent", border: "1px solid currentColor", color: "inherit" }}>
                    <span>⬆</span> Restore From Backup
                    <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
                  </label>
                  <button className="primary-button" type="button" onClick={handleWipeVault} style={{ background: "#e11d48", color: "#fff" }}>
                    <span>🗑</span> Wipe Vault
                  </button>
                </div>
              </div>
            </section>

            {/* Academic Project Credits */}
            <section className="settings-card settings-secondary">
              <div className="settings-icon soft-green">🎓</div>
              <div>
                <h2>GLA University – CEA Department</h2>
                <p style={{ marginTop: "0.25rem" }}>
                  <strong>Mini Project – 1</strong> | Batch 7 | Section AC | Semester V<br />
                  <strong>Faculty Mentor:</strong> Mr. Anurag Das
                </p>
                <div style={{ marginTop: "0.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem" }}>
                  <div>• <strong>Kanha Pandey</strong> (2415000755) — Crypto Logic</div>
                  <div>• <strong>Harsh Pachahara</strong> (2415000648) — Frontend & UI</div>
                  <div>• <strong>Govind Khandelwal</strong> (2415000614) — Vault Storage</div>
                  <div>• <strong>Jitendra Chauhan</strong> (2415000735) — Testing & Docs</div>
                  <div>• <strong>Gagan Kumar</strong> (2415000582) — Research</div>
                </div>
              </div>
            </section>
          </section>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map((item) => (
          <button
            className={activePage === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setActivePage(item.id)}
          >
            <Icon>{item.icon}</Icon>
            <span>{item.label === "Password generator" ? "Generator" : item.label === "My vault" ? "Vault" : item.label}</span>
          </button>
        ))}
      </nav>

      {/* Add Secret Modal */}
      {modalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <form className="secret-modal" onSubmit={saveSecret}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setModalOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="modal-icon">＋</div>
            <div className="eyebrow"><span className="eyebrow-dot" /> ADD TO YOUR VAULT</div>
            <h2>Add a new secret</h2>
            <p className="modal-description">Every field is encrypted with AES-256-GCM before saving.</p>

            <label className="form-label">
              Name
              <input
                autoFocus
                required
                placeholder="e.g. Google, GitHub, Wi-Fi"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>

            <label className="form-label">
              Username or email
              <input
                placeholder="name@example.com"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>

            <label className="form-label">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Password</span>
                <span
                  style={{ cursor: "pointer", color: "#6366f1", textDecoration: "underline", fontSize: "0.75rem" }}
                  onClick={() => {
                    const generated = generatePassword({ length: 16 });
                    setForm({ ...form, password: generated });
                  }}
                >
                  Generate Strong
                </span>
              </div>
              <input
                required
                type="text"
                placeholder="Enter password or click Generate"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>

            <label className="form-label">
              Category
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {["Personal", "Work", "Entertainment", "Finance", "Social"].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="form-label">
              Notes (Optional)
              <input
                placeholder="Recovery codes, PIN, or notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>

            <div className="modal-warning" style={{ color: "#10b981", borderColor: "rgba(16,185,129,0.3)" }}>
              🔒 Protected: Encrypted locally in IndexedDB using your PBKDF2 derived key.
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="primary-button" type="submit">
                Encrypt & Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Global Toast */}
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
