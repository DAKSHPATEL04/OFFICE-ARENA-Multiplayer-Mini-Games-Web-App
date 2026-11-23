export const PLATFORM_API = 1;

export const PLATFORM_CONFIG = {
  roomCodeLength: 4,
  roomCodeAlphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ', // Excludes I, O, L
  roomCodeBadWords: [
    'FUCK', 'SHIT', 'CUNT', 'DICK', 'COCK', 'FAGZ', 'NAZI', 'PORN', 'SEXY',
    'SLUT', 'TWAT', 'WANK', 'BICH', 'DAMN', 'HELL', 'JIZZ', 'KUNT', 'METH',
    'RAPE', 'SUCK', 'TITS', 'ARSE', 'BOOB', 'CRAP', 'DYKE', 'FART', 'GAYS',
    'HATE', 'JERK', 'KILL', 'MUFF', 'NUDE', 'PISS', 'SCUM', 'SHAG', 'TURD',
  ],
  chatFilterWords: ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'slut', 'whore', 'bastard'],
  limits: {
    maxRoomsPerServer: 50,
    maxConnectionsPerServer: 600,
    maxConnectionsPerIp: 40,
    createRoomPerMin: 5,
    joinAttemptsPerMin: 10,
    maxMessagesPerSec: 120,
    closeSocketMessagesPerSec: 200,
    maxMessageBytes: 4096,
    maxSpectatorsPerRoom: 20,
    chatMaxChars: 80,
    chatCooldownMs: 1000,
    nicknameMin: 1,
    nicknameMax: 14,
    roomNameMin: 1,
    roomNameMax: 24,
    passwordMin: 4,
    passwordMax: 12,
  },
  timers: {
    pingIntervalMs: 2000,
    heartbeatTimeoutMs: 10000,
    reconnectGraceMs: 60000,
    kickCooldownMs: 60000,
    emptyRoomGraceMs: 60000,
    openRoomsPushMs: 5000,
    loadingMaxMs: 15000,
    planDurationMs: 5000,
    countdownSec: 3,
    autoStartSec: 5,
    snapshotRateHz: 20,
    interpolationDelayMs: 100,
    maxExtrapolationMs: 200,
  },
} as const;

export const PLAYER_COLORS = [
  { id: 'red', name: 'Red', hex: '#F23A12', shape: 'circle' },
  { id: 'blue', name: 'Blue', hex: '#3F6FE0', shape: 'square' },
  { id: 'yellow', name: 'Yellow', hex: '#FDD835', shape: 'triangle' },
  { id: 'green', name: 'Green', hex: '#43A047', shape: 'diamond' },
  { id: 'orange', name: 'Orange', hex: '#FF8A3D', shape: 'star' },
  { id: 'purple', name: 'Purple', hex: '#9B5CFF', shape: 'hexagon' },
  { id: 'cyan', name: 'Cyan', hex: '#25C7E8', shape: 'cross' },
  { id: 'pink', name: 'Pink', hex: '#FF5CAA', shape: 'heart' },
  { id: 'lime', name: 'Lime', hex: '#9BE564', shape: 'ring' },
  { id: 'teal', name: 'Teal', hex: '#14B8A6', shape: 'shield' },
  { id: 'white', name: 'White', hex: '#F4F6FF', shape: 'bolt' },
  { id: 'gray', name: 'Silver', hex: '#8A94B8', shape: 'crown' },
] as const;

export const PROFILE_ICONS = [
  'shield', 'flame', 'zap', 'star', 'crown', 'target', 'rocket', 'sword',
  'compass', 'anchor', 'gem', 'award', 'ghost', 'bot', 'heart', 'sun',
] as const;

export const QUICK_CHAT_MESSAGES = [
  'Ready!',
  'Wait for me',
  'GG',
  'Nice shot!',
  'Again?',
  'Brb',
] as const;
