'use client';

import { useState, useEffect } from 'react';
import { Bell, Calendar, Plus, X, MessageCircle, Send, Trash2, ChevronLeft } from 'lucide-react';
import NoticeboardTermsModal from './NoticeboardTermsModal';
import SessionExpiredModal from './SessionExpiredModal';
import { getEffectiveToken } from '../../lib/purchaserSession';

interface Notice {
  id: string;
  title: string;
  message: string;
  created_at: string;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  author_name?: string;
  author_unit?: string;
}

interface Comment {
  id: string;
  author_name: string;
  author_unit?: string;
  body: string;
  created_at: string;
  unit_id?: string;
}

interface PurchaserNoticeboardTabProps {
  unitUid: string;
  isDarkMode: boolean;
  selectedLanguage: string;
  token?: string;
}

const TRANSLATIONS: Record<string, any> = {
  en: {
    header: 'Community Noticeboard',
    subtitle: 'Important updates and announcements',
    noNotices: 'No Posts Yet',
    noNoticesDesc: 'Be the first to share something with your community.',
    loading: 'Loading...',
    createButton: 'New Post',
    createTitle: 'Create a Post',
    formTitle: 'Title',
    formMessage: 'What would you like to share?',
    formCategory: 'Category',
    formPriority: 'Priority',
    formAuthorName: 'Your Name',
    low: 'Low',
    medium: 'Medium',
    high: 'Urgent',
    cancel: 'Cancel',
    submit: 'Post',
    submitting: 'Posting...',
    all: 'All',
    event: 'Event',
    alert: 'Alert',
    lostFound: 'Lost & Found',
    general: 'General',
    sessionExpired: 'Session expired. Please scan your QR code again.',
    submitFailed: 'Failed to submit. Please try again.',
    comments: 'Comments',
    noComments: 'No comments yet',
    beFirstComment: 'Start the conversation...',
    writeComment: 'Add a comment...',
    postComment: 'Post',
    deleteComment: 'Delete',
    yourName: 'Your name',
    back: 'Back',
    commentPosted: 'Comment posted!',
    commentDeleted: 'Comment deleted',
    commentFailed: 'Failed to post comment.',
    viewComments: 'View comments',
    postedBy: 'Posted by',
    anonymous: 'Community Member',
    resident: 'Resident',
  },
  pl: {
    header: 'Tablica Społeczności',
    subtitle: 'Ważne aktualizacje i ogłoszenia',
    noNotices: 'Brak Postów',
    noNoticesDesc: 'Bądź pierwszy, który podzieli się czymś ze społecznością.',
    loading: 'Ładowanie...',
    createButton: 'Nowy Post',
    createTitle: 'Utwórz Post',
    formTitle: 'Tytuł',
    formMessage: 'Czym chciałbyś się podzielić?',
    formCategory: 'Kategoria',
    formPriority: 'Priorytet',
    formAuthorName: 'Twoje Imię',
    low: 'Niski',
    medium: 'Średni',
    high: 'Pilny',
    cancel: 'Anuluj',
    submit: 'Opublikuj',
    submitting: 'Publikowanie...',
    all: 'Wszystkie',
    event: 'Wydarzenie',
    alert: 'Ostrzeżenie',
    lostFound: 'Zgubione',
    general: 'Ogólne',
    sessionExpired: 'Sesja wygasła. Zeskanuj ponownie kod QR.',
    submitFailed: 'Nie udało się przesłać. Spróbuj ponownie.',
    comments: 'Komentarze',
    noComments: 'Brak komentarzy',
    beFirstComment: 'Rozpocznij rozmowę...',
    writeComment: 'Dodaj komentarz...',
    postComment: 'Opublikuj',
    deleteComment: 'Usuń',
    yourName: 'Twoje imię',
    back: 'Wstecz',
    commentPosted: 'Komentarz opublikowany!',
    commentDeleted: 'Komentarz usunięty',
    commentFailed: 'Nie udało się opublikować.',
    viewComments: 'Zobacz komentarze',
    postedBy: 'Opublikowane przez',
    anonymous: 'Członek Społeczności',
    resident: 'Mieszkaniec',
  },
  es: {
    header: 'Tablón de la Comunidad',
    subtitle: 'Actualizaciones y anuncios importantes',
    noNotices: 'Sin Publicaciones',
    noNoticesDesc: 'Sé el primero en compartir algo con tu comunidad.',
    loading: 'Cargando...',
    createButton: 'Nueva Publicación',
    createTitle: 'Crear Publicación',
    formTitle: 'Título',
    formMessage: '¿Qué te gustaría compartir?',
    formCategory: 'Categoría',
    formPriority: 'Prioridad',
    formAuthorName: 'Tu Nombre',
    low: 'Baja',
    medium: 'Media',
    high: 'Urgente',
    cancel: 'Cancelar',
    submit: 'Publicar',
    submitting: 'Publicando...',
    all: 'Todos',
    event: 'Evento',
    alert: 'Alerta',
    lostFound: 'Perdidos',
    general: 'General',
    sessionExpired: 'Sesión expirada. Escanee su código QR nuevamente.',
    submitFailed: 'No se pudo enviar. Inténtelo de nuevo.',
    comments: 'Comentarios',
    noComments: 'Sin comentarios',
    beFirstComment: 'Inicia la conversación...',
    writeComment: 'Añadir comentario...',
    postComment: 'Publicar',
    deleteComment: 'Eliminar',
    yourName: 'Tu nombre',
    back: 'Volver',
    commentPosted: '¡Comentario publicado!',
    commentDeleted: 'Comentario eliminado',
    commentFailed: 'No se pudo publicar.',
    viewComments: 'Ver comentarios',
    postedBy: 'Publicado por',
    anonymous: 'Miembro de la Comunidad',
    resident: 'Residente',
  },
  ru: {
    header: 'Доска Объявлений',
    subtitle: 'Важные обновления и объявления',
    noNotices: 'Нет Публикаций',
    noNoticesDesc: 'Будьте первым, кто поделится чем-то с сообществом.',
    loading: 'Загрузка...',
    createButton: 'Новый Пост',
    createTitle: 'Создать Публикацию',
    formTitle: 'Заголовок',
    formMessage: 'Чем хотите поделиться?',
    formCategory: 'Категория',
    formPriority: 'Приоритет',
    formAuthorName: 'Ваше Имя',
    low: 'Низкий',
    medium: 'Средний',
    high: 'Срочный',
    cancel: 'Отмена',
    submit: 'Опубликовать',
    submitting: 'Публикация...',
    all: 'Все',
    event: 'Событие',
    alert: 'Предупреждение',
    lostFound: 'Потеряно',
    general: 'Общее',
    sessionExpired: 'Сеанс истек. Отсканируйте QR-код еще раз.',
    submitFailed: 'Не удалось отправить. Попробуйте еще раз.',
    comments: 'Комментарии',
    noComments: 'Нет комментариев',
    beFirstComment: 'Начните разговор...',
    writeComment: 'Добавить комментарий...',
    postComment: 'Опубликовать',
    deleteComment: 'Удалить',
    yourName: 'Ваше имя',
    back: 'Назад',
    commentPosted: 'Комментарий опубликован!',
    commentDeleted: 'Комментарий удален',
    commentFailed: 'Не удалось опубликовать.',
    viewComments: 'Посмотреть комментарии',
    postedBy: 'Опубликовано',
    anonymous: 'Член Сообщества',
    resident: 'Житель',
  },
  pt: {
    header: 'Quadro da Comunidade',
    subtitle: 'Atualizações e anúncios importantes',
    noNotices: 'Sem Publicações',
    noNoticesDesc: 'Seja o primeiro a compartilhar algo com sua comunidade.',
    loading: 'Carregando...',
    createButton: 'Nova Publicação',
    createTitle: 'Criar Publicação',
    formTitle: 'Título',
    formMessage: 'O que você gostaria de compartilhar?',
    formCategory: 'Categoria',
    formPriority: 'Prioridade',
    formAuthorName: 'Seu Nome',
    low: 'Baixa',
    medium: 'Média',
    high: 'Urgente',
    cancel: 'Cancelar',
    submit: 'Publicar',
    submitting: 'Publicando...',
    all: 'Todos',
    event: 'Evento',
    alert: 'Alerta',
    lostFound: 'Perdidos',
    general: 'Geral',
    sessionExpired: 'Sessão expirada. Escaneie seu código QR novamente.',
    submitFailed: 'Falha ao enviar. Tente novamente.',
    comments: 'Comentários',
    noComments: 'Sem comentários',
    beFirstComment: 'Inicie a conversa...',
    writeComment: 'Adicionar comentário...',
    postComment: 'Publicar',
    deleteComment: 'Excluir',
    yourName: 'Seu nome',
    back: 'Voltar',
    commentPosted: 'Comentário publicado!',
    commentDeleted: 'Comentário excluído',
    commentFailed: 'Falha ao publicar.',
    viewComments: 'Ver comentários',
    postedBy: 'Postado por',
    anonymous: 'Membro da Comunidade',
    resident: 'Morador',
  },
  lv: {
    header: 'Kopienas Ziņojumu Dēlis',
    subtitle: 'Svarīgi atjauninājumi un paziņojumi',
    noNotices: 'Nav Ierakstu',
    noNoticesDesc: 'Esi pirmais, kas dalās ar kaut ko kopienā.',
    loading: 'Ielādē...',
    createButton: 'Jauns Ieraksts',
    createTitle: 'Izveidot Ierakstu',
    formTitle: 'Nosaukums',
    formMessage: 'Ko vēlaties dalīties?',
    formCategory: 'Kategorija',
    formPriority: 'Prioritāte',
    formAuthorName: 'Jūsu Vārds',
    low: 'Zema',
    medium: 'Vidēja',
    high: 'Steidzami',
    cancel: 'Atcelt',
    submit: 'Publicēt',
    submitting: 'Publicē...',
    all: 'Visi',
    event: 'Notikums',
    alert: 'Brīdinājums',
    lostFound: 'Pazaudēts',
    general: 'Vispārīgi',
    sessionExpired: 'Sesija beigusies. Lūdzu, skenējiet QR kodu vēlreiz.',
    submitFailed: 'Neizdevās iesniegt. Mēģiniet vēlreiz.',
    comments: 'Komentāri',
    noComments: 'Nav komentāru',
    beFirstComment: 'Sāciet sarunu...',
    writeComment: 'Pievienot komentāru...',
    postComment: 'Publicēt',
    deleteComment: 'Dzēst',
    yourName: 'Jūsu vārds',
    back: 'Atpakaļ',
    commentPosted: 'Komentārs publicēts!',
    commentDeleted: 'Komentārs dzēsts',
    commentFailed: 'Neizdevās publicēt.',
    viewComments: 'Skatīt komentārus',
    postedBy: 'Publicējis',
    anonymous: 'Kopienas Loceklis',
    resident: 'Iedzīvotājs',
  },
  lt: {
    header: 'Bendruomenės Skelbimų Lenta',
    subtitle: 'Svarbūs atnaujinimai ir pranešimai',
    noNotices: 'Nėra Įrašų',
    noNoticesDesc: 'Būkite pirmas, kuris pasidalins kažkuo su bendruomene.',
    loading: 'Įkeliama...',
    createButton: 'Naujas Įrašas',
    createTitle: 'Sukurti Įrašą',
    formTitle: 'Pavadinimas',
    formMessage: 'Kuo norėtumėte pasidalinti?',
    formCategory: 'Kategorija',
    formPriority: 'Prioritetas',
    formAuthorName: 'Jūsų Vardas',
    low: 'Žemas',
    medium: 'Vidutinis',
    high: 'Skubus',
    cancel: 'Atšaukti',
    submit: 'Paskelbti',
    submitting: 'Skelbiama...',
    all: 'Visi',
    event: 'Įvykis',
    alert: 'Įspėjimas',
    lostFound: 'Pamesta',
    general: 'Bendra',
    sessionExpired: 'Sesija pasibaigė. Nuskaitykite QR kodą dar kartą.',
    submitFailed: 'Nepavyko pateikti. Bandykite dar kartą.',
    comments: 'Komentarai',
    noComments: 'Nėra komentarų',
    beFirstComment: 'Pradėkite pokalbį...',
    writeComment: 'Pridėti komentarą...',
    postComment: 'Paskelbti',
    deleteComment: 'Ištrinti',
    yourName: 'Jūsų vardas',
    back: 'Atgal',
    commentPosted: 'Komentaras paskelbtas!',
    commentDeleted: 'Komentaras ištrintas',
    commentFailed: 'Nepavyko paskelbti.',
    viewComments: 'Žiūrėti komentarus',
    postedBy: 'Paskelbė',
    anonymous: 'Bendruomenės Narys',
    resident: 'Gyventojas',
  },
  ro: {
    header: 'Panou Comunitate',
    subtitle: 'Actualizări și anunțuri importante',
    noNotices: 'Fără Postări',
    noNoticesDesc: 'Fii primul care împărtășește ceva cu comunitatea.',
    loading: 'Se încarcă...',
    createButton: 'Postare Nouă',
    createTitle: 'Creează Postare',
    formTitle: 'Titlu',
    formMessage: 'Ce ai vrea să împărtășești?',
    formCategory: 'Categorie',
    formPriority: 'Prioritate',
    formAuthorName: 'Numele Tău',
    low: 'Scăzută',
    medium: 'Medie',
    high: 'Urgent',
    cancel: 'Anulare',
    submit: 'Postează',
    submitting: 'Se postează...',
    all: 'Toate',
    event: 'Eveniment',
    alert: 'Alertă',
    lostFound: 'Pierdut',
    general: 'General',
    sessionExpired: 'Sesiunea a expirat. Scanați codul QR din nou.',
    submitFailed: 'Nu s-a putut trimite. Încercați din nou.',
    comments: 'Comentarii',
    noComments: 'Fără comentarii',
    beFirstComment: 'Începe conversația...',
    writeComment: 'Adaugă comentariu...',
    postComment: 'Postează',
    deleteComment: 'Șterge',
    yourName: 'Numele tău',
    back: 'Înapoi',
    commentPosted: 'Comentariu postat!',
    commentDeleted: 'Comentariu șters',
    commentFailed: 'Nu s-a putut posta.',
    viewComments: 'Vezi comentariile',
    postedBy: 'Postat de',
    anonymous: 'Membru al Comunității',
    resident: 'Rezident',
  },
  ga: {
    header: 'Clár Fógraí Pobail',
    subtitle: 'Nuashonruithe agus fógraí tábhachtacha',
    noNotices: 'Gan Poist Fós',
    noNoticesDesc: 'Bí ar an gcéad duine a roinnfidh rud éigin le do phobal.',
    loading: 'Ag lódáil...',
    createButton: 'Post Nua',
    createTitle: 'Cruthaigh Post',
    formTitle: 'Teideal',
    formMessage: 'Cad ba mhaith leat a roinnt?',
    formCategory: 'Catagóir',
    formPriority: 'Tosaíocht',
    formAuthorName: 'D\'Ainm',
    low: 'Íseal',
    medium: 'Meánach',
    high: 'Práinneach',
    cancel: 'Cealaigh',
    submit: 'Postáil',
    submitting: 'Ag postáil...',
    all: 'Gach rud',
    event: 'Imeacht',
    alert: 'Foláireamh',
    lostFound: 'Caillte & Aimsithe',
    general: 'Ginearálta',
    sessionExpired: 'Tá an seisiún imithe i léig. Scan do chód QR arís.',
    submitFailed: 'Theip ar an seoladh. Bain triail eile as.',
    comments: 'Tuairimí',
    noComments: 'Gan tuairimí fós',
    beFirstComment: 'Tosaigh an comhrá...',
    writeComment: 'Cuir tuairim leis...',
    postComment: 'Postáil',
    deleteComment: 'Scrios',
    yourName: 'D\'ainm',
    back: 'Ar ais',
    commentPosted: 'Tuairim postáilte!',
    commentDeleted: 'Tuairim scriosta',
    commentFailed: 'Theip ar an bpostáil.',
    viewComments: 'Féach ar thuairimí',
    postedBy: 'Postáilte ag',
    anonymous: 'Ball Pobail',
    resident: 'Cónaitheoir',
  }
};

