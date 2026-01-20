/**
 * Centralized translations for the OpenHouse AI portal
 *
 * All user-facing text should be defined here for easy localization.
 * Components import and use these translations based on selectedLanguage.
 */

export type SupportedLanguage = 'en' | 'pl' | 'es' | 'ru' | 'pt' | 'lv' | 'lt' | 'ro' | 'ga';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'pl', label: 'Polish', nativeLabel: 'Polski' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português' },
  { code: 'lv', label: 'Latvian', nativeLabel: 'Latviešu' },
  { code: 'lt', label: 'Lithuanian', nativeLabel: 'Lietuvių' },
  { code: 'ro', label: 'Romanian', nativeLabel: 'Română' },
  { code: 'ga', label: 'Irish', nativeLabel: 'Gaeilge' },
];

export interface Translations {
  // Common
  common: {
    loading: string;
    error: string;
    retry: string;
    close: string;
    cancel: string;
    confirm: string;
    save: string;
    search: string;
    noResults: string;
    viewAll: string;
    learnMore: string;
    back: string;
    next: string;
    done: string;
    yes: string;
    no: string;
  };

  // Navigation tabs
  navigation: {
    assistant: string;
    documents: string;
    noticeboard: string;
    maps: string;
  };

  // Chat/Assistant tab
  chat: {
    welcome: string;
    subtitle: string;
    tryAsking: string;
    prompts: string[];
    placeholder: string;
    askButton: string;
    powered: string;
    voiceNotSupported: string;
    sessionExpired: string;
    errorOccurred: string;
    copied: string;
    copyMessage: string;
  };

  // Documents tab
  documents: {
    title: string;
    searchPlaceholder: string;
    categories: {
      all: string;
      mustRead: string;
      important: string;
      floorplans: string;
      fireSafety: string;
      parking: string;
      handover: string;
      snagging: string;
      warranties: string;
      specifications: string;
      general: string;
      videos: string;
    };
    noDocuments: string;
    noMatchingDocuments: string;
    tryAdjustingFilters: string;
    loadingDocuments: string;
    downloadDocument: string;
    viewDocument: string;
    mustReadBadge: string;
    importantBadge: string;
    watchVideo: string;
    closeVideo: string;
    loadingVideos: string;
    noVideosAvailable: string;
    noVideosDescription: string;
    handoverVideo: string;
    unableToLoadVideo: string;
    openInBrowser: string;
  };

  // Noticeboard tab
  noticeboard: {
    title: string;
    noNotices: string;
    loadingNotices: string;
    postedOn: string;
    readMore: string;
    termsTitle: string;
    termsAccept: string;
    termsDecline: string;
  };

  // Maps tab
  maps: {
    title: string;
    yourLocation: string;
    searchPlaceholder: string;
    categories: {
      all: string;
      transport: string;
      shopping: string;
      dining: string;
      health: string;
      education: string;
      recreation: string;
    };
    directions: string;
    distance: string;
    walkingTime: string;
    drivingTime: string;
    noPlacesFound: string;
  };

  // Session/Auth
  session: {
    expired: string;
    expiredMessage: string;
    scanAgain: string;
    invalidCode: string;
    codeRequired: string;
  };

  // AI response language instruction
  aiLanguage: {
    instruction: string;
  };
}

