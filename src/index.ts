/**
 * Mercury Protocol Enhancement - Phase 2
 * Main export module for enhanced Brain Manager with context learning
 */

export { ContextWindowAnalyzer } from './ContextWindowAnalyzer';
export { MercuryProtocolBridge } from './MercuryProtocolBridge';
export { BrainManagerV2 } from './BrainManagerV2';

// Export all types
export type {
  ConversationMessage,
  ToolCall,
  SuccessMetrics,
  AnalysisInsight,
  ContextAnalysisResult,
  ToolPattern
} from './ContextWindowAnalyzer';

export type {
  MercurySession,
  BrainIntegrationConfig,
  LearningInsight
} from './MercuryProtocolBridge';

export type {
  BrainManagerConfig,
  ProjectContext,
  SessionAnalytics
} from './BrainManagerV2';

// Version and metadata
export const VERSION = '2.0.0';
export const PHASE = 'Phase 2 - Full Integration';
export const FEATURES = [
  'Advanced context window analysis',
  'Behavioral success detection',
  'Automatic learning integration',
  'Enhanced Brain Manager with Mercury insights',
  'Zero-overhead learning workflow',
  'Pattern recognition and recommendations'
] as const;