const CATEGORIES = ['all', 'event', 'alert', 'lostFound', 'general'];

function Avatar({ name, size = 'md', isDarkMode }: { name?: string; size?: 'sm' | 'md' | 'lg'; isDarkMode: boolean }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const colors = [
    'from-amber-400 to-orange-500',
    'from-emerald-400 to-teal-500',
    'from-blue-400 to-indigo-500',
    'from-purple-400 to-pink-500',
    'from-rose-400 to-red-500',
  ];
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };
  
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white font-semibold shadow-sm flex-shrink-0`}>
      {initial}
    </div>
  );
}

function CategoryBadge({ category, t, isDarkMode }: { category?: string; t: any; isDarkMode: boolean }) {
  const config: Record<string, { bg: string; text: string; icon: string }> = {
    event: {
      bg: isDarkMode ? 'bg-amber-900/40' : 'bg-amber-50',
      text: isDarkMode ? 'text-amber-300' : 'text-amber-700',
      icon: ''
    },
    alert: {
      bg: isDarkMode ? 'bg-red-900/40' : 'bg-red-50',
      text: isDarkMode ? 'text-red-300' : 'text-red-600',
      icon: ''
    },
    lostFound: {
      bg: isDarkMode ? 'bg-purple-900/40' : 'bg-purple-50',
      text: isDarkMode ? 'text-purple-300' : 'text-purple-600',
      icon: ''
    },
    general: {
      bg: isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100',
      text: isDarkMode ? 'text-gray-300' : 'text-gray-600',
      icon: ''
    },
  };
  
  const { bg, text, icon } = config[category || 'general'] || config.general;
  const label = t[category || 'general'] || t.general;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${bg} ${text}`}>
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function PriorityIndicator({ priority, isDarkMode }: { priority: string; isDarkMode: boolean }) {
  if (priority === 'low') return null;
  
  const isHigh = priority === 'high';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
      isHigh 
        ? isDarkMode ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-600'
        : isDarkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-600'
    }`}>
      {isHigh ? 'Urgent' : 'Important'}
    </span>
  );
}

export default function PurchaserNoticeboardTab({
  unitUid,
  isDarkMode,
  selectedLanguage,
  token: propToken,
}: PurchaserNoticeboardTabProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    category: 'general',
    priority: 'low' as 'low' | 'medium' | 'high'
  });

  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [noticeAuthorName, setNoticeAuthorName] = useState('');
  
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [pendingAction, setPendingAction] = useState<'post' | 'comment' | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // iOS Capacitor-only state - DOES NOT affect web app
  const [isIOSNative, setIsIOSNative] = useState(false);
  const IOS_TAB_BAR_HEIGHT = 72;

  const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;

  // Detect iOS Capacitor native platform - runs once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const cap = (window as any).Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function' && typeof cap.getPlatform === 'function') {
      if (cap.isNativePlatform() && cap.getPlatform() === 'ios') {
        setIsIOSNative(true);
      }
    }
  }, []);

  useEffect(() => {
    if (propToken || getEffectiveToken(unitUid)) {
      fetchNotices();
      checkTermsStatus();
    }
  }, [unitUid, propToken]);

  useEffect(() => {
    if (selectedNotice) {
      fetchComments(selectedNotice.id);
    }
  }, [selectedNotice?.id]);

  const checkTermsStatus = async () => {
    try {
      const cachedTerms = localStorage.getItem(`noticeboard_terms_${unitUid}`);
      if (cachedTerms === 'accepted') {
        setTermsAccepted(true);
        return;
      }

      const token = propToken || getEffectiveToken(unitUid);

      const res = await fetch(
        `/api/purchaser/noticeboard/terms?unitUid=${unitUid}&token=${encodeURIComponent(token)}`
      );
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTermsAccepted(data.termsAccepted);
      }
    } catch (error) {
      console.error('Failed to check terms status:', error);
      setTermsAccepted(false);
    }
  };

  const handleAcceptTerms = async () => {
    setAcceptingTerms(true);
    try {
      const token = propToken || getEffectiveToken(unitUid);

      const res = await fetch(
        `/api/purchaser/noticeboard/terms?unitUid=${unitUid}&token=${encodeURIComponent(token)}`,
        { method: 'POST' }
      );

      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (res.ok) {
        localStorage.setItem(`noticeboard_terms_${unitUid}`, 'accepted');
        setTermsAccepted(true);
        setShowTermsModal(false);
        
        if (pendingAction === 'post') {
          setShowCreateModal(true);
        }
        setPendingAction(null);
      }
    } catch (error) {
      console.error('Failed to accept terms:', error);
    } finally {
      setAcceptingTerms(false);
    }
  };

  const handleCreateClick = () => {
    if (!termsAccepted) {
      setPendingAction('post');
      setShowTermsModal(true);
    } else {
      setShowCreateModal(true);
    }
  };

  const fetchNotices = async () => {
    try {
      const token = propToken || getEffectiveToken(unitUid);

      console.log('[Noticeboard] fetchNotices called', {
        propToken: propToken ? `${propToken.substring(0, 8)}...` : 'undefined',
        effectiveToken: token ? `${token.substring(0, 8)}...` : 'undefined',
        unitUid,
        tokenSource: propToken ? 'prop' : 'storage',
        isAccessCode: /^[A-Z]{2}-\d{3}-[A-Z0-9]{4}$/.test(token || ''),
        isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || ''),
      });

      const res = await fetch(
        `/api/purchaser/noticeboard?unitUid=${unitUid}&token=${encodeURIComponent(token)}`
      );
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setNotices(data.notices || []);
      }
    } catch (error) {
      console.error('Failed to fetch notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (noticeId: string) => {
    setLoadingComments(true);
    try {
      const token = propToken || getEffectiveToken(unitUid);

      const res = await fetch(
        `/api/purchaser/noticeboard/${noticeId}/comments?unitUid=${unitUid}&token=${encodeURIComponent(token)}`
      );
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedNotice) return;

    if (!termsAccepted) {
      setPendingAction('comment');
      setShowTermsModal(true);
      return;
    }

    setSubmittingComment(true);
    try {
      const token = propToken || getEffectiveToken(unitUid);

      const res = await fetch(
        `/api/purchaser/noticeboard/${selectedNotice.id}/comments?unitUid=${unitUid}&token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: commentText.trim(),
            authorName: authorName.trim() || undefined,
            termsAccepted: true,
          }),
        }
      );

      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [data.comment, ...prev]);
        setCommentText('');
      } else {
        alert(t.commentFailed);
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
      alert(t.commentFailed);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const token = propToken || getEffectiveToken(unitUid);
      if (!selectedNotice) return;

      const res = await fetch(
        `/api/purchaser/noticeboard/${selectedNotice.id}/comments?unitUid=${unitUid}&token=${encodeURIComponent(token)}&commentId=${commentId}`,
        { method: 'DELETE' }
      );

      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) return;

    setCreating(true);
    try {
      const token = propToken || getEffectiveToken(unitUid);

      const res = await fetch(`/api/purchaser/noticeboard?unitUid=${unitUid}&token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          message: formData.message,
          category: formData.category,
          priority: formData.priority,
          authorName: noticeAuthorName.trim() || undefined,
          termsAccepted: true
        })
      });

      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      
      const data = await res.json().catch(() => ({}));
      
      if (res.ok) {
        setShowCreateModal(false);
        setFormData({ title: '', message: '', category: 'general', priority: 'low' });
        setNoticeAuthorName('');
        fetchNotices();
      } else {
        console.error('[Noticeboard POST] Server error:', res.status, data);
        const errorMsg = data?.error || t.submitFailed;
        alert(errorMsg);
      }
    } catch (error) {
      console.error('[Noticeboard POST] Network error:', error);
      alert(t.submitFailed);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const filteredNotices = selectedCategory === 'all' 
    ? notices 
    : notices.filter(n => n.category === selectedCategory);

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

  if (selectedNotice) {
    return (
      <div className={`flex flex-col h-full ${bgColor}`}>
        <div className={`${cardBg} border-b ${borderColor} px-4 py-3 sticky top-0 z-10`}>
          <button
            onClick={() => {
              setSelectedNotice(null);
              setComments([]);
              setCommentText('');
            }}
            className={`flex items-center gap-2 ${subtextColor} hover:text-gold-500 transition-colors font-medium`}
          >
            <ChevronLeft className="w-5 h-5" />
            <span>{t.back}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          <div className={`${cardBg} border-b ${borderColor}`}>
            <div className="p-4 sm:p-6">
              <div className="flex items-start gap-3 mb-4">
                <Avatar 
                  name={selectedNotice.author_name || t.anonymous} 
                  size="lg" 
                  isDarkMode={isDarkMode} 
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold ${textColor}`}>
                      {selectedNotice.author_name || t.anonymous}
                    </span>
                    {selectedNotice.author_unit && (
                      <span className={`text-sm ${subtextColor}`}>
                        · Unit {selectedNotice.author_unit}
                      </span>
                    )}
                  </div>
                  <span className={`text-sm ${subtextColor}`}>
                    {formatDate(selectedNotice.created_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <CategoryBadge category={selectedNotice.category} t={t} isDarkMode={isDarkMode} />
                <PriorityIndicator priority={selectedNotice.priority} isDarkMode={isDarkMode} />
              </div>

              <h1 className={`text-xl font-bold ${textColor} mb-3`}>
                {selectedNotice.title}
              </h1>
              
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} whitespace-pre-wrap leading-relaxed`}>
                {selectedNotice.message}
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className={`w-5 h-5 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
              <h2 className={`font-semibold ${textColor}`}>
                {t.comments} ({comments.length})
              </h2>
            </div>

            <div className={`${cardBg} rounded-2xl border ${borderColor} p-4 mb-6`}>
              <div className="flex items-start gap-3">
                <Avatar name={authorName || '?'} size="sm" isDarkMode={isDarkMode} />
                <form onSubmit={handleSubmitComment} className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder={t.yourName}
                    maxLength={50}
                    className={`w-full px-3 py-2 text-sm border ${borderColor} ${isDarkMode ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-50 text-gray-900 placeholder-gray-500'} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-500/50 transition-all`}
                  />
                  <div className="flex gap-2">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={t.writeComment}
                      maxLength={2000}
                      rows={2}
                      className={`flex-1 px-3 py-2 text-sm border ${borderColor} ${isDarkMode ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-50 text-gray-900 placeholder-gray-500'} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none transition-all`}
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim() || submittingComment}
                      className="self-end px-4 py-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-xl font-medium hover:from-gold-600 hover:to-gold-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    >
                      {submittingComment ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {loadingComments ? (
              <div className="flex flex-col items-center py-12">
                <div className={`w-8 h-8 border-3 border-gold-500 border-t-transparent rounded-full animate-spin mb-3`} />
                <span className={subtextColor}>{t.loading}</span>
              </div>
            ) : comments.length === 0 ? (
              <div className={`text-center py-12 ${subtextColor}`}>
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">{t.noComments}</p>
                <p className="text-sm mt-1 opacity-75">{t.beFirstComment}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`${cardBg} rounded-2xl p-4 group`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={comment.author_name} size="sm" isDarkMode={isDarkMode} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm ${textColor}`}>
                              {comment.author_name}
                            </span>
                            {comment.author_unit && (
                              <span className={`text-xs ${subtextColor}`}>
                                · {comment.author_unit}
                              </span>
                            )}
                            <span className={`text-xs ${subtextColor}`}>
                              · {formatDate(comment.created_at)}
                            </span>
                          </div>
                          {comment.unit_id && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 ${isDarkMode ? 'hover:bg-gray-700 text-gray-500 hover:text-red-400' : 'hover:bg-gray-100 text-gray-400 hover:text-red-500'} transition-all`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} whitespace-pre-wrap break-words leading-relaxed`}>
                          {comment.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`flex flex-col h-full ${bgColor} pt-2`}>
        <div className={`${cardBg} border-b ${borderColor} px-4 py-3 overflow-x-auto`}>
          <div className="flex gap-2 min-w-max">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-md'
                    : isDarkMode
                      ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t[cat]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center flex-1 py-12">
            <div className={`w-10 h-10 border-3 border-gold-500 border-t-transparent rounded-full animate-spin mb-4`} />
            <span className={subtextColor}>{t.loading}</span>
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
            <div className={`p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-3xl shadow-lg mb-6`}>
              <Bell className={`w-12 h-12 ${isDarkMode ? 'text-gold-400' : 'text-gold-500'}`} />
            </div>
            <h3 className={`text-xl font-bold ${textColor} mb-2`}>
              {t.noNotices}
            </h3>
            <p className={`${subtextColor} max-w-sm`}>
              {t.noNoticesDesc}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredNotices.map((notice) => (
                  <article
                    key={notice.id}
                    onClick={() => setSelectedNotice(notice)}
                    className={`${cardBg} rounded-xl border ${borderColor} overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg group flex flex-col`}
                  >
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Avatar 
                          name={notice.author_name || t.anonymous} 
                          size="sm"
                          isDarkMode={isDarkMode} 
                        />
                        <div className="flex-1 min-w-0">
                          <span className={`font-medium text-sm ${textColor} truncate block`}>
                            {notice.author_name || t.anonymous}
                          </span>
                          <span className={`text-xs ${subtextColor}`}>
                            {formatDate(notice.created_at)}
                            {notice.author_unit && ` · Unit ${notice.author_unit}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <CategoryBadge category={notice.category} t={t} isDarkMode={isDarkMode} />
                        <PriorityIndicator priority={notice.priority} isDarkMode={isDarkMode} />
                      </div>

                      <h2 className={`text-base font-semibold ${textColor} mb-2 group-hover:text-gold-500 transition-colors line-clamp-2`}>
                        {notice.title}
                      </h2>

                      <p className={`${subtextColor} text-sm line-clamp-3 leading-relaxed flex-1`}>
                        {notice.message}
                      </p>

                      <div className={`flex items-center gap-4 mt-3 pt-3 border-t ${borderColor}`}>
                        <span className={`flex items-center gap-1.5 text-sm ${subtextColor} group-hover:text-gold-500 transition-colors`}>
                          <MessageCircle className="w-4 h-4" />
                          <span>{t.viewComments}</span>
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Floating Action Button - positioned above mobile nav */}
        <div 
          className="fixed left-0 right-0 flex justify-center z-40 pointer-events-none"
          style={{
            bottom: isIOSNative ? IOS_TAB_BAR_HEIGHT + 48 : 96
          }}
        >
          <button
            onClick={handleCreateClick}
            className="pointer-events-auto flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl hover:from-gold-600 hover:to-gold-700 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            {t.createButton}
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className={`${cardBg} w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto`}>
            <div className={`sticky top-0 ${cardBg} border-b ${borderColor} px-5 py-4 flex items-center justify-between`}>
              <h2 className={`text-lg font-bold ${textColor}`}>{t.createTitle}</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="p-5 space-y-4 pb-32 md:pb-5">
              <div>
                <label className={`block text-sm font-medium ${textColor} mb-2`}>
                  {t.formAuthorName}
                </label>
                <input
                  type="text"
                  value={noticeAuthorName}
                  onChange={(e) => setNoticeAuthorName(e.target.value)}
                  maxLength={100}
                  placeholder={t.anonymous}
                  className={`w-full px-4 py-3 border ${borderColor} ${isDarkMode ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-50 text-gray-900 placeholder-gray-500'} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-500/50 transition-all`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${textColor} mb-2`}>
                  {t.formTitle}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={`w-full px-4 py-3 border ${borderColor} ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-500/50 transition-all`}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${textColor} mb-2`}>
                  {t.formMessage}
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={4}
                  className={`w-full px-4 py-3 border ${borderColor} ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none transition-all`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${textColor} mb-2`}>
                    {t.formCategory}
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className={`w-full px-4 py-3 border ${borderColor} ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-500/50 transition-all`}
                  >
                    <option value="general">{t.general}</option>
                    <option value="event">{t.event}</option>
                    <option value="alert">{t.alert}</option>
                    <option value="lostFound">{t.lostFound}</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium ${textColor} mb-2`}>
                    {t.formPriority}
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className={`w-full px-4 py-3 border ${borderColor} ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-500/50 transition-all`}
                  >
                    <option value="low">{t.low}</option>
                    <option value="medium">{t.medium}</option>
                    <option value="high">{t.high}</option>
                  </select>
                </div>
              </div>

              <div className={`flex gap-3 pt-4 sticky bottom-0 ${isDarkMode ? 'bg-gradient-to-t from-gray-800 via-gray-800 to-transparent' : 'bg-gradient-to-t from-white via-white to-transparent'} md:bg-none md:relative -mx-5 px-5 pb-5 md:m-0 md:p-0`}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={`flex-1 px-4 py-3 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} ${textColor} rounded-xl font-medium transition-all`}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={creating || !formData.title.trim() || !formData.message.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-xl font-medium hover:from-gold-600 hover:to-gold-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                >
                  {creating ? t.submitting : t.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <NoticeboardTermsModal
        isOpen={showTermsModal}
        onAccept={handleAcceptTerms}
        onClose={() => {
          setShowTermsModal(false);
          setPendingAction(null);
        }}
        isDarkMode={isDarkMode}
        isSubmitting={acceptingTerms}
      />

      <SessionExpiredModal
        isOpen={sessionExpired}
        isDarkMode={isDarkMode}
        selectedLanguage={selectedLanguage}
      />
    </>
  );
}
