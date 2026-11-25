import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PersonaId,
  SessionStatus,
  TranscriptEntry,
  VoiceName,
} from '../types/companion';
import {
  base64ToInt16Array,
  downsampleBuffer,
  float32ToInt16Base64,
  int16ToAudioBuffer,
} from '../utils/audio';

interface UseLiveEmpathyOptions {
  voiceName: VoiceName;
  personaId: PersonaId;
  userName: string;
}

export function useLiveEmpathySession({
  voiceName,
  personaId,
  userName,
}: UseLiveEmpathyOptions) {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isQuietSending, setIsQuietSending] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const quietAudioRef = useRef<HTMLAudioElement | null>(null);
  const nextStartTimeRef = useRef(0);
  const isMutedRef = useRef(false);
  const statusRef = useRef<SessionStatus>('idle');
  const speakingTimeoutRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const updateStatus = useCallback((next: SessionStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const stopAllPlayback = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    if (quietAudioRef.current) {
      quietAudioRef.current.pause();
      quietAudioRef.current = null;
    }
    if (speakingTimeoutRef.current) {
      window.clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
  }, []);

  const ensureOutputAudioContext = useCallback(() => {
    if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
      const ctx = new AudioContext({ sampleRate: 24000 });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      analyser.connect(ctx.destination);
      outputAudioCtxRef.current = ctx;
      outputAnalyserRef.current = analyser;
    }
    if (outputAudioCtxRef.current.state === 'suspended') {
      void outputAudioCtxRef.current.resume();
    }
    return {
      ctx: outputAudioCtxRef.current,
      analyser: outputAnalyserRef.current!,
    };
  }, []);

  const playPcmChunk = useCallback(
    (base64Data: string) => {
      const { ctx, analyser } = ensureOutputAudioContext();
      const pcm16 = base64ToInt16Array(base64Data);
      if (pcm16.length === 0) return;

      const audioBuffer = int16ToAudioBuffer(ctx, pcm16, 24000);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);

      const now = ctx.currentTime;
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now + 0.02;
      }

      const startAt = nextStartTimeRef.current;
      source.start(startAt);
      nextStartTimeRef.current = startAt + audioBuffer.duration;
      activeSourcesRef.current.add(source);

      updateStatus('speaking');

      source.onended = () => {
        activeSourcesRef.current.delete(source);
        if (activeSourcesRef.current.size === 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          if (speakingTimeoutRef.current) {
            window.clearTimeout(speakingTimeoutRef.current);
          }
          speakingTimeoutRef.current = window.setTimeout(() => {
            if (activeSourcesRef.current.size === 0 && statusRef.current === 'speaking') {
              updateStatus('listening');
            }
          }, 220);
        }
      };
    },
    [ensureOutputAudioContext, updateStatus]
  );

  const appendStreamingTranscript = useCallback(
    (role: 'user' | 'assistant', chunk: string) => {
      if (!chunk) return;
      setTranscript((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === role && last.isStreaming) {
          next[next.length - 1] = {
            ...last,
            text: last.text + chunk,
          };
          return next;
        }
        // Finalize any opposite streaming turn first
        if (last && last.isStreaming) {
          next[next.length - 1] = { ...last, isStreaming: false };
        }
        next.push({
          id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role,
          text: chunk,
          timestamp: Date.now(),
          isStreaming: true,
          source: 'voice',
        });
        return next;
      });
    },
    []
  );

  const finalizeStreamingTurns = useCallback(() => {
    setTranscript((prev) =>
      prev.map((item) => (item.isStreaming ? { ...item, isStreaming: false } : item))
    );
  }, []);

  const cleanupLiveResources = useCallback(() => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    stopAllPlayback();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      void inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    inputAnalyserRef.current = null;

    if (wsRef.current) {
      try {
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close();
        }
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    finalizeStreamingTurns();
  }, [finalizeStreamingTurns, stopAllPlayback]);

  const stopSession = useCallback(() => {
    cleanupLiveResources();
    updateStatus('idle');
  }, [cleanupLiveResources, updateStatus]);

  const startSession = useCallback(async () => {
    if (statusRef.current === 'connecting' || statusRef.current === 'listening' || statusRef.current === 'speaking') {
      return;
    }

    setErrorMessage(null);
    updateStatus('connecting');
    setIsMuted(false);
    isMutedRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      ensureOutputAudioContext();

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }
      inputAudioCtxRef.current = inputCtx;

      const source = inputCtx.createMediaStreamSource(stream);
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      inputAnalyserRef.current = analyser;

      const processor = inputCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      // Zero-gain sink prevents mic feedback while keeping onaudioprocess active
      const silentSink = inputCtx.createGain();
      silentSink.gain.value = 0;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(silentSink);
      silentSink.connect(inputCtx.destination);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams({
        voice: voiceName,
        persona: personaId,
        userName: userName.trim(),
      });
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live?${params.toString()}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type?: string;
            data?: string;
            text?: string;
            message?: string;
          };

          if (msg.type === 'ready') {
            updateStatus('listening');
            if (!timerIntervalRef.current) {
              timerIntervalRef.current = window.setInterval(() => {
                setElapsedSeconds((prev) => prev + 1);
              }, 1000);
            }
          } else if (msg.type === 'audio' && msg.data) {
            playPcmChunk(msg.data);
          } else if (msg.type === 'inputTranscript' && msg.text) {
            appendStreamingTranscript('user', msg.text);
          } else if (msg.type === 'outputTranscript' && msg.text) {
            appendStreamingTranscript('assistant', msg.text);
          } else if (msg.type === 'interrupted') {
            stopAllPlayback();
            finalizeStreamingTurns();
            updateStatus('listening');
          } else if (msg.type === 'turnComplete') {
            finalizeStreamingTurns();
            if (activeSourcesRef.current.size === 0 && wsRef.current?.readyState === WebSocket.OPEN) {
              updateStatus('listening');
            }
          } else if (msg.type === 'error') {
            setErrorMessage(msg.message || '음성 연결 중 오류가 발생했습니다.');
            cleanupLiveResources();
            updateStatus('error');
          } else if (msg.type === 'closed') {
            if (statusRef.current !== 'idle' && statusRef.current !== 'error') {
              cleanupLiveResources();
              updateStatus('idle');
            }
          }
        } catch (err) {
          console.error('Failed to parse live message:', err);
        }
      };

      ws.onerror = () => {
        setErrorMessage('실시간 음성 서버와 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.');
        cleanupLiveResources();
        updateStatus('error');
      };

      ws.onclose = () => {
        if (statusRef.current !== 'idle' && statusRef.current !== 'error') {
          cleanupLiveResources();
          updateStatus('idle');
        }
      };

      processor.onaudioprocess = (e) => {
        if (
          isMutedRef.current ||
          !wsRef.current ||
          wsRef.current.readyState !== WebSocket.OPEN
        ) {
          return;
        }
        const rawFloat = e.inputBuffer.getChannelData(0);
        const resampled = downsampleBuffer(rawFloat, inputCtx.sampleRate, 16000);
        const base64Audio = float32ToInt16Base64(resampled);
        wsRef.current.send(JSON.stringify({ type: 'audio', data: base64Audio }));
      };
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? '마이크 사용 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용하거나 아래 글 입력으로 대화를 이어가실 수 있어요.'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? '연결된 마이크를 찾을 수 없습니다. 아래 글 입력으로 온기와 대화하실 수 있어요.'
            : '마이크를 시작하지 못했습니다. 기기 연결을 확인해 주세요.';
      setErrorMessage(msg);
      cleanupLiveResources();
      updateStatus('error');
    }
  }, [
    appendStreamingTranscript,
    cleanupLiveResources,
    ensureOutputAudioContext,
    finalizeStreamingTurns,
    personaId,
    playPcmChunk,
    stopAllPlayback,
    updateStatus,
    userName,
    voiceName,
  ]);

  const sendMessage = useCallback(
    async (rawText: string, speakResponseInQuietMode = true) => {
      const text = rawText.trim();
      if (!text) return;
      setErrorMessage(null);

      // If Live WebSocket is connected, send directly into the live session
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        finalizeStreamingTurns();
        setTranscript((prev) => [
          ...prev,
          {
            id: `user-${Date.now()}`,
            role: 'user',
            text,
            timestamp: Date.now(),
            isStreaming: false,
            source: 'text',
          },
        ]);
        updateStatus('thinking');
        wsRef.current.send(JSON.stringify({ type: 'text', text }));
        return;
      }

      // Otherwise use Quiet Mode REST endpoint (/api/text-empathy)
      const userEntry: TranscriptEntry = {
        id: `user-${Date.now()}`,
        role: 'user',
        text,
        timestamp: Date.now(),
        isStreaming: false,
        source: 'text',
      };

      const historySnapshot = transcript.map((t) => ({
        role: t.role,
        text: t.text,
      }));

      setTranscript((prev) => [...prev, userEntry]);
      setIsQuietSending(true);
      updateStatus('thinking');

      try {
        const res = await fetch('/api/text-empathy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: historySnapshot,
            persona: personaId,
            voiceName,
            userName,
            withAudio: speakResponseInQuietMode,
          }),
        });

        const data = (await res.json()) as {
          replyText?: string;
          audioBase64?: string | null;
          error?: string;
        };

        if (!res.ok || !data.replyText) {
          throw new Error(data.error || '응답을 받아오지 못했습니다.');
        }

        setTranscript((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text: data.replyText!,
            timestamp: Date.now(),
            isStreaming: false,
            source: 'text',
          },
        ]);

        if (data.audioBase64 && speakResponseInQuietMode) {
          stopAllPlayback();
          const { ctx, analyser } = ensureOutputAudioContext();
          const binary = atob(data.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const decodedBuffer = await ctx.decodeAudioData(bytes.buffer);
          const src = ctx.createBufferSource();
          src.buffer = decodedBuffer;
          src.connect(analyser);
          activeSourcesRef.current.add(src);
          updateStatus('speaking');
          src.onended = () => {
            activeSourcesRef.current.delete(src);
            if (activeSourcesRef.current.size === 0 && statusRef.current === 'speaking') {
              updateStatus('idle');
            }
          };
          src.start();
        } else {
          updateStatus('idle');
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : '대화 처리 중 오류가 발생했습니다.'
        );
        updateStatus('error');
      } finally {
        setIsQuietSending(false);
      }
    },
    [
      ensureOutputAudioContext,
      finalizeStreamingTurns,
      personaId,
      stopAllPlayback,
      transcript,
      updateStatus,
      userName,
      voiceName,
    ]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const interruptAssistant = useCallback(() => {
    stopAllPlayback();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      updateStatus('listening');
    } else {
      updateStatus('idle');
    }
  }, [stopAllPlayback, updateStatus]);

  const resetConversation = useCallback(() => {
    cleanupLiveResources();
    setTranscript([]);
    setElapsedSeconds(0);
    setErrorMessage(null);
    updateStatus('idle');
  }, [cleanupLiveResources, updateStatus]);

  useEffect(() => {
    return () => {
      cleanupLiveResources();
      if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
        void outputAudioCtxRef.current.close();
      }
    };
  }, [cleanupLiveResources]);

  return {
    status,
    isMuted,
    errorMessage,
    transcript,
    elapsedSeconds,
    isQuietSending,
    inputAnalyserRef,
    outputAnalyserRef,
    startSession,
    stopSession,
    toggleMute,
    interruptAssistant,
    sendMessage,
    resetConversation,
    clearError: () => setErrorMessage(null),
  };
}
