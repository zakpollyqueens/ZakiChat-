(function () {
  "use strict";

  const STORAGE_KEY = "zakichat-language";
  const DEFAULT_LANGUAGE = "en";

  const LANGUAGES = [
    ["en", "English", "English"],
    ["sw", "Kiswahili", "Swahili"],
    ["lg", "Luganda", "Luganda"],
    ["fr", "Français", "French"],
    ["es", "Español", "Spanish"],
    ["pt", "Português", "Portuguese"],
    ["tr", "Türkçe", "Turkish"],
    ["de", "Deutsch", "German"],
    ["it", "Italiano", "Italian"],
    ["nl", "Nederlands", "Dutch"],
    ["ar", "العربية", "Arabic"],
    ["fa", "فارسی", "Persian"],
    ["ur", "اردو", "Urdu"],
    ["ru", "Русский", "Russian"],
    ["uk", "Українська", "Ukrainian"],
    ["pl", "Polski", "Polish"],
    ["cs", "Čeština", "Czech"],
    ["ro", "Română", "Romanian"],
    ["el", "Ελληνικά", "Greek"],
    ["hi", "हिन्दी", "Hindi"],
    ["bn", "বাংলা", "Bengali"],
    ["zh", "中文", "Chinese"],
    ["ja", "日本語", "Japanese"],
    ["ko", "한국어", "Korean"],
    ["th", "ไทย", "Thai"],
    ["vi", "Tiếng Việt", "Vietnamese"],
    ["id", "Bahasa Indonesia", "Indonesian"],
    ["ms", "Bahasa Melayu", "Malay"],
    ["fil", "Filipino", "Filipino"],
    ["rw", "Ikinyarwanda", "Kinyarwanda"],
    ["am", "አማርኛ", "Amharic"],
    ["so", "Soomaali", "Somali"],
    ["ha", "Hausa", "Hausa"],
    ["yo", "Yorùbá", "Yoruba"],
    ["ig", "Igbo", "Igbo"],
    ["zu", "isiZulu", "Zulu"],
    ["xh", "isiXhosa", "Xhosa"]
  ].map(([code, nativeName, englishName]) => ({
    code,
    nativeName,
    englishName
  }));

  const RTL_LANGUAGES = new Set([
    "ar",
    "fa",
    "ur"
  ]);

  const TRANSLATIONS = {
    en: {
      "settings.title": "Settings",
      "settings.language": "App language",
      "settings.languageDescription":
        "Choose the language you want ZakiChat to use.",
      "language.title": "App language",
      "language.description":
        "Select your preferred language for ZakiChat.",
      "language.search": "Search languages",
      "language.detected": "Detected from your device",
      "language.selected": "Selected",
      "language.saved": "Language changed successfully.",
      "language.english": "English",
      "nav.chats": "Chats",
      "nav.contacts": "Contacts",
      "nav.groups": "Groups",
      "nav.updates": "Updates",
      "nav.settings": "Settings"
    },

    fr: {
      "settings.title": "Paramètres",
      "settings.language": "Langue de l'application",
      "settings.languageDescription":
        "Choisissez la langue utilisée par ZakiChat.",
      "language.title": "Langue de l'application",
      "language.description":
        "Choisissez votre langue préférée pour ZakiChat.",
      "language.search": "Rechercher une langue",
      "language.detected": "Détectée depuis votre appareil",
      "language.selected": "Sélectionnée",
      "language.saved": "Langue modifiée avec succès.",
      "nav.chats": "Discussions",
      "nav.contacts": "Contacts",
      "nav.groups": "Groupes",
      "nav.updates": "Actualités",
      "nav.settings": "Paramètres"
    },

    es: {
      "settings.title": "Ajustes",
      "settings.language": "Idioma de la aplicación",
      "settings.languageDescription":
        "Elige el idioma que ZakiChat debe utilizar.",
      "language.title": "Idioma de la aplicación",
      "language.description":
        "Selecciona tu idioma preferido para ZakiChat.",
      "language.search": "Buscar idiomas",
      "language.detected": "Detectado desde tu dispositivo",
      "language.selected": "Seleccionado",
      "language.saved": "Idioma cambiado correctamente.",
      "nav.chats": "Chats",
      "nav.contacts": "Contactos",
      "nav.groups": "Grupos",
      "nav.updates": "Novedades",
      "nav.settings": "Ajustes"
    },

    tr: {
      "settings.title": "Ayarlar",
      "settings.language": "Uygulama dili",
      "settings.languageDescription":
        "ZakiChat'in kullanacağı dili seçin.",
      "language.title": "Uygulama dili",
      "language.description":
        "ZakiChat için tercih ettiğiniz dili seçin.",
      "language.search": "Dil ara",
      "language.detected": "Cihazınızdan algılandı",
      "language.selected": "Seçildi",
      "language.saved": "Dil başarıyla değiştirildi.",
      "nav.chats": "Sohbetler",
      "nav.contacts": "Kişiler",
      "nav.groups": "Gruplar",
      "nav.updates": "Güncellemeler",
      "nav.settings": "Ayarlar"
    },

    sw: {
      "settings.title": "Mipangilio",
      "settings.language": "Lugha ya programu",
      "settings.languageDescription":
        "Chagua lugha ambayo ZakiChat itatumia.",
      "language.title": "Lugha ya programu",
      "language.description":
        "Chagua lugha unayopendelea kutumia ZakiChat.",
      "language.search": "Tafuta lugha",
      "language.detected": "Imetambuliwa kutoka kwenye kifaa chako",
      "language.selected": "Imechaguliwa",
      "language.saved": "Lugha imebadilishwa kwa mafanikio.",
      "nav.chats": "Mazungumzo",
      "nav.contacts": "Anwani",
      "nav.groups": "Vikundi",
      "nav.updates": "Taarifa",
      "nav.settings": "Mipangilio"
    },

    lg: {
      "settings.title": "Enteekateeka",
      "settings.language": "Olulimi lwa pulogulaamu",
      "settings.languageDescription":
        "Londa olulimi lw'oyagala ZakiChat okukozesa.",
      "language.title": "Olulimi lwa pulogulaamu",
      "language.description":
        "Londa olulimi lw'oyagala okukozesa ZakiChat.",
      "language.search": "Noonya ennimi",
      "language.detected": "Luzuliddwa okuva ku kyuma kyo",
      "language.selected": "Lulondeddwa",
      "language.saved": "Olulimi lukyusiddwa bulungi.",
      "nav.chats": "Emboozi",
      "nav.contacts": "Abantu",
      "nav.groups": "Ebibiina",
      "nav.updates": "Amawulire",
      "nav.settings": "Enteekateeka"
    },

    de: {
      "settings.title": "Einstellungen",
      "settings.language": "App-Sprache",
      "settings.languageDescription":
        "Wähle die Sprache für ZakiChat.",
      "language.title": "App-Sprache",
      "language.description":
        "Wähle deine bevorzugte Sprache für ZakiChat.",
      "language.search": "Sprachen suchen",
      "language.detected": "Von deinem Gerät erkannt",
      "language.selected": "Ausgewählt",
      "language.saved": "Sprache erfolgreich geändert.",
      "nav.chats": "Chats",
      "nav.contacts": "Kontakte",
      "nav.groups": "Gruppen",
      "nav.updates": "Neuigkeiten",
      "nav.settings": "Einstellungen"
    },

    pt: {
      "settings.title": "Definições",
      "settings.language": "Idioma da aplicação",
      "settings.languageDescription":
        "Escolha o idioma que o ZakiChat deve utilizar.",
      "language.title": "Idioma da aplicação",
      "language.description":
        "Selecione o seu idioma preferido para o ZakiChat.",
      "language.search": "Pesquisar idiomas",
      "language.detected": "Detetado pelo seu dispositivo",
      "language.selected": "Selecionado",
      "language.saved": "Idioma alterado com sucesso.",
      "nav.chats": "Conversas",
      "nav.contacts": "Contactos",
      "nav.groups": "Grupos",
      "nav.updates": "Atualizações",
      "nav.settings": "Definições"
    },

    ar: {
      "settings.title": "الإعدادات",
      "settings.language": "لغة التطبيق",
      "settings.languageDescription":
        "اختر اللغة التي سيستخدمها ZakiChat.",
      "language.title": "لغة التطبيق",
      "language.description":
        "اختر لغتك المفضلة لاستخدام ZakiChat.",
      "language.search": "البحث عن اللغات",
      "language.detected": "تم اكتشافها من جهازك",
      "language.selected": "محددة",
      "language.saved": "تم تغيير اللغة بنجاح.",
      "nav.chats": "الدردشات",
      "nav.contacts": "جهات الاتصال",
      "nav.groups": "المجموعات",
      "nav.updates": "التحديثات",
      "nav.settings": "الإعدادات"
    },

    hi: {
      "settings.title": "सेटिंग्स",
      "settings.language": "ऐप की भाषा",
      "settings.languageDescription":
        "ZakiChat में उपयोग की जाने वाली भाषा चुनें।",
      "language.title": "ऐप की भाषा",
      "language.description":
        "ZakiChat के लिए अपनी पसंदीदा भाषा चुनें।",
      "language.search": "भाषाएँ खोजें",
      "language.detected": "आपके डिवाइस से पहचानी गई",
      "language.selected": "चयनित",
      "language.saved": "भाषा सफलतापूर्वक बदल दी गई।",
      "nav.chats": "चैट",
      "nav.contacts": "संपर्क",
      "nav.groups": "समूह",
      "nav.updates": "अपडेट",
      "nav.settings": "सेटिंग्स"
    },

    zh: {
      "settings.title": "设置",
      "settings.language": "应用语言",
      "settings.languageDescription":
        "选择 ZakiChat 使用的语言。",
      "language.title": "应用语言",
      "language.description":
        "选择你在 ZakiChat 中偏好的语言。",
      "language.search": "搜索语言",
      "language.detected": "根据你的设备检测",
      "language.selected": "已选择",
      "language.saved": "语言已成功更改。",
      "nav.chats": "聊天",
      "nav.contacts": "联系人",
      "nav.groups": "群组",
      "nav.updates": "动态",
      "nav.settings": "设置"
    },

    ja: {
      "settings.title": "設定",
      "settings.language": "アプリの言語",
      "settings.languageDescription":
        "ZakiChatで使用する言語を選択してください。",
      "language.title": "アプリの言語",
      "language.description":
        "ZakiChatで使用する言語を選択してください。",
      "language.search": "言語を検索",
      "language.detected": "端末から検出",
      "language.selected": "選択済み",
      "language.saved": "言語を変更しました。",
      "nav.chats": "チャット",
      "nav.contacts": "連絡先",
      "nav.groups": "グループ",
      "nav.updates": "更新",
      "nav.settings": "設定"
    },

    ko: {
      "settings.title": "설정",
      "settings.language": "앱 언어",
      "settings.languageDescription":
        "ZakiChat에서 사용할 언어를 선택하세요.",
      "language.title": "앱 언어",
      "language.description":
        "ZakiChat에서 사용할 언어를 선택하세요.",
      "language.search": "언어 검색",
      "language.detected": "기기에서 감지됨",
      "language.selected": "선택됨",
      "language.saved": "언어가 변경되었습니다.",
      "nav.chats": "채팅",
      "nav.contacts": "연락처",
      "nav.groups": "그룹",
      "nav.updates": "업데이트",
      "nav.settings": "설정"
    },

    ru: {
      "settings.title": "Настройки",
      "settings.language": "Язык приложения",
      "settings.languageDescription":
        "Выберите язык, который будет использовать ZakiChat.",
      "language.title": "Язык приложения",
      "language.description":
        "Выберите предпочитаемый язык ZakiChat.",
      "language.search": "Поиск языков",
      "language.detected": "Определён по вашему устройству",
      "language.selected": "Выбран",
      "language.saved": "Язык успешно изменён.",
      "nav.chats": "Чаты",
      "nav.contacts": "Контакты",
      "nav.groups": "Группы",
      "nav.updates": "Обновления",
      "nav.settings": "Настройки"
    }
  };

  function getStoredLanguage() {
    return localStorage.getItem(STORAGE_KEY);
  }

  function normalizeLanguage(code) {
    if (!code) return DEFAULT_LANGUAGE;

    const base = code.toLowerCase().split("-")[0];

    return LANGUAGES.some(
      language => language.code === base
    )
      ? base
      : DEFAULT_LANGUAGE;
  }

  function detectLanguage() {
    const stored = getStoredLanguage();

    if (stored) {
      return normalizeLanguage(stored);
    }

    const browserLanguages =
      navigator.languages?.length
        ? navigator.languages
        : [navigator.language];

    for (const language of browserLanguages) {
      const normalized = normalizeLanguage(language);

      if (normalized !== DEFAULT_LANGUAGE) {
        return normalized;
      }

      if (
        String(language)
          .toLowerCase()
          .startsWith("en")
      ) {
        return DEFAULT_LANGUAGE;
      }
    }

    return DEFAULT_LANGUAGE;
  }

  function getLanguage(code) {
    return (
      LANGUAGES.find(
        language => language.code === code
      ) || LANGUAGES[0]
    );
  }

  function translate(key, language) {
    const active =
      language || getCurrentLanguage();

    return (
      TRANSLATIONS[active]?.[key] ||
      TRANSLATIONS.en[key] ||
      key
    );
  }

  function applyTranslations(root = document) {
    root
      .querySelectorAll("[data-i18n]")
      .forEach(element => {
        const key =
          element.getAttribute("data-i18n");

        element.textContent =
          translate(key);
      });

    root
      .querySelectorAll("[data-i18n-placeholder]")
      .forEach(element => {
        const key =
          element.getAttribute(
            "data-i18n-placeholder"
          );

        element.setAttribute(
          "placeholder",
          translate(key)
        );
      });

    root
      .querySelectorAll("[data-i18n-title]")
      .forEach(element => {
        const key =
          element.getAttribute("data-i18n-title");

        element.setAttribute(
          "title",
          translate(key)
        );
      });

    const current =
      getCurrentLanguage();

    document.documentElement.lang =
      current;

    document.documentElement.dir =
      RTL_LANGUAGES.has(current)
        ? "rtl"
        : "ltr";

    document.dispatchEvent(
      new CustomEvent("zakichat:languagechange", {
        detail: {
          language: current
        }
      })
    );
  }

  function setLanguage(language) {
    const normalized =
      normalizeLanguage(language);

    localStorage.setItem(
      STORAGE_KEY,
      normalized
    );

    applyTranslations();

    return getLanguage(normalized);
  }

  function getCurrentLanguage() {
    return normalizeLanguage(
      getStoredLanguage() ||
        detectLanguage()
    );
  }

  function getLanguages() {
    return LANGUAGES.slice();
  }

  window.ZakiChatI18n = Object.freeze({
    languages: getLanguages,
    getLanguage,
    getCurrentLanguage,
    detectLanguage,
    setLanguage,
    translate,
    applyTranslations,
    rtlLanguages: () =>
      Array.from(RTL_LANGUAGES)
  });

  document.addEventListener(
    "DOMContentLoaded",
    () => applyTranslations()
  );
})();
