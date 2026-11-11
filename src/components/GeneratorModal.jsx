import React, { useState, useEffect, useCallback } from "react";
import { generatePassword, generatePassphrase } from "../utils/passwordGenerator";
import { calculatePasswordStrength } from "../utils/passwordStrength";
import { X, RefreshCw, Copy, Check, Sliders, KeyRound, BookOpen } from "lucide-react";

export default function GeneratorModal({ isOpen, onClose, onSelectPassword }) {
  const [mode, setMode] = useState("random"); // "random" | "passphrase"
  
  // Random password options
  const [length, setLength] = useState(16);
  const [uppercase, setUppercase] = useState(true);
  const [lowercase, setLowercase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(true);

  // Passphrase options
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState("-");
  const [capitalize, setCapitalize] = useState(true);
  const [includeNumber, setIncludeNumber] = useState(true);

  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(() => {
    if (mode === "random") {
      const generated = generatePassword({
        length,
        includeUppercase: uppercase,
        includeLowercase: lowercase,
        includeNumbers: numbers,
        includeSymbols: symbols,
        avoidAmbiguous,
      });
      setPassword(generated);
    } else {
      const generated = generatePassphrase({
        wordCount,
        separator,
        capitalize,
        includeNumber,
      });
      setPassword(generated);
    }
    setCopied(false);
  }, [mode, length, uppercase, lowercase, numbers, symbols, avoidAmbiguous, wordCount, separator, capitalize, includeNumber]);

  useEffect(() => {
    if (isOpen) {
      handleGenerate();
    }
  }, [isOpen, handleGenerate]);

  const handleCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleUse = () => {
    if (onSelectPassword && password) {
      onSelectPassword(password);
      onClose();
    }
  };

  if (!isOpen) return null;

  const strength = calculatePasswordStrength(password);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 backdrop-blur-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <KeyRound className="w-5 h-5 text-cyan-400" />
            <span>Cryptographic Password Generator</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => { setMode("random"); }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition ${
              mode === "random"
                ? "bg-slate-800 text-cyan-400 shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Random String</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode("passphrase"); }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition ${
              mode === "passphrase"
                ? "bg-slate-800 text-cyan-400 shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Memorable Passphrase</span>
          </button>
        </div>

        {/* Generated Password Box */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl relative group">
            <div className="flex-1 font-mono text-base sm:text-lg text-cyan-300 break-all select-all pr-2 tracking-wide font-medium">
              {password}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={handleGenerate}
                title="Regenerate"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy to Clipboard"
                className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition"
              >
                {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Strength Bar */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              Entropy: <strong className="text-slate-200">{strength.entropy} bits</strong>
            </span>
            <span className={`font-semibold ${strength.textColor}`}>{strength.label}</span>
          </div>
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${strength.color}`}
              style={{ width: `${strength.percentage}%` }}
            />
          </div>
        </div>

        {/* Configuration Controls */}
        {mode === "random" ? (
          <div className="space-y-3.5 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-slate-300 font-medium">Password Length</span>
                <span className="text-cyan-400 font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {length} characters
                </span>
              </div>
              <input
                type="range"
                min="8"
                max="64"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uppercase}
                  onChange={(e) => setUppercase(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Uppercase (A-Z)</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lowercase}
                  onChange={(e) => setLowercase(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Lowercase (a-z)</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={numbers}
                  onChange={(e) => setNumbers(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Numbers (0-9)</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={symbols}
                  onChange={(e) => setSymbols(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Symbols (!@#$...)</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer col-span-2">
                <input
                  type="checkbox"
                  checked={avoidAmbiguous}
                  onChange={(e) => setAvoidAmbiguous(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Avoid Ambiguous Characters (l, 1, I, O, 0)</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-slate-300 font-medium">Word Count</span>
                <span className="text-cyan-400 font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {wordCount} words
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="8"
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-400 mb-1">Separator</label>
                <input
                  type="text"
                  maxLength="2"
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>

              <div className="flex flex-col justify-end space-y-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={capitalize}
                    onChange={(e) => setCapitalize(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-cyan-500"
                  />
                  <span>Capitalize</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNumber}
                    onChange={(e) => setIncludeNumber(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-cyan-500"
                  />
                  <span>Append Number</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
          >
            Close
          </button>
          {onSelectPassword && (
            <button
              type="button"
              onClick={handleUse}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-xl transition shadow-lg shadow-cyan-600/20"
            >
              Use This Password
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
