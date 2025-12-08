'use client';

import { useState, useEffect } from 'react';
import { Bell, Calendar, AlertCircle, Plus, X, MessageCircle, Send, Trash2, ChevronLeft } from 'lucide-react';

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
}

const TRANSLATIONS: Record<string, any> = {
  en: {
    header: 'Community Noticeboard',
    subtitle: 'Important updates and announcements',
    noNotices: 'No Notices Yet',
    noNoticesDesc: 'Important announcements and updates from your development will appear here.',
    loading: 'Loading notices...',
    createButton: 'Create Post',
    createTitle: 'Submit a Notice',
    formTitle: 'Title',
    formMessage: 'Message',
    formCategory: 'Category',
    formPriority: 'Priority',
    formAuthorName: 'Your Name (optional)',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    cancel: 'Cancel',
    submit: 'Submit Notice',
    submitting: 'Submitting...',
    all: 'All',
    event: 'Event',
    alert: 'Alert',
    lostFound: 'Lost & Found',
    general: 'General',
    sessionExpired: 'Session expired. Please scan your QR code again.',
    submitFailed: 'Failed to submit notice. Please try again.',
    comments: 'Comments',
    noComments: 'No comments yet',
    beFirstComment: 'Be the first to comment on this post.',
    writeComment: 'Write a comment...',
    postComment: 'Post',
    deleteComment: 'Delete',
    yourName: 'Your name (optional)',
    back: 'Back',
    commentPosted: 'Comment posted!',
    commentDeleted: 'Comment deleted',
    commentFailed: 'Failed to post comment. Please try again.',
    viewComments: 'View comments',
    postedBy: 'Posted by',
  },
  pl: {
    header: 'Tablica Społeczności',
    subtitle: 'Ważne aktualizacje i ogłoszenia',
    noNotices: 'Brak Ogłoszeń',
    noNoticesDesc: 'Ważne ogłoszenia i aktualizacje z Twojego rozwoju pojawią się tutaj.',
    loading: 'Ładowanie ogłoszeń...',
    createButton: 'Utwórz Post',
    createTitle: 'Prześlij Ogłoszenie',
    formTitle: 'Tytuł',
    formMessage: 'Wiadomość',
    formCategory: 'Kategoria',
    formPriority: 'Priorytet',
    formAuthorName: 'Twoje Imię (opcjonalnie)',
    low: 'Niski',
    medium: 'Średni',
    high: 'Wysoki',
    cancel: 'Anuluj',
    submit: 'Prześlij',
    submitting: 'Przesyłanie...',
    all: 'Wszystkie',
    event: 'Wydarzenie',
    alert: 'Ostrzeżenie',
    lostFound: 'Zgubiono i Znaleziono',
    general: 'Ogólne',
    sessionExpired: 'Sesja wygasła. Zeskanuj ponownie kod QR.',
    submitFailed: 'Nie udało się przesłać ogłoszenia. Spróbuj ponownie.',
    comments: 'Komentarze',
    noComments: 'Brak komentarzy',
    beFirstComment: 'Bądź pierwszym, który skomentuje ten post.',
    writeComment: 'Napisz komentarz...',
    postComment: 'Opublikuj',
    deleteComment: 'Usuń',
    yourName: 'Twoje imię (opcjonalnie)',
    back: 'Wstecz',
    commentPosted: 'Komentarz opublikowany!',
    commentDeleted: 'Komentarz usunięty',
    commentFailed: 'Nie udało się opublikować komentarza. Spróbuj ponownie.',
    viewComments: 'Zobacz komentarze',
    postedBy: 'Opublikowane przez',
  },
  es: {
    header: 'Tablón de la Comunidad',
    subtitle: 'Actualizaciones y anuncios importantes',
    noNotices: 'Sin Avisos',
    noNoticesDesc: 'Los anuncios y actualizaciones importantes de su desarrollo aparecerán aquí.',
    loading: 'Cargando avisos...',
    createButton: 'Crear Publicación',
    createTitle: 'Enviar un Aviso',
    formTitle: 'Título',
    formMessage: 'Mensaje',
    formCategory: 'Categoría',
    formPriority: 'Prioridad',
    formAuthorName: 'Tu Nombre (opcional)',
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    cancel: 'Cancelar',
    submit: 'Enviar',
    submitting: 'Enviando...',
    all: 'Todos',
    event: 'Evento',
    alert: 'Alerta',
    lostFound: 'Perdidos y Encontrados',
    general: 'General',
    sessionExpired: 'Sesión expirada. Escanee su código QR nuevamente.',
    submitFailed: 'No se pudo enviar el aviso. Inténtelo de nuevo.',
    comments: 'Comentarios',
    noComments: 'Sin comentarios aún',
    beFirstComment: 'Sé el primero en comentar esta publicación.',
    writeComment: 'Escribe un comentario...',
    postComment: 'Publicar',
    deleteComment: 'Eliminar',
    yourName: 'Tu nombre (opcional)',
    back: 'Volver',
    commentPosted: '¡Comentario publicado!',
    commentDeleted: 'Comentario eliminado',
    commentFailed: 'No se pudo publicar el comentario. Inténtelo de nuevo.',
    viewComments: 'Ver comentarios',
    postedBy: 'Publicado por',
  },
  ru: {
    header: 'Доска Объявлений',
    subtitle: 'Важные обновления и объявления',
    noNotices: 'Пока нет объявлений',
    noNoticesDesc: 'Здесь будут появляться важные объявления и обновления от вашей разработки.',
    loading: 'Загрузка объявлений...',
    createButton: 'Создать Пост',
    createTitle: 'Отправить Объявление',
    formTitle: 'Заголовок',
    formMessage: 'Сообщение',
    formCategory: 'Категория',
    formPriority: 'Приоритет',
    formAuthorName: 'Ваше Имя (необязательно)',
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    cancel: 'Отмена',
    submit: 'Отправить',
    submitting: 'Отправка...',
    all: 'Все',
    event: 'Событие',
    alert: 'Предупреждение',
    lostFound: 'Потеряно и Найдено',
    general: 'Общее',
    sessionExpired: 'Сеанс истек. Отсканируйте QR-код еще раз.',
    submitFailed: 'Не удалось отправить объявление. Попробуйте еще раз.',
    comments: 'Комментарии',
    noComments: 'Комментариев пока нет',
    beFirstComment: 'Будьте первым, кто прокомментирует эту публикацию.',
    writeComment: 'Напишите комментарий...',
    postComment: 'Опубликовать',
    deleteComment: 'Удалить',
    yourName: 'Ваше имя (необязательно)',
    back: 'Назад',
    commentPosted: 'Комментарий опубликован!',
    commentDeleted: 'Комментарий удален',
    commentFailed: 'Не удалось опубликовать комментарий. Попробуйте еще раз.',
    viewComments: 'Посмотреть комментарии',
    postedBy: 'Опубликовано',
  },
  pt: {
    header: 'Quadro da Comunidade',
    subtitle: 'Atualizações e anúncios importantes',
    noNotices: 'Sem Avisos',
    noNoticesDesc: 'Anúncios e atualizações importantes do seu desenvolvimento aparecerão aqui.',
    loading: 'Carregando avisos...',
    createButton: 'Criar Publicação',
    createTitle: 'Enviar um Aviso',
    formTitle: 'Título',
    formMessage: 'Mensagem',
    formCategory: 'Categoria',
    formPriority: 'Prioridade',
    formAuthorName: 'Seu Nome (opcional)',
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    cancel: 'Cancelar',
    submit: 'Enviar',
    submitting: 'Enviando...',
    all: 'Todos',
    event: 'Evento',
    alert: 'Alerta',
    lostFound: 'Perdidos e Achados',
    general: 'Geral',
    sessionExpired: 'Sessão expirada. Escaneie seu código QR novamente.',
    submitFailed: 'Falha ao enviar aviso. Tente novamente.',
    comments: 'Comentários',
    noComments: 'Sem comentários ainda',
    beFirstComment: 'Seja o primeiro a comentar esta publicação.',
    writeComment: 'Escreva um comentário...',
    postComment: 'Publicar',
    deleteComment: 'Excluir',
    yourName: 'Seu nome (opcional)',
    back: 'Voltar',
    commentPosted: 'Comentário publicado!',
    commentDeleted: 'Comentário excluído',
    commentFailed: 'Falha ao publicar comentário. Tente novamente.',
    viewComments: 'Ver comentários',
    postedBy: 'Postado por',
  },
  lv: {
    header: 'Kopienas Ziņojumu Dēlis',
    subtitle: 'Svarīgi atjauninājumi un paziņojumi',
    noNotices: 'Nav Paziņojumu',
    noNoticesDesc: 'Svarīgi paziņojumi un atjauninājumi no jūsu attīstības parādīsies šeit.',
    loading: 'Ielādē paziņojumus...',
    createButton: 'Izveidot Ierakstu',
    createTitle: 'Iesniegt Paziņojumu',
    formTitle: 'Nosaukums',
    formMessage: 'Ziņojums',
    formCategory: 'Kategorija',
    formPriority: 'Prioritāte',
    formAuthorName: 'Jūsu Vārds (nav obligāts)',
    low: 'Zema',
    medium: 'Vidēja',
    high: 'Augsta',
    cancel: 'Atcelt',
    submit: 'Iesniegt',
    submitting: 'Iesniedz...',
    all: 'Visi',
    event: 'Notikums',
    alert: 'Brīdinājums',
    lostFound: 'Pazaudēts un Atrasts',
    general: 'Vispārīgi',
    sessionExpired: 'Sesija beigusies. Lūdzu, skenējiet QR kodu vēlreiz.',
    submitFailed: 'Neizdevās iesniegt paziņojumu. Lūdzu, mēģiniet vēlreiz.',
    comments: 'Komentāri',
    noComments: 'Vēl nav komentāru',
    beFirstComment: 'Esi pirmais, kas komentē šo ierakstu.',
    writeComment: 'Rakstīt komentāru...',
    postComment: 'Publicēt',
    deleteComment: 'Dzēst',
    yourName: 'Jūsu vārds (nav obligāts)',
    back: 'Atpakaļ',
    commentPosted: 'Komentārs publicēts!',
    commentDeleted: 'Komentārs dzēsts',
    commentFailed: 'Neizdevās publicēt komentāru. Mēģiniet vēlreiz.',
    viewComments: 'Skatīt komentārus',
    postedBy: 'Publicējis',
  },
  lt: {
    header: 'Bendruomenės Skelbimų Lenta',
    subtitle: 'Svarbūs atnaujinimai ir pranešimai',
    noNotices: 'Pranešimų nėra',
    noNoticesDesc: 'Svarbūs pranešimai ir atnaujinimai iš jūsų plėtros atsiras čia.',
    loading: 'Įkeliami pranešimai...',
    createButton: 'Kurti įrašą',
    createTitle: 'Pateikti Pranešimą',
    formTitle: 'Pavadinimas',
    formMessage: 'Žinutė',
    formCategory: 'Kategorija',
    formPriority: 'Prioritetas',
    formAuthorName: 'Jūsų Vardas (neprivalu)',
    low: 'Žemas',
    medium: 'Vidutinis',
    high: 'Aukštas',
    cancel: 'Atšaukti',
    submit: 'Pateikti',
    submitting: 'Pateikiama...',
    all: 'Visi',
    event: 'Įvykis',
    alert: 'Įspėjimas',
    lostFound: 'Pamesta ir Rasta',
    general: 'Bendra',
    sessionExpired: 'Sesija pasibaigė. Nuskaitykite QR kodą dar kartą.',
    submitFailed: 'Nepavyko pateikti pranešimo. Bandykite dar kartą.',
    comments: 'Komentarai',
    noComments: 'Komentarų dar nėra',
    beFirstComment: 'Būkite pirmas, kuris pakomentuos šį įrašą.',
    writeComment: 'Parašykite komentarą...',
    postComment: 'Paskelbti',
    deleteComment: 'Ištrinti',
    yourName: 'Jūsų vardas (neprivaloma)',
    back: 'Atgal',
    commentPosted: 'Komentaras paskelbtas!',
    commentDeleted: 'Komentaras ištrintas',
    commentFailed: 'Nepavyko paskelbti komentaro. Bandykite dar kartą.',
    viewComments: 'Žiūrėti komentarus',
    postedBy: 'Paskelbė',
  },
  ro: {
    header: 'Panou Comunitate',
    subtitle: 'Actualizări și anunțuri importante',
    noNotices: 'Fără Anunțuri',
    noNoticesDesc: 'Anunțurile și actualizările importante din dezvoltarea dvs. vor apărea aici.',
    loading: 'Se încarcă anunțurile...',
    createButton: 'Creați Postare',
    createTitle: 'Trimite un Anunț',
    formTitle: 'Titlu',
    formMessage: 'Mesaj',
    formCategory: 'Categorie',
    formPriority: 'Prioritate',
    formAuthorName: 'Numele Tău (opțional)',
    low: 'Scăzută',
    medium: 'Medie',
    high: 'Ridicată',
    cancel: 'Anulare',
    submit: 'Trimite',
    submitting: 'Se trimite...',
    all: 'Toate',
    event: 'Eveniment',
    alert: 'Alertă',
    lostFound: 'Pierdut și Găsit',
    general: 'General',
    sessionExpired: 'Sesiunea a expirat. Vă rugăm să scanați codul QR din nou.',
    submitFailed: 'Nu s-a putut trimite anunțul. Vă rugăm să încercați din nou.',
    comments: 'Comentarii',
    noComments: 'Încă nu există comentarii',
    beFirstComment: 'Fii primul care comentează această postare.',
    writeComment: 'Scrie un comentariu...',
    postComment: 'Postează',
    deleteComment: 'Șterge',
    yourName: 'Numele tău (opțional)',
    back: 'Înapoi',
    commentPosted: 'Comentariu postat!',
    commentDeleted: 'Comentariu șters',
    commentFailed: 'Nu s-a putut posta comentariul. Încercați din nou.',
    viewComments: 'Vezi comentariile',
    postedBy: 'Postat de',
  }
};

