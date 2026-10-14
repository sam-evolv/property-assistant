'use client';

import { LogIn, RefreshCw } from 'lucide-react';

interface SessionExpiredModalProps {
  isOpen: boolean;
  isDarkMode: boolean;
  selectedLanguage: string;
  onRescan?: () => void;
}

const TRANSLATIONS: Record<string, { title: string; message: string; rescan: string }> = {
  en: {
    title: 'Session Expired',
    message: 'Your session has expired. Please sign in again with your property code to continue.',
    rescan: 'Sign in again',
  },
  pl: {
    title: 'Sesja Wygasła',
    message: 'Twoja sesja wygasła. Zaloguj się ponownie, używając kodu nieruchomości.',
    rescan: 'Zaloguj się ponownie',
  },
  es: {
    title: 'Sesión Expirada',
    message: 'Tu sesión ha expirado. Inicia sesión de nuevo con el código de tu vivienda.',
    rescan: 'Iniciar sesión',
  },
  fr: {
    title: 'Session Expirée',
    message: 'Votre session a expiré. Reconnectez-vous avec le code de votre logement.',
    rescan: 'Se reconnecter',
  },
  de: {
    title: 'Sitzung Abgelaufen',
    message: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich mit Ihrem Immobiliencode erneut an.',
    rescan: 'Erneut anmelden',
  },
  pt: {
    title: 'Sessão Expirada',
    message: 'A sua sessão expirou. Inicie sessão novamente com o código do seu imóvel.',
    rescan: 'Iniciar sessão',
  },
};

export default function SessionExpiredModal({
  isOpen,
  isDarkMode,
  selectedLanguage,
  onRescan,
}: SessionExpiredModalProps) {
  if (!isOpen) return null;

  const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;

  const handleRescan = () => {
    if (onRescan) {
      onRescan();
    } else {
      sessionStorage.clear();
      window.location.href = '/login/homeowner';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className={`
          max-w-sm w-full rounded-2xl p-6 shadow-2xl text-center
          ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
        `}
      >
        <div
          className={`
            w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center
            ${isDarkMode ? 'bg-amber-500/20' : 'bg-amber-100'}
          `}
        >
          <RefreshCw className={`w-8 h-8 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
        </div>

        <h2 className="text-xl font-bold mb-2">{t.title}</h2>
        <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {t.message}
        </p>

        <button
          onClick={handleRescan}
          className={`
            w-full py-3 px-4 rounded-xl font-semibold
            flex items-center justify-center gap-2
            transition-all duration-200
            ${isDarkMode
              ? 'bg-amber-500 hover:bg-amber-400 text-gray-900'
              : 'bg-amber-500 hover:bg-amber-600 text-white'
            }
          `}
        >
          <LogIn className="w-5 h-5" />
          {t.rescan}
        </button>
      </div>
    </div>
  );
}
