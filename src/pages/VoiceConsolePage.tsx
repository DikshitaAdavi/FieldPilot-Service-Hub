import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  PhoneOff,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useVoice } from '../context/VoiceContext';
import { VoiceOrb } from '../components/voice/VoiceOrb';
import { ConfirmationCard } from '../components/voice/ConfirmationCard';
import { CameraSnapshotPanel } from '../components/voice/CameraSnapshotPanel';
import { PriorityLabel, StateLabel } from '../components/common/Chips';

const QUICK_PROMPTS = [
  'Check safety SOP and past history for CH-07 high discharge pressure',
  'Check spare part availability for condenser fan motor CFM-30XA-480V',
  'Order 1 CFM-30XA-480V urgent from Bengaluru Regional Hub for INC0010001',
  'Provide a workaround on INC0010001: isolated Circuit A and shifted load to CH-08',
  'Invite a remote supervisor expert to inspect INC0010001',
];

export function VoiceConsolePage() {
  const { store, navigate, integrationsStatus } = useApp();
  const {
    session,
    lockedTicketNumber,
    setLockedTicketNumber,
    messages,
    interimTranscript,
    isListening,
    isTranscribing,
    audioLevel,
    isThinking,
    isSpeaking,
    ttsProvider,
    murfVoiceId,
    setMurfVoiceId,
    lastSpokenText,
    autoplayBlocked,
    speechTtsEnabled,
    setSpeechTtsEnabled,
    ragSources,
    toolTimeline,
    error,
    startSession,
    endSession,
    toggleListening,
    stopSpeaking,
    replayLastVoice,
    testMurfVoice,
    sendMessage,
  } = useVoice();

  const availableVoices = integrationsStatus?.murf.supportedVoices?.length
    ? integrationsStatus.murf.supportedVoices
    : ['Gordon', 'Matthew', 'Natalie', 'Miles'];

  const [textInput, setTextInput] = useState('');

  if (!store) return null;

  const activeTicket = store.tickets.find(
    (t) => t.ticket_number === lockedTicketNumber
  );

  const pendingConfirmations = store.confirmations.filter(
    (c) => c.status === 'pending' && new Date(c.expires_at).getTime() > Date.now()
  );

  const activeExpertInvites = store.expertInvites.filter(
    (e) => activeTicket && e.ticket_id === activeTicket.id
  );

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!textInput.trim() || isThinking) return;
    const msg = textInput;
    setTextInput('');
    await sendMessage(msg);
  }

  return (
    <div className="space-y-5">
      {/* Top Context Lock & Session Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Locked Ticket Context
            </label>
            <select
              value={lockedTicketNumber ?? ''}
              onChange={(e) => setLockedTicketNumber(e.target.value || null)}
              className="mt-0.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">General Field Inquiry</option>
              {store.tickets
                .filter((t) => !['CLOSED_COMPLETE', 'CANCELLED'].includes(t.state))
                .slice(0, 20)
                .map((t) => (
                  <option key={t.id} value={t.ticket_number}>
                    {t.ticket_number} · {t.priority} · {t.title.slice(0, 44)}
                  </option>
                ))}
            </select>
          </div>

          {activeTicket && (
            <div className="flex items-center gap-2 pt-3 sm:pt-4">
              <PriorityLabel priority={activeTicket.priority} />
              <StateLabel state={activeTicket.state} />
              <button
                type="button"
                onClick={() => navigate(`/tickets/${activeTicket.ticket_number}`)}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                View Ticket →
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Voice:{' '}
            {ttsProvider === 'gemini-tts'
              ? 'Gemini Audio TTS'
              : integrationsStatus?.murf.configured
              ? 'Murf Falcon TTS'
              : 'Gemini Audio TTS'}
            {' · '}STT: Gemini Transcribe
          </span>

          {integrationsStatus?.murf.configured && (
            <select
              aria-label="Murf Falcon voice"
              value={murfVoiceId}
              onChange={(e) => setMurfVoiceId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {availableVoices.map((v) => (
                <option key={v} value={v}>
                  Murf · {v}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => void testMurfVoice()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            Test Voice
          </button>

          {lastSpokenText && (
            <button
              type="button"
              onClick={() => void replayLastVoice()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              Replay
            </button>
          )}

          <button
            type="button"
            onClick={() => setSpeechTtsEnabled(!speechTtsEnabled)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            {speechTtsEnabled ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Voice Output On
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                Muted
              </>
            )}
          </button>

          {session ? (
            <button
              type="button"
              onClick={endSession}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700 whitespace-nowrap"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              End Session
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startSession(lockedTicketNumber)}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
            >
              Start Copilot Session
            </button>
          )}
        </div>
      </div>

      {/* Pending Confirmations */}
      {pendingConfirmations.length > 0 && (
        <div className="space-y-3">
          {pendingConfirmations.map((conf) => (
            <ConfirmationCard key={conf.id} confirmation={conf} />
          ))}
        </div>
      )}

      {/* Remote Expert Invite Banner */}
      {activeExpertInvites.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs dark:border-indigo-900 dark:bg-indigo-950/40">
          <div>
            <span className="font-semibold text-indigo-800 dark:text-indigo-300">
              Remote Expert Room Ready:
            </span>{' '}
            <span className="font-mono text-indigo-700 dark:text-indigo-200">
              {activeExpertInvites[0].channel_name}
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/expert/${activeExpertInvites[0].channel_name}`)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
          >
            Open Expert Room →
          </button>
        </div>
      )}

      {/* Main 3-Column Copilot Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left/Center: Voice Orb, Live Captions & Conversation */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <VoiceOrb
              isListening={isListening}
              isTranscribing={isTranscribing}
              audioLevel={audioLevel}
              isThinking={isThinking}
              isSpeaking={isSpeaking}
              onToggleListen={toggleListening}
              onStopSpeaking={stopSpeaking}
            />
            {interimTranscript && (
              <p className="mt-1 rounded-lg bg-slate-100 px-3 py-1.5 text-center text-xs italic text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                &ldquo;{interimTranscript}&rdquo;
              </p>
            )}
          </div>

          {/* Conversation Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-5 max-h-[420px]">
            {messages.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Ready for hands-free field diagnostics
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Tap a quick prompt below, speak into your mic, or send a photo for Gemini Vision analysis.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.text}</p>
                  </div>
                </div>
              ))
            )}
            {isThinking && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                FieldPilot AI is querying tools &amp; manuals...
              </div>
            )}
            {autoplayBlocked && lastSpokenText && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                <span>Browser paused audio autoplay after response.</span>
                <button
                  type="button"
                  onClick={() => void replayLastVoice()}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 whitespace-nowrap"
                >
                  <Play className="h-3 w-3" />
                  Play Audio Reply
                </button>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Quick Field Prompts + Input */}
          <div className="border-t border-slate-200 p-4 space-y-3 dark:border-slate-800">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isThinking}
                  onClick={() => sendMessage(q)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-[11px] font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-500"
                >
                  {q}
                </button>
              ))}
            </div>

            <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a field command or reply (e.g. 'Yes, confirm')..."
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={isThinking || !textInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Right 5 Columns: Camera Snapshot + Safety SOPs + Tool Timeline */}
        <div className="space-y-5 lg:col-span-5">
          <CameraSnapshotPanel />

          {/* Safety SOP & RAG Sources */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Grounded Knowledge &amp; Safety SOPs
            </h3>
            {ragSources.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Referenced manuals and mandatory safety warnings will appear here as the copilot diagnoses the issue.
              </p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {ragSources.map((src) => (
                  <div
                    key={src.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {src.title}
                      </span>
                      <span className="font-mono text-[10px] uppercase text-slate-500">
                        {src.doc_type}
                      </span>
                    </div>
                    {src.safety_sop && (
                      <p className="mt-1.5 flex items-start gap-1.5 text-rose-700 dark:text-rose-300">
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{src.safety_sop}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tool Execution Timeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Wrench className="h-4 w-4 text-slate-500" />
              Tool Execution Timeline
            </h3>
            {toolTimeline.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Real-time tool calls (`search_knowledge_base`, `check_part_availability`, `create_purchase_order`, etc.) log here.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {toolTimeline.map((te) => (
                  <div
                    key={te.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2
                        className={`h-3.5 w-3.5 shrink-0 ${
                          te.status === 'success'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : te.status === 'pending_confirmation'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600'
                        }`}
                      />
                      <span className="truncate font-mono font-medium text-slate-800 dark:text-slate-200">
                        {te.tool_name}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {te.duration_ms}ms · {te.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
