import type { SupportedLanguageCode } from "./languages.js";

interface ReminderTranslations {
  ecommerce: {
    shopDrawer: { aiCS: { reminders: string } };
    pickupReminder: { title: string; enabled: string; hint: string; saveFailed: string };
    deliveryFailureReminder: { title: string; enabled: string; hint: string; saveFailed: string };
  };
}

export const PICKUP_REMINDER_TRANSLATIONS = {
  "en": {
    "ecommerce": {
      "shopDrawer": {
        "aiCS": {
          "reminders": "Reminders"
        }
      },
      "pickupReminder": {
        "title": "Pickup reminders",
        "enabled": "Remind buyers to collect their orders",
        "hint": "At 10:00 and 17:00 in the shop’s timezone, remind buyers whose single-package orders are still awaiting collection. Reminders stop when collection or delivery is confirmed. Sent from the server, including when this app is closed.",
        "saveFailed": "Could not save pickup reminder settings."
      },
      "deliveryFailureReminder": {
        "title": "Delivery-failure reminders",
        "enabled": "Remind buyers after a failed delivery attempt",
        "hint": "After a failed delivery attempt, send the buyer one message at the next 10:00 or 17:00 in the shop’s timezone, asking them to follow the tracking updates, contact the courier if needed and check where the parcel is being held. One message per delivery attempt; nothing is sent once the parcel is out for redelivery, at a pickup point, delivered or being returned. Sent from the server, including when this app is closed.",
        "saveFailed": "Could not save delivery-failure reminder settings."
      }
    }
  },
  "zh": {
    "ecommerce": {
      "shopDrawer": {
        "aiCS": {
          "reminders": "提醒"
        }
      },
      "pickupReminder": {
        "title": "自提提醒",
        "enabled": "提醒买家领取自提订单",
        "hint": "按店铺当地时间每天10:00和17:00，提醒仍待领取的单包裹订单。确认领取或送达后停止提醒。由服务器执行，关闭本软件也能发送。",
        "saveFailed": "保存自提提醒设置失败。"
      },
      "deliveryFailureReminder": {
        "title": "派送失败提醒",
        "enabled": "派送失败后提醒买家",
        "hint": "包裹派送失败后，在店铺时区的下一个 10:00 或 17:00 给买家发送一条消息，提醒其关注包裹物流信息、如有需要联系快递员跟进，并查询包裹存放地址。每次派送只发一条；包裹已重新派送、到达自提点、已签收或正在退回时不再发送。由服务器发送，本应用关闭时也会发送。",
        "saveFailed": "派送失败提醒设置保存失败。"
      }
    }
  },
  "de": {
    "ecommerce": {
      "shopDrawer": {
        "aiCS": {
          "reminders": "Erinnerungen"
        }
      },
      "pickupReminder": {
        "title": "Abholerinnerungen",
        "enabled": "Käufer an die Abholung erinnern",
        "hint": "Um 10:00 und 17:00 Uhr in der Zeitzone des Shops erhalten Käufer eine Erinnerung für noch abzuholende Bestellungen mit einem Paket. Nach bestätigter Abholung oder Zustellung enden die Erinnerungen. Der Server sendet auch bei geschlossener App.",
        "saveFailed": "Abholeinstellungen konnten nicht gespeichert werden."
      },
      "deliveryFailureReminder": {
        "title": "Erinnerungen bei fehlgeschlagener Zustellung",
        "enabled": "Käufer nach einem fehlgeschlagenen Zustellversuch erinnern",
        "hint": "Nach einem fehlgeschlagenen Zustellversuch erhält der Käufer um die nächste 10:00 oder 17:00 Uhr in der Zeitzone des Shops eine Nachricht mit der Bitte, die Sendungsverfolgung zu beachten, bei Bedarf den Zusteller zu kontaktieren und zu prüfen, wo das Paket liegt. Eine Nachricht pro Zustellversuch; nichts wird gesendet, sobald das Paket erneut zugestellt wird, an einer Abholstelle liegt, zugestellt ist oder zurückgeht. Wird vom Server gesendet, auch wenn diese App geschlossen ist.",
        "saveFailed": "Einstellungen für Zustellungserinnerungen konnten nicht gespeichert werden."
      }
    }
  },
  "es": {
    "ecommerce": {
      "shopDrawer": {
        "aiCS": {
          "reminders": "Recordatorios"
        }
      },
      "pickupReminder": {
        "title": "Recordatorios de recogida",
        "enabled": "Recordar a los compradores que recojan sus pedidos",
        "hint": "A las 10:00 y 17:00 en la zona horaria de la tienda, se recuerdan los pedidos de un solo paquete pendientes de recogida. Se detienen al confirmarse la recogida o entrega. El servidor envía aunque la aplicación esté cerrada.",
        "saveFailed": "No se pudieron guardar los recordatorios."
      },
      "deliveryFailureReminder": {
        "title": "Recordatorios de entrega fallida",
        "enabled": "Avisar a los compradores tras un intento de entrega fallido",
        "hint": "Tras un intento de entrega fallido, se envía al comprador un mensaje a las próximas 10:00 o 17:00 en la zona horaria de la tienda, pidiéndole que siga las actualizaciones de seguimiento, contacte con el transportista si es necesario y compruebe dónde está retenido el paquete. Un mensaje por intento de entrega; no se envía nada si el paquete sale de nuevo a reparto, está en un punto de recogida, se ha entregado o se está devolviendo. Se envía desde el servidor, también con esta aplicación cerrada.",
        "saveFailed": "No se pudo guardar la configuración de recordatorios de entrega fallida."
      }
    }
  },
  "fr": {
    "ecommerce": {
      "shopDrawer": {
        "aiCS": {
          "reminders": "Rappels"
        }
      },
      "pickupReminder": {
        "title": "Rappels de retrait",
        "enabled": "Rappeler aux acheteurs de retirer leurs commandes",
        "hint": "À 10 h et 17 h dans le fuseau de la boutique, rappel pour les commandes à un seul colis en attente de retrait. Arrêt après confirmation du retrait ou de la livraison. Envoi par le serveur, même si l’application est fermée.",
        "saveFailed": "Impossible d’enregistrer les rappels."
      },
      "deliveryFailureReminder": {
        "title": "Rappels d’échec de livraison",
        "enabled": "Prévenir l’acheteur après une tentative de livraison échouée",
        "hint": "Après une tentative de livraison échouée, un message est envoyé à l’acheteur au prochain créneau de 10:00 ou 17:00 dans le fuseau horaire de la boutique, l’invitant à suivre les mises à jour du suivi, à contacter le transporteur si nécessaire et à vérifier où le colis est retenu. Un message par tentative de livraison ; rien n’est envoyé si le colis repart en livraison, se trouve en point de retrait, est livré ou en cours de retour. Envoyé par le serveur, y compris lorsque cette application est fermée.",
        "saveFailed": "Impossible d’enregistrer les paramètres des rappels d’échec de livraison."
      }
    }
  },
  "id": {
    "ecommerce": {
      "shopDrawer": {
        "aiCS": {
          "reminders": "Pengingat"
        }
      },
      "pickupReminder": {
        "title": "Pengingat pengambilan",
        "enabled": "Ingatkan pembeli untuk mengambil pesanan",
        "hint": "Pukul 10.00 dan 17.00 di zona waktu toko, ingatkan pesanan satu paket yang masih menunggu pengambilan. Berhenti setelah pengambilan atau pengantaran dikonfirmasi. Server tetap mengirim saat aplikasi ditutup.",
        "saveFailed": "Gagal menyimpan pengaturan pengingat."
      },
      "deliveryFailureReminder": {
        "title": "Pengingat gagal kirim",
        "enabled": "Ingatkan pembeli setelah percobaan pengiriman gagal",
        "hint": "Setelah percobaan pengiriman gagal, pembeli menerima satu pesan pada pukul 10:00 atau 17:00 berikutnya di zona waktu toko, yang meminta mereka memantau pembaruan pelacakan, menghubungi kurir bila perlu, dan memeriksa lokasi paket disimpan. Satu pesan per percobaan pengiriman; tidak ada pesan jika paket sedang dikirim ulang, berada di titik pengambilan, sudah diterima, atau sedang dikembalikan. Dikirim dari server, termasuk saat aplikasi ini ditutup.",
        "saveFailed": "Gagal menyimpan pengaturan pengingat gagal kirim."
      }
    }
  },
  "it": {
    "ecommerce": {
      "shopDrawer": {
        "aiCS": {
          "reminders": "Promemoria"
        }
      },
      "pickupReminder": {
        "title": "Promemoria di ritiro",
        "enabled": "Ricorda agli acquirenti di ritirare gli ordini",
        "hint": "Alle 10:00 e alle 17:00 nel fuso del negozio, ricorda gli ordini con un solo pacco ancora da ritirare. I promemoria terminano quando il ritiro o la consegna sono confermati. Il server invia anche quando l’app è chiusa.",
        "saveFailed": "Impossibile salvare i promemoria."
      },
      "deliveryFailureReminder": {
        "title": "Promemoria consegna non riuscita",
        "enabled": "Avvisa gli acquirenti dopo un tentativo di consegna non riuscito",
        "hint": "Dopo un tentativo di consegna non riuscito, l’acquirente riceve un messaggio alle prossime 10:00 o 17:00 nel fuso orario del negozio, che lo invita a seguire gli aggiornamenti di tracciamento, contattare il corriere se necessario e verificare dove si trova il pacco. Un messaggio per tentativo di consegna; non viene inviato nulla se il pacco è di nuovo in consegna, in un punto di ritiro, consegnato o in reso. Inviato dal server, anche quando questa app è chiusa.",
        "saveFailed": "Impossibile salvare le impostazioni dei promemoria di consegna non riuscita."
      }
    }
  },
  "th": {
    "ecommerce": {
      "shopDrawer": {
        "aiCS": {
          "reminders": "การแจ้งเตือน"
        }
      },
      "pickupReminder": {
        "title": "แจ้งเตือนรับพัสดุ",
        "enabled": "เตือนผู้ซื้อให้รับคำสั่งซื้อ",
        "hint": "แจ้งเตือนคำสั่งซื้อที่มีพัสดุหนึ่งชิ้นและยังรอรับ เวลา 10:00 และ 17:00 ตามเขตเวลาร้าน หยุดเมื่อยืนยันการรับหรือส่งมอบแล้ว เซิร์ฟเวอร์ส่งได้แม้ปิดแอป",
        "saveFailed": "บันทึกการตั้งค่าแจ้งเตือนไม่สำเร็จ"
      },
      "deliveryFailureReminder": {
        "title": "การแจ้งเตือนจัดส่งไม่สำเร็จ",
        "enabled": "แจ้งเตือนผู้ซื้อหลังการจัดส่งไม่สำเร็จ",
        "hint": "หลังการจัดส่งไม่สำเร็จ ระบบจะส่งข้อความหนึ่งข้อความถึงผู้ซื้อในเวลา 10:00 หรือ 17:00 ถัดไปตามเขตเวลาของร้าน เพื่อให้ติดตามสถานะพัสดุ ติดต่อพนักงานจัดส่งหากจำเป็น และตรวจสอบว่าพัสดุถูกเก็บไว้ที่ใด หนึ่งข้อความต่อการจัดส่งหนึ่งครั้ง และจะไม่ส่งเมื่อพัสดุออกจัดส่งใหม่ อยู่ที่จุดรับพัสดุ จัดส่งสำเร็จ หรือกำลังตีกลับ ส่งจากเซิร์ฟเวอร์ แม้ปิดแอปนี้อยู่",
        "saveFailed": "ไม่สามารถบันทึกการตั้งค่าการแจ้งเตือนจัดส่งไม่สำเร็จได้"
      }
    }
  }
} as const satisfies Record<SupportedLanguageCode, ReminderTranslations>;
