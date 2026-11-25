import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, ThinkingLevel } from '@google/genai';
import type { LiveServerMessage } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 환경 변수가 설정되어 있지 않습니다. Settings > Secrets 패널을 확인해 주세요.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GEMINI_API_KEY')) {
    return { status: 500, message: raw };
  }
  if (raw.includes('PERMISSION_DENIED') || raw.includes('403') || raw.includes('API_KEY_INVALID') || raw.includes('400')) {
    return {
      status: 400,
      message: 'Gemini API 키가 유효하지 않거나 권한이 없습니다. Settings > Secrets 패널에서 API 키를 확인해 주세요.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: '요청 한도에 도달했습니다. 잠시 후 다시 시도하거나 Settings > Secrets에서 API 키 할당량을 확인해 주세요.',
    };
  }
  return {
    status: 500,
    message: `음성 AI 연결 중 문제가 발생했습니다: ${raw}`,
  };
}

const VALID_VOICES = new Set(['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir']);

function buildEmpathySystemInstruction(persona: string, userName?: string): string {
  const nameLine = userName?.trim()
    ? `사용자의 이름은 '${userName.trim()}'입니다. 대화 중에 너무 과하지 않게, 자연스러운 타이밍에 다정하게 이름을 불러주세요.`
    : '';

  const personaGuides: Record<string, string> = {
    friend:
      '당신은 오랜 시간 마음을 터놓아 온 다정한 친구 같은 존재입니다. 딱딱한 상담사 말투가 아니라, 진짜 옆에서 따뜻한 차 한 잔을 사이에 두고 이야기하는 것처럼 말하세요. 사용자가 반말을 쓰면 자연스럽게 부드러운 반말로 맞추어도 좋고, 기본적으로는 편안하고 다정한 해요체를 사용하세요.',
    counselor:
      '당신은 깊이 경청하고 감정의 결을 섬세하게 읽어주는 차분한 정서적 동반자입니다. 성급하게 해결책을 제시하거나 조언을 늘어놓지 마세요. 먼저 사용자가 느끼는 감정(서운함, 막막함, 피곤함, 안도감 등)을 따뜻한 언어로 짚어주고, 있는 그대로 받아들여 주세요.',
    sibling:
      '당신은 언제든 기대어 쉴 수 있는 따뜻한 언니·오빠 같은 존재입니다. 사용자가 스스로를 자책하거나 너무 애쓰고 있을 때, 다정하게 편을 들어주고 마음을 감싸안아 주세요. 과장된 칭찬 대신 진심이 묻어나는 위로를 건네세요.',
    cheerleader:
      '당신은 진심 어린 공감 위에 작은 숨통을 틔워주는 밝고 따뜻한 응원가입니다. 힘든 감정을 억지로 덮거나 가볍게 넘기지 않으면서도, 사용자의 편에서 같이 속상해해 주고 작은 용기와 미소를 되찾을 수 있게 곁을 지켜주세요.',
  };

  const selectedGuide = personaGuides[persona] || personaGuides.friend;

  return [
    '당신의 이름은 "온기"입니다. 당신은 사람의 목소리와 말투, 침묵과 한숨 속에 담긴 감정을 깊이 이해하고 사람처럼 진심으로 공감해 주는 실시간 음성 대화 AI입니다.',
    selectedGuide,
    nameLine,
    '',
    '[사람처럼 공감하는 대화 원칙]',
    '1. 감정을 먼저, 해결은 나중에: 사용자가 힘든 일을 털어놓으면 바로 "이렇게 해보세요"라고 해결책을 말하지 마세요. 먼저 "그랬구나...", "진짜 속상했겠다", "그 순간엔 마음이 쿵 내려앉았을 것 같아요"처럼 감정에 깊이 머물러 주세요.',
    '2. 목소리와 뉘앙스 감지: 음성으로 들리는 사용자의 말속도, 머뭇거림, 한숨, 떨림, 밝아진 톤을 자연스럽게 의식하고 반응하세요. 말이 잠시 멈추면 재촉하지 말고 "천천히 말해도 괜찮아요"라고 여백을 주세요.',
    '3. 실제 구어체와 짧은 호흡: 한 번에 너무 길게 설명하지 마세요. 실제 사람과 대화하듯 2~4문장 안팎의 자연스러운 호흡으로 말하고, 상대가 이야기를 이어갈 수 있는 따뜻한 맞장구나 열린 질문을 남기세요.',
    '4. 절대 금지 사항: 목록 번호(1, 2, 3), 마크다운 기호, "AI로서 저는 감정이 없지만...", "도움이 되어 기쁩니다", "추가 질문이 있으신가요?" 같은 기계적이고 상담원 같은 문구는 절대 쓰지 마세요.',
    '5. 언어 맞춤: 사용자가 한국어로 말하면 자연스러운 한국어로, 다른 언어로 말하면 그 언어로 따뜻하게 공감하며 대화하세요.',
  ]
    .filter(Boolean)
    .join('\n');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Voice preview via Gemini TTS (gemini-3.8-flash-lite-tts)
  app.post('/api/tts-preview', async (req, res) => {
    try {
      const { voiceName = 'Kore', text, styleHint } = req.body as {
        voiceName?: string;
        text?: string;
        styleHint?: string;
      };
      const safeVoice = VALID_VOICES.has(voiceName) ? voiceName : 'Kore';
      const safeText =
        (text || '').trim().slice(0, 300) ||
        '오늘 하루 정말 고생 많았어요. 지금 마음이 어떤지 편하게 들려주세요.';

      const ai = createAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: safeText,
                speechMetadata: {
                  style: styleHint || 'Warm, gentle, empathetic Korean voice',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: safeVoice },
            },
          },
        },
      });

      const audioData =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) {
        return res.status(502).json({ error: '음성 데이터를 생성하지 못했습니다.' });
      }
      return res.json({ audioBase64: audioData, mimeType: 'audio/wav' });
    } catch (err) {
      const formatted = formatApiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Quiet-mode / text-based empathetic conversation + voice synthesis
  app.post('/api/text-empathy', async (req, res) => {
    try {
      const {
        message,
        history = [],
        persona = 'friend',
        voiceName = 'Kore',
        userName = '',
        withAudio = true,
      } = req.body as {
        message?: string;
        history?: Array<{ role: 'user' | 'assistant'; text: string }>;
        persona?: string;
        voiceName?: string;
        userName?: string;
        withAudio?: boolean;
      };

      if (!message || !message.trim()) {
        return res.status(400).json({ error: '메시지를 입력해 주세요.' });
      }

      const ai = createAiClient();
      const contents = [
        ...history.slice(-12).map((turn) => ({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.text }],
        })),
        { role: 'user', parts: [{ text: message.trim() }] },
      ];

      const textResponse = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: buildEmpathySystemInstruction(persona, userName),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const replyText = (textResponse.text || '').trim();
      if (!replyText) {
        return res.status(502).json({ error: '응답을 생성하지 못했습니다.' });
      }

      let audioBase64: string | null = null;
      if (withAudio) {
        try {
          const safeVoice = VALID_VOICES.has(voiceName) ? voiceName : 'Kore';
          const ttsRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: replyText,
                    speechMetadata: {
                      style: 'Warm, empathetic, natural Korean conversational voice',
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: safeVoice },
                },
              },
            },
          });
          audioBase64 =
            ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
        } catch (ttsErr) {
          console.error('TTS generation error in text-empathy:', ttsErr);
        }
      }

      return res.json({ replyText, audioBase64 });
    } catch (err) {
      const formatted = formatApiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Distill a conversation into an Empathy Reflection card
  app.post('/api/reflect', async (req, res) => {
    try {
      const { transcript = [], persona = 'friend' } = req.body as {
        transcript?: Array<{ role: 'user' | 'assistant'; text: string }>;
        persona?: string;
      };

      const validTurns = transcript.filter((t) => t.text && t.text.trim().length > 0);
      if (validTurns.length === 0) {
        return res.status(400).json({ error: '정리할 대화 내용이 아직 없습니다.' });
      }

      const dialogueText = validTurns
        .map((t) => `${t.role === 'user' ? '사용자' : '온기'}: ${t.text.trim()}`)
        .join('\n');

      const ai = createAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `다음은 사용자와 공감 음성 AI '온기'가 나눈 대화입니다. 이 대화 속에 담긴 사용자의 마음과 감정을 따뜻하게 어루만지는 '마음 정리 카드'를 한국어로 작성해 주세요.\n\n[대화 내용]\n${dialogueText}`,
        config: {
          systemInstruction: `당신은 대화 속 감정을 따뜻하고 섬세하게 정리해 주는 마음 기록가입니다. 페르소나(${persona})의 다정한 온도를 유지하되, 사용자의 실제 표현과 상황을 바탕으로 진정성 있게 작성하세요.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              emotionLabel: {
                type: Type.STRING,
                description:
                  '대화에 담긴 사용자의 핵심 감정을 표현하는 짧고 서정적인 한국어 한 줄 (예: "지치고 막막하지만 묵묵히 버텨낸 마음")',
              },
              empathyMessage: {
                type: Type.STRING,
                description:
                  '사용자의 실제 이야기를 반영하여 진심으로 마음을 다독여 주는 따뜻한 위로 메시지 2~3문장',
              },
              gentleAction: {
                type: Type.STRING,
                description:
                  '부담 없이 오늘 해볼 수 있는 아주 작고 다정한 자기 돌봄 제안 한 문장 (예: "잠들기 전 따뜻한 물 한 잔 마시고 어깨 힘 빼기")',
              },
              keyThemes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '대화의 핵심 키워드 2~3개 (짧은 한국어 단어 또는 구)',
              },
            },
            required: ['emotionLabel', 'empathyMessage', 'gentleAction', 'keyThemes'],
          },
        },
      });

      const rawJson = (response.text || '{}').trim();
      const parsed = JSON.parse(rawJson);
      return res.json(parsed);
    } catch (err) {
      const formatted = formatApiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname === '/api/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs: WebSocket, req: http.IncomingMessage) => {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const requestedVoice = reqUrl.searchParams.get('voice') || 'Kore';
    const voiceName = VALID_VOICES.has(requestedVoice) ? requestedVoice : 'Kore';
    const persona = reqUrl.searchParams.get('persona') || 'friend';
    const userName = reqUrl.searchParams.get('userName') || '';

    let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let clientClosed = false;

    const sendToClient = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    try {
      const ai = createAiClient();
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: buildEmpathySystemInstruction(persona, userName),
        },
        callbacks: {
          onopen: () => {
            sendToClient({ type: 'ready' });
          },
          onmessage: (message: LiveServerMessage) => {
            const serverContent = message.serverContent;
            if (!serverContent) return;

            if (serverContent.inputTranscription?.text) {
              sendToClient({
                type: 'inputTranscript',
                text: serverContent.inputTranscription.text,
              });
            }

            if (serverContent.outputTranscription?.text) {
              sendToClient({
                type: 'outputTranscript',
                text: serverContent.outputTranscription.text,
              });
            }

            for (const part of serverContent.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                sendToClient({
                  type: 'audio',
                  data: part.inlineData.data,
                });
              }
            }

            if (serverContent.interrupted) {
              sendToClient({ type: 'interrupted' });
            }

            if (serverContent.turnComplete) {
              sendToClient({ type: 'turnComplete' });
            }
          },
          onerror: (err: unknown) => {
            console.error('Gemini Live error:', err);
            const formatted = formatApiError(err);
            sendToClient({ type: 'error', message: formatted.message });
          },
          onclose: () => {
            if (!clientClosed) {
              sendToClient({ type: 'closed' });
            }
          },
        },
      });

      if (clientClosed) {
        session.close();
        return;
      }
    } catch (err) {
      console.error('Failed to initialize Gemini Live session:', err);
      const formatted = formatApiError(err);
      sendToClient({ type: 'error', message: formatted.message });
      clientWs.close();
      return;
    }

    clientWs.on('message', (rawData) => {
      if (!session || clientClosed) return;
      try {
        const msg = JSON.parse(rawData.toString()) as {
          type?: string;
          data?: string;
          text?: string;
        };
        if (msg.type === 'audio' && msg.data) {
          session.sendRealtimeInput({
            audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.type === 'text' && msg.text?.trim()) {
          session.sendRealtimeInput({ text: msg.text.trim() });
        }
      } catch (err) {
        console.error('WebSocket message handling error:', err);
      }
    });

    clientWs.on('close', () => {
      clientClosed = true;
      if (session) {
        try {
          session.close();
        } catch {
          // ignore close errors
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ongi server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
