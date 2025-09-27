// Shared constants for tunnl.ai Chrome Extension

export const STORAGE_KEYS = {
    OPENAI_API_KEY: 'openaiApiKey',
    TASKS: 'tasks',
    CURRENT_TASK: 'currentTask',
    EXTENSION_ENABLED: 'extensionEnabled',
    BLOCKED_SITES: 'blockedSites',
    STATS: 'stats',
    ALLOWLIST: 'allowlist',
    TASK_VALIDATION_ENABLED: 'taskValidationEnabled',
    FEEDBACK: 'feedback',
    TEMPORARY_UNBLOCK: 'temporaryUnblock',
    ONE_TIME_BYPASS: 'oneTimeBypass',
    LOCK_END_TIME: 'lockEndTime',
    LOCKED_TASK_ID: 'lockedTaskId'
} as const;

export const MESSAGE_TYPES = {
    // Task management
    SET_CURRENT_TASK: 'SET_CURRENT_TASK',
    CLEAR_CURRENT_TASK: 'CLEAR_CURRENT_TASK',
    DELETE_TASK: 'DELETE_TASK',
    
    // Extension control
    TOGGLE_EXTENSION: 'TOGGLE_EXTENSION',
    
    // URL analysis
    ANALYZE_URL: 'ANALYZE_URL',
    VALIDATE_TASK: 'VALIDATE_TASK',
    
    // Settings
    GET_SETTINGS: 'GET_SETTINGS',
    UPDATE_SETTINGS: 'UPDATE_SETTINGS',
    OPEN_SETTINGS: 'OPEN_SETTINGS',
    
    // Feedback and blocking
    BLOCK_FEEDBACK: 'BLOCK_FEEDBACK',
    SHOW_BLOCK_TOAST: 'SHOW_BLOCK_TOAST',
    SHOW_BLOCK_MODAL: 'SHOW_BLOCK_MODAL',
    
    // API
    VALIDATE_API_KEY: 'VALIDATE_API_KEY',
    
    // Allowlist
    ADD_TO_ALLOWLIST: 'ADD_TO_ALLOWLIST',
    
    // Unblocking
    TEMPORARY_UNBLOCK: 'TEMPORARY_UNBLOCK',
    ONE_TIME_BYPASS: 'ONE_TIME_BYPASS',
    
    // Stats
    GET_STATS: 'GET_STATS',
    UPDATE_STATS: 'UPDATE_STATS'
} as const;

export const OPENAI_CONFIG = {
    MODEL: 'gpt-3.5-turbo',
    MAX_TOKENS: 200,
    TEMPERATURE: 0.3,
    API_BASE_URL: 'https://api.openai.com/v1',
    ENDPOINTS: {
        CHAT_COMPLETIONS: '/chat/completions',
        MODELS: '/models'
    }
} as const;

export const CACHE_CONFIG = {
    MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    CLEANUP_INTERVAL: 60 * 60 * 1000 * 24 // 24 hours
} as const;

export const STORAGE_LIMITS = {
    SYNC_MAX_SIZE: 50000, // 50KB
    LOCAL_MAX_SIZE: 500000, // 500KB
    MAX_BLOCKED_SITES: 50,
    MAX_TASKS: 20,
    MAX_FEEDBACK: 200
} as const;

export const TIMING_CONFIG = {
    TEMPORARY_UNBLOCK_DURATION: 10 * 60 * 1000, // 10 minutes
    NOTIFICATION_DEBOUNCE: 4000, // 4 seconds
    BADGE_NOTIFICATION_DURATION: 8000, // 8 seconds
    TOAST_AUTO_DISMISS: 120000, // 2 minutes
    TEMP_MESSAGE_DURATION: 5000 // 5 seconds
} as const;

export const UI_CONFIG = {
    POPUP_WIDTH: 400,
    POPUP_HEIGHT: 600,
    MODAL_Z_INDEX: 2147483647,
    TOAST_Z_INDEX: 2147483647
} as const;

export const SYSTEM_URLS = [
    'chrome://',
    'chrome-extension://',
    'devtools://'
] as const;

export const DEFAULT_SETTINGS = {
    openaiApiKey: '',
    tasks: [],
    currentTask: null,
    extensionEnabled: true,
    blockedSites: [],
    stats: { blockedCount: 0, analyzedCount: 0 },
    allowlist: [],
    taskValidationEnabled: true,
    feedback: []
} as const;

// Type definitions
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];
export type SystemUrl = typeof SYSTEM_URLS[number];

export interface TunnlSettings {
    openaiApiKey: string;
    tasks: string[];
    currentTask: CurrentTask | null;
    extensionEnabled: boolean;
    blockedSites: BlockedSite[];
    stats: Stats;
    allowlist: string[];
    taskValidationEnabled: boolean;
    feedback: Feedback[];
}

export interface CurrentTask {
    text: string;
    index?: number;
    setAt: number;
}

export interface BlockedSite {
    url: string;
    timestamp: number;
    reason: string;
}

export interface Stats {
    blockedCount: number;
    analyzedCount: number;
}

export interface Feedback {
    url: string;
    reason: string;
    correct: boolean;
    timestamp: number;
}

export interface AnalysisResult {
    shouldBlock: boolean;
    reason: string;
    activityUnderstanding: string;
    confidence: number;
}

export interface TaskValidationResult {
    isValid: boolean;
    reason: string;
    suggestions: string[];
    confidence: number;
}

export interface ApiKeyValidationResult {
    valid: boolean;
    error?: string;
    models?: number;
    message?: string;
}