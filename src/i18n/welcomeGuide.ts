export const welcomeGuideMessages = {
  'zh-CN': {
    label: '新手引导',
    progress: '第 {current} 步，共 {total} 步',
    skip: '跳过',
    back: '上一步',
    next: '下一步',
    done: '完成',
    receive: {
      title: '找到你的收款地址',
      body: '打开「收款地址」，选择一个地址，然后复制地址或展示二维码给付款人。',
    },
    send: {
      title: '发起一笔转账',
      body: '点「资产总览」里的「发送」，填写收款地址和金额，核对交易后再确认。',
    },
    activity: {
      title: '查看交易进度',
      body: '在「最近活动」点开一笔交易，查看处理进度和到账状态。',
    },
    security: {
      title: '查看凭证与安全',
      body: '在「凭证与安全」打开凭证明细，查看 TXCer 的状态和验证过程。',
    },
    layout: {
      title: '按自己的习惯整理总览',
      body: '点头像，再选「编辑卡片」。拖动卡片调整顺序，也可以添加或隐藏卡片。',
    },
  },
  'en-US': {
    label: 'Wallet guide',
    progress: 'Step {current} of {total}',
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    receive: {
      title: 'Find your receiving address',
      body: 'Open Receiving addresses, choose an address, and copy it or show its QR code to the sender.',
    },
    send: {
      title: 'Start a transfer',
      body: 'Select Send in Asset overview. Enter the recipient’s address and amount, then review the transfer before confirming.',
    },
    activity: {
      title: 'Track a transaction',
      body: 'Open a transaction in Recent activity to see its progress and whether the funds have arrived.',
    },
    security: {
      title: 'Review credentials',
      body: 'Open the credential details under Credentials & security to see TXCer status and verification steps.',
    },
    layout: {
      title: 'Make the overview yours',
      body: 'Open the avatar menu and choose Edit cards. Drag cards to reorder them, or add and hide cards as needed.',
    },
  },
  'ja-JP': {
    label: 'ウォレットガイド',
    progress: '全{total}ステップ中 {current}',
    skip: 'スキップ',
    back: '前へ',
    next: '次へ',
    done: '完了',
    receive: {
      title: '受取アドレスを確認する',
      body: '「受取アドレス」を開いてアドレスを選び、コピーするか、送金者に QR コードを提示します。',
    },
    send: {
      title: '送金を始める',
      body: '「資産概要」の「送金」から、受取アドレスと金額を入力し、内容を確認してから送金します。',
    },
    activity: {
      title: '取引の進み具合を確認する',
      body: '「最近のアクティビティ」で取引を開き、処理の進み具合や着金状況を確認できます。',
    },
    security: {
      title: '証明書を確認する',
      body: '「証明書とセキュリティ」で証明書の詳細を開くと、TXCer の状態と検証の流れを確認できます。',
    },
    layout: {
      title: '概要を使いやすく整える',
      body: 'アバターメニューから「カードを編集」を選ぶと、ドラッグで並べ替えたり、カードを追加したり非表示にしたりできます。',
    },
  },
  'es-ES': {
    label: 'Guía de la cartera',
    progress: 'Paso {current} de {total}',
    skip: 'Omitir',
    back: 'Atrás',
    next: 'Siguiente',
    done: 'Listo',
    receive: {
      title: 'Encuentra tu dirección de recepción',
      body: 'Abre las direcciones de recepción, elige una y cópiala o muestra su código QR a quien vaya a enviarte fondos.',
    },
    send: {
      title: 'Inicia una transferencia',
      body: 'Pulsa Enviar en el resumen de activos. Introduce la dirección de destino y el importe, y revisa la transferencia antes de confirmarla.',
    },
    activity: {
      title: 'Sigue una transacción',
      body: 'Abre una transacción en Actividad reciente para ver su progreso y comprobar si los fondos han llegado.',
    },
    security: {
      title: 'Consulta tus credenciales',
      body: 'Abre los detalles en Credenciales y seguridad para ver el estado de TXCer y los pasos de verificación.',
    },
    layout: {
      title: 'Personaliza el resumen',
      body: 'Abre el menú del avatar y elige Editar tarjetas. Arrastra las tarjetas para ordenarlas, o añade y oculta las que quieras.',
    },
  },
  'fr-FR': {
    label: 'Guide du portefeuille',
    progress: 'Étape {current} sur {total}',
    skip: 'Passer',
    back: 'Précédent',
    next: 'Suivant',
    done: 'Terminer',
    receive: {
      title: 'Trouver une adresse de réception',
      body: 'Ouvrez les adresses de réception, choisissez-en une, puis copiez-la ou montrez son code QR à l’expéditeur.',
    },
    send: {
      title: 'Commencer un transfert',
      body: 'Choisissez Envoyer dans l’aperçu des actifs. Saisissez l’adresse du destinataire et le montant, puis vérifiez le transfert avant de le confirmer.',
    },
    activity: {
      title: 'Suivre une transaction',
      body: 'Ouvrez une transaction dans Activité récente pour suivre son avancement et vérifier si les fonds sont arrivés.',
    },
    security: {
      title: 'Consulter les certificats',
      body: 'Ouvrez le détail dans Certificats et sécurité pour consulter l’état de TXCer et les étapes de vérification.',
    },
    layout: {
      title: 'Personnaliser la vue d’ensemble',
      body: 'Dans le menu de l’avatar, choisissez Modifier les cartes. Faites glisser les cartes pour les réorganiser, ou ajoutez et masquez celles de votre choix.',
    },
  },
} as const
