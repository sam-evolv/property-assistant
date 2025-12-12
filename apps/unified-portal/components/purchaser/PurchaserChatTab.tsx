'use client';

import { useState, useEffect, useRef } from 'react';
import { Home, Mic, Send, FileText, Download, Eye, Info, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

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

const SourcesDropdown = ({ 
  sources, 
  isDarkMode 
}: { 
  sources: SourceDocument[]; 
  isDarkMode: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!sources || sources.length === 0) return null;
  
  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 text-xs transition-colors ${
          isDarkMode 
            ? 'text-gray-500 hover:text-gray-400' 
            : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <Info className="h-3 w-3" />
        <span>Sources</span>
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      
      {isOpen && (
        <div className={`mt-2 rounded-lg border p-2 text-xs ${
          isDarkMode 
            ? 'border-gray-700 bg-gray-800/50' 
            : 'border-gray-200 bg-gray-50'
        }`}>
          <p className={`mb-1 font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Based on:
          </p>
          <ul className="space-y-1">
            {sources.map((source, idx) => (
              <li key={idx} className={`flex items-start gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>
                  {source.name}
                  {source.date && <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}> ({source.date})</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const RequestInfoButton = ({ 
  question,
  unitId,
  isDarkMode,
  onSubmitted,
}: { 
  question: string;
  unitId: string;
  isDarkMode: boolean;
  onSubmitted: () => void;
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const handleSubmit = async () => {
    if (submitting || submitted) return;
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/information-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          unitId,
          context: 'Submitted from chat when AI could not answer',
        }),
      });
      
      if (res.ok) {
        setSubmitted(true);
        onSubmitted();
      }
    } catch (error) {
      console.error('Failed to submit request:', error);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (submitted) {
    return (
      <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        isDarkMode 
          ? 'bg-green-900/30 text-green-400' 
          : 'bg-green-50 text-green-700'
      }`}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Request submitted - the team will add this info</span>
      </div>
    );
  }
  
  return (
    <button
      onClick={handleSubmit}
      disabled={submitting}
      className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        isDarkMode
          ? 'bg-gold-600/20 text-gold-400 hover:bg-gold-600/30'
          : 'bg-gold-100 text-gold-700 hover:bg-gold-200'
      } disabled:opacity-50`}
    >
      <AlertCircle className="h-4 w-4" />
      <span>{submitting ? 'Submitting...' : 'Request this information'}</span>
    </button>
  );
};

interface DrawingData {
  fileName: string;
  drawingType: string;
  drawingDescription: string;
  houseTypeCode: string;
  previewUrl: string;
  downloadUrl: string;
  explanation: string;
}

interface ClarificationOption {
  id: string;
  label: string;
  description: string;
}

interface ClarificationData {
  type: string;
  options: ClarificationOption[];
}

interface SourceDocument {
  name: string;
  date: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  floorPlanUrl?: string | null;
  drawing?: DrawingData | null;
  clarification?: ClarificationData | null;
  sources?: SourceDocument[] | null;
  isNoInfo?: boolean;
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
  },
  ga: {
    welcome: 'Fiafraigh aon rud faoi do theach nó do phobal',
    subtitle: 'Freagraí tapa don saol laethúil: pleananna urláir, áiseanna, seirbhísí áitiúla, agus tuilleadh.',
    prompts: [
      "Iompar Poiblí",
      "Bailiú Dramhaíola",
      "Rialacha Páirceála",
      "An Ceantar Áitiúil"
    ],
    placeholder: 'Fiafraigh faoi do theach nó do phobal...',
    askButton: 'Fiafraigh',
    powered: 'Faoi chumhacht AI • Eolas le haghaidh tagartha amháin',
    voiceNotSupported: 'Ní thacaítear le hionchur gutha i do bhrabhsálaí. Úsáid Chrome, Edge, nó Safari.',
    sessionExpired: 'Seisiún imithe in éag. Scan do chód QR arís.',
    errorOccurred: 'Tá brón orainn, tharla earráid. Bain triail eile as.'
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Scroll to top of messages so user sees their question first
  const scrollToTop = () => {
    messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    // When messages change, scroll to top to show user's message
    scrollToTop();
  }, [messages]);

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
                          selectedLanguage === 'ro' ? 'ro-RO' :
                          selectedLanguage === 'ga' ? 'ga-IE' : 'en-US';

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
          unitUid: unitUid,
        }),
      });

      const contentType = res.headers.get('content-type') || '';

      // Handle streaming response (Server-Sent Events)
      if (contentType.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No reader available');

        const decoder = new TextDecoder();
        let streamedContent = '';
        let drawing: DrawingData | null = null;
        let sources: SourceDocument[] | null = null;
        let assistantMessageIndex = -1;

        // Add placeholder assistant message immediately
        setMessages((prev) => {
          assistantMessageIndex = prev.length;
          return [...prev, { role: 'assistant', content: '', drawing: null, sources: null }];
        });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'metadata') {
                  // Received metadata with drawing and source info
                  if (data.drawing) {
                    drawing = data.drawing;
                  }
                  if (data.sources && data.sources.length > 0) {
                    sources = data.sources;
                  }
                } else if (data.type === 'text') {
                  // Streaming text content
                  streamedContent += data.content;
                  setMessages((prev) => {
                    const updated = [...prev];
                    if (assistantMessageIndex >= 0 && updated[assistantMessageIndex]) {
                      updated[assistantMessageIndex] = {
                        ...updated[assistantMessageIndex],
                        content: streamedContent,
                        drawing: drawing,
                        sources: sources,
                      };
                    }
                    return updated;
                  });
                } else if (data.type === 'done') {
                  // Streaming complete - detect if this is a "no info" response
                  const isNoInfoResponse = streamedContent.toLowerCase().includes("i don't have that information") ||
                    streamedContent.toLowerCase().includes("i don't have that specific detail") ||
                    streamedContent.toLowerCase().includes("i'd recommend contacting your developer");
                  
                  setMessages((prev) => {
                    const updated = [...prev];
                    if (assistantMessageIndex >= 0 && updated[assistantMessageIndex]) {
                      updated[assistantMessageIndex] = {
                        ...updated[assistantMessageIndex],
                        content: streamedContent,
                        drawing: drawing,
                        sources: sources,
                        isNoInfo: isNoInfoResponse,
                      };
                    }
                    return updated;
                  });
                } else if (data.type === 'error') {
                  setMessages((prev) => {
                    const updated = [...prev];
                    if (assistantMessageIndex >= 0 && updated[assistantMessageIndex]) {
                      updated[assistantMessageIndex] = {
                        ...updated[assistantMessageIndex],
                        content: t.errorOccurred,
                      };
                    }
                    return updated;
                  });
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      } else {
        // Handle non-streaming JSON response (liability override, clarification, errors)
        const data = await res.json();

        if (data.answer) {
          setMessages((prev) => [
            ...prev,
            { 
              role: 'assistant', 
              content: data.answer,
              floorPlanUrl: data.floorPlanUrl || null,
              drawing: data.drawing || null,
              clarification: data.clarification || null,
            },
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
    <div className={`flex flex-col min-h-0 overflow-hidden ${isDarkMode ? 'bg-black' : 'bg-white'}`}
      style={{ height: 'calc(100dvh - 56px - 64px - env(safe-area-inset-bottom, 0px))' }}>
      {/* ChatGPT-Style Home Screen - Fixed viewport, no scroll, accounts for header (56px) and nav bar (64px + safe area) */}
      {messages.length === 0 && showHome ? (
        <div className="flex h-full min-h-0 flex-col justify-between overflow-hidden">
          <style>{ANIMATION_STYLES}</style>
          
          {/* HERO CONTENT - Centered in remaining space */}
          <div className="flex flex-1 min-h-0 flex-col items-center justify-center px-5 overflow-hidden">
            {/* Logo */}
            <div className={`logo-container ${isDarkMode ? 'drop-shadow-[0_0_35px_rgba(245,158,11,0.25)]' : 'drop-shadow-[0_8px_32px_rgba(0,0,0,0.12)]'}`}>
              <img 
                src="/longview-logo.png" 
                alt="Longview Estates" 
                className={`h-10 w-auto object-contain ${isDarkMode ? 'brightness-0 invert' : ''}`}
              />
            </div>

            {/* Welcome Headline */}
            <h1 className={`mt-3 text-center text-[17px] font-semibold leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t.welcome.includes('or community') ? (
                <>
                  {t.welcome.split('or community')[0]}
                  <span className="block">or community</span>
                </>
              ) : (
                t.welcome
              )}
            </h1>

            {/* Subtitle */}
            <p className={`mt-1.5 text-center text-[11px] leading-relaxed max-w-[260px] ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              {t.subtitle}
            </p>

            {/* 2x2 Prompt Grid - Compact */}
            <div className="mt-3 grid w-full max-w-[300px] grid-cols-2 gap-1.5">
              {t.prompts.map((prompt: string, i: number) => (
                <button
                  key={i}
                  onClick={() => handleQuickPrompt(prompt)}
                  className={`flex items-center justify-center rounded-full px-2.5 py-2 text-[12px] font-medium transition-all duration-200 cursor-pointer ${
                    isDarkMode 
                      ? 'border border-gray-700 bg-gray-800 text-gray-200 hover:border-gold-500 hover:shadow-[0_0_10px_rgba(234,179,8,0.4)] active:scale-95'
                      : 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-gold-500 hover:shadow-[0_0_10px_rgba(234,179,8,0.35)] active:scale-95'
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* INPUT BAR - Fixed at bottom, above mobile nav */}
          <div className={`shrink-0 border-t px-2 pt-0 pb-0 ${isDarkMode ? 'border-gray-800 bg-black' : 'border-gray-200 bg-white'}`}>
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
            <p className={`mt-0 text-center text-[9px] ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
              {t.powered}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          {/* MESSAGES - Scrollable conversation view (alternating like iMessage) */}
          <div 
            ref={messagesContainerRef}
            className={`flex-1 min-h-0 overflow-y-auto px-4 py-3 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
          >
            <div className="mx-auto max-w-3xl flex flex-col gap-3">
              {messages.map((msg, idx) => {
                if (msg.role === 'user') {
                  return (
                    <div key={`msg-${idx}`} className="flex justify-end">
                      <div className={`max-w-[80%] rounded-[20px] px-4 py-2.5 ${
                        isDarkMode
                          ? 'bg-gradient-to-br from-gold-500 to-gold-600 text-white'
                          : 'bg-gradient-to-br from-gold-400 to-gold-500 text-white'
                      }`}>
                        <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={`msg-${idx}`} className="flex justify-start">
                    <div className={`max-w-[85%] rounded-[20px] px-4 py-2.5 ${
                      isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-900'
                    }`}>
                      <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">{msg.content}</p>
                      {msg.drawing && (
                      <div className={`mt-3 rounded-xl border overflow-hidden ${
                        isDarkMode 
                          ? 'border-gray-700 bg-gray-800/50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className={`px-3 py-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          <div className="flex items-center gap-2">
                            <FileText className={`h-4 w-4 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {msg.drawing.drawingType === 'room_sizes' ? 'Room Sizes' :
                               msg.drawing.drawingType === 'floor_plan' ? 'Floor Plan' :
                               msg.drawing.drawingType === 'elevation' ? 'Elevations' : 'Drawing'}
                            </span>
                            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              ({msg.drawing.houseTypeCode})
                            </span>
                          </div>
                          {msg.drawing.explanation && (
                            <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {msg.drawing.explanation}
                            </p>
                          )}
                        </div>
                        <div className="flex">
                          <a
                            href={msg.drawing.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition border-r ${
                              isDarkMode
                                ? 'border-gray-700 text-gold-400 hover:bg-gray-700/50'
                                : 'border-gray-200 text-gold-700 hover:bg-gray-100'
                            }`}
                          >
                            <Eye className="h-4 w-4" />
                            Preview
                          </a>
                          <a
                            href={msg.drawing.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition ${
                              isDarkMode
                                ? 'text-gold-400 hover:bg-gray-700/50'
                                : 'text-gold-700 hover:bg-gray-100'
                            }`}
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {msg.floorPlanUrl && !msg.drawing && (
                      <a
                        href={msg.floorPlanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          isDarkMode
                            ? 'bg-gold-600/20 text-gold-400 hover:bg-gold-600/30'
                            : 'bg-gold-100 text-gold-700 hover:bg-gold-200'
                        }`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        View Floor Plan (PDF)
                      </a>
                    )}
                    
                    {msg.clarification && msg.clarification.options && (
                      <div className="mt-3 flex flex-col gap-2">
                        {msg.clarification.options.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => {
                              const followUp = option.id === 'internal' 
                                ? 'Show me the internal floor plans please'
                                : 'Show me the external elevations please';
                              sendMessage(followUp);
                            }}
                            className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all ${
                              isDarkMode
                                ? 'border-gray-700 bg-gray-800/70 hover:border-gold-500 hover:bg-gray-800'
                                : 'border-gray-200 bg-white hover:border-gold-400 hover:bg-gold-50'
                            }`}
                          >
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {option.label}
                            </span>
                            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {option.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Sources dropdown for transparency */}
                    {msg.sources && msg.sources.length > 0 && (
                      <SourcesDropdown sources={msg.sources} isDarkMode={isDarkMode} />
                    )}
                    
                    {/* Request info button when AI doesn't have the answer */}
                    {msg.isNoInfo && messages.find(m => m.role === 'user') && (
                      <RequestInfoButton 
                        question={messages.filter(m => m.role === 'user').slice(-1)[0]?.content || ''}
                        unitId={unitUid}
                        isDarkMode={isDarkMode}
                        onSubmitted={() => {}}
                      />
                    )}
                    </div>
                  </div>
                );
              })}
              {sending && <TypingIndicator isDarkMode={isDarkMode} />}
            </div>
          </div>

          {/* Input Bar - Fixed gap maintained at all times */}
          <div 
            className={`shrink-0 px-4 pt-3 pb-3 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
          >
            <div className="mx-auto flex max-w-3xl items-center gap-2">
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

              <div className={`flex flex-1 items-center gap-2 rounded-[24px] border px-4 py-2 ${
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
            <p className={`mt-1.5 text-center text-[10px] ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              {t.powered}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
