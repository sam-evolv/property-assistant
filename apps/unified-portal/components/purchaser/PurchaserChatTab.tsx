'use client';

import { useState, useEffect, useRef } from 'react';
import { Home, Mic, Send } from 'lucide-react';

// Animation styles for typing indicator and logo hover
const ANIMATION_STYLES = `
  @keyframes dot-bounce {
    0%, 60%, 100% {
      opacity: 0.3;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-8px);
    }
  }
  @keyframes logo-float {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-12px);
    }
  }
  .typing-dot {
    animation: dot-bounce 1.4s infinite;
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin: 0 2px;
  }
  .dot-1 { animation-delay: 0s; }
  .dot-2 { animation-delay: 0.2s; }
  .dot-3 { animation-delay: 0.4s; }
  .logo-container {
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .logo-container:hover {
    animation: logo-float 2s ease-in-out infinite;
  }
`;

const TYPING_STYLES = ANIMATION_STYLES;

const TypingIndicator = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <div className={`flex justify-start`}>
    <style>{TYPING_STYLES}</style>
    <div
      className={`rounded-[20px] px-4 py-2.5 ${
        isDarkMode 
          ? 'bg-gray-900' 
          : 'bg-gray-200'
      }`}
    >
      <div className="flex items-center gap-1">
        <div className={`typing-dot dot-1 ${isDarkMode ? 'bg-gray-500' : 'bg-gray-400'}`} />
        <div className={`typing-dot dot-2 ${isDarkMode ? 'bg-gray-500' : 'bg-gray-400'}`} />
        <div className={`typing-dot dot-3 ${isDarkMode ? 'bg-gray-500' : 'bg-gray-400'}`} />
      </div>
    </div>
  </div>
);

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PurchaserChatTabProps {
  houseId: string;
  developmentId: string;
  initialMessage: string;
  purchaserName?: string;
  developmentName?: string;
  unitUid: string;
  token: string;
  selectedLanguage: string;
  isDarkMode: boolean;
  userId?: string | null;
}

