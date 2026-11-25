export const EXAMPLE_KEYS = [
  "example1",
  "example2",
  "example3",
  "example4",
  "example5",
  "example6",
] as const;
export type ExampleKey = (typeof EXAMPLE_KEYS)[number];

/**
 * Ecommerce preset examples by locale.
 * Falls back to "en" for unknown locales.
 */
export const ECOMMERCE_PRESET: Record<string, Record<ExampleKey, string>> = {
  en: {
    example1: "Check if there are any pending customer service conversations",
    example2:
      "Review all pending CS conversations — mark trivial ones as read, escalate the rest to a human agent",
    example3: "Help me write the customer service prompt for my store",
    example4:
      "Review and audit yesterday's customer service conversations",
    example5:
      "Check which orders have return/refund requests and whether the return shipping has been completed",
    example6: "Summarize our store's recent customer service performance",
  },
  zh: {
    example1: "看看有哪些待处理的客服对话",
    example2: "待处理的客服对话你帮过过一遍，没必要处理的直接标记为已读，有必要处理的就派客服处理",
    example3: "帮我写一下店铺的客服提示词",
    example4: "帮我回顾审核一下过去一天的客服对话",
    example5: "看看店铺有哪些退货退款订单，并且看看退货的物流完成了没",
    example6: "帮我总结一下最近店铺的客服表现",
  },
  de: {
    example1: "Pruefe, ob es ausstehende Kundendienstgespraeche gibt",
    example2:
      "Pruefe alle ausstehenden Kundendienstgespraeche, markiere einfache Faelle als gelesen und eskaliere den Rest an einen menschlichen Agenten",
    example3: "Hilf mir, den Kundenservice-Prompt fuer meinen Shop zu schreiben",
    example4:
      "Pruefe und auditiere die Kundendienstgespraeche von gestern",
    example5:
      "Pruefe, welche Bestellungen Rueckgabe- oder Erstattungsanfragen haben und ob der Rueckversand abgeschlossen ist",
    example6: "Fasse die aktuelle Kundendienstleistung unseres Shops zusammen",
  },
  es: {
    example1: "Comprueba si hay conversaciones de atencion al cliente pendientes",
    example2:
      "Revisa todas las conversaciones de atencion al cliente pendientes, marca como leidas las simples y escala el resto a un agente humano",
    example3:
      "Ayudame a escribir el prompt de atencion al cliente de mi tienda",
    example4:
      "Revisa y audita las conversaciones de atencion al cliente de ayer",
    example5:
      "Comprueba que pedidos tienen solicitudes de devolucion o reembolso y si el envio de devolucion se completo",
    example6: "Resume el rendimiento reciente de atencion al cliente de nuestra tienda",
  },
  fr: {
    example1: "Verifie s'il y a des conversations de service client en attente",
    example2:
      "Passe en revue toutes les conversations de service client en attente, marque les cas simples comme lus et escalade le reste a un agent humain",
    example3:
      "Aide-moi a rediger le prompt du service client de ma boutique",
    example4:
      "Examine et audite les conversations de service client d'hier",
    example5:
      "Verifie quelles commandes ont des demandes de retour ou de remboursement et si l'expedition de retour est terminee",
    example6: "Resume les performances recentes du service client de notre boutique",
  },
  id: {
    example1: "Periksa apakah ada percakapan layanan pelanggan yang masih tertunda",
    example2:
      "Tinjau semua percakapan CS yang tertunda, tandai yang sederhana sebagai sudah dibaca, lalu eskalasikan sisanya ke agen manusia",
    example3: "Bantu saya menulis prompt layanan pelanggan untuk toko saya",
    example4:
      "Tinjau dan audit percakapan layanan pelanggan kemarin",
    example5:
      "Periksa pesanan mana yang memiliki permintaan retur atau refund dan apakah pengiriman retur sudah selesai",
    example6: "Ringkas performa layanan pelanggan terbaru toko kami",
  },
  it: {
    example1: "Controlla se ci sono conversazioni di assistenza clienti in sospeso",
    example2:
      "Rivedi tutte le conversazioni CS in sospeso, segna come lette quelle semplici ed escala le altre a un agente umano",
    example3: "Aiutami a scrivere il prompt del servizio clienti del mio negozio",
    example4:
      "Rivedi e verifica le conversazioni di assistenza clienti di ieri",
    example5:
      "Controlla quali ordini hanno richieste di reso o rimborso e se la spedizione di reso e stata completata",
    example6: "Riassumi le prestazioni recenti dell'assistenza clienti del nostro negozio",
  },
  th: {
    example1: "ตรวจสอบว่ามีบทสนทนาฝ่ายบริการลูกค้าที่ยังค้างอยู่หรือไม่",
    example2:
      "ตรวจทานบทสนทนา CS ที่ค้างอยู่ทั้งหมด ทำเครื่องหมายรายการง่าย ๆ ว่าอ่านแล้ว และส่งต่อรายการที่เหลือให้เจ้าหน้าที่",
    example3: "ช่วยเขียนพรอมต์บริการลูกค้าของร้านให้หน่อย",
    example4: "ช่วยตรวจทานบทสนทนาฝ่ายบริการลูกค้าของเมื่อวาน",
    example5: "ตรวจสอบว่าออเดอร์ใดมีคำขอคืนสินค้าหรือคืนเงิน และการจัดส่งคืนเสร็จแล้วหรือยัง",
    example6: "สรุปประสิทธิภาพฝ่ายบริการลูกค้าล่าสุดของร้านเรา",
  },
};

/**
 * Get preset-specific example texts for a given preset and locale.
 * Returns null for the "default" preset (uses i18n fallback).
 */
export function getPresetExamples(
  presetId: string,
  lang: string,
): Record<ExampleKey, string> | null {
  if (presetId === "default") return null;
  if (presetId === "ecommerce") {
    const locale = lang.trim().toLowerCase().split(/[-_]/)[0];
    return ECOMMERCE_PRESET[locale] ?? ECOMMERCE_PRESET["en"];
  }
  return null;
}
