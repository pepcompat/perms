// ชื่อ IPC channel รวมศูนย์ — กัน typo ระหว่าง main กับ preload

export const IPC = {
  // servers (invoke/handle)
  serversList: 'servers:list',
  serversGet: 'servers:get',
  serversCreate: 'servers:create',
  serversUpdate: 'servers:update',
  serversDelete: 'servers:delete',
  serversTest: 'servers:test',
  sshListKeys: 'ssh:listKeys',
  sshPickKey: 'ssh:pickKey',

  // sftp (รับส่งไฟล์บน session SSH)
  sftpHome: 'sftp:home',
  sftpList: 'sftp:list',
  sftpMkdir: 'sftp:mkdir',
  sftpDelete: 'sftp:delete',
  sftpRename: 'sftp:rename',
  sftpDownload: 'sftp:download',
  sftpUpload: 'sftp:upload',
  sftpRead: 'sftp:read',
  sftpWrite: 'sftp:write',
  sftpArchive: 'sftp:archive',
  sftpExtract: 'sftp:extract',
  sftpDownloadArchive: 'sftp:downloadArchive',
  /** event main→renderer: ความคืบหน้าการถ่ายโอน */
  sftpProgress: 'sftp:progress',

  // คิวรับส่งไฟล์ (resume + ตรวจ checksum + ลองใหม่อัตโนมัติ)
  transferEnqueue: 'transfer:enqueue',
  transferList: 'transfer:list',
  transferCancel: 'transfer:cancel',
  transferRetry: 'transfer:retry',
  transferClear: 'transfer:clear',
  /** event main→renderer: สถานะคิวทั้งหมด */
  transferUpdate: 'transfer:update',

  // snapshot ไฟล์ (ดู diff / ย้อนกลับ)
  snapshotList: 'snapshot:list',
  snapshotGet: 'snapshot:get',
  snapshotDelete: 'snapshot:delete',

  // host key (ยืนยันตัวตนเซิร์ฟเวอร์)
  hostKeysList: 'hostkey:list',
  hostKeysForget: 'hostkey:forget',
  hostKeyRespond: 'hostkey:respond',
  /** event main→renderer: ขอให้ผู้ใช้ยืนยัน host key */
  hostKeyPrompt: 'hostkey:prompt',

  // อุโมงค์ SSH (port forward)
  tunnelOpen: 'tunnel:open',
  tunnelClose: 'tunnel:close',
  tunnelList: 'tunnel:list',
  /** event main→renderer: รายการอุโมงค์ทั้งหมด */
  tunnelUpdate: 'tunnel:update',

  // systemd / journal
  systemdHas: 'systemd:has',
  systemdList: 'systemd:list',
  systemdAction: 'systemd:action',
  systemdStatus: 'systemd:status',
  systemdLogs: 'systemd:logs',

  // นโยบายกรองคำสั่ง AI
  guardGet: 'guard:get',
  guardSet: 'guard:set',

  // docker (จัดการ container บนเซิร์ฟเวอร์ SSH)
  dockerList: 'docker:list',
  dockerAction: 'docker:action',
  dockerLogs: 'docker:logs',

  // terminal
  terminalOpen: 'terminal:open',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalClose: 'terminal:close',
  /** session ที่ยังเปิดอยู่ (ใช้สร้าง tab กลับหลัง refresh) */
  terminalList: 'terminal:list',
  /** output ล่าสุดของ session — เล่นซ้ำตอนต่อกลับ */
  terminalReplay: 'terminal:replay',
  /** event main→renderer: ต่อท้ายด้วย sessionId -> `terminal:data:<id>` */
  terminalDataPrefix: 'terminal:data:',
  /** event main→renderer: `terminal:exit:<id>` */
  terminalExitPrefix: 'terminal:exit:',

  // sessions / history
  sessionsList: 'sessions:list',
  sessionCommands: 'sessions:commands',
  sessionRecentCommands: 'sessions:recentCommands',
  sessionCommandStats: 'sessions:commandStats',
  sessionRecordCommand: 'sessions:recordCommand',

  // ai
  aiChat: 'ai:chat',
  aiApprove: 'ai:approve',
  aiCancel: 'ai:cancel',
  aiHistory: 'ai:history',
  /** event main→renderer: `ai:stream:<requestId>` */
  aiStreamPrefix: 'ai:stream:',

  // runbooks
  runbooksList: 'runbooks:list',
  runbooksSave: 'runbooks:save',
  runbooksDelete: 'runbooks:delete',

  // knowledge (คลังความรู้ AI)
  knowledgeList: 'knowledge:list',
  knowledgeSave: 'knowledge:save',
  knowledgeDelete: 'knowledge:delete',
  knowledgeSearch: 'knowledge:search',
  /** event main→renderer: AI บันทึกความรู้ (ส่ง title) → โชว์ toast */
  knowledgeSaved: 'knowledge:saved',

  // settings + secrets
  settingsGet: 'settings:get',
  settingsSetAiKey: 'settings:setAiKey',
  settingsClearAiKey: 'settings:clearAiKey',
  settingsUpdateAi: 'settings:updateAi',

  // window / shell / app
  /** event main→renderer: ส่ง boolean ว่าอยู่ fullscreen ไหม */
  windowFullscreen: 'window:fullscreen',
  /** เปิด URL ด้วย default browser (คลิกลิงก์ใน terminal) */
  shellOpenExternal: 'shell:openExternal',
  /** เวอร์ชันของแอปตอนนี้ */
  appVersion: 'app:version',

  // auto-update
  updateCheck: 'update:check',
  updateRestart: 'update:restart',
  /** event main→renderer */
  updateAvailable: 'update:available',
  updateProgress: 'update:progress',
  updateDownloaded: 'update:downloaded',
  updateError: 'update:error'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