// Translations for UI and prompts
const TRANSLATIONS: Record<string, any> = {
  en: {
    welcome: 'Ask anything about your home or community',
    subtitle: 'Quick answers for daily life: floor plans, amenities, local services, and more.',
    prompts: [
      "Public Transport",
      "Waste collection",
      "Parking rules",
      "Local area"
    ],
    placeholder: 'Ask about your home or community...',
    askButton: 'Ask',
    powered: 'Powered by AI • Information provided for reference only',
    voiceNotSupported: 'Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.',
    sessionExpired: 'Session expired. Please scan your QR code again.',
    errorOccurred: 'Sorry, I encountered an error. Please try again.'
  },
  pl: {
    welcome: 'Zapytaj o cokolwiek dotyczącego Twojego domu lub społeczności',
    subtitle: 'Szybkie odpowiedzi na co dzień: plany pięter, udogodnienia, lokalne usługi i więcej.',
    prompts: [
      "Transport publiczny",
      "Odbiór śmieci",
      "Zasady parkowania",
      "Okolica"
    ],
    placeholder: 'Zapytaj o swój dom lub społeczność...',
    askButton: 'Zapytaj',
    powered: 'Zasilane przez AI • Informacje wyłącznie w celach informacyjnych',
    voiceNotSupported: 'Wprowadzanie głosowe nie jest obsługiwane w Twojej przeglądarce. Użyj Chrome, Edge lub Safari.',
    sessionExpired: 'Sesja wygasła. Zeskanuj ponownie kod QR.',
    errorOccurred: 'Przepraszamy, napotkaliśmy błąd. Spróbuj ponownie.'
  },
  es: {
    welcome: 'Pregunta cualquier cosa sobre tu hogar o comunidad',
    subtitle: 'Respuestas rápidas para la vida diaria: planos, comodidades, servicios locales y más.',
    prompts: [
      "Transporte público",
      "Recogida de basura",
      "Reglas de estacionamiento",
      "Área local"
    ],
    placeholder: 'Pregunta sobre tu hogar o comunidad...',
    askButton: 'Preguntar',
    powered: 'Con tecnología de IA • Información solo como referencia',
    voiceNotSupported: 'La entrada de voz no es compatible con su navegador. Utilice Chrome, Edge o Safari.',
    sessionExpired: 'Sesión expirada. Escanee su código QR nuevamente.',
    errorOccurred: 'Lo sentimos, encontré un error. Inténtelo de nuevo.'
  },
  ru: {
    welcome: 'Спросите что угодно о вашем доме или сообществе',
    subtitle: 'Быстрые ответы на повседневные вопросы: планировки, удобства, местные услуги и многое другое.',
    prompts: [
      "Общественный транспорт",
      "Вывоз мусора",
      "Правила парковки",
      "Местность"
    ],
    placeholder: 'Спросите о вашем доме или сообществе...',
    askButton: 'Спросить',
    powered: 'На базе ИИ • Информация только для справки',
    voiceNotSupported: 'Голосовой ввод не поддерживается в вашем браузере. Используйте Chrome, Edge или Safari.',
    sessionExpired: 'Сеанс истек. Отсканируйте QR-код еще раз.',
    errorOccurred: 'Извините, произошла ошибка. Попробуйте еще раз.'
  },
  pt: {
    welcome: 'Pergunte qualquer coisa sobre sua casa ou comunidade',
    subtitle: 'Respostas rápidas para o dia a dia: plantas, comodidades, serviços locais e mais.',
    prompts: [
      "Transporte público",
      "Coleta de lixo",
      "Regras de estacionamento",
      "Área local"
    ],
    placeholder: 'Pergunte sobre sua casa ou comunidade...',
    askButton: 'Perguntar',
    powered: 'Alimentado por IA • Informação apenas para referência',
    voiceNotSupported: 'A entrada de voz não é compatível com o seu navegador. Use Chrome, Edge ou Safari.',
    sessionExpired: 'Sessão expirada. Escaneie seu código QR novamente.',
    errorOccurred: 'Desculpe, encontrei um erro. Tente novamente.'
  },
  lv: {
    welcome: 'Jautājiet jebko par savu māju vai kopienu',
    subtitle: 'Ātras atbildes ikdienai: plāni, ērtības, vietējie pakalpojumi un vairāk.',
    prompts: [
      "Sabiedriskais transports",
      "Atkritumu savākšana",
      "Stāvvietas noteikumi",
      "Vietējā apkārtne"
    ],
    placeholder: 'Jautājiet par savu māju vai kopienu...',
    askButton: 'Jautāt',
    powered: 'Darbina AI • Informācija tikai atsaucei',
    voiceNotSupported: 'Balss ievade netiek atbalstīta jūsu pārlūkprogrammā. Lūdzu, izmantojiet Chrome, Edge vai Safari.',
    sessionExpired: 'Sesija beigusies. Lūdzu, skenējiet QR kodu vēlreiz.',
    errorOccurred: 'Atvainojiet, radās kļūda. Lūdzu, mēģiniet vēlreiz.'
  },
  lt: {
    welcome: 'Klauskite bet ko apie savo namus ar bendruomenę',
    subtitle: 'Greiti atsakymai kasdienybei: planai, patogumai, vietinės paslaugos ir daugiau.',
    prompts: [
      "Viešasis transportas",
      "Šiukšlių surinkimas",
      "Parkavimo taisyklės",
      "Vietovė"
    ],
    placeholder: 'Klauskite apie savo namus ar bendruomenę...',
    askButton: 'Klausti',
    powered: 'Veikia AI • Informacija tik nuorodai',
    voiceNotSupported: 'Balso įvedimas nepalaikomas jūsų naršyklėje. Naudokite Chrome, Edge arba Safari.',
    sessionExpired: 'Sesija pasibaigė. Nuskaitykite QR kodą dar kartą.',
    errorOccurred: 'Atsiprašome, įvyko klaida. Bandykite dar kartą.'
  },
  ro: {
    welcome: 'Întrebați orice despre casa sau comunitatea dvs.',
    subtitle: 'Răspunsuri rapide pentru viața de zi cu zi: planuri, facilități, servicii locale și multe altele.',
    prompts: [
      "Transport public",
      "Colectare gunoi",
      "Reguli parcare",
      "Zona locală"
    ],
    placeholder: 'Întrebați despre casa sau comunitatea dvs...',
    askButton: 'Întreabă',
    powered: 'Alimentat de AI • Informații doar ca referință',
    voiceNotSupported: 'Intrarea vocală nu este acceptată în browserul dvs. Vă rugăm să utilizați Chrome, Edge sau Safari.',
    sessionExpired: 'Sesiunea a expirat. Vă rugăm să scanați codul QR din nou.',
    errorOccurred: 'Ne pare rău, am întâlnit o eroare. Vă rugăm să încercați din nou.'
  }
};

