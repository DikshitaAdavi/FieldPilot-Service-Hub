import React, { useRef, useState } from 'react';
import { Camera, Upload, Sparkles, VideoOff } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';

const SAMPLE_GAUGE_URL = '/src/assets/images/chiller_gauge_inspection_1795244410709.jpg';

export function CameraSnapshotPanel() {
  const { analyzeImage, isThinking, lastVisionAnalysis } = useVoice();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('Inspect pressure gauge, fan housing, and identify fault or safety risk.');
  const [camError, setCamError] = useState<string | null>(null);

  async function startCamera() {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreamActive(true);
    } catch {
      setCamError('Camera permission unavailable in browser. Upload a photo or run the CH-07 sample inspection.');
    }
  }

  function stopCamera() {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  }

  async function captureAndAnalyze() {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPreviewSrc(dataUrl);
    stopCamera();
    const base64 = dataUrl.split(',')[1];
    await analyzeImage(base64, 'image/jpeg', promptText);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = String(reader.result);
      setPreviewSrc(result);
      const base64 = result.split(',')[1];
      await analyzeImage(base64, file.type || 'image/jpeg', promptText);
    };
    reader.readAsDataURL(file);
  }

  async function inspectSampleGauge() {
    setCamError(null);
    setPreviewSrc(SAMPLE_GAUGE_URL);
    const res = await fetch(SAMPLE_GAUGE_URL);
    const blob = await res.blob();
    const reader = new FileReader();
    reader.onload = async () => {
      const result = String(reader.result);
      const base64 = result.split(',')[1];
      await analyzeImage(base64, blob.type || 'image/jpeg', promptText);
    };
    reader.readAsDataURL(blob);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Visual Equipment Inspection
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Capture camera snapshot or upload nameplate/gauge photo for Gemini analysis
          </p>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
        {streamActive ? (
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        ) : previewSrc ? (
          <img
            src={previewSrc}
            alt="Equipment inspection snapshot"
            referrerPolicy="no-referrer"
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center p-4 text-center">
            <Camera className="h-7 w-7 text-slate-400 dark:text-slate-600" />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              No snapshot captured yet
            </p>
          </div>
        )}
      </div>

      <input
        type="text"
        value={promptText}
        onChange={(e) => setPromptText(e.target.value)}
        placeholder="Inspection focus..."
        className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />

      {camError && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{camError}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {streamActive ? (
          <>
            <button
              type="button"
              disabled={isThinking}
              onClick={captureAndAnalyze}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Camera className="h-3.5 w-3.5" />
              Capture &amp; Inspect
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
            >
              <VideoOff className="h-3.5 w-3.5" />
              Stop
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={isThinking}
              onClick={startCamera}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Camera className="h-3.5 w-3.5" />
              Camera
            </button>
            <button
              type="button"
              disabled={isThinking}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </button>
            <button
              type="button"
              disabled={isThinking}
              onClick={inspectSampleGauge}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Inspect CH-07 Gauge
            </button>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {lastVisionAnalysis && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          {lastVisionAnalysis}
        </div>
      )}
    </div>
  );
}
