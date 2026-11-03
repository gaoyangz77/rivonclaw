export const AFFILIATE_CREATOR_BUSINESS_TRANSLATIONS = {
  en: {
    ecommerce: {
      affiliateTeam: {
        creatorBusinessTab: "Creator business rules",
        creatorBusinessSummaryOff: "No rules on",
        creatorBusinessSummaryOn: "{{count}} of 3 rules on",
        creatorBusiness: {
          title: "Creator business rules",
          description:
            "These rules apply to all shops of this seller account and are off by default.",
          autoClaim: "Auto-claim when a new Creator's sample application is approved",
          autoClaimHint:
            "When a BD approves a sample application with their own BD login, and the Creator has no BD, is not protected and has no collaboration progress (sample shipped, received, fulfilled or ordered) in any shop, the Creator is assigned to that BD.",
          autoRelease:
            "Auto-release a new Creator to the public pool after a sample rejection or ignore",
          autoReleaseHint:
            "When the BD who owns a Creator rejects or ignores that Creator's sample application, and the Creator is not protected and has no collaboration progress (sample shipped, received, fulfilled or ordered) in any shop, the Creator is released to the public pool.",
          deadlineRelease:
            "Auto-release to the public pool when a sample application is still unreviewed near TikTok's deadline",
          deadlineReleaseHint:
            "For a new Creator assigned to an individual BD: if a sample application is still unreviewed within the set number of hours before TikTok's review deadline, the system checks hourly and releases the Creator to the public pool so another BD can review it. Protected Creators are not affected.",
          deadlineReleaseHours: "Hours before the deadline",
          deadlineReleaseHoursInvalid: "Enter a whole number between 1 and 142",
          exclusions:
            "Reviews done with the main account, by AI on its own, or by the automatic pre-filter rules do not trigger the first two rules. The deadline release does not depend on any review decision.",
          saved: "Creator business rules saved.",
          saveFailed: "Could not save the Creator business rules. Please retry.",
        },
      },
    },
  },
  zh: {
    ecommerce: {
      affiliateTeam: {
        creatorBusinessTab: "达人业务配置",
        creatorBusinessSummaryOff: "未启用",
        creatorBusinessSummaryOn: "已启用 {{count}}/3 项规则",
        creatorBusiness: {
          title: "达人业务配置",
          description: "以下规则对本卖家账号下的所有店铺生效，默认均为关闭。",
          autoClaim: "新达人申样通过时自动申领",
          autoClaimHint:
            "BD 使用自己的 BD 登录通过达人的申样申请时，如果该达人没有归属 BD、未受保护，且在任何店铺都没有合作进度（已发样、已收样、已履约、已出单），该达人会自动归属这位 BD。",
          autoRelease: "新达人拒绝/忽略申样后自动释放到公海",
          autoReleaseHint:
            "达人所属的 BD 拒绝或忽略该达人的申样申请时，如果该达人未受保护，且在任何店铺都没有合作进度（已发样、已收样、已履约、已出单），该达人会被释放到公海。",
          deadlineRelease: "申样临期未审自动释放到公海",
          deadlineReleaseHint:
            "分配给个人 BD 的新达人，如果有申样在审核截止前设定的小时数内仍未审核，系统每小时检查一次，把达人释放到公海，交给其他 BD 审核。受保护的达人不受影响。",
          deadlineReleaseHours: "截止前（小时）",
          deadlineReleaseHoursInvalid: "请输入 1–142 之间的整数",
          exclusions:
            "使用主账号审核、AI 自行审核，以及自动预筛规则完成的审核，都不会触发前两条规则。申样临期未审释放不依赖任何审核结果。",
          saved: "达人业务配置已保存。",
          saveFailed: "达人业务配置保存失败，请重试。",
        },
      },
    },
  },
  de: {
    ecommerce: {
      affiliateTeam: {
        creatorBusinessTab: "Creator-Geschäftsregeln",
        creatorBusinessSummaryOff: "Keine Regel aktiv",
        creatorBusinessSummaryOn: "{{count}} von 3 Regeln aktiv",
        creatorBusiness: {
          title: "Creator-Geschäftsregeln",
          description:
            "Diese Regeln gelten für alle Shops dieses Verkäuferkontos und sind standardmäßig deaktiviert.",
          autoClaim:
            "Automatisch übernehmen, wenn der Musterantrag eines neuen Creators genehmigt wird",
          autoClaimHint:
            "Genehmigt ein BD mit seinem eigenen BD-Login einen Musterantrag, und der Creator hat keinen BD, ist nicht geschützt und hat in keinem Shop einen Kooperationsfortschritt (Muster versandt, erhalten, erfüllt oder bestellt), wird der Creator diesem BD zugewiesen.",
          autoRelease:
            "Neuen Creator nach abgelehntem oder ignoriertem Musterantrag automatisch in den öffentlichen Pool freigeben",
          autoReleaseHint:
            "Lehnt der BD, dem ein Creator gehört, dessen Musterantrag ab oder ignoriert ihn, und der Creator ist nicht geschützt und hat in keinem Shop einen Kooperationsfortschritt (Muster versandt, erhalten, erfüllt oder bestellt), wird der Creator in den öffentlichen Pool freigegeben.",
          deadlineRelease:
            "Neuen Creator in den öffentlichen Pool freigeben, wenn ein Musterantrag kurz vor Ablauf der Prüffrist noch nicht geprüft ist",
          deadlineReleaseHint:
            "Für einen neuen Creator, der einem einzelnen BD zugewiesen ist: Ist ein Musterantrag in der eingestellten Stundenzahl vor Ablauf der TikTok-Prüffrist noch nicht geprüft, prüft das System stündlich und gibt den Creator in den öffentlichen Pool frei, damit ein anderer BD ihn prüfen kann. Geschützte Creator sind nicht betroffen.",
          deadlineReleaseHours: "Stunden vor Fristende",
          deadlineReleaseHoursInvalid: "Bitte eine ganze Zahl zwischen 1 und 142 eingeben",
          exclusions:
            "Prüfungen über das Hauptkonto, durch die KI allein oder durch die automatischen Vorfilterregeln lösen die ersten beiden Regeln nicht aus. Die Freigabe vor Fristende hängt von keiner Prüfentscheidung ab.",
          saved: "Creator-Geschäftsregeln gespeichert.",
          saveFailed:
            "Creator-Geschäftsregeln konnten nicht gespeichert werden. Bitte erneut versuchen.",
        },
      },
    },
  },
  es: {
    ecommerce: {
      affiliateTeam: {
        creatorBusinessTab: "Reglas de negocio de creadores",
        creatorBusinessSummaryOff: "Sin reglas activas",
        creatorBusinessSummaryOn: "{{count}} de 3 reglas activas",
        creatorBusiness: {
          title: "Reglas de negocio de creadores",
          description:
            "Estas reglas se aplican a todas las tiendas de esta cuenta de vendedor y están desactivadas de forma predeterminada.",
          autoClaim:
            "Asignar automáticamente al aprobar la solicitud de muestra de un creador nuevo",
          autoClaimHint:
            "Cuando un BD aprueba una solicitud de muestra con su propio acceso de BD, y el creador no tiene BD, no está protegido y no tiene avance de colaboración (muestra enviada, recibida, cumplida o con pedido) en ninguna tienda, el creador se asigna a ese BD.",
          autoRelease:
            "Devolver automáticamente un creador nuevo al grupo público tras rechazar o ignorar su solicitud de muestra",
          autoReleaseHint:
            "Cuando el BD propietario de un creador rechaza o ignora su solicitud de muestra, y el creador no está protegido y no tiene avance de colaboración (muestra enviada, recibida, cumplida o con pedido) en ninguna tienda, el creador se devuelve al grupo público.",
          deadlineRelease:
            "Devolver un creador nuevo al grupo público cuando una solicitud de muestra sigue sin revisar cerca del plazo de TikTok",
          deadlineReleaseHint:
            "Para un creador nuevo asignado a un BD individual: si una solicitud de muestra sigue sin revisar dentro del número de horas indicado antes del plazo de revisión de TikTok, el sistema comprueba cada hora y devuelve el creador al grupo público para que otro BD lo revise. Los creadores protegidos no se ven afectados.",
          deadlineReleaseHours: "Horas antes del plazo",
          deadlineReleaseHoursInvalid: "Introduce un número entero entre 1 y 142",
          exclusions:
            "Las revisiones hechas con la cuenta principal, por la IA por sí sola o por las reglas de prefiltrado automático no activan las dos primeras reglas. La devolución por plazo no depende de ninguna decisión de revisión.",
          saved: "Reglas de negocio de creadores guardadas.",
          saveFailed:
            "No se pudieron guardar las reglas de negocio de creadores. Inténtalo de nuevo.",
        },
      },
    },
  },
  fr: {
    ecommerce: {
      affiliateTeam: {
        creatorBusinessTab: "Règles métier créateurs",
        creatorBusinessSummaryOff: "Aucune règle active",
        creatorBusinessSummaryOn: "{{count}} règle(s) active(s) sur 3",
        creatorBusiness: {
          title: "Règles métier créateurs",
          description:
            "Ces règles s’appliquent à toutes les boutiques de ce compte vendeur et sont désactivées par défaut.",
          autoClaim:
            "Attribuer automatiquement à l’approbation de la demande d’échantillon d’un nouveau créateur",
          autoClaimHint:
            "Lorsqu’un BD approuve une demande d’échantillon avec son propre identifiant BD, et que le créateur n’a pas de BD, n’est pas protégé et n’a aucune progression de collaboration (échantillon envoyé, reçu, honoré ou commandé) dans aucune boutique, le créateur est attribué à ce BD.",
          autoRelease:
            "Remettre automatiquement un nouveau créateur dans le pool public après un refus ou une demande ignorée",
          autoReleaseHint:
            "Lorsque le BD propriétaire d’un créateur refuse ou ignore sa demande d’échantillon, et que le créateur n’est pas protégé et n’a aucune progression de collaboration (échantillon envoyé, reçu, honoré ou commandé) dans aucune boutique, le créateur est remis dans le pool public.",
          deadlineRelease:
            "Remettre un nouveau créateur dans le pool public lorsqu’une demande d’échantillon reste non examinée près de l’échéance de TikTok",
          deadlineReleaseHint:
            "Pour un nouveau créateur attribué à un BD individuel : si une demande d’échantillon n’est toujours pas examinée dans le nombre d’heures défini avant l’échéance d’examen de TikTok, le système vérifie chaque heure et remet le créateur dans le pool public afin qu’un autre BD l’examine. Les créateurs protégés ne sont pas concernés.",
          deadlineReleaseHours: "Heures avant l’échéance",
          deadlineReleaseHoursInvalid: "Saisissez un nombre entier entre 1 et 142",
          exclusions:
            "Les examens effectués avec le compte principal, par l’IA seule ou par les règles de préfiltrage automatique ne déclenchent pas les deux premières règles. La remise à l’échéance ne dépend d’aucune décision d’examen.",
          saved: "Règles métier créateurs enregistrées.",
          saveFailed: "Impossible d’enregistrer les règles métier créateurs. Réessayez.",
        },
      },
    },
  },
  id: {
    ecommerce: {
      affiliateTeam: {
        creatorBusinessTab: "Aturan bisnis kreator",
        creatorBusinessSummaryOff: "Tidak ada aturan aktif",
        creatorBusinessSummaryOn: "{{count}} dari 3 aturan aktif",
        creatorBusiness: {
          title: "Aturan bisnis kreator",
          description:
            "Aturan ini berlaku untuk semua toko di akun penjual ini dan nonaktif secara default.",
          autoClaim: "Klaim otomatis saat permintaan sampel kreator baru disetujui",
          autoClaimHint:
            "Saat BD menyetujui permintaan sampel dengan login BD miliknya sendiri, dan kreator tidak memiliki BD, tidak dilindungi, serta tidak memiliki progres kolaborasi (sampel dikirim, diterima, dipenuhi, atau ada pesanan) di toko mana pun, kreator ditetapkan ke BD tersebut.",
          autoRelease:
            "Lepaskan kreator baru ke pool publik otomatis setelah permintaan sampel ditolak atau diabaikan",
          autoReleaseHint:
            "Saat BD pemilik kreator menolak atau mengabaikan permintaan sampel kreator itu, dan kreator tidak dilindungi serta tidak memiliki progres kolaborasi (sampel dikirim, diterima, dipenuhi, atau ada pesanan) di toko mana pun, kreator dilepaskan ke pool publik.",
          deadlineRelease:
            "Lepaskan kreator baru ke pool publik otomatis saat permintaan sampel belum ditinjau mendekati batas waktu TikTok",
          deadlineReleaseHint:
            "Untuk kreator baru yang ditetapkan ke BD perorangan: jika permintaan sampel masih belum ditinjau dalam jumlah jam yang ditetapkan sebelum batas waktu peninjauan TikTok, sistem memeriksa setiap jam dan melepaskan kreator ke pool publik agar BD lain dapat meninjaunya. Kreator yang dilindungi tidak terpengaruh.",
          deadlineReleaseHours: "Jam sebelum batas waktu",
          deadlineReleaseHoursInvalid: "Masukkan bilangan bulat antara 1 dan 142",
          exclusions:
            "Peninjauan yang dilakukan dengan akun utama, oleh AI sendiri, atau oleh aturan penyaring awal otomatis tidak memicu dua aturan pertama. Pelepasan menjelang batas waktu tidak bergantung pada keputusan peninjauan apa pun.",
          saved: "Aturan bisnis kreator disimpan.",
          saveFailed: "Aturan bisnis kreator gagal disimpan. Coba lagi.",
        },
      },
    },
  },
  it: {
    ecommerce: {
      affiliateTeam: {
        creatorBusinessTab: "Regole business creator",
        creatorBusinessSummaryOff: "Nessuna regola attiva",
        creatorBusinessSummaryOn: "{{count}} regole attive su 3",
        creatorBusiness: {
          title: "Regole business creator",
          description:
            "Queste regole valgono per tutti i negozi di questo account venditore e sono disattivate per impostazione predefinita.",
          autoClaim:
            "Assegna automaticamente quando la richiesta di campione di un nuovo creator è approvata",
          autoClaimHint:
            "Quando un BD approva una richiesta di campione con il proprio login BD, e il creator non ha un BD, non è protetto e non ha alcun avanzamento di collaborazione (campione spedito, ricevuto, evaso o ordinato) in nessun negozio, il creator viene assegnato a quel BD.",
          autoRelease:
            "Restituisci automaticamente un nuovo creator al pool pubblico dopo il rifiuto o l’ignoramento della richiesta di campione",
          autoReleaseHint:
            "Quando il BD proprietario di un creator rifiuta o ignora la sua richiesta di campione, e il creator non è protetto e non ha alcun avanzamento di collaborazione (campione spedito, ricevuto, evaso o ordinato) in nessun negozio, il creator viene restituito al pool pubblico.",
          deadlineRelease:
            "Restituisci un nuovo creator al pool pubblico quando una richiesta di campione è ancora non esaminata vicino alla scadenza di TikTok",
          deadlineReleaseHint:
            "Per un nuovo creator assegnato a un singolo BD: se una richiesta di campione non è ancora stata esaminata entro il numero di ore impostato prima della scadenza di revisione di TikTok, il sistema controlla ogni ora e restituisce il creator al pool pubblico perché un altro BD lo esamini. I creator protetti non sono interessati.",
          deadlineReleaseHours: "Ore prima della scadenza",
          deadlineReleaseHoursInvalid: "Inserisci un numero intero tra 1 e 142",
          exclusions:
            "Le revisioni fatte con l’account principale, dall’IA da sola o dalle regole di prefiltro automatico non attivano le prime due regole. La restituzione alla scadenza non dipende da alcuna decisione di revisione.",
          saved: "Regole business creator salvate.",
          saveFailed: "Impossibile salvare le regole business creator. Riprova.",
        },
      },
    },
  },
  th: {
    ecommerce: {
      affiliateTeam: {
        creatorBusinessTab: "กฎธุรกิจครีเอเตอร์",
        creatorBusinessSummaryOff: "ยังไม่เปิดใช้กฎ",
        creatorBusinessSummaryOn: "เปิดใช้ {{count}} จาก 3 กฎ",
        creatorBusiness: {
          title: "กฎธุรกิจครีเอเตอร์",
          description: "กฎเหล่านี้ใช้กับทุกร้านค้าของบัญชีผู้ขายนี้ และปิดอยู่ตามค่าเริ่มต้น",
          autoClaim: "รับครีเอเตอร์ใหม่อัตโนมัติเมื่ออนุมัติคำขอตัวอย่าง",
          autoClaimHint:
            "เมื่อ BD อนุมัติคำขอตัวอย่างด้วยการเข้าสู่ระบบ BD ของตนเอง และครีเอเตอร์ไม่มี BD ไม่ได้รับการป้องกัน และไม่มีความคืบหน้าการร่วมงาน (ส่งตัวอย่างแล้ว ได้รับตัวอย่างแล้ว ทำตามข้อตกลงแล้ว หรือมีคำสั่งซื้อ) ในร้านค้าใดเลย ครีเอเตอร์จะถูกมอบหมายให้ BD คนนั้น",
          autoRelease: "ปล่อยครีเอเตอร์ใหม่สู่ส่วนกลางอัตโนมัติหลังปฏิเสธหรือเพิกเฉยคำขอตัวอย่าง",
          autoReleaseHint:
            "เมื่อ BD เจ้าของครีเอเตอร์ปฏิเสธหรือเพิกเฉยคำขอตัวอย่างของครีเอเตอร์นั้น และครีเอเตอร์ไม่ได้รับการป้องกันและไม่มีความคืบหน้าการร่วมงาน (ส่งตัวอย่างแล้ว ได้รับตัวอย่างแล้ว ทำตามข้อตกลงแล้ว หรือมีคำสั่งซื้อ) ในร้านค้าใดเลย ครีเอเตอร์จะถูกปล่อยสู่ส่วนกลาง",
          deadlineRelease:
            "ปล่อยครีเอเตอร์ใหม่สู่ส่วนกลางอัตโนมัติเมื่อคำขอตัวอย่างยังไม่ได้ตรวจสอบใกล้กำหนดของ TikTok",
          deadlineReleaseHint:
            "สำหรับครีเอเตอร์ใหม่ที่มอบหมายให้ BD รายบุคคล: หากคำขอตัวอย่างยังไม่ได้ตรวจสอบภายในจำนวนชั่วโมงที่ตั้งไว้ก่อนกำหนดตรวจสอบของ TikTok ระบบจะตรวจสอบทุกชั่วโมงและปล่อยครีเอเตอร์สู่ส่วนกลางเพื่อให้ BD คนอื่นตรวจสอบ ครีเอเตอร์ที่ได้รับการป้องกันไม่ได้รับผลกระทบ",
          deadlineReleaseHours: "ชั่วโมงก่อนถึงกำหนด",
          deadlineReleaseHoursInvalid: "กรอกจำนวนเต็มระหว่าง 1 ถึง 142",
          exclusions:
            "การตรวจสอบด้วยบัญชีหลัก โดย AI เพียงลำพัง หรือโดยกฎคัดกรองล่วงหน้าอัตโนมัติ จะไม่ทำให้สองกฎแรกทำงาน การปล่อยก่อนถึงกำหนดไม่ขึ้นกับผลการตรวจสอบใดๆ",
          saved: "บันทึกกฎธุรกิจครีเอเตอร์แล้ว",
          saveFailed: "บันทึกกฎธุรกิจครีเอเตอร์ไม่สำเร็จ โปรดลองอีกครั้ง",
        },
      },
    },
  },
} as const;