export default function PurchaserChatTab({
  houseId,
  developmentId,
  initialMessage,
  purchaserName,
  developmentName,
  unitUid,
  token,
  selectedLanguage,
  isDarkMode,
  userId,
}: PurchaserChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  useEffect(() => {
    // Initialize Web Speech API
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = selectedLanguage === 'en' ? 'en-US' :
                          selectedLanguage === 'pl' ? 'pl-PL' :
                          selectedLanguage === 'es' ? 'es-ES' :
                          selectedLanguage === 'ru' ? 'ru-RU' :
                          selectedLanguage === 'pt' ? 'pt-PT' :
                          selectedLanguage === 'lv' ? 'lv-LV' :
                          selectedLanguage === 'lt' ? 'lt-LT' :
                          selectedLanguage === 'ro' ? 'ro-RO' : 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [selectedLanguage]);

  const toggleVoiceInput = () => {
    const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;
    if (!speechSupported || !recognitionRef.current) {
      alert(t.voiceNotSupported);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsListening(false);
      }
    }
  };

  const sendMessage = async (messageText?: string) => {
    const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;
    const textToSend = messageText || input.trim();
    if (!textToSend || sending) return;

    if (!token) {
      console.error('No token available for chat');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t.sessionExpired,
        },
      ]);
      return;
    }

    if (showHome) {
      setShowHome(false);
    }
    const userMessage: Message = { role: 'user', content: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-qr-token': token,
        },
        body: JSON.stringify({
          developmentId,
          message: textToSend,
          userId: userId || undefined,
        }),
      });

      const data = await res.json();

      if (data.answer) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.answer },
        ]);
      } else if (data.error) {
        const errorMessage = res.status === 401 || res.status === 403 
          ? t.sessionExpired 
          : t.errorOccurred;
        
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: errorMessage,
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t.errorOccurred,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleHomeClick = () => {
    setShowHome(true);
    setMessages([]);
    setHasGreeted(false);
  };

  const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const inputBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300';
  const inputText = isDarkMode ? 'text-white' : 'text-gray-900';

  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
      {/* ChatGPT-Style Home Screen - No Scroll Layout */}
      {showHome && messages.length === 0 ? (
        <div className="flex h-full flex-col">
          {/* MAIN CONTENT (hero + pills) - Centered */}
          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-6">
            {/* Premium Logo Section */}
            <style>{ANIMATION_STYLES}</style>
            <div className="mb-8 flex flex-col items-center">
              {/* Logo Container with Elegant Shadow & Hover Float */}
              <div className={`logo-container relative mb-6 ${isDarkMode ? 'drop-shadow-[0_0_35px_rgba(245,158,11,0.25)] hover:drop-shadow-[0_0_50px_rgba(245,158,11,0.4)]' : 'drop-shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:drop-shadow-[0_16px_48px_rgba(0,0,0,0.2)]'}`}>
                <img 
                  src="/longview-logo.png" 
                  alt="Longview Estates" 
                  className={`h-16 w-auto object-contain transition-all duration-300 ${isDarkMode ? 'brightness-0 invert' : ''}`}
                />
              </div>
            </div>

            {/* Welcome Headline */}
            <h1 className={`text-center text-[20px] font-semibold leading-snug tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t.welcome.includes('or community') ? (
                <>
                  {t.welcome.split('or community')[0]}
                  <span className={`block ${isDarkMode ? 'text-white/90' : 'text-slate-900/90'}`}>or community</span>
                </>
              ) : (
                t.welcome
              )}
            </h1>

            {/* Subtitle */}
            <p className={`mt-2 text-center text-[13px] leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              {t.subtitle}
            </p>

            {/* 2x2 Compact Pill Grid (No Emojis) */}
            <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3">
              {t.prompts.map((prompt: string, i: number) => (
                <button
                  key={i}
                  onClick={() => handleQuickPrompt(prompt)}
                  className={`flex items-center justify-center rounded-full px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                    isDarkMode 
                      ? 'border border-gray-700 bg-gray-800/80 text-gray-200 shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 hover:border-gold-400 hover:shadow-[0_10px_24px_rgba(0,0,0,0.3)] active:translate-y-0 active:shadow-[0_4px_12px_rgba(0,0,0,0.25)]'
                      : 'border border-slate-200 bg-white/80 text-slate-800 shadow-[0_4px_10px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:border-gold-400 hover:shadow-[0_10px_24px_rgba(15,23,42,0.16)] active:translate-y-0 active:shadow-[0_4px_12px_rgba(15,23,42,0.14)]'
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* INPUT BAR - Fixed at Bottom (iMessage Style) */}
          <div className={`flex-shrink-0 border-t px-4 pb-4 pt-3 ${isDarkMode ? 'border-gray-800 bg-black' : 'border-gray-200 bg-white'}`}>
            <div className={`mx-auto flex max-w-md items-center gap-2 rounded-[24px] border px-3 py-2 ${
              isDarkMode
                ? 'border-gray-700 bg-gray-900'
                : 'border-gray-300 bg-gray-100'
            }`}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={t.placeholder}
                className={`flex-1 border-none bg-transparent px-2 py-1 text-[15px] placeholder:text-gray-400 focus:outline-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              />
              
              {/* Microphone Button */}
              {speechSupported && (
                <button
                  onClick={toggleVoiceInput}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                    isListening 
                      ? 'bg-gold-500 text-white' 
                      : isDarkMode 
                        ? 'text-gray-400 hover:text-gray-300'
                        : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-label="Voice input"
                >
                  <Mic className="h-5 w-5" />
                </button>
              )}

              {/* Send Button - Only show when text entered */}
              {input.trim() && (
                <button
                  onClick={() => sendMessage()}
                  disabled={sending}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white transition-all hover:brightness-110 disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Powered By AI Footer */}
            <p className={`mt-2 text-center text-[11px] ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
              {t.powered}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* iMessage-Style Chat Messages View */}
          <div className={`flex-1 overflow-y-auto px-4 py-4 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
            <div className="mx-auto max-w-3xl space-y-3">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-[20px] px-4 py-2.5 ${
                      msg.role === 'user'
                        ? isDarkMode
                          ? 'bg-gradient-to-br from-gold-500 to-gold-600 text-white'
                          : 'bg-gradient-to-br from-gold-400 to-gold-500 text-white'
                        : isDarkMode 
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              ))}
              {sending && <TypingIndicator isDarkMode={isDarkMode} />}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* iMessage-Style Input Bar - Fixed at Bottom */}
          <div className={`flex-shrink-0 border-t px-4 pb-4 pt-3 ${isDarkMode ? 'border-gray-800 bg-black' : 'border-gray-200 bg-white'}`}>
            <div className="mx-auto flex max-w-3xl items-center gap-2">
              {/* Home Button */}
              <button
                onClick={handleHomeClick}
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition ${
                  isDarkMode 
                    ? 'text-gray-400 hover:bg-gray-900 hover:text-gray-300' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
                aria-label="Back to home"
              >
                <Home className="h-5 w-5" />
              </button>

              {/* Input Field - iMessage Style */}
              <div className={`flex flex-1 items-center gap-2 rounded-[24px] border px-3 py-2 ${
                isDarkMode
                  ? 'border-gray-700 bg-gray-900'
                  : 'border-gray-300 bg-gray-100'
              }`}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={t.placeholder}
                  disabled={sending}
                  className={`flex-1 border-none bg-transparent px-2 py-1 text-[15px] placeholder:text-gray-400 focus:outline-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                />
                
                {/* Microphone Button */}
                {speechSupported && (
                  <button
                    onClick={toggleVoiceInput}
                    disabled={sending}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      isListening 
                        ? 'bg-gold-500 text-white' 
                        : isDarkMode 
                          ? 'text-gray-400 hover:text-gray-300'
                          : 'text-gray-500 hover:text-gray-700'
                    } disabled:opacity-50`}
                    aria-label="Voice input"
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                )}

                {/* Send Button - Only show when text entered */}
                {input.trim() && (
                  <button
                    onClick={() => sendMessage()}
                    disabled={sending}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white transition-all hover:brightness-110 disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
