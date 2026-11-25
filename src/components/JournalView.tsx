import { useMemo, useState } from 'react';
import { BookHeart, ChevronDown, ChevronUp, Search, Trash2 } from 'lucide-react';
import {
  PERSONA_OPTIONS,
  VOICE_OPTIONS,
  type PersonaId,
  type ReflectionRecord,
} from '../types/companion';

interface JournalViewProps {
  records: ReflectionRecord[];
  onDeleteRecord: (id: string) => void;
  onStartTalking: () => void;
}

function formatKoreanDate(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${year}. ${month}. ${day} · ${hh}:${mm}`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.max(1, sec)}초 대화`;
  const mins = Math.round(sec / 60);
  return `${mins}분 대화`;
}

export function JournalView({
  records,
  onDeleteRecord,
  onStartTalking,
}: JournalViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [personaFilter, setPersonaFilter] = useState<'all' | PersonaId>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((rec) => {
      if (personaFilter !== 'all' && rec.personaId !== personaFilter) {
        return false;
      }
      if (!q) return true;
      return (
        rec.emotionLabel.toLowerCase().includes(q) ||
        rec.empathyMessage.toLowerCase().includes(q) ||
        rec.gentleAction.toLowerCase().includes(q) ||
        rec.keyThemes.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [personaFilter, records, searchQuery]);

  if (records.length === 0) {
    return (
      <section className="mx-auto max-w-3xl py-8">
        <div className="overflow-hidden rounded-2xl border border-[#E6E1D8] bg-white dark:border-[#2B2926] dark:bg-[#1C1B19]">
          <div className="grid items-stretch md:grid-cols-12">
            <div className="md:col-span-5">
              {!imgFailed ? (
                <img
                  src="/src/assets/images/sanctuary_morning_light_1795570387128.jpg"
                  alt="따뜻한 차 한 잔이 놓인 조용한 나무 테이블"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="h-56 w-full object-cover md:h-full"
                />
              ) : (
                <div className="flex h-56 w-full items-center justify-center bg-[#F3EFE9] md:h-full dark:bg-[#24221F]">
                  <BookHeart className="h-8 w-8 text-[#2F5D50] dark:text-[#7AC2AC]" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center p-7 md:col-span-7 md:p-8">
              <h1 className="font-display text-2xl font-bold text-[#1F1E1C] text-balance dark:text-[#F2EFE9]">
                아직 저장된 마음 기록이 없어요
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-[#6E6A63] dark:text-[#A39E93]">
                온기와 목소리로 대화를 나눈 뒤 ‘마음 정리하기’를 누르면, 그날의 감정과 따뜻한 위로의 문장이 이곳에 차곡차곡 쌓입니다. 모든 기록은 이 기기에만 안전하게 보관됩니다.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={onStartTalking}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#2F5D50] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#244A3F] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5D50] dark:bg-[#4B8A78] dark:hover:bg-[#5A9E8A]"
                >
                  첫 대화 시작하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6 py-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1F1E1C] dark:text-[#F2EFE9]">
            나의 감정 기록
          </h1>
          <p className="mt-1 text-sm text-[#6E6A63] dark:text-[#A39E93]">
            그동안 온기와 나누었던 대화의 온도와 스스로를 다독였던 순간들입니다
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A857C]"
            aria-hidden="true"
          />
          <label htmlFor="journal-search" className="sr-only">
            감정 기록 검색
          </label>
          <input
            id="journal-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="감정이나 키워드로 검색..."
            className="min-h-[42px] w-full rounded-xl border border-[#DFD9CE] bg-white pl-10 pr-4 text-sm text-[#1F1E1C] placeholder:text-[#8A857C] focus:border-[#2F5D50] focus:outline-none dark:border-[#34312D] dark:bg-[#1C1B19] dark:text-[#F2EFE9] dark:focus:border-[#5A9E8A]"
          />
        </div>
      </div>

      {/* Interactive Filter Segmented Controls */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#E6E1D8] bg-[#F3EFE9] p-1 dark:border-[#2B2926] dark:bg-[#191816]">
        <button
          type="button"
          onClick={() => setPersonaFilter('all')}
          className={`min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            personaFilter === 'all'
              ? 'bg-white text-[#1F1E1C] shadow-xs dark:bg-[#272522] dark:text-[#F2EFE9]'
              : 'text-[#6E6A63] hover:text-[#1F1E1C] dark:text-[#A39E93] dark:hover:text-[#F2EFE9]'
          }`}
        >
          전체 ({records.length})
        </button>
        {PERSONA_OPTIONS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPersonaFilter(p.id)}
            className={`min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              personaFilter === p.id
                ? 'bg-white text-[#1F1E1C] shadow-xs dark:bg-[#272522] dark:text-[#F2EFE9]'
                : 'text-[#6E6A63] hover:text-[#1F1E1C] dark:text-[#A39E93] dark:hover:text-[#F2EFE9]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {filteredRecords.length === 0 ? (
        <div className="rounded-2xl border border-[#E6E1D8] bg-white p-10 text-center dark:border-[#2B2926] dark:bg-[#1C1B19]">
          <p className="text-sm text-[#6E6A63] dark:text-[#A39E93]">
            조건에 맞는 감정 기록을 찾지 못했어요.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredRecords.map((record) => {
            const personaLabel =
              PERSONA_OPTIONS.find((p) => p.id === record.personaId)?.label ?? '다정한 친구';
            const voiceLabel =
              VOICE_OPTIONS.find((v) => v.id === record.voiceName)?.label.split(' ')[0] ??
              record.voiceName;
            const isExpanded = expandedId === record.id;

            return (
              <article
                key={record.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E6E1D8] bg-white p-6 dark:border-[#2B2926] dark:bg-[#1C1B19]"
              >
                <div>
                  {/* Unboxed clean metadata with typographic separators */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#6E6A63] dark:text-[#A39E93]">
                      <span className="font-mono-tabular">
                        {formatKoreanDate(record.createdAt)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{personaLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{voiceLabel}</span>
                      {record.durationSeconds > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {formatDuration(record.durationSeconds)}
                          </span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteRecord(record.id)}
                      aria-label="이 기록 삭제하기"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8A857C] transition-colors hover:bg-[#FAF8F5] hover:text-[#B44332] dark:hover:bg-[#252320] dark:hover:text-[#E27D6D]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <h2 className="font-display mt-3 text-lg font-bold text-[#1F1E1C] text-balance dark:text-[#F2EFE9]">
                    {record.emotionLabel}
                  </h2>

                  <p className="mt-2.5 text-[15px] leading-relaxed text-[#353330] dark:text-[#D5D0C6]">
                    {record.empathyMessage}
                  </p>

                  <div className="mt-4 border-t border-[#EFECE6] pt-3.5 text-[13px] leading-relaxed text-[#2F5D50] dark:border-[#2B2926] dark:text-[#86CBB6]">
                    <span className="font-semibold">오늘의 작은 돌봄: </span>
                    {record.gentleAction}
                  </div>
                </div>

                <div className="mt-4 border-t border-[#EFECE6] pt-3.5 dark:border-[#2B2926]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-xs text-[#6E6A63] dark:text-[#A39E93]">
                      {record.keyThemes.join(' · ')}
                    </div>

                    {record.transcriptSnippet.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : record.id)
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#3F3C37] hover:text-[#2F5D50] whitespace-nowrap shrink-0 dark:text-[#C9C3B8] dark:hover:text-[#86CBB6]"
                      >
                        <span>{isExpanded ? '대화 접기' : '대화 다시 보기'}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t border-[#F4F1EB] pt-3 text-[13px] leading-relaxed dark:border-[#252320]">
                      {record.transcriptSnippet.map((turn) => (
                        <div key={turn.id} className="text-[#4A4742] dark:text-[#C4BEB3]">
                          <span className="mr-2 font-semibold text-[#1F1E1C] dark:text-[#F2EFE9]">
                            {turn.role === 'user' ? '나' : '온기'}
                          </span>
                          <span>{turn.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
