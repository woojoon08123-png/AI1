import { useEffect, useRef, useState } from 'react';
import { BookOpenCheck, Coffee, Loader2, SendHorizontal, Volume2, Square } from 'lucide-react';
import type { ReflectionRecord, SessionStatus, TranscriptEntry } from '../types/companion';

interface TranscriptPanelProps {
  transcript: TranscriptEntry[];
  status: SessionStatus;
  isQuietSending: boolean;
  onSendMessage: (text: string) => void;
  onCreateReflection: () => Promise<void>;
  isReflecting: boolean;
  latestReflection: ReflectionRecord | null;
  onViewJournal: () => void;
  onSpeakText?: (entryId: string, text: string) => void;
  speakingEntryId?: string | null;
  loadingSpeechEntryId?: string | null;
}

const STARTER_PROMPTS = [
  '오늘 유독 마음이 지쳐서 아무것도 하기 싫어요',
  '가까운 사람에게 말하기 애매한 서운함이 남았어요',
  '머릿속이 복잡해서 그냥 내 이야기만 들어줬으면 좋겠어요',
];

function formatClockTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function TranscriptPanel({
  transcript,
  status,
  isQuietSending,
  onSendMessage,
  onCreateReflection,
  isReflecting,
  latestReflection,
  onViewJournal,
  onSpeakText,
  speakingEntryId,
  loadingSpeechEntryId,
}: TranscriptPanelProps) {
  const [draftText, setDraftText] = useState('');
  const [imgFailed, setImgFailed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [transcript, latestReflection]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftText.trim() || isQuietSending) return;
    onSendMessage(draftText);
    setDraftText('');
  };

  const canReflect = transcript.filter((t) => t.text.trim().length > 0).length >= 2;

  return (
    <section
      aria-label="대화 기록과 마음 입력"
      className="flex h-full min-h-[520px] flex-col rounded-2xl border border-[#E6E1D8] bg-white dark:border-[#2B2926] dark:bg-[#1C1B19]"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-4 border-b border-[#EFECE6] px-6 py-4 dark:border-[#2B2926]">
        <div>
          <h2 className="font-display text-base font-bold text-[#1F1E1C] dark:text-[#F2EFE9]">
            함께 나눈 이야기
          </h2>
          <p className="mt-0.5 text-xs text-[#6E6A63] dark:text-[#A39E93]">
            목소리나 글로 마음을 꺼내 놓으면 온기가 조용히 귀 기울입니다
          </p>
        </div>

        {canReflect && (
          <button
            type="button"
            onClick={() => void onCreateReflection()}
            disabled={isReflecting}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#D8D2C7] bg-[#FAF8F5] px-3.5 py-1.5 text-xs font-medium text-[#2F5D50] transition-colors hover:bg-[#EFECE6] disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5D50] dark:border-[#34312D] dark:bg-[#24221F] dark:text-[#7AC2AC] dark:hover:bg-[#2C2A27]"
          >
            {isReflecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <BookOpenCheck className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{isReflecting ? '정리하는 중' : '마음 정리하기'}</span>
          </button>
        )}
      </div>

      {/* Scrollable Transcript Feed */}
      <div
        ref={scrollContainerRef}
        className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5"
      >
        {transcript.length === 0 ? (
          <div className="flex h-full flex-col justify-between gap-6">
            <div className="overflow-hidden rounded-xl border border-[#EFECE6] bg-[#FAF8F5] dark:border-[#2B2926] dark:bg-[#161513]">
              {!imgFailed ? (
                <div className="aspect-[16/9] w-full overflow-hidden">
                  <img
                    src="/src/assets/images/sanctuary_morning_light_1795570387128.jpg"
                    alt="햇살이 비치는 조용한 나무 테이블 위 따뜻한 차 한 잔"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#F3EFE9] to-[#E6DFD3] px-6 text-center dark:from-[#22201D] dark:to-[#191815]">
                  <Coffee className="h-6 w-6 text-[#2F5D50] dark:text-[#7AC2AC]" aria-hidden="true" />
                  <p className="font-display text-sm text-[#4A4742] dark:text-[#C9C3B8]">
                    따뜻한 차 한 잔처럼 편안한 쉼표
                  </p>
                </div>
              )}
              <div className="px-5 py-4">
                <p className="font-display text-sm font-bold text-[#1F1E1C] dark:text-[#F2EFE9]">
                  어떤 이야기도 서두르지 않아도 돼요
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#6E6A63] dark:text-[#A39E93]">
                  왼쪽의 마이크 버튼을 눌러 바로 목소리로 들려주시거나, 말하기 조용한 곳이라면 아래 문장을 눌러 글로 대화를 시작해도 온기가 목소리로 답해드려요.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[#6E6A63] dark:text-[#A39E93]">
                이렇게 말을 꺼내볼 수 있어요
              </p>
              <div className="flex flex-col gap-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onSendMessage(prompt)}
                    disabled={isQuietSending}
                    className="min-h-[42px] w-full rounded-xl border border-[#EAE5DC] bg-[#FAF8F5] px-4 py-2.5 text-left text-[13px] leading-snug text-[#2E2C29] transition-colors hover:border-[#2F5D50]/40 hover:bg-[#F3EFE9] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5D50] dark:border-[#2F2D29] dark:bg-[#171614] dark:text-[#E2DDD3] dark:hover:border-[#5A9E8A]/40 dark:hover:bg-[#22201D]"
                  >
                    “{prompt}”
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {transcript.map((entry) => {
              const isUser = entry.role === 'user';
              const isThisSpeaking = speakingEntryId === entry.id;
              const isThisLoading = loadingSpeechEntryId === entry.id;

              return (
                <article
                  key={entry.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-[#6E6A63] dark:text-[#A39E93]">
                    <span className="font-medium text-[#3F3C37] dark:text-[#D5D0C6]">
                      {isUser ? '나' : '온기'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">
                      {formatClockTime(entry.timestamp)}
                    </span>
                    {entry.isStreaming && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>듣고 적는 중</span>
                      </>
                    )}
                    {!isUser && !entry.isStreaming && onSpeakText && entry.text.trim() && (
                      <>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => onSpeakText(entry.id, entry.text)}
                          disabled={isThisLoading}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#2F5D50] hover:underline disabled:opacity-50 dark:text-[#7AC2AC]"
                        >
                          {isThisLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          ) : isThisSpeaking ? (
                            <Square className="h-3 w-3 text-[#B4652A]" aria-hidden="true" />
                          ) : (
                            <Volume2 className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span>
                            {isThisLoading
                              ? '음성 준비'
                              : isThisSpeaking
                                ? '멈추기'
                                : '목소리로 듣기'}
                          </span>
                        </button>
                      </>
                    )}
                  </div>

                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                      isUser
                        ? 'bg-[#2F5D50] text-white dark:bg-[#3A6F60] dark:text-[#F8F6F2]'
                        : 'border border-[#EFECE6] bg-[#FAF8F5] text-[#1F1E1C] dark:border-[#2E2C28] dark:bg-[#24221F] dark:text-[#F2EFE9]'
                    }`}
                  >
                    {entry.text}
                  </div>
                </article>
              );
            })}

            {(status === 'thinking' || isQuietSending) && (
              <div className="flex flex-col items-start">
                <div className="mb-1 text-xs font-medium text-[#6E6A63] dark:text-[#A39E93]">
                  온기
                </div>
                <div className="rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6E6A63] dark:border-[#2E2C28] dark:bg-[#24221F] dark:text-[#A39E93]">
                  마음을 헤아리며 답을 준비하고 있어요...
                </div>
              </div>
            )}

            {latestReflection && (
              <div className="mt-4 rounded-2xl border border-[#D4DFDA] bg-[#F4F8F6] p-5 dark:border-[#2D453D] dark:bg-[#192420]">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#2F5D50] dark:text-[#86CBB6]">
                  <span className="font-semibold">오늘의 마음 정리</span>
                  <span>{latestReflection.keyThemes.join(' · ')}</span>
                </div>
                <h3 className="font-display mt-2 text-base font-bold text-[#1F1E1C] dark:text-[#F2EFE9]">
                  {latestReflection.emotionLabel}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#353330] dark:text-[#DDD8CE]">
                  {latestReflection.empathyMessage}
                </p>
                <div className="mt-3 border-t border-[#DCE6E1] pt-3 text-xs leading-relaxed text-[#4E5A55] dark:border-[#2A3F38] dark:text-[#B2C2BC]">
                  <span className="font-semibold">작은 돌봄 제안: </span>
                  {latestReflection.gentleAction}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={onViewJournal}
                    className="text-xs font-semibold text-[#2F5D50] underline underline-offset-4 hover:text-[#23473D] dark:text-[#86CBB6] dark:hover:text-[#A3D9C8]"
                  >
                    감정 기록 보관함에서 보기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Text Fallback Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[#EFECE6] px-4 py-3.5 sm:px-6 dark:border-[#2B2926]"
      >
        <div className="flex items-center gap-2.5">
          <label htmlFor="quiet-message-input" className="sr-only">
            텍스트로 마음 전하기
          </label>
          <input
            id="quiet-message-input"
            type="text"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder={
              status === 'listening' || status === 'speaking'
                ? '대화 중에 글로도 덧붙일 수 있어요...'
                : '말하기 어려운 곳이라면 글로 편하게 적어주세요...'
            }
            className="min-h-[44px] flex-1 rounded-xl border border-[#DFD9CE] bg-[#FAF8F5] px-4 py-2 text-sm text-[#1F1E1C] placeholder:text-[#8A857C] focus:border-[#2F5D50] focus:outline-none dark:border-[#34312D] dark:bg-[#151412] dark:text-[#F2EFE9] dark:placeholder:text-[#78736A] dark:focus:border-[#5A9E8A]"
          />
          <button
            type="submit"
            disabled={!draftText.trim() || isQuietSending}
            aria-label="메시지 보내기"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#244A3F] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5D50] dark:bg-[#4B8A78] dark:hover:bg-[#5A9E8A]"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}
