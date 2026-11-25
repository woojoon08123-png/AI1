export type VoiceName = 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';

export type PersonaId = 'friend' | 'counselor' | 'sibling' | 'cheerleader';

export type SessionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export type NavTab = 'talk' | 'journal' | 'settings';

export interface VoiceOption {
  id: VoiceName;
  label: string;
  toneSummary: string;
  sampleLine: string;
  styleHint: string;
}

export interface PersonaOption {
  id: PersonaId;
  label: string;
  shortDesc: string;
  toneGuide: string;
}

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  isStreaming?: boolean;
  source?: 'voice' | 'text';
}

export interface ReflectionRecord {
  id: string;
  createdAt: number;
  personaId: PersonaId;
  voiceName: VoiceName;
  emotionLabel: string;
  empathyMessage: string;
  gentleAction: string;
  keyThemes: string[];
  turnCount: number;
  durationSeconds: number;
  transcriptSnippet: TranscriptEntry[];
}

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'Kore',
    label: '서연 (Kore)',
    toneSummary: '차분하고 온화한 중음 · 지친 날 마음을 기대기 좋은 목소리',
    sampleLine: '오늘 하루 정말 길었죠. 여기선 아무 말 안 하고 한숨만 쉬어도 괜찮아요.',
    styleHint: 'Warm, gentle, unhurried, deeply empathetic Korean conversational voice',
  },
  {
    id: 'Zephyr',
    label: '하늘 (Zephyr)',
    toneSummary: '맑고 부드러운 미풍 같은 톤 · 편안하게 속마음을 풀기 좋은 목소리',
    sampleLine: '당신 이야기를 듣다 보니, 그동안 혼자 얼마나 애썼는지 느껴져서 마음이 쓰여요.',
    styleHint: 'Soft, airy, comforting, attentive Korean friend voice',
  },
  {
    id: 'Charon',
    label: '도현 (Charon)',
    toneSummary: '깊고 안정적인 중저음 · 흔들리는 마음을 단단히 잡아주는 목소리',
    sampleLine: '지금 느끼는 감정이 결코 사소한 게 아니에요. 천천히 이야기해 줘도 괜찮습니다.',
    styleHint: 'Calm, grounded, reassuring low-pitched Korean listener voice',
  },
  {
    id: 'Puck',
    label: '지우 (Puck)',
    toneSummary: '다정하고 생동감 있는 톤 · 무거운 공기를 환기시켜 주는 목소리',
    sampleLine: '에이, 그 상황에서 그렇게 느낀 건 진짜 당연한 거예요! 나였어도 그랬을걸요.',
    styleHint: 'Expressive, relatable, warm, lively Korean close friend voice',
  },
  {
    id: 'Fenrir',
    label: '민재 (Fenrir)',
    toneSummary: '솔직하고 든든한 형·오빠 같은 톤 · 내 편이 되어주는 목소리',
    sampleLine: '야, 오늘 진짜 고생 많았다. 무슨 일 있었는지 나한테 다 털어놔 봐.',
    styleHint: 'Sincere, supportive, steady older-brother Korean voice',
  },
];

export const PERSONA_OPTIONS: PersonaOption[] = [
  {
    id: 'friend',
    label: '다정한 친구',
    shortDesc: '내 편이 되어 맞장구치고 함께 감정을 나누는 편안한 대화',
    toneGuide: '반말과 존댓말 중 사용자가 쓰는 어투를 자연스럽게 맞추되, 처음엔 부드러운 해요체로 다가갑니다.',
  },
  {
    id: 'counselor',
    label: '차분한 경청자',
    shortDesc: '서두르지 않고 감정의 결을 섬세하게 짚어주는 깊은 경청',
    toneGuide: '따뜻하고 정중한 해요체로, 판단이나 성급한 해결책 없이 감정을 먼저 언어화해 줍니다.',
  },
  {
    id: 'sibling',
    label: '따뜻한 언니·오빠',
    shortDesc: '다독여 주면서도 현실적인 숨 고르기를 도와주는 든든한 온기',
    toneGuide: '다정하고 믿음직한 어조로, 스스로를 너무 몰아세우지 않도록 부드럽게 감싸줍니다.',
  },
  {
    id: 'cheerleader',
    label: '유쾌한 응원가',
    shortDesc: '무거운 기분을 조금씩 가볍게 덜어주는 밝고 진심 어린 에너지',
    toneGuide: '진심을 잃지 않으면서도 숨 막히는 감정에 작은 숨통을 틔워주는 밝은 공감을 건넵니다.',
  },
];
