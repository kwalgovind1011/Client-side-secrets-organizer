/**
 * Cryptographically Secure Password & Passphrase Generator
 * Utilizes window.crypto.getRandomValues for unbiased random selections.
 */

const UPPERCASE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // omitted ambiguous I, O by default or toggleable
const UPPERCASE_ALL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE_CHARS = "abcdefghijkmnopqrstuvwxyz"; // omitted l
const LOWERCASE_ALL = "abcdefghijklmnopqrstuvwxyz";
const NUMBER_CHARS = "23456789"; // omitted 1, 0
const NUMBER_ALL = "0123456789";
const SYMBOL_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

// Curated list of friendly dictionary words for Diceware-style passphrases
const PASSPHRASE_WORDS = [
  "anchor", "apple", "beacon", "breeze", "bridge", "cabin", "canyon", "castle",
  "cedar", "cipher", "cliff", "cloud", "clover", "comet", "coral", "crystal",
  "dawn", "delta", "desert", "dolphin", "dragon", "eagle", "ember", "falcon",
  "feather", "flame", "forest", "fossil", "galaxy", "glacier", "granite", "harbor",
  "haven", "hawk", "horizon", "island", "jasper", "jungle", "lagoon", "lantern",
  "legacy", "lynx", "meadow", "meteor", "mirage", "mountain", "nebula", "oasis",
  "ocean", "orbit", "otter", "palace", "pathway", "peak", "pebble", "phoenix",
  "pioneer", "planet", "prism", "quartz", "quiver", "radiant", "raven", "reef",
  "ridge", "river", "rocket", "ruby", "safari", "sailor", "sand", "sapphire",
  "shadow", "shield", "silver", "solace", "solar", "spark", "summit", "sunset",
  "temple", "timber", "titan", "topaz", "torrent", "tower", "trail", "tundra",
  "valley", "velvet", "vessel", "vortex", "voyage", "walnut", "wave", "whisper",
  "willow", "winter", "wizard", "zenith", "zephyr"
];

const getCrypto = () => (typeof window !== "undefined" ? window.crypto : globalThis.crypto);

/**
 * Get a cryptographically secure random integer in range [0, max - 1]
 * Uses rejection sampling to eliminate modulo bias.
 */
function getSecureRandomInt(max) {
  if (max <= 1) return 0;
  const range = 256 - (256 % max);
  const buffer = new Uint8Array(1);
  let rand;
  do {
    getCrypto().getRandomValues(buffer);
    rand = buffer[0];
  } while (rand >= range);
  return rand % max;
}

/**
 * Generate a random password based on configurable criteria
 */
export function generatePassword({
  length = 16,
  includeUppercase = true,
  includeLowercase = true,
  includeNumbers = true,
  includeSymbols = true,
  avoidAmbiguous = true,
} = {}) {
  let charPool = "";
  const requiredChars = [];

  const upper = avoidAmbiguous ? UPPERCASE_CHARS : UPPERCASE_ALL;
  const lower = avoidAmbiguous ? LOWERCASE_CHARS : LOWERCASE_ALL;
  const numbers = avoidAmbiguous ? NUMBER_CHARS : NUMBER_ALL;
  const symbols = SYMBOL_CHARS;

  if (includeUppercase) {
    charPool += upper;
    requiredChars.push(upper[getSecureRandomInt(upper.length)]);
  }
  if (includeLowercase) {
    charPool += lower;
    requiredChars.push(lower[getSecureRandomInt(lower.length)]);
  }
  if (includeNumbers) {
    charPool += numbers;
    requiredChars.push(numbers[getSecureRandomInt(numbers.length)]);
  }
  if (includeSymbols) {
    charPool += symbols;
    requiredChars.push(symbols[getSecureRandomInt(symbols.length)]);
  }

  // Fallback if no sets selected
  if (!charPool) {
    charPool = lower;
    requiredChars.push(lower[getSecureRandomInt(lower.length)]);
  }

  const result = [...requiredChars];
  const remainingLength = Math.max(0, length - requiredChars.length);

  for (let i = 0; i < remainingLength; i++) {
    result.push(charPool[getSecureRandomInt(charPool.length)]);
  }

  // Fisher-Yates cryptographically secure shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join("");
}

/**
 * Generate a memorable word-based passphrase (e.g. "coral-beacon-summit-timber")
 */
export function generatePassphrase({
  wordCount = 4,
  separator = "-",
  capitalize = true,
  includeNumber = true,
} = {}) {
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    let word = PASSPHRASE_WORDS[getSecureRandomInt(PASSPHRASE_WORDS.length)];
    if (capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    words.push(word);
  }

  let phrase = words.join(separator);
  if (includeNumber) {
    const num = getSecureRandomInt(100);
    phrase += `${separator}${num}`;
  }

  return phrase;
}
