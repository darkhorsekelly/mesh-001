// ===============================================
// ACTION RESOLVERS INDEX
// ===============================================
// Re-exports all action handler types and registry

export type {
    TickContext,
    ActionHandler,
    ActionValidator,
    ActionRegistration,
} from './actionTypes.js';

export {
    actionRegistry,
    getHandler,
    getValidator,
    isRegistered,
} from './actionRegistry.js';
