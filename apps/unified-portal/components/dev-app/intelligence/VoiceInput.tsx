'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onListening: (isListening: boolean) => void;
  disabled?: boolean;
}

export default function VoiceInput({ onTranscript, onListening, disabled }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    onListening(false);
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
  }, [onListening]);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Fallback: focus the text input
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IE'; // Irish English

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onTranscript(transcript);

      // Reset silence timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (event.results[event.results.length - 1].isFinal) {
        silenceTimerRef.current = setTimeout(() => {
          stopListening();
        }, 1500);
      }
    };

    recognition.onerror = () => {
      stopListening();
    };

    recognition.onend = () => {
      setIsListening(false);
      onListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    onListening(true);
  }, [onTranscript, onListening, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  const toggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={disabled}
      className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
      style={{
        backgroundColor: isListening ? '#D4AF37' : '#f3f4f6',
        boxShadow: isListening ? '0 0 0 4px rgba(212,175,55,0.2)' : 'none',
        animation: isListening ? 'devapp-pulse-mic 1.5s ease-in-out infinite' : 'none',
      }}
      aria-label={isListening ? 'Stop recording' : 'Start voice input'}
    >
      {isListening ? (
        <MicOff size={16} className="text-white" />
      ) : (
        <Mic size={16} className="text-[#6b7280]" />
      )}
      <style jsx>{`
        @keyframes devapp-pulse-mic {
          0%, 100% { box-shadow: 0 0 0 4px rgba(212,175,55,0.2); }
          50% { box-shadow: 0 0 0 8px rgba(212,175,55,0.1); }
        }
      `}</style>
    </button>
  );
}
