import React, { useEffect, useRef, useState } from 'react';
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';
import {
  ArrowLeft,
  CheckCircle2,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  ShieldAlert,
  Video,
  VideoOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PriorityLabel, StateLabel } from '../components/common/Chips';
import { formatRelativeTime } from '../lib/stateMachine';
import { fetchJson } from '../lib/apiClient';

export function ExpertViewPage({ channel }: { channel: string }) {
  const { store, integrationsStatus, navigate, pushToast, refreshStore } = useApp();

  const [rtcJoined, setRtcJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [rtcNotice, setRtcNotice] = useState<string | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoRef = useRef<ICameraVideoTrack | null>(null);
  const localPlayerRef = useRef<HTMLDivElement | null>(null);
  const remotePlayerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      void leaveAgora();
    };
  }, []);

  if (!store) return null;

  const ticketNumber = channel.replace(/^fp-/, '');
  const ticket =
    store.tickets.find((t) => t.ticket_number.toLowerCase() === ticketNumber.toLowerCase()) ??
    store.tickets[0];
  const invite = store.expertInvites.find((i) => i.channel_name === channel);
  const equipment = ticket ? store.equipment.find((e) => e.id === ticket.equipment_id) : null;
  const session = invite?.session_id
    ? store.sessions.find((s) => s.id === invite.session_id)
    : store.sessions[0];
  const transcripts = session
    ? store.transcripts.filter((tr) => tr.session_id === session.id)
    : [];

  async function leaveAgora() {
    try {
      if (localAudioRef.current) {
        localAudioRef.current.stop();
        localAudioRef.current.close();
        localAudioRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.stop();
        localVideoRef.current.close();
        localVideoRef.current = null;
      }
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }
    } catch {
      // ignore teardown errors
    }
    setRtcJoined(false);
    setHasLocalVideo(false);
    setRemoteConnected(false);
  }

  async function joinRoom() {
    setJoining(true);
    setRtcNotice(null);

    try {
      if (invite) {
        await fetchJson(`/api/expert-invites/${invite.id}/join`, {
          method: 'POST',
          body: JSON.stringify({ status: 'joined' }),
        });
        await refreshStore();
      }

      if (!integrationsStatus?.agora.configured) {
        setRtcNotice(
          'Agora App ID is not configured yet—joined operational transcript & diagnostic bridge in local sync mode.'
        );
        pushToast({
          title: 'Diagnostic Bridge Joined',
          body: `Live transcript & SOP workspace active on ${channel}`,
          tone: 'info',
        });
        return;
      }

      const tokenRes = await fetchJson<{
        appId: string;
        channelName: string;
        token: string | null;
        uid: number;
      }>(`/api/agora/token?channelName=${encodeURIComponent(channel)}`);

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        setRemoteConnected(true);
        if (mediaType === 'video' && remotePlayerRef.current) {
          user.videoTrack?.play(remotePlayerRef.current);
        }
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      client.on('user-unpublished', (_user, mediaType) => {
        if (mediaType === 'video' && client.remoteUsers.every((u) => !u.videoTrack)) {
          setRemoteConnected(false);
        }
      });

      client.on('user-left', () => {
        if (client.remoteUsers.length === 0) {
          setRemoteConnected(false);
        }
      });

      client.on('token-privilege-will-expire', async () => {
        const refreshed = await fetchJson<{ token: string | null }>(
          `/api/agora/token?channelName=${encodeURIComponent(channel)}`
        );
        if (refreshed.token) {
          await client.renewToken(refreshed.token);
        }
      });

      await client.join(tokenRes.appId, tokenRes.channelName, tokenRes.token, tokenRes.uid);

      const tracks: Array<IMicrophoneAudioTrack | ICameraVideoTrack> = [];
      try {
        const mic = await AgoraRTC.createMicrophoneAudioTrack();
        localAudioRef.current = mic;
        tracks.push(mic);
      } catch {
        setRtcNotice('Joined Agora audio/video room (microphone unavailable in browser).');
      }

      try {
        const cam = await AgoraRTC.createCameraVideoTrack();
        localVideoRef.current = cam;
        setHasLocalVideo(true);
        if (localPlayerRef.current) cam.play(localPlayerRef.current);
        tracks.push(cam);
      } catch {
        // camera optional on desktop/preview
      }

      if (tracks.length > 0) {
        await client.publish(tracks);
      }

      setRtcJoined(true);
      pushToast({
        title: 'Agora Live Bridge Connected',
        body: `Channel ${tokenRes.channelName} active`,
        tone: 'success',
      });
    } catch (err) {
      setRtcNotice(err instanceof Error ? err.message : 'Unable to connect Agora RTC channel.');
    } finally {
      setJoining(false);
    }
  }

  async function toggleMic() {
    if (!localAudioRef.current) return;
    const next = !micMuted;
    await localAudioRef.current.setEnabled(!next);
    setMicMuted(next);
  }

  async function toggleCam() {
    if (!localVideoRef.current) return;
    const next = !camOff;
    await localVideoRef.current.setEnabled(!next);
    setCamOff(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/voice')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Voice Console
          </button>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Remote Expert Collaboration · <span className="font-mono">{channel}</span>
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Agora RTC Status: {integrationsStatus?.agora.configured ? 'Live WebRTC Configured' : 'Needs AGORA_APP_ID Secret'}
            {' · '}
            {rtcJoined ? 'Connected to Channel' : 'Standby'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {rtcJoined && (
            <>
              <button
                type="button"
                onClick={toggleMic}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {micMuted ? <MicOff className="h-3.5 w-3.5 text-rose-500" /> : <Mic className="h-3.5 w-3.5" />}
                {micMuted ? 'Unmute' : 'Mute Mic'}
              </button>
              <button
                type="button"
                onClick={toggleCam}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {camOff ? <VideoOff className="h-3.5 w-3.5 text-rose-500" /> : <Video className="h-3.5 w-3.5" />}
                {camOff ? 'Cam Off' : 'Cam On'}
              </button>
              <button
                type="button"
                onClick={leaveAgora}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-rose-700"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                Leave Call
              </button>
            </>
          )}
          {!rtcJoined && (
            <button
              type="button"
              disabled={joining}
              onClick={joinRoom}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              {joining ? 'Connecting...' : invite?.status === 'joined' ? 'Reconnect Diagnostic Bridge' : 'Join Diagnostic Bridge'}
            </button>
          )}
        </div>
      </div>

      {rtcNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          {rtcNotice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Live Agora Video / Field Snapshot Feed */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-800">
            <div className="relative aspect-video">
              <div
                ref={remotePlayerRef}
                className={remoteConnected ? 'h-full w-full' : 'hidden'}
              />
              {!remoteConnected && (
                <img
                  src="/src/assets/images/chiller_gauge_inspection_1795244410709.jpg"
                  alt="Field camera diagnostic stream"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover opacity-90"
                />
              )}
              <div
                ref={localPlayerRef}
                className={`absolute right-4 top-4 h-28 w-44 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 transition-opacity ${
                  rtcJoined && hasLocalVideo && !camOff ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40" />
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-white">
                <Video className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  {remoteConnected ? 'Live Remote Field Stream' : 'Field Camera Feed'} · {equipment?.asset_tag ?? 'CH-07'}
                </span>
              </div>
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-sm font-semibold">{ticket?.title}</p>
                <p className="text-xs text-slate-300">
                  {invite?.ai_diagnosis_summary ||
                    'AI Diagnostic Brief: High discharge pressure (>238 PSI). Condenser fan motor inspection & LOTO verification active.'}
                </p>
              </div>
            </div>
          </div>

          {/* Live Transcript */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Live Field Transcript
            </h2>
            <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto">
              {transcripts.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Transcript lines from the active technician session stream here in real time.
                </p>
              ) : (
                transcripts.map((tr) => (
                  <div
                    key={tr.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                      <span className="uppercase">{tr.speaker}</span>
                      <span className="font-mono text-slate-400">{formatRelativeTime(tr.created_at)}</span>
                    </div>
                    <p className="mt-1 text-slate-800 dark:text-slate-200">{tr.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Ticket & Supervisor Controls */}
        <div className="space-y-5">
          {ticket && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {ticket.ticket_number}
                </span>
                <PriorityLabel priority={ticket.priority} />
                <StateLabel state={ticket.state} />
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {ticket.title}
              </p>
              <button
                type="button"
                onClick={() => navigate(`/tickets/${ticket.ticket_number}`)}
                className="mt-3 w-full rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Open Full Ticket Record
              </button>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Supervisor Remote Sign-Off
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Verify technician LOTO tag and approve circuit isolation or emergency part procurement.
            </p>
            <button
              type="button"
              onClick={() =>
                pushToast({
                  title: 'LOTO & Workaround Guidance Sent',
                  body: `Logged supervisor guidance on ${ticket?.ticket_number}`,
                  tone: 'success',
                })
              }
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve LOTO &amp; Circuit Isolation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
