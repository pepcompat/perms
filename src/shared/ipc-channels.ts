// ชื่อ IPC channel รวมศูนย์ — กัน typo ระหว่าง main กับ preload

export const IPC = {
  // servers (invoke/handle)
  serversList: 'servers:list',
  serversGet: 'servers:get',
  serversCreate: 'servers:create',
  serversUpdate: 'servers:update',
  serversDelete: 'servers:delete',
  serversTest: 'servers:test',

  // terminal
  terminalOpen: 'terminal:open',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalClose: 'terminal:close',
  /** event main→renderer: ต่อท้ายด้วย sessionId -> `terminal:data:<id>` */
  terminalDataPrefix: 'terminal:data:',
  /** event main→renderer: `terminal:exit:<id>` */
  terminalExitPrefix: 'terminal:exit:',

  // sessions / history
  sessionsList: 'sessions:list',
  sessionCommands: 'sessions:commands',

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

  // settings + secrets
  settingsGet: 'settings:get',
  settingsSetAiKey: 'settings:setAiKey',
  settingsClearAiKey: 'settings:clearAiKey',
  settingsUpdateAi: 'settings:updateAi',

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
