import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ConfirmationRequest, ToolExecution, VoiceSession } from '../types/domain';
import { fetchJson } from '../lib/apiClient';
import { useApp } from './AppContext';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}

export interface RagSourceCard {
  id: string;
  title: string;
  doc_type: string;
  hazard_level: string;
  safety_sop?: string | null;
}

interface VoiceContextValue {
  session: VoiceSession | null;
  lockedTicketNumber: string | null;
  setLockedTicketNumber: (num: string | null) => void;
  messages: CopilotMessage[];
  interimTranscript: string;
  isListening: boolean;
  isTranscribing: boolean;
  audioLevel: number;
  isThinking: boolean;
  isSpeaking: boolean;
  ttsProvider: string | null;
  murfVoiceId: string;
  setMurfVoiceId: (voiceId: string) => void;
  lastSpokenText: string | null;
  autoplayBlocked: boolean;
  speechTtsEnabled: boolean;
  setSpeechTtsEnabled: (v: boolean) => void;
  speechSupported: boolean;
  ragSources: RagSourceCard[];
  toolTimeline: ToolExecution[];
  lastVisionAnalysis: string | null;
  error: string | null;
  startSession: (ticketNumber?: string | null) => Promise<VoiceSession | null>;
  endSession: () => Promise<void>;
  toggleListening: () => void;
  stopSpeaking: () => void;
  replayLastVoice: () => Promise<void>;
  testMurfVoice: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  analyzeImage: (imageBase64: string, mimeType: string, prompt?: string) => Promise<string | null>;
  launchForTicket: (ticketNumber: string) => Promise<void>;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, store, route, navigate, refreshStore, resolveConfirmation, pushToast } = useApp();

  const [session, setSession] = useState<VoiceSession | null>(null);
  const [lockedTicketNumber, setLockedTicketNumber] = useState<string | null>('INC0010001');
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<string | null>(null);
  const [murfVoiceId, setMurfVoiceIdState] = useState<string>(() => {
    return localStorage.getItem('fp_murf_voice') || 'Gordon';
  });
  const [lastSpokenText, setLastSpokenText] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [speechTtsEnabled, setSpeechTtsEnabled] = useState(true);
  const [ragSources, setRagSources] = useState<RagSourceCard[]>([]);
  const [toolTimeline, setToolTimeline] = useState<ToolExecution[]>([]);
  const [lastVisionAnalysis, setLastVisionAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setMurfVoiceId = useCallback((voiceId: string) => {
    setMurfVoiceIdState(voiceId);
    localStorage.setItem('fp_murf_voice', voiceId);
  }, []);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<CopilotMessage[]>([]);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});

  const micSupported =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  const speechRecognitionSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const speechSupported = micSupported || speechRecognitionSupported;

  const stopMeterAndStream = useCallback(() => {
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    setAudioLevel(0);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speakWithBrowserFallback = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ''));
    utterance.rate = 1.02;
    utterance.onstart = () => {
      setTtsProvider('browser-tts');
      setIsSpeaking(true);
    };
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const speakText = useCallback(
    async (text: string, options?: { force?: boolean; voiceId?: string }) => {
      const clean = text.trim();
      if (!clean) return;
      if (!options?.force && !speechTtsEnabled) return;

      setLastSpokenText(clean);
      setAutoplayBlocked(false);
      stopSpeaking();

      const controller = new AbortController();
      ttsAbortRef.current = controller;

      try {
        const res = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: clean,
            voice_id: options?.voiceId || murfVoiceId,
          }),
          signal: controller.signal,
        });

        const ct = res.headers.get('content-type') || '';
        if (!res.ok || ct.includes('application/json') || ct.includes('text/html')) {
          speakWithBrowserFallback(clean);
          return;
        }

        const provider = res.headers.get('X-TTS-Provider') || 'server-tts';
        const blob = await res.blob();
        if (controller.signal.aborted || blob.size === 0) return;

        const objectUrl = URL.createObjectURL(blob);
        audioUrlRef.current = objectUrl;
        const audio = audioElRef.current ?? new Audio();
        audioElRef.current = audio;
        audio.src = objectUrl;

        audio.onplay = () => {
          setTtsProvider(provider);
          setAutoplayBlocked(false);
          setIsSpeaking(true);
        };
        audio.onended = () => {
          setIsSpeaking(false);
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          speakWithBrowserFallback(clean);
        };

        try {
          await audio.play();
        } catch (playErr) {
          if ((playErr as { name?: string })?.name === 'NotAllowedError') {
            setIsSpeaking(false);
            setAutoplayBlocked(true);
            return;
          }
          throw playErr;
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        speakWithBrowserFallback(clean);
      }
    },
    [speechTtsEnabled, murfVoiceId, stopSpeaking, speakWithBrowserFallback]
  );

  const replayLastVoice = useCallback(async () => {
    if (!lastSpokenText) return;
    if (!audioElRef.current && typeof Audio !== 'undefined') {
      audioElRef.current = new Audio();
    }
    await speakText(lastSpokenText, { force: true });
  }, [lastSpokenText, speakText]);

  const testMurfVoice = useCallback(async () => {
    if (!audioElRef.current && typeof Audio !== 'undefined') {
      audioElRef.current = new Audio();
    }
    setError(null);
    const sample = `FieldPilot voice check active on Murf Falcon using ${murfVoiceId}. Microphone and audio output are ready.`;
    await speakText(sample, { force: true, voiceId: murfVoiceId });
  }, [murfVoiceId, speakText]);

  const startSession = useCallback(
    async (ticketNumber?: string | null) => {
      const targetTicket = ticketNumber !== undefined ? ticketNumber : lockedTicketNumber;
      if (targetTicket !== undefined) setLockedTicketNumber(targetTicket);
      setError(null);
      setAutoplayBlocked(false);
      setInterimTranscript('');
      setLastSpokenText(null);
      setLastVisionAnalysis(null);
      try {
        const created = await fetchJson<VoiceSession>('/api/sessions/start', {
          method: 'POST',
          body: JSON.stringify({
            user_id: currentUser?.id ?? 'usr-tech-arjun',
            ticket_number: targetTicket,
          }),
        });
        const initialMsgs: CopilotMessage[] = [
          {
            id: `msg-init-${Date.now()}`,
            role: 'assistant',
            text: targetTicket
              ? `FieldPilot Copilot active on ${targetTicket}. Speak into the microphone, tap a prompt, or snap an equipment photo.`
              : 'FieldPilot Copilot active. Name a ticket number or describe the field issue.',
            timestamp: new Date().toISOString(),
          },
        ];
        messagesRef.current = initialMsgs;
        setSession(created);
        setMessages(initialMsgs);
        setToolTimeline([]);
        setRagSources([]);
        await refreshStore();
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to start voice session');
        return null;
      }
    },
    [currentUser, lockedTicketNumber, refreshStore]
  );

  const endSession = useCallback(async () => {
    stopSpeaking();
    stopMeterAndStream();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
    const endingSession = session;
    messagesRef.current = [];
    setSession(null);
    setMessages([]);
    setToolTimeline([]);
    setRagSources([]);
    setLastVisionAnalysis(null);
    setLastSpokenText(null);
    setAutoplayBlocked(false);
    setInterimTranscript('');
    setError(null);
    if (!endingSession) return;
    try {
      await fetchJson(`/api/sessions/${endingSession.id}/end`, {
        method: 'POST',
        body: JSON.stringify({ summary: `Session on ${lockedTicketNumber ?? 'General'} completed.` }),
      });
      await refreshStore();
      pushToast({ title: 'Copilot session saved', body: 'Ready for a new conversation.', tone: 'success' });
    } catch {
      // session already reset cleanly on client
    }
  }, [session, lockedTicketNumber, refreshStore, stopSpeaking, stopMeterAndStream, pushToast]);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;
      if (!audioElRef.current && typeof Audio !== 'undefined') {
        audioElRef.current = new Audio();
      }
      stopSpeaking();
      setError(null);

      const pendingConf: ConfirmationRequest | undefined = store?.confirmations.find(
        (c) =>
          c.status === 'pending' &&
          (!session || c.session_id === session.id || !c.session_id) &&
          new Date(c.expires_at).getTime() > Date.now()
      );

      if (pendingConf) {
        const lower = text.toLowerCase();
        if (/^(yes|confirm|go ahead|approved?|proceed|do it)\b/.test(lower)) {
          const userConfMsg: CopilotMessage = {
            id: `u-${Date.now()}`,
            role: 'user',
            text,
            timestamp: new Date().toISOString(),
          };
          messagesRef.current = [...messagesRef.current, userConfMsg];
          setMessages(messagesRef.current);
          const res = (await resolveConfirmation(pendingConf.id, 'confirmed', 'voice')) as {
            confirmation: ConfirmationRequest;
          };
          const replyText = `Confirmed and executed: ${res.confirmation.summary_text}`;
          const replyConfMsg: CopilotMessage = {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: replyText,
            timestamp: new Date().toISOString(),
          };
          messagesRef.current = [...messagesRef.current, replyConfMsg];
          setMessages(messagesRef.current);
          void speakText(replyText);
          return;
        }
        if (/^(no|cancel|abort|stop|reject)\b/.test(lower)) {
          const userCancelMsg: CopilotMessage = {
            id: `u-${Date.now()}`,
            role: 'user',
            text,
            timestamp: new Date().toISOString(),
          };
          messagesRef.current = [...messagesRef.current, userCancelMsg];
          setMessages(messagesRef.current);
          await resolveConfirmation(pendingConf.id, 'cancelled', 'voice');
          const replyText = 'Cancelled pending action. No inventory or state changes were made.';
          const replyCancelMsg: CopilotMessage = {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: replyText,
            timestamp: new Date().toISOString(),
          };
          messagesRef.current = [...messagesRef.current, replyCancelMsg];
          setMessages(messagesRef.current);
          void speakText(replyText);
          return;
        }
      }

      let activeSess = session;
      if (!activeSess) {
        activeSess = await startSession(lockedTicketNumber);
      }

      const userMsg: CopilotMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text,
        timestamp: new Date().toISOString(),
      };
      const nextHistory = [...messagesRef.current, userMsg];
      messagesRef.current = nextHistory;
      setMessages(nextHistory);
      setIsThinking(true);

      try {
        const data = await fetchJson<{
          reply: string;
          ragSources?: RagSourceCard[];
          toolExecutions?: ToolExecution[];
        }>('/api/copilot/chat', {
          method: 'POST',
          body: JSON.stringify({
            session_id: activeSess?.id,
            actor_id: currentUser?.id ?? 'usr-tech-arjun',
            ticket_number: lockedTicketNumber,
            page_context: route,
            messages: nextHistory
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .slice(-12)
              .map((m) => ({ role: m.role, text: m.text })),
          }),
        });

        const aiMsg: CopilotMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.reply,
          timestamp: new Date().toISOString(),
        };
        const updatedMsgs = [...messagesRef.current, aiMsg];
        messagesRef.current = updatedMsgs;
        setMessages(updatedMsgs);

        if (Array.isArray(data.ragSources) && data.ragSources.length > 0) {
          setRagSources(data.ragSources);
        }
        if (Array.isArray(data.toolExecutions) && data.toolExecutions.length > 0) {
          setToolTimeline((prev) => [...data.toolExecutions!, ...prev]);
        }
        await refreshStore();
        void speakText(data.reply);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Copilot error';
        setError(msg);
      } finally {
        setIsThinking(false);
      }
    },
    [
      session,
      lockedTicketNumber,
      messages,
      currentUser,
      route,
      store,
      startSession,
      stopSpeaking,
      speakText,
      refreshStore,
      resolveConfirmation,
    ]
  );

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const stopRecordingAndTranscribe = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      stopMeterAndStream();
      setIsListening(false);
    }
  }, [stopMeterAndStream]);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      stopRecordingAndTranscribe();
      return;
    }

    if (!micSupported) {
      setError('Microphone hardware access is unavailable in this browser. Type your command below.');
      return;
    }

    stopSpeaking();
    setError(null);
    setInterimTranscript('');

    // Unlock HTMLAudioElement during direct user gesture so TTS plays reliably in browsers/iframes
    if (!audioElRef.current) {
      audioElRef.current = new Audio();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Live microphone input level meter
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 90) * 100)));
          meterRafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const chosenMime = preferredTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);

      audioChunksRef.current = [];
      let browserTranscriptFallback = '';

      recorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) audioChunksRef.current.push(evt.data);
      };

      recorder.onstop = async () => {
        stopMeterAndStream();
        setIsListening(false);
        const blobType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        audioChunksRef.current = [];

        if (audioBlob.size < 400) {
          if (browserTranscriptFallback.trim()) {
            setInterimTranscript('');
            await sendMessageRef.current(browserTranscriptFallback.trim());
          } else {
            setInterimTranscript('');
            setError('Recording was too short. Tap the mic, speak clearly, then tap again to send.');
          }
          return;
        }

        setIsTranscribing(true);
        try {
          const base64 = await blobToBase64(audioBlob);
          const cleanMime = blobType.split(';')[0] || 'audio/webm';
          const result = await fetchJson<{ transcript: string }>('/api/voice/transcribe', {
            method: 'POST',
            body: JSON.stringify({ audio_base64: base64, mime_type: cleanMime }),
          });
          const spoken = (result.transcript || browserTranscriptFallback).trim();
          setInterimTranscript('');
          if (spoken) {
            await sendMessageRef.current(spoken);
          } else {
            setError('No speech detected. Hold or speak clearly into the mic, or type below.');
          }
        } catch (err) {
          if (browserTranscriptFallback.trim()) {
            setInterimTranscript('');
            await sendMessageRef.current(browserTranscriptFallback.trim());
          } else {
            setError(err instanceof Error ? err.message : 'Audio transcription failed');
          }
        } finally {
          setIsTranscribing(false);
        }
      };

      // Optional parallel Web Speech live interim captions when browser allows it
      if (speechRecognitionSupported) {
        const Ctor =
          (window as unknown as { SpeechRecognition?: new () => BrowserSpeechRecognition }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeechRecognition }).webkitSpeechRecognition;
        if (Ctor) {
          try {
            const rec = new Ctor();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = 'en-IN';
            rec.onresult = (event) => {
              let text = '';
              for (let i = 0; i < event.results.length; i++) {
                text += event.results[i][0].transcript + ' ';
              }
              browserTranscriptFallback = text.trim();
              setInterimTranscript(browserTranscriptFallback);
            };
            rec.onerror = () => {
              // MediaRecorder + Gemini transcription handles speech even if Web Speech is blocked
            };
            rec.start();
            recognitionRef.current = rec;
          } catch {
            // ignore Web Speech failure in restricted iframes
          }
        }
      }

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsListening(true);
    } catch (err) {
      stopMeterAndStream();
      setIsListening(false);
      const name = (err as { name?: string })?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Microphone permission blocked by browser or preview frame. Allow mic access in browser site settings, or type your command below.');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to start microphone capture.');
      }
    }
  }, [
    isListening,
    micSupported,
    speechRecognitionSupported,
    stopRecordingAndTranscribe,
    stopSpeaking,
    stopMeterAndStream,
  ]);

  const analyzeImage = useCallback(
    async (imageBase64: string, mimeType: string, prompt?: string) => {
      if (!audioElRef.current && typeof Audio !== 'undefined') {
        audioElRef.current = new Audio();
      }
      setError(null);
      setIsThinking(true);
      let activeSess = session;
      if (!activeSess) {
        activeSess = await startSession(lockedTicketNumber);
      }
      try {
        const data = await fetchJson<{ analysis: string }>('/api/copilot/vision', {
          method: 'POST',
          body: JSON.stringify({
            image_base64: imageBase64,
            mime_type: mimeType,
            prompt,
            ticket_number: lockedTicketNumber,
            session_id: activeSess?.id,
            actor_id: currentUser?.id,
          }),
        });
        setLastVisionAnalysis(data.analysis);
        const visMsg: CopilotMessage = {
          id: `vis-${Date.now()}`,
          role: 'assistant',
          text: data.analysis,
          timestamp: new Date().toISOString(),
        };
        messagesRef.current = [...messagesRef.current, visMsg];
        setMessages(messagesRef.current);
        await refreshStore();
        void speakText(data.analysis);
        return data.analysis;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Vision inspection error');
        return null;
      } finally {
        setIsThinking(false);
      }
    },
    [session, lockedTicketNumber, currentUser, startSession, refreshStore, speakText]
  );

  const launchForTicket = useCallback(
    async (ticketNumber: string) => {
      setLockedTicketNumber(ticketNumber);
      await startSession(ticketNumber);
      navigate('/voice');
    },
    [startSession, navigate]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key.toLowerCase() === 'v' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (route === '/voice') {
          e.preventDefault();
          void toggleListening();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route, toggleListening]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopMeterAndStream();
    };
  }, [stopSpeaking, stopMeterAndStream]);

  return (
    <VoiceContext.Provider
      value={{
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
        speechSupported,
        ragSources,
        toolTimeline,
        lastVisionAnalysis,
        error,
        startSession,
        endSession,
        toggleListening,
        stopSpeaking,
        replayLastVoice,
        testMurfVoice,
        sendMessage,
        analyzeImage,
        launchForTicket,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used inside VoiceProvider');
  return ctx;
}
