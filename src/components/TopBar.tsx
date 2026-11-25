import { MessageCircleHeart, BookHeart, SlidersHorizontal, RotateCcw } from 'lucide-react';
import type { NavTab } from '../types/companion';

interface TopBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onResetConversation: () => void;
  journalCount: number;
  hasActiveTranscript: boolean;
}

export function TopBar({
  activeTab,
  onSelectTab,
  onResetConversation,
  journalCount,
  hasActiveTranscript,
}: TopBarProps) {
  const navItems: Array<{ id: NavTab; label: string }> = [
    { id: 'talk', label: '대화하기' },
    {
      id: 'journal',
      label: journalCount > 0 ? `감정 기록 ${journalCount}` : '감정 기록',
    },
    { id: 'settings', label: '목소리 설정' },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#E6E1D8] bg-[#FAF8F5]/90 backdrop-blur-md dark:border-[#2B2926] dark:bg-[#141312]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-5 py-3.5 sm:px-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => onSelectTab('talk')}
            className="font-display text-xl font-bold tracking-tight text-[#1F1E1C] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F5D50] dark:text-[#F2EFE9] dark:focus-visible:outline-[#5A9E8A]"
          >
            온기
          </button>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav
            aria-label="주요 메뉴"
            className="hidden md:flex items-center gap-8 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative py-1.5 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F5D50] dark:focus-visible:outline-[#5A9E8A] ${
                    isActive
                      ? 'text-[#1F1E1C] dark:text-[#F2EFE9]'
                      : 'text-[#6E6A63] hover:text-[#1F1E1C] dark:text-[#A39E93] dark:hover:text-[#F2EFE9]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-[#2F5D50] dark:bg-[#5A9E8A]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onResetConversation}
              disabled={!hasActiveTranscript && activeTab === 'talk'}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#D8D2C7] bg-white px-4 py-2 text-xs font-medium text-[#1F1E1C] transition-colors duration-150 hover:bg-[#F3EFE9] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5D50] dark:border-[#34312D] dark:bg-[#1C1B19] dark:text-[#F2EFE9] dark:hover:bg-[#252320] dark:focus-visible:outline-[#5A9E8A]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>새 대화</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Thumb-Zone Navigation Bar (<= 15% mobile viewport height) */}
      <nav
        aria-label="모바일 메뉴"
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-3 border-t border-[#E6E1D8] bg-[#FAF8F5]/95 backdrop-blur-md md:hidden dark:border-[#2B2926] dark:bg-[#141312]/95"
      >
        <button
          type="button"
          onClick={() => onSelectTab('talk')}
          className={`flex min-h-[54px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'talk'
              ? 'text-[#2F5D50] dark:text-[#7AC2AC]'
              : 'text-[#6E6A63] dark:text-[#A39E93]'
          }`}
        >
          <MessageCircleHeart className="h-5 w-5" aria-hidden="true" />
          <span>대화하기</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('journal')}
          className={`flex min-h-[54px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'journal'
              ? 'text-[#2F5D50] dark:text-[#7AC2AC]'
              : 'text-[#6E6A63] dark:text-[#A39E93]'
          }`}
        >
          <BookHeart className="h-5 w-5" aria-hidden="true" />
          <span>{journalCount > 0 ? `감정 기록 (${journalCount})` : '감정 기록'}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('settings')}
          className={`flex min-h-[54px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'settings'
              ? 'text-[#2F5D50] dark:text-[#7AC2AC]'
              : 'text-[#6E6A63] dark:text-[#A39E93]'
          }`}
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          <span>목소리 설정</span>
        </button>
      </nav>
    </>
  );
}
