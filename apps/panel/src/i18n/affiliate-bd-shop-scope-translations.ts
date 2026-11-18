/**
 * Business developer shop access scope (ADR-110): the editor, the list/detail
 * summaries, and the refusals shown when an owner is outside the shop scope.
 * Merged into `ecommerce.affiliateTeam` for every supported locale.
 */
export const AFFILIATE_BD_SHOP_SCOPE_COPY = {
  en: {
    shopScopeLabel: "Shop access",
    shopScopeAll: "All shops (including ones opened later)",
    shopScopeSpecific: "Specific regions or shops",
    shopScopeAllHint:
      "This BD can work Creators of every shop, including shops connected later.",
    shopScopeSpecificHint:
      "This BD only works Creators of the regions and shops selected below.",
    shopScopeWholeRegion: "Whole region (including shops opened later)",
    shopScopeShopCount: "Shops: {{count}}",
    shopScopeIncludedInRegion: "All shops below are covered by the whole-region grant.",
    shopScopeEveryShopTicked:
      "Every current shop of this region is ticked, but shops opened later will NOT be included.",
    shopScopeGrantWholeRegion: "Grant the whole region instead",
    shopScopeSelectAllRegions: "Select all regions",
    shopScopeClear: "Clear",
    shopScopeRegionsWithoutShops: "Regions with no shops yet",
    shopScopeRegionsWithoutShopsSelected: "{{count}} selected",
    shopScopeRegionsWithoutShopsHint:
      "You can still grant these as whole regions; shops connected there later will be included.",
    shopScopeShopsWithoutRegion: "Shops without a region",
    shopScopeNothingSelected:
      "Select at least one region or shop, or choose All shops.",
    shopScopeNoMatchingShops: "No matching shops",
    shopScopeSummaryAll: "All shops",
    shopScopeSummaryWholeRegion: "{{region}} (whole region)",
    shopScopeSummaryRegionLead: "{{region}}: ",
    shopScopeSummaryShopSeparator: ", ",
    shopScopeSummaryMore: "+{{count}} more",
    shopScopeSummaryMissingShops: "{{count}} unavailable shops",
    shopScopeShopNotFound:
      "One of the selected shops no longer exists. Reopen the editor and choose again.",
    ownerOutOfShopScope:
      "This BD's shop access does not cover any shop of this Creator. Choose another BD or widen this BD's shop access.",
    ownerOutOfShopScopeBadge: "Out of shop access",
    ownerShopScopeHint:
      "Only BDs whose shop access covers at least one of this Creator's shops are listed.",
  },
  zh: {
    shopScopeLabel: "店铺权限",
    shopScopeAll: "全部店铺（含以后新开的）",
    shopScopeSpecific: "指定站点或店铺",
    shopScopeAllHint: "该 BD 可处理所有店铺的达人，以后新连接的店铺也自动包含。",
    shopScopeSpecificHint: "该 BD 只处理下方所选站点和店铺的达人。",
    shopScopeWholeRegion: "整个站点（含以后新开的店铺）",
    shopScopeShopCount: "店铺 {{count}} 家",
    shopScopeIncludedInRegion: "下面的店铺都已包含在整个站点的授权里。",
    shopScopeEveryShopTicked: "该站点现有店铺已全部勾选，但以后新开的店铺不会自动包含。",
    shopScopeGrantWholeRegion: "改为授权整个站点",
    shopScopeSelectAllRegions: "全选所有站点",
    shopScopeClear: "清空",
    shopScopeRegionsWithoutShops: "暂无店铺的站点",
    shopScopeRegionsWithoutShopsSelected: "已选 {{count}} 个",
    shopScopeRegionsWithoutShopsHint:
      "仍可按整个站点授权，以后在该站点新连接的店铺会自动包含。",
    shopScopeShopsWithoutRegion: "未记录站点的店铺",
    shopScopeNothingSelected: "请至少选择一个站点或店铺，或改选“全部店铺”。",
    shopScopeNoMatchingShops: "没有匹配的店铺",
    shopScopeSummaryAll: "全部店铺",
    shopScopeSummaryWholeRegion: "{{region}}（整站）",
    shopScopeSummaryRegionLead: "{{region}}：",
    shopScopeSummaryShopSeparator: "、",
    shopScopeSummaryMore: "等另外 {{count}} 家",
    shopScopeSummaryMissingShops: "{{count}} 家已不可用的店铺",
    shopScopeShopNotFound: "所选店铺中有店铺已不存在，请重新打开编辑后再选择。",
    ownerOutOfShopScope:
      "该 BD 的店铺权限不包含这位达人的任何店铺。请改选其他 BD，或扩大该 BD 的店铺权限。",
    ownerOutOfShopScopeBadge: "超出店铺权限",
    ownerShopScopeHint: "仅列出店铺权限至少覆盖该达人一家店铺的 BD。",
  },
  de: {
    shopScopeLabel: "Shop-Zugriff",
    shopScopeAll: "Alle Shops (auch später eröffnete)",
    shopScopeSpecific: "Bestimmte Regionen oder Shops",
    shopScopeAllHint:
      "Dieser BD bearbeitet Creator aller Shops, auch später verbundener Shops.",
    shopScopeSpecificHint:
      "Dieser BD bearbeitet nur Creator der unten gewählten Regionen und Shops.",
    shopScopeWholeRegion: "Gesamte Region (auch später eröffnete Shops)",
    shopScopeShopCount: "Shops: {{count}}",
    shopScopeIncludedInRegion: "Alle Shops unten sind durch die Freigabe der gesamten Region abgedeckt.",
    shopScopeEveryShopTicked:
      "Alle aktuellen Shops dieser Region sind ausgewählt, später eröffnete Shops sind aber NICHT enthalten.",
    shopScopeGrantWholeRegion: "Stattdessen die gesamte Region freigeben",
    shopScopeSelectAllRegions: "Alle Regionen auswählen",
    shopScopeClear: "Leeren",
    shopScopeRegionsWithoutShops: "Regionen ohne Shops",
    shopScopeRegionsWithoutShopsSelected: "{{count}} ausgewählt",
    shopScopeRegionsWithoutShopsHint:
      "Sie können sie trotzdem als gesamte Region freigeben; dort später verbundene Shops sind dann enthalten.",
    shopScopeShopsWithoutRegion: "Shops ohne Region",
    shopScopeNothingSelected:
      "Wählen Sie mindestens eine Region oder einen Shop oder „Alle Shops“.",
    shopScopeNoMatchingShops: "Keine passenden Shops",
    shopScopeSummaryAll: "Alle Shops",
    shopScopeSummaryWholeRegion: "{{region}} (gesamte Region)",
    shopScopeSummaryRegionLead: "{{region}}: ",
    shopScopeSummaryShopSeparator: ", ",
    shopScopeSummaryMore: "+{{count}} weitere",
    shopScopeSummaryMissingShops: "{{count}} nicht mehr verfügbare Shops",
    shopScopeShopNotFound:
      "Einer der gewählten Shops existiert nicht mehr. Öffnen Sie den Editor erneut und wählen Sie neu.",
    ownerOutOfShopScope:
      "Der Shop-Zugriff dieses BD deckt keinen Shop dieses Creators ab. Wählen Sie einen anderen BD oder erweitern Sie dessen Shop-Zugriff.",
    ownerOutOfShopScopeBadge: "Außerhalb des Shop-Zugriffs",
    ownerShopScopeHint:
      "Es werden nur BDs gelistet, deren Shop-Zugriff mindestens einen Shop dieses Creators abdeckt.",
  },
  es: {
    shopScopeLabel: "Acceso a tiendas",
    shopScopeAll: "Todas las tiendas (incluidas las que se abran después)",
    shopScopeSpecific: "Regiones o tiendas concretas",
    shopScopeAllHint:
      "Este BD atiende a creadores de todas las tiendas, incluidas las que se conecten después.",
    shopScopeSpecificHint:
      "Este BD solo atiende a creadores de las regiones y tiendas elegidas abajo.",
    shopScopeWholeRegion: "Región completa (incluidas tiendas abiertas después)",
    shopScopeShopCount: "Tiendas: {{count}}",
    shopScopeIncludedInRegion: "Todas las tiendas de abajo están cubiertas por el acceso a la región completa.",
    shopScopeEveryShopTicked:
      "Todas las tiendas actuales de esta región están marcadas, pero las que se abran después NO se incluirán.",
    shopScopeGrantWholeRegion: "Conceder la región completa",
    shopScopeSelectAllRegions: "Seleccionar todas las regiones",
    shopScopeClear: "Borrar",
    shopScopeRegionsWithoutShops: "Regiones sin tiendas todavía",
    shopScopeRegionsWithoutShopsSelected: "{{count}} seleccionadas",
    shopScopeRegionsWithoutShopsHint:
      "Aun así puede conceder la región completa; las tiendas que se conecten allí después quedarán incluidas.",
    shopScopeShopsWithoutRegion: "Tiendas sin región",
    shopScopeNothingSelected:
      "Seleccione al menos una región o tienda, o elija «Todas las tiendas».",
    shopScopeNoMatchingShops: "No hay tiendas coincidentes",
    shopScopeSummaryAll: "Todas las tiendas",
    shopScopeSummaryWholeRegion: "{{region}} (región completa)",
    shopScopeSummaryRegionLead: "{{region}}: ",
    shopScopeSummaryShopSeparator: ", ",
    shopScopeSummaryMore: "+{{count}} más",
    shopScopeSummaryMissingShops: "{{count}} tiendas ya no disponibles",
    shopScopeShopNotFound:
      "Una de las tiendas elegidas ya no existe. Vuelva a abrir el editor y elija de nuevo.",
    ownerOutOfShopScope:
      "El acceso a tiendas de este BD no cubre ninguna tienda de este creador. Elija otro BD o amplíe su acceso a tiendas.",
    ownerOutOfShopScopeBadge: "Fuera de su acceso a tiendas",
    ownerShopScopeHint:
      "Solo se listan los BD cuyo acceso a tiendas cubre al menos una tienda de este creador.",
  },
  fr: {
    shopScopeLabel: "Accès aux boutiques",
    shopScopeAll: "Toutes les boutiques (y compris celles ouvertes plus tard)",
    shopScopeSpecific: "Régions ou boutiques précises",
    shopScopeAllHint:
      "Ce BD traite les créateurs de toutes les boutiques, y compris celles connectées plus tard.",
    shopScopeSpecificHint:
      "Ce BD ne traite que les créateurs des régions et boutiques choisies ci-dessous.",
    shopScopeWholeRegion: "Région entière (y compris boutiques ouvertes plus tard)",
    shopScopeShopCount: "Boutiques : {{count}}",
    shopScopeIncludedInRegion: "Toutes les boutiques ci-dessous sont couvertes par l'accès à la région entière.",
    shopScopeEveryShopTicked:
      "Toutes les boutiques actuelles de cette région sont cochées, mais celles ouvertes plus tard NE seront PAS incluses.",
    shopScopeGrantWholeRegion: "Accorder plutôt la région entière",
    shopScopeSelectAllRegions: "Sélectionner toutes les régions",
    shopScopeClear: "Effacer",
    shopScopeRegionsWithoutShops: "Régions sans boutique pour l'instant",
    shopScopeRegionsWithoutShopsSelected: "{{count}} sélectionnée(s)",
    shopScopeRegionsWithoutShopsHint:
      "Vous pouvez quand même accorder la région entière ; les boutiques qui y seront connectées plus tard seront incluses.",
    shopScopeShopsWithoutRegion: "Boutiques sans région",
    shopScopeNothingSelected:
      "Sélectionnez au moins une région ou une boutique, ou choisissez « Toutes les boutiques ».",
    shopScopeNoMatchingShops: "Aucune boutique correspondante",
    shopScopeSummaryAll: "Toutes les boutiques",
    shopScopeSummaryWholeRegion: "{{region}} (région entière)",
    shopScopeSummaryRegionLead: "{{region}} : ",
    shopScopeSummaryShopSeparator: ", ",
    shopScopeSummaryMore: "+{{count}} autres",
    shopScopeSummaryMissingShops: "{{count}} boutiques devenues indisponibles",
    shopScopeShopNotFound:
      "L'une des boutiques choisies n'existe plus. Rouvrez l'éditeur et choisissez à nouveau.",
    ownerOutOfShopScope:
      "L'accès aux boutiques de ce BD ne couvre aucune boutique de ce créateur. Choisissez un autre BD ou élargissez son accès.",
    ownerOutOfShopScopeBadge: "Hors accès aux boutiques",
    ownerShopScopeHint:
      "Seuls les BD dont l'accès couvre au moins une boutique de ce créateur sont listés.",
  },
  id: {
    shopScopeLabel: "Akses toko",
    shopScopeAll: "Semua toko (termasuk yang dibuka kemudian)",
    shopScopeSpecific: "Wilayah atau toko tertentu",
    shopScopeAllHint:
      "BD ini menangani kreator dari semua toko, termasuk toko yang terhubung kemudian.",
    shopScopeSpecificHint:
      "BD ini hanya menangani kreator dari wilayah dan toko yang dipilih di bawah.",
    shopScopeWholeRegion: "Seluruh wilayah (termasuk toko yang dibuka kemudian)",
    shopScopeShopCount: "Toko: {{count}}",
    shopScopeIncludedInRegion: "Semua toko di bawah sudah tercakup oleh akses seluruh wilayah.",
    shopScopeEveryShopTicked:
      "Semua toko saat ini di wilayah ini sudah dicentang, tetapi toko yang dibuka kemudian TIDAK akan termasuk.",
    shopScopeGrantWholeRegion: "Beri akses seluruh wilayah",
    shopScopeSelectAllRegions: "Pilih semua wilayah",
    shopScopeClear: "Kosongkan",
    shopScopeRegionsWithoutShops: "Wilayah yang belum punya toko",
    shopScopeRegionsWithoutShopsSelected: "{{count}} dipilih",
    shopScopeRegionsWithoutShopsHint:
      "Tetap bisa diberi akses seluruh wilayah; toko yang terhubung di sana kemudian akan ikut termasuk.",
    shopScopeShopsWithoutRegion: "Toko tanpa wilayah",
    shopScopeNothingSelected:
      "Pilih minimal satu wilayah atau toko, atau pilih \"Semua toko\".",
    shopScopeNoMatchingShops: "Tidak ada toko yang cocok",
    shopScopeSummaryAll: "Semua toko",
    shopScopeSummaryWholeRegion: "{{region}} (seluruh wilayah)",
    shopScopeSummaryRegionLead: "{{region}}: ",
    shopScopeSummaryShopSeparator: ", ",
    shopScopeSummaryMore: "+{{count}} lagi",
    shopScopeSummaryMissingShops: "{{count}} toko yang tidak tersedia lagi",
    shopScopeShopNotFound:
      "Salah satu toko yang dipilih sudah tidak ada. Buka editor lagi dan pilih ulang.",
    ownerOutOfShopScope:
      "Akses toko BD ini tidak mencakup toko mana pun milik kreator ini. Pilih BD lain atau perluas akses toko BD ini.",
    ownerOutOfShopScopeBadge: "Di luar akses toko",
    ownerShopScopeHint:
      "Hanya BD yang akses tokonya mencakup minimal satu toko kreator ini yang ditampilkan.",
  },
  it: {
    shopScopeLabel: "Accesso ai negozi",
    shopScopeAll: "Tutti i negozi (anche quelli aperti in seguito)",
    shopScopeSpecific: "Regioni o negozi specifici",
    shopScopeAllHint:
      "Questo BD gestisce i creator di tutti i negozi, compresi quelli collegati in seguito.",
    shopScopeSpecificHint:
      "Questo BD gestisce solo i creator delle regioni e dei negozi scelti qui sotto.",
    shopScopeWholeRegion: "Intera regione (compresi i negozi aperti in seguito)",
    shopScopeShopCount: "Negozi: {{count}}",
    shopScopeIncludedInRegion: "Tutti i negozi qui sotto sono coperti dall'accesso all'intera regione.",
    shopScopeEveryShopTicked:
      "Tutti i negozi attuali di questa regione sono selezionati, ma quelli aperti in seguito NON saranno inclusi.",
    shopScopeGrantWholeRegion: "Concedi invece l'intera regione",
    shopScopeSelectAllRegions: "Seleziona tutte le regioni",
    shopScopeClear: "Svuota",
    shopScopeRegionsWithoutShops: "Regioni senza ancora negozi",
    shopScopeRegionsWithoutShopsSelected: "{{count}} selezionate",
    shopScopeRegionsWithoutShopsHint:
      "Puoi comunque concedere l'intera regione; i negozi collegati lì in seguito saranno inclusi.",
    shopScopeShopsWithoutRegion: "Negozi senza regione",
    shopScopeNothingSelected:
      "Seleziona almeno una regione o un negozio, oppure scegli «Tutti i negozi».",
    shopScopeNoMatchingShops: "Nessun negozio corrispondente",
    shopScopeSummaryAll: "Tutti i negozi",
    shopScopeSummaryWholeRegion: "{{region}} (intera regione)",
    shopScopeSummaryRegionLead: "{{region}}: ",
    shopScopeSummaryShopSeparator: ", ",
    shopScopeSummaryMore: "+{{count}} altri",
    shopScopeSummaryMissingShops: "{{count}} negozi non più disponibili",
    shopScopeShopNotFound:
      "Uno dei negozi scelti non esiste più. Riapri l'editor e scegli di nuovo.",
    ownerOutOfShopScope:
      "L'accesso ai negozi di questo BD non copre alcun negozio di questo creator. Scegli un altro BD o amplia il suo accesso.",
    ownerOutOfShopScopeBadge: "Fuori dall'accesso ai negozi",
    ownerShopScopeHint:
      "Sono elencati solo i BD il cui accesso copre almeno un negozio di questo creator.",
  },
  th: {
    shopScopeLabel: "สิทธิ์การเข้าถึงร้านค้า",
    shopScopeAll: "ร้านค้าทั้งหมด (รวมร้านที่เปิดภายหลัง)",
    shopScopeSpecific: "เฉพาะภูมิภาคหรือร้านค้าที่เลือก",
    shopScopeAllHint:
      "BD นี้ดูแลครีเอเตอร์ของทุกร้านค้า รวมถึงร้านที่เชื่อมต่อภายหลัง",
    shopScopeSpecificHint:
      "BD นี้ดูแลเฉพาะครีเอเตอร์ของภูมิภาคและร้านค้าที่เลือกด้านล่าง",
    shopScopeWholeRegion: "ทั้งภูมิภาค (รวมร้านที่เปิดภายหลัง)",
    shopScopeShopCount: "ร้านค้า: {{count}}",
    shopScopeIncludedInRegion: "ร้านค้าทั้งหมดด้านล่างรวมอยู่ในสิทธิ์ทั้งภูมิภาคแล้ว",
    shopScopeEveryShopTicked:
      "ติ๊กร้านค้าปัจจุบันทั้งหมดของภูมิภาคนี้แล้ว แต่ร้านที่เปิดภายหลังจะไม่ถูกรวมให้",
    shopScopeGrantWholeRegion: "เปลี่ยนเป็นให้สิทธิ์ทั้งภูมิภาค",
    shopScopeSelectAllRegions: "เลือกทุกภูมิภาค",
    shopScopeClear: "ล้าง",
    shopScopeRegionsWithoutShops: "ภูมิภาคที่ยังไม่มีร้านค้า",
    shopScopeRegionsWithoutShopsSelected: "เลือกแล้ว {{count}}",
    shopScopeRegionsWithoutShopsHint:
      "ยังให้สิทธิ์ทั้งภูมิภาคได้ ร้านที่เชื่อมต่อในภูมิภาคนั้นภายหลังจะถูกรวมให้อัตโนมัติ",
    shopScopeShopsWithoutRegion: "ร้านค้าที่ไม่มีภูมิภาค",
    shopScopeNothingSelected:
      "เลือกอย่างน้อยหนึ่งภูมิภาคหรือหนึ่งร้านค้า หรือเลือก “ร้านค้าทั้งหมด”",
    shopScopeNoMatchingShops: "ไม่พบร้านค้าที่ตรงกัน",
    shopScopeSummaryAll: "ร้านค้าทั้งหมด",
    shopScopeSummaryWholeRegion: "{{region}} (ทั้งภูมิภาค)",
    shopScopeSummaryRegionLead: "{{region}}: ",
    shopScopeSummaryShopSeparator: ", ",
    shopScopeSummaryMore: "และอีก {{count}} ร้าน",
    shopScopeSummaryMissingShops: "{{count}} ร้านค้าที่ไม่พร้อมใช้งานแล้ว",
    shopScopeShopNotFound:
      "ร้านค้าที่เลือกบางร้านไม่มีอยู่แล้ว กรุณาเปิดตัวแก้ไขใหม่แล้วเลือกอีกครั้ง",
    ownerOutOfShopScope:
      "สิทธิ์ร้านค้าของ BD นี้ไม่ครอบคลุมร้านค้าใดของครีเอเตอร์รายนี้ กรุณาเลือก BD คนอื่นหรือขยายสิทธิ์ร้านค้าของ BD นี้",
    ownerOutOfShopScopeBadge: "นอกสิทธิ์ร้านค้า",
    ownerShopScopeHint:
      "แสดงเฉพาะ BD ที่สิทธิ์ร้านค้าครอบคลุมอย่างน้อยหนึ่งร้านของครีเอเตอร์รายนี้",
  },
} as const;
