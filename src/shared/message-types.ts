// Message type constants for tunnl.ai Chrome Extension

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
    
    // Settings management
    GET_SETTINGS: 'GET_SETTINGS',
    UPDATE_SETTINGS: 'UPDATE_SETTINGS',
    OPEN_SETTINGS: 'OPEN_SETTINGS',
    
    // Feedback and blocking
    BLOCK_FEEDBACK: 'BLOCK_FEEDBACK',
    SHOW_BLOCK_TOAST: 'SHOW_BLOCK_TOAST',
    SHOW_BLOCK_MODAL: 'SHOW_BLOCK_MODAL',
    
    // API management
    VALIDATE_API_KEY: 'VALIDATE_API_KEY',
    
    // Allowlist management
    ADD_TO_ALLOWLIST: 'ADD_TO_ALLOWLIST',
    REMOVE_FROM_ALLOWLIST: 'REMOVE_FROM_ALLOWLIST',
    
    // Unblocking actions
    TEMPORARY_UNBLOCK: 'TEMPORARY_UNBLOCK',
    ONE_TIME_BYPASS: 'ONE_TIME_BYPASS',
    
    // Statistics
    GET_STATS: 'GET_STATS',
    UPDATE_STATS: 'UPDATE_STATS',
    RESET_STATS: 'RESET_STATS',
    
    // Data management
    EXPORT_DATA: 'EXPORT_DATA',
    IMPORT_DATA: 'IMPORT_DATA',
    CLEAR_ALL_DATA: 'CLEAR_ALL_DATA'
} as const;

// Message response status
export const MESSAGE_STATUS = {
    SUCCESS: 'success',
    ERROR: 'error',
    PENDING: 'pending'
} as const;

// Message categories for organization
export const MESSAGE_CATEGORIES = {
    TASK_MANAGEMENT: [
        MESSAGE_TYPES.SET_CURRENT_TASK,
        MESSAGE_TYPES.CLEAR_CURRENT_TASK,
        MESSAGE_TYPES.DELETE_TASK,
        MESSAGE_TYPES.VALIDATE_TASK
    ],
    
    EXTENSION_CONTROL: [
        MESSAGE_TYPES.TOGGLE_EXTENSION,
        MESSAGE_TYPES.OPEN_SETTINGS
    ],
    
    URL_ANALYSIS: [
        MESSAGE_TYPES.ANALYZE_URL,
        MESSAGE_TYPES.SHOW_BLOCK_TOAST,
        MESSAGE_TYPES.SHOW_BLOCK_MODAL,
        MESSAGE_TYPES.BLOCK_FEEDBACK
    ],
    
    SETTINGS: [
        MESSAGE_TYPES.GET_SETTINGS,
        MESSAGE_TYPES.UPDATE_SETTINGS,
        MESSAGE_TYPES.VALIDATE_API_KEY
    ],
    
    ALLOWLIST: [
        MESSAGE_TYPES.ADD_TO_ALLOWLIST,
        MESSAGE_TYPES.REMOVE_FROM_ALLOWLIST
    ],
    
    UNBLOCKING: [
        MESSAGE_TYPES.TEMPORARY_UNBLOCK,
        MESSAGE_TYPES.ONE_TIME_BYPASS
    ],
    
    STATISTICS: [
        MESSAGE_TYPES.GET_STATS,
        MESSAGE_TYPES.UPDATE_STATS,
        MESSAGE_TYPES.RESET_STATS
    ],
    
    DATA_MANAGEMENT: [
        MESSAGE_TYPES.EXPORT_DATA,
        MESSAGE_TYPES.IMPORT_DATA,
        MESSAGE_TYPES.CLEAR_ALL_DATA
    ]
} as const;

// Type definitions
export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];
export type MessageStatus = typeof MESSAGE_STATUS[keyof typeof MESSAGE_STATUS];

export interface BaseMessage {
    type: MessageType;
}

export interface SetCurrentTaskMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.SET_CURRENT_TASK;
    index?: number;
    text?: string;
}

export interface ClearCurrentTaskMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.CLEAR_CURRENT_TASK;
}

export interface ToggleExtensionMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.TOGGLE_EXTENSION;
    enabled: boolean;
}

export interface AnalyzeUrlMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.ANALYZE_URL;
    url: string;
}

export interface ValidateTaskMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.VALIDATE_TASK;
    taskText: string;
}

export interface GetSettingsMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.GET_SETTINGS;
}

export interface UpdateSettingsMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.UPDATE_SETTINGS;
    settings: Record<string, any>;
}

export interface OpenSettingsMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.OPEN_SETTINGS;
}

export interface BlockFeedbackMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.BLOCK_FEEDBACK;
    data: {
        url: string;
        reason: string;
        correct: boolean;
    };
}

export interface ShowBlockToastMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.SHOW_BLOCK_TOAST;
    url: string;
    message: string;
    activityUnderstanding: string;
}

export interface ShowBlockModalMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.SHOW_BLOCK_MODAL;
    url: string;
    message: string;
    activityUnderstanding: string;
    currentTask: string;
}

export interface ValidateApiKeyMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.VALIDATE_API_KEY;
    apiKey: string;
}

export interface AddToAllowlistMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.ADD_TO_ALLOWLIST;
    host?: string;
    url?: string;
}

export interface TemporaryUnblockMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.TEMPORARY_UNBLOCK;
    url: string;
    duration?: number;
}

export interface OneTimeBypassMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.ONE_TIME_BYPASS;
    url: string;
}

export interface GetStatsMessage extends BaseMessage {
    type: typeof MESSAGE_TYPES.GET_STATS;
}

export type TunnlMessage = 
    | SetCurrentTaskMessage
    | ClearCurrentTaskMessage
    | ToggleExtensionMessage
    | AnalyzeUrlMessage
    | ValidateTaskMessage
    | GetSettingsMessage
    | UpdateSettingsMessage
    | OpenSettingsMessage
    | BlockFeedbackMessage
    | ShowBlockToastMessage
    | ShowBlockModalMessage
    | ValidateApiKeyMessage
    | AddToAllowlistMessage
    | TemporaryUnblockMessage
    | OneTimeBypassMessage
    | GetStatsMessage;

export interface MessageResponse<T = any> {
    success: boolean;
    error?: string;
    data?: T;
}