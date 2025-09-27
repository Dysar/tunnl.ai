// Storage key constants for tunnl.ai Chrome Extension

export const STORAGE_KEYS = {
    // Core settings
    OPENAI_API_KEY: 'openaiApiKey',
    TASKS: 'tasks',
    CURRENT_TASK: 'currentTask',
    EXTENSION_ENABLED: 'extensionEnabled',
    
    // Data collections
    BLOCKED_SITES: 'blockedSites',
    STATS: 'stats',
    ALLOWLIST: 'allowlist',
    FEEDBACK: 'feedback',
    
    // Configuration
    TASK_VALIDATION_ENABLED: 'taskValidationEnabled',
    
    // Temporary data
    TEMPORARY_UNBLOCK: 'temporaryUnblock',
    ONE_TIME_BYPASS: 'oneTimeBypass',
    LOCK_END_TIME: 'lockEndTime',
    LOCKED_TASK_ID: 'lockedTaskId'
} as const;

// Storage areas
export const STORAGE_AREAS = {
    LOCAL: 'local',
    SYNC: 'sync'
} as const;

// Default storage configuration
export const STORAGE_CONFIG = {
    // Use local storage for most data (higher limits)
    PRIMARY_AREA: STORAGE_AREAS.LOCAL,
    
    // Use sync storage for critical settings that should sync across devices
    SYNC_KEYS: [
        STORAGE_KEYS.OPENAI_API_KEY,
        STORAGE_KEYS.TASKS,
        STORAGE_KEYS.CURRENT_TASK,
        STORAGE_KEYS.EXTENSION_ENABLED,
        STORAGE_KEYS.TASK_VALIDATION_ENABLED
    ],
    
    // Use local storage for data that doesn't need to sync
    LOCAL_KEYS: [
        STORAGE_KEYS.BLOCKED_SITES,
        STORAGE_KEYS.STATS,
        STORAGE_KEYS.ALLOWLIST,
        STORAGE_KEYS.FEEDBACK,
        STORAGE_KEYS.TEMPORARY_UNBLOCK,
        STORAGE_KEYS.ONE_TIME_BYPASS,
        STORAGE_KEYS.LOCK_END_TIME,
        STORAGE_KEYS.LOCKED_TASK_ID
    ]
} as const;

// Type definitions
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
export type StorageArea = typeof STORAGE_AREAS[keyof typeof STORAGE_AREAS];

export interface StorageInfo {
    local: {
        size: number;
        keys: number;
        limit: number;
    };
    sync: {
        size: number;
        keys: number;
        limit: number;
    };
}

export interface TemporaryUnblock {
    url: string;
    until: number;
}

export interface OneTimeBypass {
    url: string;
}

export interface LockInfo {
    lockEndTime: number;
    lockedTaskId: string;
}