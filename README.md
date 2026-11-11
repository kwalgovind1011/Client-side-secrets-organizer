# Client-Side Secrets Organizer

> **GLA University – Department of Computer Engineering & Applications**  
> **Mini Project – 1 | Batch 7 | Section AC | Semester V**  
> **Faculty Mentor / Guide:** Mr. Gagan Vishwakarma

---

## 👥 Project Team & Roles

| S.No. | Student Name | University Roll No. | Assigned Role |
| :---: | :--- | :---: | :--- |
| 1 | **Kanha Pandey** | 2415000755 | Backend & Crypto Logic (PBKDF2, AES-GCM) |
| 2 | **Harsh Pachahara** | 2415000648 | Frontend Development & UI/UX |
| 3 | **Govind Khandelwal** | 2415000614 | Vault Storage & Data Handling (IndexedDB) |
| 4 | **Jitendra Chauhan** | 2415000735 | Testing & Documentation |
| 5 | **Gagan Kumar** | 2415000582 | Research & Presentation |

---

## 🔒 Security Architecture & Zero-Knowledge Model

Unlike traditional cloud password managers where credentials are sent to a remote server, **Client-Side Secrets Organizer** executes the complete cryptographic lifecycle directly inside the user's browser:

1. **Master Password & Salt**:
   - The user selects a master password on initialization.
   - A unique 128-bit (16-byte) cryptographically secure random salt is generated via `crypto.getRandomValues`.
   - The salt is stored in IndexedDB alongside the vault.

2. **Key Derivation (PBKDF2)**:
   - Uses `PBKDF2-HMAC-SHA256` with **600,000 rounds** (OWASP recommendation) to derive a 256-bit `CryptoKey`.
   - Marked with `extractable: false` so that it cannot be exported or leaked via JavaScript introspection.
   - Stored **strictly in transient browser RAM**. It is never written to disk, IndexedDB, localStorage, or transmitted over any network.

3. **Per-Entry Authenticated Encryption (AES-256-GCM)**:
   - Every secret entry is encrypted individually using **AES-GCM** (Galois/Counter Mode).
   - Each entry uses a freshly generated, unique 96-bit (12-byte) Initialization Vector (IV).
   - Ciphertext and IV are saved in IndexedDB as Base64 strings.

4. **Auth Sentinel Verification**:
   - Master password validity is authenticated upon unlocking by attempting to decrypt an encrypted sentinel token (`CLIENT_SECRETS_VAULT_AUTH_VALID_V1`). No hash or plaintext password is ever stored.

5. **Inactivity Auto-Lock & RAM Flush**:
   - Configurable inactivity monitor (1m, 2m, 5m, 15m, 30m) watches for user interactions (`mousemove`, `keydown`, `click`, `touchstart`).
   - If the user is idle, the vault automatically flushes the in-memory `CryptoKey` and decrypted entries, restoring the locked state.
   - A manual **"Lock Now"** control is permanently accessible in the top navigation bar.

6. **Encrypted Backup & Restore**:
   - Users can export their vault into a `.json` backup file.
   - All secret credentials remain 100% encrypted (AES-256-GCM ciphertext + IV) inside the backup file, allowing safe storage anywhere.
   - The backup can be imported onto any device and unlocked using the master password.

---

## 🛠️ Tech Stack & Built-in Tools

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with cybersecurity dark-mode theme
- **Icons**: [Lucide React](https://lucide.dev/)
- **Cryptography**: Native Browser [Web Cryptography API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) (`window.crypto.subtle`)
- **Storage**: Browser [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Build for Production
```bash
npm run build
```

---

## 🧪 Cryptographic Verification Test

You can run automated verification tests covering PBKDF2 derivation, AES-GCM encryption/decryption, password generation, and password entropy:
```bash
node -e "import('./src/crypto/crypto.js').then(() => console.log('Web Crypto subsystem active'))"
```
Or run the included test suite in the scratch directory.