const translations: Record<SupportedLanguage, Translations> = {
  en: {
    common: {
      loading: 'Loading...',
      error: 'An error occurred',
      retry: 'Try again',
      close: 'Close',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      search: 'Search',
      noResults: 'No results found',
      viewAll: 'View all',
      learnMore: 'Learn more',
      back: 'Back',
      next: 'Next',
      done: 'Done',
      yes: 'Yes',
      no: 'No',
    },
    navigation: {
      assistant: 'Assistant',
      documents: 'Docs',
      noticeboard: 'Noticeboard',
      maps: 'Maps',
    },
    chat: {
      welcome: 'Your home assistant',
      subtitle: 'Get instant answers about your property, floor plans, local amenities, and more. Just ask!',
      tryAsking: 'Try asking about:',
      prompts: ['Public Transport', 'Floor Plans', 'Parking rules', 'Local area'],
      placeholder: 'Ask about your home or community...',
      askButton: 'Ask',
      powered: 'Powered by AI • Information provided for reference only',
      voiceNotSupported: 'Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.',
      sessionExpired: 'Session expired. Please scan your QR code again.',
      errorOccurred: 'Sorry, I encountered an error. Please try again.',
      copied: 'Copied!',
      copyMessage: 'Copy message',
    },
    documents: {
      title: 'Documents',
      searchPlaceholder: 'Search documents...',
      categories: {
        all: 'All',
        mustRead: 'Must Read',
        important: 'Important',
        floorplans: 'Floorplans',
        fireSafety: 'Fire Safety',
        parking: 'Parking',
        handover: 'Handover',
        snagging: 'Snagging',
        warranties: 'Warranties',
        specifications: 'Specifications',
        general: 'General',
        videos: 'Videos',
      },
      noDocuments: 'No documents available yet',
      noMatchingDocuments: 'No matching documents',
      tryAdjustingFilters: 'Try adjusting your search or filter criteria.',
      loadingDocuments: 'Loading documents...',
      downloadDocument: 'Download',
      viewDocument: 'View',
      mustReadBadge: 'Must Read',
      importantBadge: 'Important',
      watchVideo: 'Watch',
      closeVideo: 'Close video',
      loadingVideos: 'Loading videos...',
      noVideosAvailable: 'No Videos Available',
      noVideosDescription: 'There are no handover videos available for your property yet.',
      handoverVideo: 'Handover Video',
      unableToLoadVideo: 'Unable to load video',
      openInBrowser: 'Open in Browser',
    },
    noticeboard: {
      title: 'Noticeboard',
      noNotices: 'No notices at the moment',
      loadingNotices: 'Loading notices...',
      postedOn: 'Posted on',
      readMore: 'Read more',
      termsTitle: 'Terms & Conditions',
      termsAccept: 'I Accept',
      termsDecline: 'Decline',
    },
    maps: {
      title: 'Local Area',
      yourLocation: 'Your home',
      searchPlaceholder: 'Search nearby places...',
      categories: {
        all: 'All',
        transport: 'Transport',
        shopping: 'Shopping',
        dining: 'Dining',
        health: 'Health',
        education: 'Education',
        recreation: 'Recreation',
      },
      directions: 'Get directions',
      distance: 'Distance',
      walkingTime: 'Walking',
      drivingTime: 'Driving',
      noPlacesFound: 'No places found nearby',
    },
    session: {
      expired: 'Session Expired',
      expiredMessage: 'Your session has expired. Please scan your QR code again to continue.',
      scanAgain: 'Scan QR Code',
      invalidCode: 'Invalid code. Please check and try again.',
      codeRequired: 'Please enter your access code',
    },
    aiLanguage: {
      instruction: 'Respond in English.',
    },
  },

  pl: {
    common: {
      loading: 'Ładowanie...',
      error: 'Wystąpił błąd',
      retry: 'Spróbuj ponownie',
      close: 'Zamknij',
      cancel: 'Anuluj',
      confirm: 'Potwierdź',
      save: 'Zapisz',
      search: 'Szukaj',
      noResults: 'Nie znaleziono wyników',
      viewAll: 'Zobacz wszystko',
      learnMore: 'Dowiedz się więcej',
      back: 'Wstecz',
      next: 'Dalej',
      done: 'Gotowe',
      yes: 'Tak',
      no: 'Nie',
    },
    navigation: {
      assistant: 'Asystent',
      documents: 'Dokumenty',
      noticeboard: 'Ogłoszenia',
      maps: 'Mapy',
    },
    chat: {
      welcome: 'Twój asystent domowy',
      subtitle: 'Uzyskaj natychmiastowe odpowiedzi na temat swojej nieruchomości, planów pięter, lokalnych udogodnień i więcej. Po prostu zapytaj!',
      tryAsking: 'Spróbuj zapytać o:',
      prompts: ['Transport publiczny', 'Plany pięter', 'Zasady parkowania', 'Okolica'],
      placeholder: 'Zapytaj o swój dom lub społeczność...',
      askButton: 'Zapytaj',
      powered: 'Zasilane przez AI • Informacje wyłącznie w celach informacyjnych',
      voiceNotSupported: 'Wprowadzanie głosowe nie jest obsługiwane w Twojej przeglądarce. Użyj Chrome, Edge lub Safari.',
      sessionExpired: 'Sesja wygasła. Zeskanuj ponownie kod QR.',
      errorOccurred: 'Przepraszamy, wystąpił błąd. Spróbuj ponownie.',
      copied: 'Skopiowano!',
      copyMessage: 'Kopiuj wiadomość',
    },
    documents: {
      title: 'Dokumenty',
      searchPlaceholder: 'Szukaj dokumentów...',
      categories: {
        all: 'Wszystko',
        mustRead: 'Do przeczytania',
        important: 'Ważne',
        floorplans: 'Plany pięter',
        fireSafety: 'Bezpieczeństwo pożarowe',
        parking: 'Parking',
        handover: 'Przekazanie',
        snagging: 'Usterki',
        warranties: 'Gwarancje',
        specifications: 'Specyfikacje',
        general: 'Ogólne',
        videos: 'Filmy',
      },
      noDocuments: 'Brak dostępnych dokumentów',
      noMatchingDocuments: 'Brak pasujących dokumentów',
      tryAdjustingFilters: 'Spróbuj dostosować kryteria wyszukiwania lub filtrowania.',
      loadingDocuments: 'Ładowanie dokumentów...',
      downloadDocument: 'Pobierz',
      viewDocument: 'Zobacz',
      mustReadBadge: 'Do przeczytania',
      importantBadge: 'Ważne',
      watchVideo: 'Oglądaj',
      closeVideo: 'Zamknij wideo',
      loadingVideos: 'Ładowanie filmów...',
      noVideosAvailable: 'Brak dostępnych filmów',
      noVideosDescription: 'Nie ma jeszcze filmów przekazania dla Twojej nieruchomości.',
      handoverVideo: 'Film przekazania',
      unableToLoadVideo: 'Nie można załadować filmu',
      openInBrowser: 'Otwórz w przeglądarce',
    },
    noticeboard: {
      title: 'Ogłoszenia',
      noNotices: 'Brak ogłoszeń w tej chwili',
      loadingNotices: 'Ładowanie ogłoszeń...',
      postedOn: 'Opublikowano',
      readMore: 'Czytaj więcej',
      termsTitle: 'Regulamin',
      termsAccept: 'Akceptuję',
      termsDecline: 'Odrzuć',
    },
    maps: {
      title: 'Okolica',
      yourLocation: 'Twój dom',
      searchPlaceholder: 'Szukaj miejsc w pobliżu...',
      categories: {
        all: 'Wszystko',
        transport: 'Transport',
        shopping: 'Zakupy',
        dining: 'Restauracje',
        health: 'Zdrowie',
        education: 'Edukacja',
        recreation: 'Rekreacja',
      },
      directions: 'Pokaż trasę',
      distance: 'Odległość',
      walkingTime: 'Pieszo',
      drivingTime: 'Samochodem',
      noPlacesFound: 'Nie znaleziono miejsc w pobliżu',
    },
    session: {
      expired: 'Sesja wygasła',
      expiredMessage: 'Twoja sesja wygasła. Zeskanuj ponownie kod QR, aby kontynuować.',
      scanAgain: 'Zeskanuj kod QR',
      invalidCode: 'Nieprawidłowy kod. Sprawdź i spróbuj ponownie.',
      codeRequired: 'Wprowadź swój kod dostępu',
    },
    aiLanguage: {
      instruction: 'Odpowiadaj po polsku.',
    },
  },

  es: {
    common: {
      loading: 'Cargando...',
      error: 'Se produjo un error',
      retry: 'Intentar de nuevo',
      close: 'Cerrar',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      save: 'Guardar',
      search: 'Buscar',
      noResults: 'No se encontraron resultados',
      viewAll: 'Ver todo',
      learnMore: 'Más información',
      back: 'Atrás',
      next: 'Siguiente',
      done: 'Hecho',
      yes: 'Sí',
      no: 'No',
    },
    navigation: {
      assistant: 'Asistente',
      documents: 'Documentos',
      noticeboard: 'Tablón',
      maps: 'Mapas',
    },
    chat: {
      welcome: 'Tu asistente del hogar',
      subtitle: 'Obtén respuestas instantáneas sobre tu propiedad, planos, servicios locales y más. ¡Solo pregunta!',
      tryAsking: 'Prueba a preguntar sobre:',
      prompts: ['Transporte público', 'Planos', 'Normas de aparcamiento', 'Zona local'],
      placeholder: 'Pregunta sobre tu hogar o comunidad...',
      askButton: 'Preguntar',
      powered: 'Con tecnología de IA • Información solo como referencia',
      voiceNotSupported: 'La entrada de voz no es compatible con tu navegador. Usa Chrome, Edge o Safari.',
      sessionExpired: 'Sesión expirada. Escanea tu código QR de nuevo.',
      errorOccurred: 'Lo siento, ocurrió un error. Inténtalo de nuevo.',
      copied: '¡Copiado!',
      copyMessage: 'Copiar mensaje',
    },
    documents: {
      title: 'Documentos',
      searchPlaceholder: 'Buscar documentos...',
      categories: {
        all: 'Todo',
        mustRead: 'Obligatorio',
        important: 'Importante',
        floorplans: 'Planos',
        fireSafety: 'Seguridad contra incendios',
        parking: 'Aparcamiento',
        handover: 'Entrega',
        snagging: 'Defectos',
        warranties: 'Garantías',
        specifications: 'Especificaciones',
        general: 'General',
        videos: 'Vídeos',
      },
      noDocuments: 'No hay documentos disponibles',
      noMatchingDocuments: 'No hay documentos coincidentes',
      tryAdjustingFilters: 'Intenta ajustar los criterios de búsqueda o filtrado.',
      loadingDocuments: 'Cargando documentos...',
      downloadDocument: 'Descargar',
      viewDocument: 'Ver',
      mustReadBadge: 'Obligatorio',
      importantBadge: 'Importante',
      watchVideo: 'Ver',
      closeVideo: 'Cerrar vídeo',
      loadingVideos: 'Cargando vídeos...',
      noVideosAvailable: 'No hay vídeos disponibles',
      noVideosDescription: 'Aún no hay vídeos de entrega disponibles para tu propiedad.',
      handoverVideo: 'Vídeo de entrega',
      unableToLoadVideo: 'No se puede cargar el vídeo',
      openInBrowser: 'Abrir en navegador',
    },
    noticeboard: {
      title: 'Tablón de anuncios',
      noNotices: 'No hay avisos en este momento',
      loadingNotices: 'Cargando avisos...',
      postedOn: 'Publicado el',
      readMore: 'Leer más',
      termsTitle: 'Términos y condiciones',
      termsAccept: 'Acepto',
      termsDecline: 'Rechazar',
    },
    maps: {
      title: 'Zona local',
      yourLocation: 'Tu hogar',
      searchPlaceholder: 'Buscar lugares cercanos...',
      categories: {
        all: 'Todo',
        transport: 'Transporte',
        shopping: 'Compras',
        dining: 'Restaurantes',
        health: 'Salud',
        education: 'Educación',
        recreation: 'Ocio',
      },
      directions: 'Cómo llegar',
      distance: 'Distancia',
      walkingTime: 'A pie',
      drivingTime: 'En coche',
      noPlacesFound: 'No se encontraron lugares cercanos',
    },
    session: {
      expired: 'Sesión expirada',
      expiredMessage: 'Tu sesión ha expirado. Escanea tu código QR de nuevo para continuar.',
      scanAgain: 'Escanear código QR',
      invalidCode: 'Código inválido. Comprueba e inténtalo de nuevo.',
      codeRequired: 'Introduce tu código de acceso',
    },
    aiLanguage: {
      instruction: 'Responde en español.',
    },
  },

  ru: {
    common: {
      loading: 'Загрузка...',
      error: 'Произошла ошибка',
      retry: 'Попробовать снова',
      close: 'Закрыть',
      cancel: 'Отмена',
      confirm: 'Подтвердить',
      save: 'Сохранить',
      search: 'Поиск',
      noResults: 'Результатов не найдено',
      viewAll: 'Показать все',
      learnMore: 'Узнать больше',
      back: 'Назад',
      next: 'Далее',
      done: 'Готово',
      yes: 'Да',
      no: 'Нет',
    },
    navigation: {
      assistant: 'Ассистент',
      documents: 'Документы',
      noticeboard: 'Объявления',
      maps: 'Карты',
    },
    chat: {
      welcome: 'Ваш домашний ассистент',
      subtitle: 'Получите мгновенные ответы о вашей недвижимости, планировках, местных удобствах и многом другом. Просто спросите!',
      tryAsking: 'Попробуйте спросить о:',
      prompts: ['Общественный транспорт', 'Планировки', 'Правила парковки', 'Местность'],
      placeholder: 'Спросите о вашем доме или районе...',
      askButton: 'Спросить',
      powered: 'На базе ИИ • Информация только для справки',
      voiceNotSupported: 'Голосовой ввод не поддерживается в вашем браузере. Используйте Chrome, Edge или Safari.',
      sessionExpired: 'Сеанс истек. Отсканируйте QR-код еще раз.',
      errorOccurred: 'Извините, произошла ошибка. Попробуйте еще раз.',
      copied: 'Скопировано!',
      copyMessage: 'Копировать сообщение',
    },
    documents: {
      title: 'Документы',
      searchPlaceholder: 'Поиск документов...',
      categories: {
        all: 'Все',
        mustRead: 'Обязательно',
        important: 'Важное',
        floorplans: 'Планировки',
        fireSafety: 'Пожарная безопасность',
        parking: 'Парковка',
        handover: 'Передача',
        snagging: 'Дефекты',
        warranties: 'Гарантии',
        specifications: 'Спецификации',
        general: 'Общее',
        videos: 'Видео',
      },
      noDocuments: 'Документы пока недоступны',
      noMatchingDocuments: 'Документы не найдены',
      tryAdjustingFilters: 'Попробуйте изменить критерии поиска или фильтрации.',
      loadingDocuments: 'Загрузка документов...',
      downloadDocument: 'Скачать',
      viewDocument: 'Просмотр',
      mustReadBadge: 'Обязательно',
      importantBadge: 'Важное',
      watchVideo: 'Смотреть',
      closeVideo: 'Закрыть видео',
      loadingVideos: 'Загрузка видео...',
      noVideosAvailable: 'Видео недоступны',
      noVideosDescription: 'Для вашей недвижимости пока нет видео о передаче.',
      handoverVideo: 'Видео передачи',
      unableToLoadVideo: 'Не удалось загрузить видео',
      openInBrowser: 'Открыть в браузере',
    },
    noticeboard: {
      title: 'Объявления',
      noNotices: 'Пока нет объявлений',
      loadingNotices: 'Загрузка объявлений...',
      postedOn: 'Опубликовано',
      readMore: 'Читать далее',
      termsTitle: 'Условия использования',
      termsAccept: 'Принимаю',
      termsDecline: 'Отклонить',
    },
    maps: {
      title: 'Местность',
      yourLocation: 'Ваш дом',
      searchPlaceholder: 'Поиск мест поблизости...',
      categories: {
        all: 'Все',
        transport: 'Транспорт',
        shopping: 'Покупки',
        dining: 'Рестораны',
        health: 'Здоровье',
        education: 'Образование',
        recreation: 'Отдых',
      },
      directions: 'Маршрут',
      distance: 'Расстояние',
      walkingTime: 'Пешком',
      drivingTime: 'На машине',
      noPlacesFound: 'Места поблизости не найдены',
    },
    session: {
      expired: 'Сеанс истек',
      expiredMessage: 'Ваш сеанс истек. Отсканируйте QR-код еще раз, чтобы продолжить.',
      scanAgain: 'Сканировать QR-код',
      invalidCode: 'Неверный код. Проверьте и попробуйте снова.',
      codeRequired: 'Введите код доступа',
    },
    aiLanguage: {
      instruction: 'Отвечай на русском языке.',
    },
  },

  pt: {
    common: {
      loading: 'Carregando...',
      error: 'Ocorreu um erro',
      retry: 'Tentar novamente',
      close: 'Fechar',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      save: 'Salvar',
      search: 'Pesquisar',
      noResults: 'Nenhum resultado encontrado',
      viewAll: 'Ver tudo',
      learnMore: 'Saiba mais',
      back: 'Voltar',
      next: 'Próximo',
      done: 'Concluído',
      yes: 'Sim',
      no: 'Não',
    },
    navigation: {
      assistant: 'Assistente',
      documents: 'Documentos',
      noticeboard: 'Avisos',
      maps: 'Mapas',
    },
    chat: {
      welcome: 'Seu assistente residencial',
      subtitle: 'Obtenha respostas instantâneas sobre sua propriedade, plantas, serviços locais e muito mais. É só perguntar!',
      tryAsking: 'Experimente perguntar sobre:',
      prompts: ['Transporte público', 'Plantas', 'Regras de estacionamento', 'Área local'],
      placeholder: 'Pergunte sobre sua casa ou comunidade...',
      askButton: 'Perguntar',
      powered: 'Alimentado por IA • Informação apenas para referência',
      voiceNotSupported: 'A entrada de voz não é compatível com o seu navegador. Use Chrome, Edge ou Safari.',
      sessionExpired: 'Sessão expirada. Escaneie seu código QR novamente.',
      errorOccurred: 'Desculpe, ocorreu um erro. Tente novamente.',
      copied: 'Copiado!',
      copyMessage: 'Copiar mensagem',
    },
    documents: {
      title: 'Documentos',
      searchPlaceholder: 'Pesquisar documentos...',
      categories: {
        all: 'Todos',
        mustRead: 'Obrigatório',
        important: 'Importante',
        floorplans: 'Plantas',
        fireSafety: 'Segurança contra incêndio',
        parking: 'Estacionamento',
        handover: 'Entrega',
        snagging: 'Defeitos',
        warranties: 'Garantias',
        specifications: 'Especificações',
        general: 'Geral',
        videos: 'Vídeos',
      },
      noDocuments: 'Nenhum documento disponível ainda',
      noMatchingDocuments: 'Nenhum documento encontrado',
      tryAdjustingFilters: 'Tente ajustar os critérios de pesquisa ou filtragem.',
      loadingDocuments: 'Carregando documentos...',
      downloadDocument: 'Baixar',
      viewDocument: 'Ver',
      mustReadBadge: 'Obrigatório',
      importantBadge: 'Importante',
      watchVideo: 'Assistir',
      closeVideo: 'Fechar vídeo',
      loadingVideos: 'Carregando vídeos...',
      noVideosAvailable: 'Nenhum vídeo disponível',
      noVideosDescription: 'Ainda não há vídeos de entrega disponíveis para sua propriedade.',
      handoverVideo: 'Vídeo de entrega',
      unableToLoadVideo: 'Não foi possível carregar o vídeo',
      openInBrowser: 'Abrir no navegador',
    },
    noticeboard: {
      title: 'Avisos',
      noNotices: 'Nenhum aviso no momento',
      loadingNotices: 'Carregando avisos...',
      postedOn: 'Publicado em',
      readMore: 'Ler mais',
      termsTitle: 'Termos e Condições',
      termsAccept: 'Aceito',
      termsDecline: 'Recusar',
    },
    maps: {
      title: 'Área local',
      yourLocation: 'Sua casa',
      searchPlaceholder: 'Pesquisar lugares próximos...',
      categories: {
        all: 'Todos',
        transport: 'Transporte',
        shopping: 'Compras',
        dining: 'Restaurantes',
        health: 'Saúde',
        education: 'Educação',
        recreation: 'Lazer',
      },
      directions: 'Como chegar',
      distance: 'Distância',
      walkingTime: 'A pé',
      drivingTime: 'De carro',
      noPlacesFound: 'Nenhum lugar encontrado nas proximidades',
    },
    session: {
      expired: 'Sessão expirada',
      expiredMessage: 'Sua sessão expirou. Escaneie seu código QR novamente para continuar.',
      scanAgain: 'Escanear código QR',
      invalidCode: 'Código inválido. Verifique e tente novamente.',
      codeRequired: 'Digite seu código de acesso',
    },
    aiLanguage: {
      instruction: 'Responda em português.',
    },
  },

  lv: {
    common: {
      loading: 'Ielādē...',
      error: 'Radās kļūda',
      retry: 'Mēģināt vēlreiz',
      close: 'Aizvērt',
      cancel: 'Atcelt',
      confirm: 'Apstiprināt',
      save: 'Saglabāt',
      search: 'Meklēt',
      noResults: 'Nav rezultātu',
      viewAll: 'Skatīt visu',
      learnMore: 'Uzzināt vairāk',
      back: 'Atpakaļ',
      next: 'Tālāk',
      done: 'Gatavs',
      yes: 'Jā',
      no: 'Nē',
    },
    navigation: {
      assistant: 'Asistents',
      documents: 'Dokumenti',
      noticeboard: 'Ziņojumu dēlis',
      maps: 'Kartes',
    },
    chat: {
      welcome: 'Jūsu mājas asistents',
      subtitle: 'Saņemiet tūlītējas atbildes par jūsu īpašumu, stāvu plāniem, vietējām ērtībām un daudz ko citu. Vienkārši jautājiet!',
      tryAsking: 'Mēģiniet jautāt par:',
      prompts: ['Sabiedriskais transports', 'Stāvu plāni', 'Stāvvietas noteikumi', 'Apkārtne'],
      placeholder: 'Jautājiet par savu māju vai kopienu...',
      askButton: 'Jautāt',
      powered: 'Darbina AI • Informācija tikai uzziņai',
      voiceNotSupported: 'Jūsu pārlūkprogramma neatbalsta balss ievadi. Lūdzu, izmantojiet Chrome, Edge vai Safari.',
      sessionExpired: 'Sesija beigusies. Lūdzu, skenējiet QR kodu vēlreiz.',
      errorOccurred: 'Atvainojiet, radās kļūda. Lūdzu, mēģiniet vēlreiz.',
      copied: 'Nokopēts!',
      copyMessage: 'Kopēt ziņojumu',
    },
    documents: {
      title: 'Dokumenti',
      searchPlaceholder: 'Meklēt dokumentus...',
      categories: {
        all: 'Visi',
        mustRead: 'Jāizlasa',
        important: 'Svarīgi',
        floorplans: 'Stāvu plāni',
        fireSafety: 'Ugunsdrošība',
        parking: 'Stāvvieta',
        handover: 'Nodošana',
        snagging: 'Defekti',
        warranties: 'Garantijas',
        specifications: 'Specifikācijas',
        general: 'Vispārīgi',
        videos: 'Video',
      },
      noDocuments: 'Dokumenti vēl nav pieejami',
      noMatchingDocuments: 'Dokumenti nav atrasti',
      tryAdjustingFilters: 'Mēģiniet pielāgot meklēšanas vai filtrēšanas kritērijus.',
      loadingDocuments: 'Ielādē dokumentus...',
      downloadDocument: 'Lejupielādēt',
      viewDocument: 'Skatīt',
      mustReadBadge: 'Jāizlasa',
      importantBadge: 'Svarīgi',
      watchVideo: 'Skatīties',
      closeVideo: 'Aizvērt video',
      loadingVideos: 'Ielādē video...',
      noVideosAvailable: 'Video nav pieejami',
      noVideosDescription: 'Jūsu īpašumam vēl nav pieejami nodošanas video.',
      handoverVideo: 'Nodošanas video',
      unableToLoadVideo: 'Nevar ielādēt video',
      openInBrowser: 'Atvērt pārlūkā',
    },
    noticeboard: {
      title: 'Ziņojumu dēlis',
      noNotices: 'Pašlaik nav paziņojumu',
      loadingNotices: 'Ielādē paziņojumus...',
      postedOn: 'Publicēts',
      readMore: 'Lasīt vairāk',
      termsTitle: 'Noteikumi un nosacījumi',
      termsAccept: 'Piekrītu',
      termsDecline: 'Noraidīt',
    },
    maps: {
      title: 'Apkārtne',
      yourLocation: 'Jūsu mājas',
      searchPlaceholder: 'Meklēt tuvumā...',
      categories: {
        all: 'Visi',
        transport: 'Transports',
        shopping: 'Iepirkšanās',
        dining: 'Restorāni',
        health: 'Veselība',
        education: 'Izglītība',
        recreation: 'Atpūta',
      },
      directions: 'Norādes',
      distance: 'Attālums',
      walkingTime: 'Kājām',
      drivingTime: 'Ar auto',
      noPlacesFound: 'Tuvumā nav atrasts nekas',
    },
    session: {
      expired: 'Sesija beigusies',
      expiredMessage: 'Jūsu sesija ir beigusies. Lūdzu, skenējiet QR kodu vēlreiz, lai turpinātu.',
      scanAgain: 'Skenēt QR kodu',
      invalidCode: 'Nederīgs kods. Pārbaudiet un mēģiniet vēlreiz.',
      codeRequired: 'Ievadiet piekļuves kodu',
    },
    aiLanguage: {
      instruction: 'Atbildi latviešu valodā.',
    },
  },

  lt: {
    common: {
      loading: 'Kraunama...',
      error: 'Įvyko klaida',
      retry: 'Bandyti dar kartą',
      close: 'Uždaryti',
      cancel: 'Atšaukti',
      confirm: 'Patvirtinti',
      save: 'Išsaugoti',
      search: 'Ieškoti',
      noResults: 'Rezultatų nerasta',
      viewAll: 'Peržiūrėti viską',
      learnMore: 'Sužinoti daugiau',
      back: 'Atgal',
      next: 'Toliau',
      done: 'Atlikta',
      yes: 'Taip',
      no: 'Ne',
    },
    navigation: {
      assistant: 'Asistentas',
      documents: 'Dokumentai',
      noticeboard: 'Skelbimų lenta',
      maps: 'Žemėlapiai',
    },
    chat: {
      welcome: 'Jūsų namų asistentas',
      subtitle: 'Gaukite greitus atsakymus apie savo nuosavybę, aukštų planus, vietines patogumus ir dar daugiau. Tiesiog paklauskite!',
      tryAsking: 'Pabandykite paklausti apie:',
      prompts: ['Viešasis transportas', 'Aukštų planai', 'Parkavimo taisyklės', 'Apylinkės'],
      placeholder: 'Klauskite apie savo namus ar bendruomenę...',
      askButton: 'Klausti',
      powered: 'Veikia su AI • Informacija tik orientacinė',
      voiceNotSupported: 'Jūsų naršyklė nepalaiko balso įvesties. Naudokite Chrome, Edge arba Safari.',
      sessionExpired: 'Sesija baigėsi. Nuskaitykite QR kodą dar kartą.',
      errorOccurred: 'Atsiprašome, įvyko klaida. Bandykite dar kartą.',
      copied: 'Nukopijuota!',
      copyMessage: 'Kopijuoti pranešimą',
    },
    documents: {
      title: 'Dokumentai',
      searchPlaceholder: 'Ieškoti dokumentų...',
      categories: {
        all: 'Visi',
        mustRead: 'Būtina perskaityti',
        important: 'Svarbu',
        floorplans: 'Aukštų planai',
        fireSafety: 'Priešgaisrinė sauga',
        parking: 'Parkavimas',
        handover: 'Perdavimas',
        snagging: 'Defektai',
        warranties: 'Garantijos',
        specifications: 'Specifikacijos',
        general: 'Bendra',
        videos: 'Vaizdo įrašai',
      },
      noDocuments: 'Dokumentų dar nėra',
      noMatchingDocuments: 'Dokumentų nerasta',
      tryAdjustingFilters: 'Pabandykite pakeisti paieškos ar filtravimo kriterijus.',
      loadingDocuments: 'Kraunami dokumentai...',
      downloadDocument: 'Atsisiųsti',
      viewDocument: 'Peržiūrėti',
      mustReadBadge: 'Būtina perskaityti',
      importantBadge: 'Svarbu',
      watchVideo: 'Žiūrėti',
      closeVideo: 'Uždaryti vaizdo įrašą',
      loadingVideos: 'Kraunami vaizdo įrašai...',
      noVideosAvailable: 'Vaizdo įrašų nėra',
      noVideosDescription: 'Jūsų nuosavybei dar nėra perdavimo vaizdo įrašų.',
      handoverVideo: 'Perdavimo vaizdo įrašas',
      unableToLoadVideo: 'Nepavyko įkelti vaizdo įrašo',
      openInBrowser: 'Atidaryti naršyklėje',
    },
    noticeboard: {
      title: 'Skelbimų lenta',
      noNotices: 'Šiuo metu pranešimų nėra',
      loadingNotices: 'Kraunami pranešimai...',
      postedOn: 'Paskelbta',
      readMore: 'Skaityti daugiau',
      termsTitle: 'Sąlygos',
      termsAccept: 'Sutinku',
      termsDecline: 'Atmesti',
    },
    maps: {
      title: 'Apylinkės',
      yourLocation: 'Jūsų namai',
      searchPlaceholder: 'Ieškoti netoliese...',
      categories: {
        all: 'Visi',
        transport: 'Transportas',
        shopping: 'Parduotuvės',
        dining: 'Restoranai',
        health: 'Sveikata',
        education: 'Švietimas',
        recreation: 'Pramogos',
      },
      directions: 'Maršrutas',
      distance: 'Atstumas',
      walkingTime: 'Pėsčiomis',
      drivingTime: 'Automobiliu',
      noPlacesFound: 'Netoliese vietų nerasta',
    },
    session: {
      expired: 'Sesija baigėsi',
      expiredMessage: 'Jūsų sesija baigėsi. Nuskaitykite QR kodą dar kartą, kad tęstumėte.',
      scanAgain: 'Nuskaityti QR kodą',
      invalidCode: 'Neteisingas kodas. Patikrinkite ir bandykite dar kartą.',
      codeRequired: 'Įveskite prieigos kodą',
    },
    aiLanguage: {
      instruction: 'Atsakyk lietuvių kalba.',
    },
  },

  ro: {
    common: {
      loading: 'Se încarcă...',
      error: 'A apărut o eroare',
      retry: 'Încearcă din nou',
      close: 'Închide',
      cancel: 'Anulează',
      confirm: 'Confirmă',
      save: 'Salvează',
      search: 'Caută',
      noResults: 'Nu s-au găsit rezultate',
      viewAll: 'Vezi tot',
      learnMore: 'Află mai multe',
      back: 'Înapoi',
      next: 'Următorul',
      done: 'Gata',
      yes: 'Da',
      no: 'Nu',
    },
    navigation: {
      assistant: 'Asistent',
      documents: 'Documente',
      noticeboard: 'Anunțuri',
      maps: 'Hărți',
    },
    chat: {
      welcome: 'Asistentul tău pentru locuință',
      subtitle: 'Obține răspunsuri instantanee despre proprietatea ta, planuri de etaj, facilități locale și multe altele. Întreabă!',
      tryAsking: 'Încearcă să întrebi despre:',
      prompts: ['Transport public', 'Planuri de etaj', 'Reguli parcare', 'Zona locală'],
      placeholder: 'Întreabă despre casa sau comunitatea ta...',
      askButton: 'Întreabă',
      powered: 'Alimentat de AI • Informații doar cu titlu orientativ',
      voiceNotSupported: 'Introducerea vocală nu este suportată de browser. Folosește Chrome, Edge sau Safari.',
      sessionExpired: 'Sesiunea a expirat. Scanează codul QR din nou.',
      errorOccurred: 'Scuze, a apărut o eroare. Te rog încearcă din nou.',
      copied: 'Copiat!',
      copyMessage: 'Copiază mesajul',
    },
    documents: {
      title: 'Documente',
      searchPlaceholder: 'Caută documente...',
      categories: {
        all: 'Toate',
        mustRead: 'De citit',
        important: 'Important',
        floorplans: 'Planuri',
        fireSafety: 'Siguranța la incendiu',
        parking: 'Parcare',
        handover: 'Predare',
        snagging: 'Defecte',
        warranties: 'Garanții',
        specifications: 'Specificații',
        general: 'General',
        videos: 'Videoclipuri',
      },
      noDocuments: 'Nu sunt documente disponibile încă',
      noMatchingDocuments: 'Nu s-au găsit documente',
      tryAdjustingFilters: 'Încearcă să ajustezi criteriile de căutare sau filtrare.',
      loadingDocuments: 'Se încarcă documentele...',
      downloadDocument: 'Descarcă',
      viewDocument: 'Vezi',
      mustReadBadge: 'De citit',
      importantBadge: 'Important',
      watchVideo: 'Vizionează',
      closeVideo: 'Închide video',
      loadingVideos: 'Se încarcă videoclipurile...',
      noVideosAvailable: 'Nu sunt videoclipuri disponibile',
      noVideosDescription: 'Nu există încă videoclipuri de predare pentru proprietatea ta.',
      handoverVideo: 'Videoclip predare',
      unableToLoadVideo: 'Nu s-a putut încărca videoclipul',
      openInBrowser: 'Deschide în browser',
    },
    noticeboard: {
      title: 'Anunțuri',
      noNotices: 'Nu sunt anunțuri momentan',
      loadingNotices: 'Se încarcă anunțurile...',
      postedOn: 'Postat pe',
      readMore: 'Citește mai mult',
      termsTitle: 'Termeni și condiții',
      termsAccept: 'Accept',
      termsDecline: 'Refuz',
    },
    maps: {
      title: 'Zona locală',
      yourLocation: 'Casa ta',
      searchPlaceholder: 'Caută în apropiere...',
      categories: {
        all: 'Toate',
        transport: 'Transport',
        shopping: 'Cumpărături',
        dining: 'Restaurante',
        health: 'Sănătate',
        education: 'Educație',
        recreation: 'Recreere',
      },
      directions: 'Indicații',
      distance: 'Distanța',
      walkingTime: 'Pe jos',
      drivingTime: 'Cu mașina',
      noPlacesFound: 'Nu s-au găsit locuri în apropiere',
    },
    session: {
      expired: 'Sesiune expirată',
      expiredMessage: 'Sesiunea ta a expirat. Scanează codul QR din nou pentru a continua.',
      scanAgain: 'Scanează codul QR',
      invalidCode: 'Cod invalid. Verifică și încearcă din nou.',
      codeRequired: 'Introdu codul de acces',
    },
    aiLanguage: {
      instruction: 'Răspunde în limba română.',
    },
  },

  ga: {
    common: {
      loading: 'Ag lódáil...',
      error: 'Tharla earráid',
      retry: 'Bain triail eile as',
      close: 'Dún',
      cancel: 'Cealaigh',
      confirm: 'Deimhnigh',
      save: 'Sábháil',
      search: 'Cuardaigh',
      noResults: 'Níor aimsíodh torthaí',
      viewAll: 'Féach ar fad',
      learnMore: 'Foghlaim níos mó',
      back: 'Ar ais',
      next: 'Ar aghaidh',
      done: 'Déanta',
      yes: 'Tá',
      no: 'Níl',
    },
    navigation: {
      assistant: 'Cúntóir',
      documents: 'Cáipéisí',
      noticeboard: 'Clár fógraí',
      maps: 'Léarscáileanna',
    },
    chat: {
      welcome: 'Do chúntóir baile',
      subtitle: 'Faigh freagraí láithreach faoi do mhaoin, pleananna urlár, áiseanna áitiúla agus níos mó. Fiafraigh díom!',
      tryAsking: 'Bain triail as ceist a chur faoi:',
      prompts: ['Iompar poiblí', 'Pleananna urlár', 'Rialacha páirceála', 'An ceantar áitiúil'],
      placeholder: 'Cuir ceist faoi do theach nó do phobal...',
      askButton: 'Fiafraigh',
      powered: 'Cumhachtaithe ag AI • Faisnéis le haghaidh tagartha amháin',
      voiceNotSupported: 'Ní thacaítear le hionchur gutha i do bhrabhsálaí. Úsáid Chrome, Edge nó Safari.',
      sessionExpired: 'Tá an seisiún imithe i léig. Scan do chód QR arís.',
      errorOccurred: 'Gabh mo leithscéal, tharla earráid. Bain triail eile as.',
      copied: 'Cóipeáilte!',
      copyMessage: 'Cóipeáil teachtaireacht',
    },
    documents: {
      title: 'Cáipéisí',
      searchPlaceholder: 'Cuardaigh cáipéisí...',
      categories: {
        all: 'Gach rud',
        mustRead: 'Riachtanach',
        important: 'Tábhachtach',
        floorplans: 'Pleananna urlár',
        fireSafety: 'Sábháilteacht dóiteáin',
        parking: 'Páirceáil',
        handover: 'Tabhair suas',
        snagging: 'Lochtanna',
        warranties: 'Barántaí',
        specifications: 'Sonraíochtaí',
        general: 'Ginearálta',
        videos: 'Físeáin',
      },
      noDocuments: 'Níl aon cháipéisí ar fáil fós',
      noMatchingDocuments: 'Níor aimsíodh cáipéisí',
      tryAdjustingFilters: 'Bain triail as na critéir cuardaigh nó scagtha a choigeartú.',
      loadingDocuments: 'Ag lódáil cáipéisí...',
      downloadDocument: 'Íoslódáil',
      viewDocument: 'Féach',
      mustReadBadge: 'Riachtanach',
      importantBadge: 'Tábhachtach',
      watchVideo: 'Féach',
      closeVideo: 'Dún físeán',
      loadingVideos: 'Ag lódáil físeáin...',
      noVideosAvailable: 'Níl aon fhíseáin ar fáil',
      noVideosDescription: 'Níl aon fhíseáin thabhartha suas ar fáil fós do do mhaoin.',
      handoverVideo: 'Físeán tabhartha suas',
      unableToLoadVideo: 'Ní féidir an físeán a lódáil',
      openInBrowser: 'Oscail sa bhrabhsálaí',
    },
    noticeboard: {
      title: 'Clár fógraí',
      noNotices: 'Níl aon fhógraí faoi láthair',
      loadingNotices: 'Ag lódáil fógraí...',
      postedOn: 'Postáilte ar',
      readMore: 'Léigh níos mó',
      termsTitle: 'Téarmaí agus coinníollacha',
      termsAccept: 'Glacaim leis',
      termsDecline: 'Diúltaigh',
    },
    maps: {
      title: 'An ceantar áitiúil',
      yourLocation: 'Do theach',
      searchPlaceholder: 'Cuardaigh in aice láimhe...',
      categories: {
        all: 'Gach rud',
        transport: 'Iompar',
        shopping: 'Siopadóireacht',
        dining: 'Bialanna',
        health: 'Sláinte',
        education: 'Oideachas',
        recreation: 'Caitheamh aimsire',
      },
      directions: 'Treoracha',
      distance: 'Fad',
      walkingTime: 'Ag siúl',
      drivingTime: 'Ag tiomáint',
      noPlacesFound: 'Níor aimsíodh áiteanna in aice láimhe',
    },
    session: {
      expired: 'Tá an seisiún imithe i léig',
      expiredMessage: 'Tá do sheisiún imithe i léig. Scan do chód QR arís chun leanúint ar aghaidh.',
      scanAgain: 'Scan cód QR',
      invalidCode: 'Cód neamhbhailí. Seiceáil agus bain triail eile as.',
      codeRequired: 'Cuir isteach do chód rochtana',
    },
    aiLanguage: {
      instruction: 'Freagair i nGaeilge.',
    },
  },
};

/**
 * Get translations for a specific language
 */
export function getTranslations(language: string): Translations {
  const lang = language as SupportedLanguage;
  return translations[lang] || translations.en;
}

/**
 * Get a specific translation value using dot notation
 * e.g., t('chat.welcome') returns the welcome message
 */
export function t(key: string, language: string): string {
  const trans = getTranslations(language);
  const keys = key.split('.');
  let value: any = trans;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English
      value = translations.en;
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey];
        } else {
          return key; // Return the key if not found
        }
      }
      break;
    }
  }

  return typeof value === 'string' ? value : key;
}

export default translations;