const CATEGORIES = ['all', 'event', 'alert', 'lostFound', 'general'];

export default function PurchaserNoticeboardTab({
  unitUid,
  isDarkMode,
  selectedLanguage,
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

  useEffect(() => {
    fetchNotices();
  }, [unitUid]);

  useEffect(() => {
    if (selectedNotice) {
      fetchComments(selectedNotice.id);
    }
  }, [selectedNotice?.id]);

  const fetchNotices = async () => {
    try {
      const token = sessionStorage.getItem(`house_token_${unitUid}`);
      if (!token) {
        console.error('No token found for noticeboard');
        setLoading(false);
        return;
      }

      const res = await fetch(
        `/api/purchaser/noticeboard?unitUid=${unitUid}&token=${encodeURIComponent(token)}`
      );
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
      const token = sessionStorage.getItem(`house_token_${unitUid}`);
      if (!token) return;

      const res = await fetch(
        `/api/purchaser/noticeboard/${noticeId}/comments?unitUid=${unitUid}&token=${encodeURIComponent(token)}`
      );
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

    setSubmittingComment(true);
    try {
      const token = sessionStorage.getItem(`house_token_${unitUid}`);
      if (!token) {
        alert(t.sessionExpired);
        return;
      }

      const res = await fetch(
        `/api/purchaser/noticeboard/${selectedNotice.id}/comments?unitUid=${unitUid}&token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: commentText.trim(),
            authorName: authorName.trim() || undefined,
          }),
        }
      );

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
      const token = sessionStorage.getItem(`house_token_${unitUid}`);
      if (!token || !selectedNotice) return;

      const res = await fetch(
        `/api/purchaser/noticeboard/${selectedNotice.id}/comments?unitUid=${unitUid}&token=${encodeURIComponent(token)}&commentId=${commentId}`,
        { method: 'DELETE' }
      );

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
      const token = sessionStorage.getItem(`house_token_${unitUid}`);
      if (!token) {
        alert(t.sessionExpired);
        return;
      }

      const res = await fetch(`/api/purchaser/noticeboard?unitUid=${unitUid}&token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          message: formData.message,
          category: formData.category,
          priority: formData.priority,
          authorName: noticeAuthorName.trim() || undefined
        })
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData({ title: '', message: '', category: 'general', priority: 'low' });
        setNoticeAuthorName('');
        fetchNotices();
      } else {
        alert(t.submitFailed);
      }
    } catch (error) {
      console.error('Failed to create notice:', error);
      alert(t.submitFailed);
    } finally {
      setCreating(false);
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'event':
        return { barBg: 'bg-gold-500', tagBg: isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-gold-50 text-gold-600', label: t.event };
      case 'alert':
        return { barBg: 'bg-red-500', tagBg: isDarkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-700', label: t.alert };
      case 'lostFound':
        return { barBg: 'bg-purple-500', tagBg: isDarkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-700', label: t.lostFound };
      default:
        return { barBg: 'bg-gray-500', tagBg: isDarkMode ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-200 text-gray-700', label: t.general };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return isDarkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-700';
      case 'medium':
        return isDarkMode ? 'bg-gold-900/30 text-gold-300' : 'bg-gold-100 text-gold-700';
      default:
        return isDarkMode ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(selectedLanguage === 'en' ? 'en-US' : 'en-GB', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatCommentDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;

  const filteredNotices = selectedCategory === 'all' 
    ? notices 
    : notices.filter(n => n.category === selectedCategory);

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  if (selectedNotice) {
    const categoryInfo = getCategoryColor(selectedNotice.category);
    return (
      <div className={`flex flex-col h-full ${bgColor}`}>
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3`}>
          <button
            onClick={() => {
              setSelectedNotice(null);
              setComments([]);
              setCommentText('');
            }}
            className={`flex items-center gap-2 ${subtextColor} hover:text-gold-500 transition-colors`}
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="font-medium">{t.back}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} p-6`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${categoryInfo.tagBg}`}>
                {categoryInfo.label}
              </span>
              {selectedNotice.priority !== 'low' && (
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getPriorityColor(selectedNotice.priority)}`}>
                  {selectedNotice.priority === 'high' ? '🔴 High' : '🟡 Medium'}
                </span>
              )}
            </div>
            <h1 className={`text-2xl font-bold ${textColor} mb-3`}>{selectedNotice.title}</h1>
            <p className={`${subtextColor} mb-4 whitespace-pre-wrap`}>{selectedNotice.message}</p>
            <div className={`flex flex-col gap-2 text-sm`}>
              <div className={`flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <Calendar className="w-4 h-4" />
                <span>{formatDate(selectedNotice.created_at)}</span>
              </div>
              {(selectedNotice.author_name || selectedNotice.author_unit) && (
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <span className="font-medium text-gold-500">{t.postedBy}:</span>
                  <span>{selectedNotice.author_name}</span>
                  {selectedNotice.author_unit && <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>• Unit {selectedNotice.author_unit}</span>}
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className={`w-5 h-5 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
              <h2 className={`text-lg font-semibold ${textColor}`}>
                {t.comments} ({comments.length})
              </h2>
            </div>

            <form onSubmit={handleSubmitComment} className="mb-6">
              <div className="mb-3">
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder={t.yourName}
                  maxLength={50}
                  className={`w-full px-4 py-2 border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500`}
                />
              </div>
              <div className="flex gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t.writeComment}
                  maxLength={2000}
                  rows={2}
                  className={`flex-1 px-4 py-3 border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none`}
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || submittingComment}
                  className="px-4 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-lg font-medium hover:from-gold-600 hover:to-gold-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingComment ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </form>

            {loadingComments ? (
              <div className={`text-center py-8 ${subtextColor}`}>
                <div className="animate-pulse">Loading comments...</div>
              </div>
            ) : comments.length === 0 ? (
              <div className={`text-center py-8 ${subtextColor}`}>
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{t.noComments}</p>
                <p className="text-sm mt-1">{t.beFirstComment}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`${cardBg} border rounded-lg p-4`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`font-medium ${textColor}`}>{comment.author_name}</span>
                          {comment.author_unit && (
                            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              ({comment.author_unit})
                            </span>
                          )}
                          <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            • {formatCommentDate(comment.created_at)}
                          </span>
                        </div>
                        <p className={`${subtextColor} text-sm whitespace-pre-wrap break-words`}>
                          {comment.body}
                        </p>
                      </div>
                      {comment.unit_id && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-red-400' : 'hover:bg-gray-100 text-gray-400 hover:text-red-500'} transition-colors`}
                          title={t.deleteComment}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
      <div className={`flex flex-col h-full ${bgColor}`}>
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3 overflow-x-auto`}>
          <div className="flex gap-2 min-w-max">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-md'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t[cat]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className={`animate-pulse ${subtextColor}`}>{t.loading}</div>
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
            <div className="p-4 bg-gradient-to-br from-gold-100 to-gold-200 rounded-full mb-4">
              <Bell className="w-8 h-8 text-gold-700" />
            </div>
            <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
              {t.noNotices}
            </h3>
            <p className={`${subtextColor} max-w-md text-sm`}>
              {t.noNoticesDesc}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredNotices.map((notice) => {
                  const categoryInfo = getCategoryColor(notice.category);
                  return (
                    <div
                      key={notice.id}
                      onClick={() => setSelectedNotice(notice)}
                      className={`${cardBg} border rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col group cursor-pointer`}
                    >
                      <div className={`h-1 ${categoryInfo.barBg}`} />

                      <div className="p-4 flex flex-col flex-1">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${categoryInfo.tagBg} whitespace-nowrap`}>
                            {categoryInfo.label}
                          </span>
                          {notice.priority !== 'low' && (
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getPriorityColor(notice.priority)} whitespace-nowrap`}>
                              {notice.priority === 'high' ? '🔴 High' : '🟡 Medium'}
                            </span>
                          )}
                        </div>

                        <h3 className={`text-base font-semibold ${textColor} mb-2 line-clamp-2 group-hover:text-gold-500 transition-colors`}>
                          {notice.title}
                        </h3>

                        <p className={`${subtextColor} text-sm mb-4 line-clamp-3 flex-1`}>
                          {notice.message}
                        </p>

                        <div className={`flex items-center justify-between text-xs pt-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDate(notice.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-gold-500">
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{t.viewComments}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-t p-4 flex justify-center`}>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-full font-semibold shadow-lg hover:from-gold-600 hover:to-gold-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            {t.createButton}
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-lg w-full p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${textColor}`}>{t.createTitle}</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${textColor} mb-1`}>
                  {t.formTitle}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={`w-full px-3 py-2 border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500`}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${textColor} mb-1`}>
                  {t.formMessage}
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={4}
                  className={`w-full px-3 py-2 border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500`}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${textColor} mb-1`}>
                  {t.formAuthorName}
                </label>
                <input
                  type="text"
                  value={noticeAuthorName}
                  onChange={(e) => setNoticeAuthorName(e.target.value)}
                  maxLength={100}
                  placeholder="e.g., John Smith"
                  autoComplete="name"
                  className={`w-full px-3 py-2 border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${textColor} mb-1`}>
                    {t.formCategory}
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className={`w-full px-3 py-2 border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500`}
                  >
                    <option value="general">{t.general}</option>
                    <option value="event">{t.event}</option>
                    <option value="alert">{t.alert}</option>
                    <option value="lostFound">{t.lostFound}</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium ${textColor} mb-1`}>
                    {t.formPriority}
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className={`w-full px-3 py-2 border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500`}
                  >
                    <option value="low">{t.low}</option>
                    <option value="medium">{t.medium}</option>
                    <option value="high">{t.high}</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={`flex-1 px-4 py-2 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} ${textColor} rounded-lg font-medium transition-colors`}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-lg font-medium hover:from-gold-600 hover:to-gold-700 transition-all disabled:opacity-50"
                >
                  {creating ? t.submitting : t.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
