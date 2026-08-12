'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';

interface ParticipantIdProps {
  onIdentified: (name: string | null) => void;
}

const STORAGE_KEY = 'esangguni_participant_name';
const SESSION_KEY = 'esangguni_session_id';

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function ParticipantId({ onIdentified }: ParticipantIdProps) {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Ensure session ID exists
    getOrCreateSessionId();
    // Check if already identified
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      onIdentified(stored || null);
    } else {
      setVisible(true);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [onIdentified]);

  const identify = (value: string | null) => {
    const n = value?.trim() || null;
    localStorage.setItem(STORAGE_KEY, n || '');
    setVisible(false);
    onIdentified(n);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    identify(name);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[hsl(224_27%_25%)] bg-[hsl(222_47%_9%)] p-6 shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="mb-5 text-center">
          <span className="text-2xl font-black tracking-widest text-[hsl(38_95%_55%)]">
            eSANGGUNI
          </span>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-[hsl(216_20%_50%)]">
            Module 1 · Smart Legislation
          </p>
        </div>

        <h2 className="mb-1 text-lg font-bold text-[hsl(214_100%_97%)]">
          Welcome, participant!
        </h2>
        <p className="mb-5 text-sm text-[hsl(216_20%_55%)] leading-relaxed">
          Enter your team name or nickname so your workshop activity can be
          grouped in our analytics. This is optional.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team Alpha, Vice Mayor Juan, etc."
            maxLength={40}
            className="w-full rounded-xl border border-[hsl(224_27%_25%)] bg-[hsl(224_35%_17%)] px-4 py-3 text-sm text-[hsl(214_100%_97%)] placeholder:text-[hsl(216_20%_40%)] outline-none focus:border-[hsl(239_84%_67%)] focus:ring-1 focus:ring-[hsl(239_84%_67%/0.3)] transition-all"
          />

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(239_84%_67%)] py-3 text-sm font-semibold text-white transition-all hover:bg-[hsl(239_84%_60%)] active:scale-[0.98]"
          >
            Start Workshop
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => identify(null)}
            className="w-full text-center text-xs text-[hsl(216_20%_45%)] hover:text-[hsl(216_20%_65%)] transition-colors py-1"
          >
            Skip — continue anonymously
          </button>
        </form>
      </div>
    </div>
  );
}
