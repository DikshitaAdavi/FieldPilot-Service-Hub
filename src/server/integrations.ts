import agoraToken from 'agora-token';

const { RtcRole, RtcTokenBuilder } = agoraToken;

export interface IntegrationsStatus {
  gemini: { configured: boolean; model: string; sttModel: string; ttsModel: string };
  agora: { configured: boolean; appId: string | null; hasCertificate: boolean };
  murf: { configured: boolean; model: string; voiceId: string; supportedVoices: string[] };
  storage: { mode: 'local'; file: string };
}

export const SUPPORTED_MURF_VOICES = ['Gordon', 'Matthew', 'Natalie', 'Miles'] as const;

function isRealEnv(val: string | undefined, placeholder?: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (placeholder && trimmed === placeholder) return false;
  return true;
}

export function isAgoraConfigured(): boolean {
  return isRealEnv(process.env.AGORA_APP_ID);
}

export function generateAgoraRtcToken(params: {
  channelName: string;
  uid?: number;
  expireSeconds?: number;
}): { appId: string; channelName: string; token: string | null; uid: number; expiresIn: number } {
  const appId = process.env.AGORA_APP_ID?.trim();
  const appCertificate = process.env.AGORA_APP_CERTIFICATE?.trim();
  if (!appId) {
    throw new Error('AGORA_APP_ID is not configured in environment secrets.');
  }
  const channelName = params.channelName.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64) || 'fp-default';
  const uid = typeof params.uid === 'number' && Number.isFinite(params.uid) ? params.uid : 0;
  const expireSeconds = params.expireSeconds ?? 7200;

  if (!appCertificate) {
    return { appId, channelName, token: null, uid, expiresIn: expireSeconds };
  }

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expireSeconds,
    expireSeconds
  );

  return { appId, channelName, token, uid, expiresIn: expireSeconds };
}

export function isMurfConfigured(): boolean {
  return isRealEnv(process.env.MURF_API_KEY);
}

export async function synthesizeSpeechWithMurf(
  text: string,
  voiceId?: string
): Promise<{ buffer: Buffer; mimeType: string; voiceId: string }> {
  const apiKey = process.env.MURF_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('MURF_API_KEY is not configured in environment secrets.');
  }

  const requested = voiceId?.trim();
  const defaultVoice = process.env.MURF_VOICE_ID?.trim() || 'Gordon';
  const chosenVoice =
    requested && (SUPPORTED_MURF_VOICES as readonly string[]).includes(requested)
      ? requested
      : defaultVoice;

  const res = await fetch('https://global.api.murf.ai/v1/speech/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      text: text.replace(/[*_`#]/g, '').slice(0, 2800),
      voiceId: chosenVoice,
      model: 'falcon-2.1',
      locale: 'en-US',
      format: 'MP3',
      sampleRate: 24000,
      channelType: 'MONO',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Murf Falcon TTS error (${res.status}): ${errText.slice(0, 240)}`);
  }

  const arrBuf = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrBuf),
    mimeType: res.headers.get('content-type') || 'audio/mpeg',
    voiceId: chosenVoice,
  };
}

export function getIntegrationsStatus(): IntegrationsStatus {
  const geminiConfigured = isRealEnv(process.env.GEMINI_API_KEY, 'MY_GEMINI_API_KEY');
  const agoraConfigured = isAgoraConfigured();
  const murfConfigured = isMurfConfigured();

  return {
    gemini: {
      configured: geminiConfigured,
      model: 'gemini-3.1-flash-lite',
      sttModel: 'gemini-3.5-transcribe',
      ttsModel: 'gemini-3.8-flash-lite-tts',
    },
    agora: {
      configured: agoraConfigured,
      appId: agoraConfigured ? process.env.AGORA_APP_ID!.trim() : null,
      hasCertificate: isRealEnv(process.env.AGORA_APP_CERTIFICATE),
    },
    murf: {
      configured: murfConfigured,
      model: 'falcon-2.1',
      voiceId: process.env.MURF_VOICE_ID?.trim() || 'Gordon',
      supportedVoices: [...SUPPORTED_MURF_VOICES],
    },
    storage: {
      mode: 'local',
      file: 'data/fieldpilot-store.json',
    },
  };
}
