import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Moon, Play, Square, Sun, Volume2 } from 'lucide-react';
import {
  PERSONA_OPTIONS,
  VOICE_OPTIONS,
  type PersonaId,
  type VoiceName,
} from '../types/companion';

interface SettingsViewProps {
  voiceName: VoiceName;
  onChangeVoice: (voice: VoiceName) => void;
  personaId: PersonaId;
  onChangePersona: (persona: PersonaId) => void;
  userName: string;
  onChangeUserName: (name: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function SettingsView({
  voiceName,
  onChangeVoice,
  personaId,
  onChangePersona,
  userName,
  onChangeUserName,
  isDark,
  onToggleTheme,
}: SettingsViewProps) {
  const [previewingVoice, setPreviewingVoice] = useState<VoiceName | null>(null);
  const [playingVoice, setPlayingVoice] = useState<VoiceName | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number | null>(null);

  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPlayingVoice(null);
  };

  const handlePreviewVoice = async (option: (typeof VOICE_OPTIONS)[number]) => {
    setPreviewError(null);
    if (playingVoice === option.id) {
      stopPreviewAudio();
      return;
    }

    stopPreviewAudio();
    setPreviewingVoice(option.id);

    try {
      const res = await fetch('/api/tts-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceName: option.id,
          text: option.sampleLine,
          styleHint: option.styleHint,
        }),
      });
      const data = (await res.json()) as { audioBase64?: string; error?: string };
      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || '목소리 미리 듣기를 생성하지 못했습니다.');
      }

      const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
      previewAudioRef.current = audio;
      setPlayingVoice(option.id);
      audio.onended = () => {
        setPlayingVoice(null);
        previewAudioRef.current = null;
      };
      audio.onerror = () => {
        setPlayingVoice(null);
        setPreviewError('오디오 재생에 실패했습니다.');
      };
      await audio.play();
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : '미리 듣기 재생 중 오류가 발생했습니다.'
      );
      setPlayingVoice(null);
    } finally {
      setPreviewingVoice(null);
    }
  };

  const stopMicTest = () => {
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) {
        track.stop();
      }
      micStreamRef.current = null;
    }
    if (micCtxRef.current && micCtxRef.current.state !== 'closed') {
      void micCtxRef.current.close();
      micCtxRef.current = null;
    }
    setMicTesting(false);
    setMicLevel(0);
  };

  const toggleMicTest = async () => {
    if (micTesting) {
      stopMicTest();
      return;
    }
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      micCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      setMicTesting(true);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / (data.length * 255);
        setMicLevel(Math.min(100, Math.round(avg * 260)));
        micRafRef.current = requestAnimationFrame(tick);
      };
      micRafRef.current = requestAnimationFrame(tick);
    } catch {
      setMicError('마이크 접근 권한을 허용해 주세요.');
      stopMicTest();
    }
  };

  useEffect(() => {
    return () => {
      stopPreviewAudio();
      stopMicTest();
    };
  }, []);

  return (
    <section className="mx-auto max-w-5xl space-y-8 py-4">
      <div className="grid items-stretch gap-6 lg:grid-cols-12">
        {/* Left: Companion Visual & Personalization */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#E6E1D8] bg-white p-6 lg:col-span-5 dark:border-[#2B2926] dark:bg-[#1C1B19]">
          <div>
            <div className="overflow-hidden rounded-xl border border-[#EFECE6] bg-[#FAF8F5] dark:border-[#2B2926] dark:bg-[#161513]">
              {!imgFailed ? (
                <img
                  src="/src/assets/images/acoustic_stone_vessel_1795570388141.jpg"
                  alt="따뜻한 빛을 머금은 도자기 오브제와 작은 황동 공명 그릇"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-[#F3EFE9] dark:bg-[#24221F]">
                  <Volume2 className="h-10 w-10 text-[#2F5D50] dark:text-[#7AC2AC]" aria-hidden="true" />
                </div>
              )}
            </div>

            <div className="mt-5">
              <label
                htmlFor="user-name-input"
                className="block text-xs font-semibold text-[#3F3C37] dark:text-[#D5D0C6]"
              >
                온기가 불러줄 이름 (선택)
              </label>
              <input
                id="user-name-input"
                type="text"
                maxLength={20}
                value={userName}
                onChange={(e) => onChangeUserName(e.target.value)}
                placeholder="예: 민수, 지영..."
                className="mt-2 min-h-[44px] w-full rounded-xl border border-[#DFD9CE] bg-[#FAF8F5] px-4 py-2 text-sm text-[#1F1E1C] placeholder:text-[#8A857C] focus:border-[#2F5D50] focus:outline-none dark:border-[#34312D] dark:bg-[#151412] dark:text-[#F2EFE9] dark:focus:border-[#5A9E8A]"
              />
              <p className="mt-1.5 text-xs text-[#6E6A63] dark:text-[#A39E93]">
                입력해 두시면 대화 중 자연스러운 순간에 다정하게 이름을 불러드려요.
              </p>
            </div>
          </div>

          {/* Appearance & Mic Test */}
          <div className="mt-6 space-y-4 border-t border-[#EFECE6] pt-5 dark:border-[#2B2926]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[#1F1E1C] dark:text-[#F2EFE9]">
                  화면 분위기
                </div>
                <div className="text-xs text-[#6E6A63] dark:text-[#A39E93]">
                  {isDark ? '밤에 편안한 고요한 어둠 모드' : '낮에 편안한 따뜻한 종이 모드'}
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#DFD9CE] bg-[#FAF8F5] px-4 py-2 text-xs font-medium text-[#1F1E1C] transition-colors hover:bg-[#EFECE6] whitespace-nowrap shrink-0 dark:border-[#34312D] dark:bg-[#24221F] dark:text-[#F2EFE9] dark:hover:bg-[#2E2B27]"
              >
                {isDark ? (
                  <>
                    <Sun className="h-4 w-4 text-[#D68C54]" aria-hidden="true" />
                    <span>따뜻한 낮</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4 text-[#2F5D50]" aria-hidden="true" />
                    <span>고요한 밤</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-[#1F1E1C] dark:text-[#F2EFE9]">
                    마이크 입력 점검
                  </div>
                  <div className="text-xs text-[#6E6A63] dark:text-[#A39E93]">
                    대화를 시작하기 전에 내 목소리가 잘 들어오는지 확인해요
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleMicTest()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DFD9CE] bg-[#FAF8F5] px-3.5 py-2 text-xs font-medium text-[#1F1E1C] transition-colors hover:bg-[#EFECE6] whitespace-nowrap shrink-0 dark:border-[#34312D] dark:bg-[#24221F] dark:text-[#F2EFE9] dark:hover:bg-[#2E2B27]"
                >
                  <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{micTesting ? '점검 중지' : '마이크 테스트'}</span>
                </button>
              </div>
              {micTesting && (
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#EFECE6] dark:bg-[#2B2926]">
                  <div
                    className="h-full bg-[#2F5D50] transition-[width] duration-75 dark:bg-[#5A9E8A]"
                    style={{ width: `${Math.max(4, micLevel)}%` }}
                  />
                </div>
              )}
              {micError && (
                <p className="mt-2 text-xs text-[#B44332] dark:text-[#E27D6D]">
                  {micError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Voice Timbre & Persona Selection */}
        <div className="space-y-6 lg:col-span-7">
          {/* Voice Choice */}
          <div className="rounded-2xl border border-[#E6E1D8] bg-white p-6 dark:border-[#2B2926] dark:bg-[#1C1B19]">
            <h2 className="font-display text-lg font-bold text-[#1F1E1C] dark:text-[#F2EFE9]">
              온기의 목소리 고르기
            </h2>
            <p className="mt-1 text-sm text-[#6E6A63] dark:text-[#A39E93]">
              지금 내 마음에 가장 편안하게 와닿는 목소리 톤을 들어보고 선택해 보세요
            </p>

            {previewError && (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-[#E8C5BE] bg-[#FDF5F3] px-4 py-2.5 text-xs text-[#9C3526] dark:border-[#5C2D26] dark:bg-[#2A1714] dark:text-[#F0A498]"
              >
                {previewError}
              </div>
            )}

            <div className="mt-4 divide-y divide-[#EFECE6] dark:divide-[#2B2926]">
              {VOICE_OPTIONS.map((option) => {
                const isSelected = voiceName === option.id;
                const isLoadingPreview = previewingVoice === option.id;
                const isPlaying = playingVoice === option.id;

                return (
                  <div
                    key={option.id}
                    className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <button
                      type="button"
                      onClick={() => onChangeVoice(option.id)}
                      className="flex flex-1 items-start gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F5D50]"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-[#2F5D50] bg-[#2F5D50] dark:border-[#5A9E8A] dark:bg-[#5A9E8A]'
                            : 'border-[#C8C1B4] dark:border-[#4A4742]'
                        }`}
                      >
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-[#1F1E1C] dark:text-[#F2EFE9]">
                          {option.label}
                        </div>
                        <div className="mt-0.5 text-xs leading-relaxed text-[#6E6A63] dark:text-[#A39E93]">
                          {option.toneSummary}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handlePreviewVoice(option)}
                      disabled={isLoadingPreview}
                      className="inline-flex min-h-[38px] items-center justify-center gap-1.5 self-start rounded-xl border border-[#DFD9CE] bg-[#FAF8F5] px-3.5 py-1.5 text-xs font-medium text-[#1F1E1C] transition-colors hover:bg-[#EFECE6] disabled:opacity-50 whitespace-nowrap shrink-0 sm:self-center dark:border-[#34312D] dark:bg-[#24221F] dark:text-[#F2EFE9] dark:hover:bg-[#2E2B27]"
                    >
                      {isLoadingPreview ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : isPlaying ? (
                        <Square className="h-3.5 w-3.5 text-[#B4652A]" aria-hidden="true" />
                      ) : (
                        <Play className="h-3.5 w-3.5 text-[#2F5D50] dark:text-[#7AC2AC]" aria-hidden="true" />
                      )}
                      <span>
                        {isLoadingPreview
                          ? '생성 중'
                          : isPlaying
                            ? '멈추기'
                            : '미리 듣기'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Empathy Style Choice */}
          <div className="rounded-2xl border border-[#E6E1D8] bg-white p-6 dark:border-[#2B2926] dark:bg-[#1C1B19]">
            <h2 className="font-display text-lg font-bold text-[#1F1E1C] dark:text-[#F2EFE9]">
              공감 대화 스타일
            </h2>
            <p className="mt-1 text-sm text-[#6E6A63] dark:text-[#A39E93]">
              대화 중 온기가 당신에게 다가가는 태도와 말투를 정합니다
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PERSONA_OPTIONS.map((persona) => {
                const isSelected = personaId === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => onChangePersona(persona.id)}
                    className={`rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5D50] ${
                      isSelected
                        ? 'border-[#2F5D50] bg-[#F4F8F6] dark:border-[#5A9E8A] dark:bg-[#1A2622]'
                        : 'border-[#EAE5DC] bg-[#FAF8F5] hover:border-[#C8C1B4] dark:border-[#2F2D29] dark:bg-[#161513] dark:hover:border-[#4A4742]'
                    }`}
                  >
                    <div className="text-sm font-semibold text-[#1F1E1C] dark:text-[#F2EFE9]">
                      {persona.label}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#6E6A63] dark:text-[#A39E93]">
                      {persona.shortDesc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
