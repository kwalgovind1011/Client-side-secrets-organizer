/**
 * Password Strength Meter and Entropy Calculator
 * Evaluates password strength based on entropy, character diversity, and pattern checks.
 */

const COMMON_WEAK_PASSWORDS = new Set([
  "password", "123456", "12345678", "123456789", "qwerty", "admin", "welcome",
  "login", "secret", "master", "iloveyou", "password123", "letmein", "football",
  "monkey", "dragon", "baseball", "sunshine", "princess", "trustno1", "computer"
]);

export function calculatePasswordStrength(password) {
  if (!password || typeof password !== "string") {
    return {
      score: 0,
      label: "None",
      color: "bg-slate-700",
      textColor: "text-slate-400",
      percentage: 0,
      entropy: 0,
      feedback: ["Enter a password to test its strength"],
    };
  }

  const clean = password.trim().toLowerCase();

  // Instant flag for trivial passwords
  if (COMMON_WEAK_PASSWORDS.has(clean) || clean.length < 4) {
    return {
      score: 0,
      label: "Very Weak",
      color: "bg-red-500",
      textColor: "text-red-400",
      percentage: 15,
      entropy: 10,
      feedback: ["This is a commonly used, easily guessable password."],
    };
  }

  // Calculate character pool size
  let poolSize = 0;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  if (hasLower) poolSize += 26;
  if (hasUpper) poolSize += 26;
  if (hasNumber) poolSize += 10;
  if (hasSymbol) poolSize += 33;

  // Shannon Entropy: E = L * log2(R)
  const length = password.length;
  let entropy = length * Math.log2(Math.max(poolSize, 1));

  // Deduct for repetitive sequences
  if (/(.)\1{2,}/.test(password)) {
    entropy -= 10; // Repeated characters e.g. "aaa"
  }
  if (/012|123|234|345|456|567|678|789|abc|bcd|cde|def/.test(clean)) {
    entropy -= 10; // Sequential patterns
  }

  entropy = Math.max(0, Math.round(entropy));

  const feedback = [];
  if (length < 8) feedback.push("Minimum recommended length is 8+ characters");
  else if (length < 12) feedback.push("Increasing length to 12+ characters significantly raises security");
  
  if (!hasUpper) feedback.push("Add uppercase letters (A-Z)");
  if (!hasLower) feedback.push("Add lowercase letters (a-z)");
  if (!hasNumber) feedback.push("Add digits (0-9)");
  if (!hasSymbol) feedback.push("Add special symbols (!@#$...)");

  let score = 0;
  let label = "Very Weak";
  let color = "bg-red-500";
  let textColor = "text-red-400";
  let percentage = 20;

  if (entropy < 30 || length < 6) {
    score = 0;
    label = "Very Weak";
    color = "bg-rose-500";
    textColor = "text-rose-400";
    percentage = 20;
  } else if (entropy < 50 || length < 9) {
    score = 1;
    label = "Weak";
    color = "bg-orange-500";
    textColor = "text-orange-400";
    percentage = 40;
  } else if (entropy < 70 || length < 12) {
    score = 2;
    label = "Medium";
    color = "bg-amber-500";
    textColor = "text-amber-400";
    percentage = 65;
  } else if (entropy < 90 || length < 15) {
    score = 3;
    label = "Strong";
    color = "bg-emerald-500";
    textColor = "text-emerald-400";
    percentage = 85;
  } else {
    score = 4;
    label = "Very Strong";
    color = "bg-cyan-500";
    textColor = "text-cyan-400";
    percentage = 100;
  }

  if (feedback.length === 0) {
    feedback.push("Excellent password entropy and composition!");
  }

  return {
    score,
    label,
    color,
    textColor,
    percentage,
    entropy,
    feedback,
  };
}
