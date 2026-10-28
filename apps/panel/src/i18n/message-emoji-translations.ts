import type { SupportedLanguageCode } from "./languages.js";

interface EmojiLabels {
  search: string;
  clear: string;
  categories: {
    suggested: string;
    smileys_people: string;
    animals_nature: string;
    food_drink: string;
    travel_places: string;
    activities: string;
    objects: string;
    symbols: string;
    flags: string;
  };
}

export const MESSAGE_EMOJI_TRANSLATIONS = {
  en: {
    messageEmoji: {
      search: "Search emoji (English names)",
      clear: "Clear search",
      categories: {
        suggested: "Recently used",
        smileys_people: "Smileys & people",
        animals_nature: "Animals & nature",
        food_drink: "Food & drink",
        travel_places: "Travel & places",
        activities: "Activities",
        objects: "Objects",
        symbols: "Symbols",
        flags: "Flags",
      },
    },
  },
  zh: {
    messageEmoji: {
      search: "搜索表情（英文名称）",
      clear: "清空搜索",
      categories: {
        suggested: "最近使用",
        smileys_people: "表情与人物",
        animals_nature: "动物与自然",
        food_drink: "食物与饮品",
        travel_places: "旅行与地点",
        activities: "活动",
        objects: "物品",
        symbols: "符号",
        flags: "旗帜",
      },
    },
  },
  de: {
    messageEmoji: {
      search: "Emojis suchen (englische Namen)",
      clear: "Suche löschen",
      categories: {
        suggested: "Zuletzt verwendet",
        smileys_people: "Smileys & Personen",
        animals_nature: "Tiere & Natur",
        food_drink: "Essen & Trinken",
        travel_places: "Reisen & Orte",
        activities: "Aktivitäten",
        objects: "Objekte",
        symbols: "Symbole",
        flags: "Flaggen",
      },
    },
  },
  es: {
    messageEmoji: {
      search: "Buscar emojis (nombres en inglés)",
      clear: "Borrar búsqueda",
      categories: {
        suggested: "Usados recientemente",
        smileys_people: "Caras y personas",
        animals_nature: "Animales y naturaleza",
        food_drink: "Comida y bebida",
        travel_places: "Viajes y lugares",
        activities: "Actividades",
        objects: "Objetos",
        symbols: "Símbolos",
        flags: "Banderas",
      },
    },
  },
  fr: {
    messageEmoji: {
      search: "Rechercher des émojis (noms anglais)",
      clear: "Effacer la recherche",
      categories: {
        suggested: "Récemment utilisés",
        smileys_people: "Visages et personnes",
        animals_nature: "Animaux et nature",
        food_drink: "Aliments et boissons",
        travel_places: "Voyages et lieux",
        activities: "Activités",
        objects: "Objets",
        symbols: "Symboles",
        flags: "Drapeaux",
      },
    },
  },
  id: {
    messageEmoji: {
      search: "Cari emoji (nama bahasa Inggris)",
      clear: "Hapus pencarian",
      categories: {
        suggested: "Terakhir digunakan",
        smileys_people: "Wajah & orang",
        animals_nature: "Hewan & alam",
        food_drink: "Makanan & minuman",
        travel_places: "Perjalanan & tempat",
        activities: "Aktivitas",
        objects: "Benda",
        symbols: "Simbol",
        flags: "Bendera",
      },
    },
  },
  it: {
    messageEmoji: {
      search: "Cerca emoji (nomi in inglese)",
      clear: "Cancella ricerca",
      categories: {
        suggested: "Usate di recente",
        smileys_people: "Faccine e persone",
        animals_nature: "Animali e natura",
        food_drink: "Cibo e bevande",
        travel_places: "Viaggi e luoghi",
        activities: "Attività",
        objects: "Oggetti",
        symbols: "Simboli",
        flags: "Bandiere",
      },
    },
  },
  th: {
    messageEmoji: {
      search: "ค้นหาอีโมจิ (ชื่อภาษาอังกฤษ)",
      clear: "ล้างการค้นหา",
      categories: {
        suggested: "ใช้ล่าสุด",
        smileys_people: "หน้ายิ้มและผู้คน",
        animals_nature: "สัตว์และธรรมชาติ",
        food_drink: "อาหารและเครื่องดื่ม",
        travel_places: "การเดินทางและสถานที่",
        activities: "กิจกรรม",
        objects: "สิ่งของ",
        symbols: "สัญลักษณ์",
        flags: "ธง",
      },
    },
  },
} satisfies Record<SupportedLanguageCode, { messageEmoji: EmojiLabels }>;
