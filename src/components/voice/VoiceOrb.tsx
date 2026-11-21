import React from 'react';
import { Mic, MicOff, Square, Volume2 } from 'lucide-react';

interface Props {
  isListening: boolean;
  isTranscribing?: boolean;
  audioLevel?: number;
  isThinking: boolean;
  isSpeaking: boolean;
  onToggleListen: () => void;
  onStopSpeaking: () => void;
}

export function VoiceOrb({
  isListening,
  isTranscribing = false,
  audioLevel = 0,
  isThinking,
  isSpeaking,
  onToggleListen,
  onStopSpeaking,
}: Props) {
  const statusLabel = isListening
    ? 'Recording — tap again (or V) to send'
    : isTranscribing
    ? 'Transcribing speech with Gemini Audio...'
    : isThinking
    ? 'Analyzing manuals, inventory & ticket state...'
    : isSpeaking
    ? 'Speaking — press mic anytime to interrupt'
    : 'Press Microphone (or V) to speak';

  const ringColor = isListening
    ? 'border-rose-500 bg-rose-600 text-white'
    : isSpeaking
    ? 'border-emerald-500 bg-emerald-600 text-white'
    : isThinking || isTranscribing
    ? 'border-amber-500 bg-amber-600 text-white'
    : 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700';

  const barMultipliers = [0.45, 0.75, 1, 0.75, 0.45];

  return (
    <div className="flex flex-col items-center justify-center py-4 text-center">
      <div className="relative flex items-center justify-center">
        {(isListening || isSpeaking) && (
          <span
            className={`animate-voice-ring absolute h-24 w-24 rounded-full border-2 ${
              isListening ? 'border-rose-400/60' : 'border-emerald-400/60'
            }`}
          />
        )}
        <button
          type="button"
          onClick={onToggleListen}
          aria-label={isListening ? 'Stop recording and send' : 'Start voice command'}
          className={`relative z-10 flex h-18 w-18 items-center justify-center rounded-full border-2 shadow-sm transition-transform active:scale-95 ${ringColor}`}
        >
          {isListening ? (
            <MicOff className="h-7 w-7" />
          ) : isSpeaking ? (
            <Volume2 className="h-7 w-7" />
          ) : (
            <Mic className="h-7 w-7" />
          )}
        </button>
      </div>

      {isListening && (
        <div className="mt-3 flex h-5 items-end justify-center gap-1" aria-label="Live microphone input level">
          {barMultipliers.map((mult, idx) => {
            const heightPx = Math.max(4, Math.min(20, Math.round((audioLevel / 100) * 20 * mult + 4)));
            return (
              <span
                key={idx}
                className="w-1 rounded-full bg-rose-500 transition-[height] duration-75"
                style={{ height: `${heightPx}px` }}
              />
            );
          })}
        </div>
      )}

      <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">{statusLabel}</p>

      {isSpeaking && (
        <button
          type="button"
          onClick={onStopSpeaking}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Square className="h-3 w-3" />
          Stop Speaking
        </button>
      )}
    </div>
  );
}
