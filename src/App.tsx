import { useCallback, useEffect, useState } from 'react';
import {
  AudioLines,
  Loader2,
  Mic,
  MicOff,
  Moon,
  Pause,
  PhoneOff,
  Sun,
  X,
} from 'lucide-react';
import { AcousticBreathCanvas } from './components/AcousticBreathCanvas';
import { JournalView } from './components/JournalView';
import { SettingsView } from './components/SettingsView';
import { TopBar } from './components/TopBar';
import { TranscriptPanel } from './components/TranscriptPanel';
import { useLiveEmpathySession } from './hooks/useLiveEmpathySession';
import {
  PERSONA_OPTIONS,
  VOICE_OPTIONS,
  type NavTab,
  type PersonaId,
  type ReflectionRecord,
  type VoiceName,
} from './types/companion';

const STORAGE_KEYS = {
  voice: 'ongi_voice_name',
  persona: 'ongi_persona_id',
  userName: 'ongi_user_name',
  theme: 'ongi_theme_dark',
  journal: 'ongi_journal_records',
};

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('talk');

  const [voiceName, setVoiceName] = useState<VoiceName>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.voice);
    return VOICE_OPTIONS.some((v) => v.id === saved) ? (saved as VoiceName) : 'Kore';
  });

  const [personaId, setPersonaId] = useState<PersonaId>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.persona);
    return PERSONA_OPTIONS.some((p) => p.id === saved) ? (saved as PersonaId) : 'friend';
  });

  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.userName) ?? '';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved !== null) return saved === 'true';
    return false;
  });

  const [journalRecords, setJournalRecords] = useState<ReflectionRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.journal);
      return raw ? (JSON.parse(raw) as ReflectionRecord[]) : [];
    } catch {
      return [];
    }
  });

  const [isReflecting, setIsReflecting] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [latestReflection, setLatestReflection] = useState<ReflectionRecord | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem(STORAGE_KEYS.theme, String(isDark));
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.voice, voiceName);
  }, [voiceName]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.persona, personaId);
  }, [personaId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.userName, userName);
  }, [userName]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify(journalRecords));
    } catch {
      // ignore quota errors
    }
  }, [journalRecords]);

  const {
    status,
    isMuted,
    errorMessage,
    transcript,
    elapsedSeconds,
    isQuietSending,
    speakingEntryId,
    loadingSpeechEntryId,
    inputAnalyserRef,
    outputAnalyserRef,
    startSession,
    stopSession,
    toggleMute,
    interruptAssistant,
    sendMessage,
    speakEntryText,
    resetConversation,
    clearError,
  } = useLiveEmpathySession({
    voiceName,
    personaId,
    userName,
  });

  const isLiveConnected =
    status === 'connecting' ||
    status === 'listening' ||
    status === 'thinking' ||
    status === 'speaking';

  const handleResetConversation = useCallback(() => {
    resetConversation();
    setLatestReflection(null);
    setReflectionError(null);
    setActiveTab('talk');
  }, [resetConversation]);

  const handleCreateReflection = useCallback(async () => {
    setIsReflecting(true);
    setReflectionError(null);
    try {
      const res = await fetch('/api/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript.map((t) => ({ role: t.role, text: t.text })),
          persona: personaId,
        }),
      });

      const data = (await res.json()) as {
        emotionLabel?: string;
        empathyMessage?: string;
        gentleAction?: string;
        keyThemes?: string[];
        error?: string;
      };

      if (!res.ok || !data.emotionLabel || !data.empathyMessage) {
        throw new Error(data.error || '마음 정리 카드를 만들지 못했습니다.');
      }

      const newRecord: ReflectionRecord = {
        id: `ref-${Date.now()}`,
        createdAt: Date.now(),
        personaId,
        voiceName,
        emotionLabel: data.emotionLabel,
        empathyMessage: data.empathyMessage,
        gentleAction: data.gentleAction || '잠시 눈을 감고 깊게 숨을 내쉬어 보세요.',
        keyThemes: Array.isArray(data.keyThemes) ? data.keyThemes : ['오늘의 마음'],
        turnCount: transcript.length,
        durationSeconds: elapsedSeconds,
        transcriptSnippet: transcript.slice(-10),
      };

      setLatestReflection(newRecord);
      setJournalRecords((prev) => [newRecord, ...prev]);
    } catch (err) {
      setReflectionError(
        err instanceof Error ? err.message : '마음 정리 중 오류가 발생했습니다.'
      );
    } finally {
      setIsReflecting(false);
    }
  }, [elapsedSeconds, personaId, transcript, voiceName]);

  const handleDeleteRecord = useCallback((id: string) => {
    setJournalRecords((prev) => prev.filter((item) => item.id !== id));
    setLatestReflection((prev) => (prev?.id === id ? null : prev));
  }, []);

  const currentVoiceLabel =
    VOICE_OPTIONS.find((v) => v.id === voiceName)?.label.split(' ')[0] ?? '서연';
  const currentPersonaLabel =
    PERSONA_OPTIONS.find((p) => p.id === personaId)?.label ?? '다정한 친구';

  const getStatusHeading = () => {
    if (status === 'connecting') return '조용히 귀 기울일 준비를 하고 있어요';
    if (status === 'listening') {
      return isMuted
        ? '마이크를 잠시 꺼두었어요'
        : '편안하게 말씀해 주세요. 듣고 있어요.';
    }
    if (status === 'thinking') return '이야기의 온도를 마음에 담고 있어요';
    if (status === 'speaking') return '온기가 진심을 담아 답하고 있어요';
    if (status === 'error') return '잠시 연결이 고르지 않았어요';
    return userName.trim()
      ? `${userName.trim()}님, 오늘 마음은 어떤가요?`
      : '오늘 마음은 어떤가요?';
  };

  const getStatusSubtext = () => {
    if (status === 'listening' && !isMuted) {
      return '말을 끊고 싶거나 생각이 바뀌면 언제든 편하게 바로 말씀하셔도 돼요';
    }
    if (status === 'speaking') {
      return '듣고 계시는 중에도 말을 건네시면 자연스럽게 멈추고 경청합니다';
    }
    return `${currentVoiceLabel} 목소리 · ${currentPersonaLabel}`;
  };

  const activeError = errorMessage || reflectionError;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F1E1C] transition-colors duration-200 dark:bg-[#141312] dark:text-[#F2EFE9]">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onResetConversation={handleResetConversation}
        journalCount={journalRecords.length}
        hasActiveTranscript={transcript.length > 0 || isLiveConnected}
      />

      <main className="mx-auto max-w-7xl px-5 pb-24 pt-6 sm:px-8 md:pb-10">
        {activeTab === 'talk' && (
          <div className="grid items-stretch gap-6 lg:grid-cols-12">
            {/* Left Column: Live Voice Sanctuary */}
            <section
              aria-label="실시간 공감 음성 공간"
              className="flex flex-col justify-between rounded-2xl border border-[#E6E1D8] bg-white p-6 sm:p-8 lg:col-span-7 dark:border-[#2B2926] dark:bg-[#1C1B19]"
            >
              {/* Workspace Toolbar: Persona Segmented Tabs + Theme Toggle + Elapsed Timer */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  role="group"
                  aria-label="공감 대화 스타일 선택"
                  className="flex flex-wrap items-center gap-1 rounded-xl border border-[#EAE5DC] bg-[#FAF8F5] p-1 dark:border-[#2B2926] dark:bg-[#151412]"
                >
                  {PERSONA_OPTIONS.map((p) => {
                    const active = personaId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={isLiveConnected}
                        title={
                          isLiveConnected
                            ? '대화를 마친 뒤 스타일을 바꿀 수 있어요'
                            : p.shortDesc
                        }
                        onClick={() => setPersonaId(p.id)}
                        className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:cursor-not-allowed ${
                          active
                            ? 'bg-white text-[#1F1E1C] shadow-xs dark:bg-[#272522] dark:text-[#F2EFE9]'
                            : 'text-[#6E6A63] hover:text-[#1F1E1C] disabled:opacity-60 dark:text-[#A39E93] dark:hover:text-[#F2EFE9]'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  {elapsedSeconds > 0 && (
                    <span className="font-mono-tabular text-xs font-medium text-[#6E6A63] dark:text-[#A39E93]">
                      {formatElapsed(elapsedSeconds)}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsDark((prev) => !prev)}
                    aria-label={isDark ? '따뜻한 낮 모드로 전환' : '고요한 밤 모드로 전환'}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#EAE5DC] bg-[#FAF8F5] text-[#4A4742] transition-colors hover:bg-[#EFECE6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5D50] dark:border-[#2B2926] dark:bg-[#151412] dark:text-[#C9C3B8] dark:hover:bg-[#24221F]"
                  >
                    {isDark ? (
                      <Sun className="h-4 w-4 text-[#D68C54]" aria-hidden="true" />
                    ) : (
                      <Moon className="h-4 w-4 text-[#2F5D50]" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {/* Center Dominant Anchor: Human Headline + Acoustic Breath Canvas */}
              <div className="my-6 flex flex-1 flex-col items-center justify-center text-center">
                <h1 className="font-display max-w-xl text-2xl font-bold leading-snug text-[#1F1E1C] text-balance sm:text-3xl dark:text-[#F2EFE9]">
                  {getStatusHeading()}
                </h1>
                <p className="mt-2 text-[13px] text-[#6E6A63] dark:text-[#A39E93]">
                  {getStatusSubtext()}
                </p>

                <div className="mt-4 h-60 w-full max-w-lg sm:h-72">
                  <AcousticBreathCanvas
                    status={status}
                    isMuted={isMuted}
                    isDark={isDark}
                    inputAnalyserRef={inputAnalyserRef}
                    outputAnalyserRef={outputAnalyserRef}
                  />
                </div>
              </div>

              {/* Honest Error Surface */}
              {activeError && (
                <div
                  role="alert"
                  className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-[#E8C5BE] bg-[#FDF5F3] px-4 py-3 text-left text-xs leading-relaxed text-[#9C3526] dark:border-[#5C2D26] dark:bg-[#2A1714] dark:text-[#F0A498]"
                >
                  <span>{activeError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      setReflectionError(null);
                    }}
                    aria-label="안내 닫기"
                    className="shrink-0 rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* Primary Voice Controls */}
              <div className="flex flex-wrap items-center justify-center gap-3 border-t border-[#EFECE6] pt-5 dark:border-[#2B2926]">
                {!isLiveConnected ? (
                  <button
                    type="button"
                    onClick={() => void startSession()}
                    className="inline-flex min-h-[50px] items-center justify-center gap-2.5 rounded-xl bg-[#2F5D50] px-7 py-3 text-sm font-semibold text-white transition-transform duration-150 hover:bg-[#244A3F] active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5D50] dark:bg-[#4B8A78] dark:hover:bg-[#5A9E8A]"
                  >
                    <Mic className="h-4 w-4" aria-hidden="true" />
                    <span>목소리로 대화 시작하기</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={toggleMute}
                      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5D50] ${
                        isMuted
                          ? 'border-[#B4652A] bg-[#FDF6F0] text-[#9E521C] dark:border-[#D68C54] dark:bg-[#2B1F17] dark:text-[#EBB083]'
                          : 'border-[#DFD9CE] bg-[#FAF8F5] text-[#1F1E1C] hover:bg-[#EFECE6] dark:border-[#34312D] dark:bg-[#24221F] dark:text-[#F2EFE9] dark:hover:bg-[#2E2B27]'
                      }`}
                    >
                      {isMuted ? (
                        <>
                          <MicOff className="h-4 w-4" aria-hidden="true" />
                          <span>마이크 켜기</span>
                        </>
                      ) : (
                        <>
                          <AudioLines className="h-4 w-4 text-[#2F5D50] dark:text-[#7AC2AC]" aria-hidden="true" />
                          <span>마이크 끄기</span>
                        </>
                      )}
                    </button>

                    {status === 'speaking' && (
                      <button
                        type="button"
                        onClick={interruptAssistant}
                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DFD9CE] bg-[#FAF8F5] px-5 py-2.5 text-sm font-medium text-[#1F1E1C] transition-colors hover:bg-[#EFECE6] whitespace-nowrap shrink-0 dark:border-[#34312D] dark:bg-[#24221F] dark:text-[#F2EFE9] dark:hover:bg-[#2E2B27]"
                      >
                        <Pause className="h-4 w-4 text-[#B4652A]" aria-hidden="true" />
                        <span>목소리 멈추기</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={stopSession}
                      disabled={status === 'connecting'}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#9C3526] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#822B1E] disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9C3526] dark:bg-[#B44332] dark:hover:bg-[#C6513F]"
                    >
                      {status === 'connecting' ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <PhoneOff className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span>대화 마치기</span>
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* Right Column: Live Empathy Transcript & Reflection */}
            <div className="lg:col-span-5">
              <TranscriptPanel
                transcript={transcript}
                status={status}
                isQuietSending={isQuietSending}
                onSendMessage={(text) => void sendMessage(text, true)}
                onCreateReflection={handleCreateReflection}
                isReflecting={isReflecting}
                latestReflection={latestReflection}
                onViewJournal={() => setActiveTab('journal')}
                onSpeakText={(entryId, text) => void speakEntryText(entryId, text)}
                speakingEntryId={speakingEntryId}
                loadingSpeechEntryId={loadingSpeechEntryId}
              />
            </div>
          </div>
        )}

        {activeTab === 'journal' && (
          <JournalView
            records={journalRecords}
            onDeleteRecord={handleDeleteRecord}
            onStartTalking={() => setActiveTab('talk')}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            voiceName={voiceName}
            onChangeVoice={setVoiceName}
            personaId={personaId}
            onChangePersona={setPersonaId}
            userName={userName}
            onChangeUserName={setUserName}
            isDark={isDark}
            onToggleTheme={() => setIsDark((prev) => !prev)}
          />
        )}
      </main>
    </div>
  );
}
