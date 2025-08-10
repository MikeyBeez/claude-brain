/**
 * Brain Manager v2 - Enhanced with Mercury Protocol Integration
 * 
 * Phase 2 implementation integrating ContextWindowAnalyzer and MercuryProtocolBridge
 * for automatic learning and context optimization
 */

import { ContextWindowAnalyzer, ContextAnalysisResult, ConversationMessage } from './ContextWindowAnalyzer';
import { MercuryProtocolBridge, MercurySession } from './MercuryProtocolBridge';

export interface BrainManagerConfig {
  enableMercuryLearning: boolean;
  autoAnalysisThreshold: number;
  maxContextWindow: number;
  learningPersistence: boolean;
}

export interface ProjectContext {
  name: string;
  path: string;
  status: string;
  lastModified: string;
  description?: string;
  mercurySessionId?: string;
}

export interface SessionAnalytics {
  totalSessions: number;
  learningInsights: number;
  averageEfficiency: number;
  topToolPatterns: string[];
  improvementTrends: { date: string; score: number }[];
}

export class BrainManagerV2 {
  private mercuryBridge: MercuryProtocolBridge;
  private analyzer: ContextWindowAnalyzer;
  private config: BrainManagerConfig;
  private currentProject: ProjectContext | null = null;
  private activeMercurySession: string | null = null;
  
  constructor(config: Partial<BrainManagerConfig> = {}) {
    this.config = {
      enableMercuryLearning: true,
      autoAnalysisThreshold: 0.3,
      maxContextWindow: 30000,
      learningPersistence: true,
      ...config
    };
    
    this.mercuryBridge = new MercuryProtocolBridge({
      enableAutoAnalysis: this.config.enableMercuryLearning,
      learningThreshold: this.config.autoAnalysisThreshold,
      storePatterns: this.config.learningPersistence,
      storeInsights: this.config.learningPersistence
    });
    
    this.analyzer = new ContextWindowAnalyzer();
  }
  
  /**
   * Initialize session with enhanced context loading and Mercury tracking
   */
  public async initializeSession(
    message: string,
    projectData?: ProjectContext,
    sessionData?: any,
    brainInterface?: any
  ): Promise<{
    success: boolean;
    project?: ProjectContext;
    mercurySessionId?: string;
    contextLoaded: boolean;
    analytics?: SessionAnalytics;
  }> {
    
    try {
      // Start Mercury session if enabled
      let mercurySessionId: string | undefined;
      if (this.config.enableMercuryLearning) {
        const intent = await this.classifyIntent(message);
        mercurySessionId = this.mercuryBridge.startSession(intent);
        this.activeMercurySession = mercurySessionId;
      }
      
      // Load project context
      if (projectData) {
        this.currentProject = {
          ...projectData,
          mercurySessionId
        };
      }
      
      // Load previous analytics if available
      let analytics: SessionAnalytics | undefined;
      if (brainInterface && this.config.learningPersistence) {
        analytics = await this.loadSessionAnalytics(brainInterface);
      }
      
      return {
        success: true,
        project: this.currentProject || undefined,
        mercurySessionId,
        contextLoaded: true,
        analytics
      };
      
    } catch (error) {
      console.error('Failed to initialize enhanced session:', error);
      return {
        success: false,
        contextLoaded: false
      };
    }
  }
  
  /**
   * Analyze context window for Mercury learning
   * This replaces the prototype implementation with full functionality
   */
  public async analyzeContextWindow(
    conversationMessages: ConversationMessage[],
    sessionId: string,
    brainInterface?: any
  ): Promise<ContextAnalysisResult | null> {
    
    if (!this.config.enableMercuryLearning) {
      return null;
    }
    
    try {
      // Complete the Mercury session with analysis
      const analysisResult = await this.mercuryBridge.completeSession(
        sessionId,
        conversationMessages,
        brainInterface
      );
      
      if (analysisResult && brainInterface) {
        // Store analysis results for future reference
        await this.persistAnalysisResult(analysisResult, brainInterface);
      }
      
      return analysisResult;
      
    } catch (error) {
      console.error('Context window analysis failed:', error);
      return null;
    }
  }
  
  /**
   * Generate enhanced project summary with Mercury insights
   */
  public async generateEnhancedSummary(
    projectName?: string,
    changes?: string[],
    notes?: string[],
    brainInterface?: any
  ): Promise<string> {
    
    const summary = [];
    const timestamp = new Date().toISOString();
    
    // Standard project summary header
    summary.push(`# ${projectName || this.currentProject?.name || 'Project'} Session Summary`);
    summary.push(`**Generated**: ${timestamp}\n`);
    
    // Project context
    if (this.currentProject) {
      summary.push('## 📂 Project Context');
      summary.push(`- **Project**: ${this.currentProject.name}`);
      summary.push(`- **Status**: ${this.currentProject.status}`);
      if (this.currentProject.description) {
        summary.push(`- **Description**: ${this.currentProject.description}`);
      }
      summary.push('');
    }
    
    // Changes and notes
    if (changes && changes.length > 0) {
      summary.push('## 🔄 Changes Made');
      for (const change of changes) {
        summary.push(`- ${change}`);
      }
      summary.push('');
    }
    
    if (notes && notes.length > 0) {
      summary.push('## 📝 Notes');
      for (const note of notes) {
        summary.push(`- ${note}`);
      }
      summary.push('');
    }
    
    // Mercury analysis integration
    if (this.activeMercurySession && this.config.enableMercuryLearning) {
      const sessionStatus = this.mercuryBridge.getSessionStatus(this.activeMercurySession);
      if (sessionStatus?.analysisResult) {
        const mercurySummary = this.mercuryBridge.createContinuationSummary(sessionStatus.analysisResult);
        summary.push(mercurySummary);
      }
    }
    
    // Learning trends and recommendations
    if (brainInterface && this.config.learningPersistence) {
      const trends = await this.generateLearningTrends(brainInterface);
      if (trends) {
        summary.push(trends);
      }
    }
    
    summary.push('---');
    summary.push('*Enhanced with Mercury Protocol Learning*');
    
    return summary.join('\n');
  }
  
  /**
   * Classify user intent for Mercury session tracking
   */
  private async classifyIntent(message: string): Promise<string> {
    // Simple intent classification - could be enhanced with ML
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('debug') || lowerMessage.includes('fix') || lowerMessage.includes('error')) {
      return 'debugging';
    }
    if (lowerMessage.includes('create') || lowerMessage.includes('build') || lowerMessage.includes('new')) {
      return 'creation';
    }
    if (lowerMessage.includes('analyze') || lowerMessage.includes('understand') || lowerMessage.includes('explain')) {
      return 'analysis';
    }
    if (lowerMessage.includes('optimize') || lowerMessage.includes('improve') || lowerMessage.includes('enhance')) {
      return 'optimization';
    }
    if (lowerMessage.includes('learn') || lowerMessage.includes('teach') || lowerMessage.includes('show')) {
      return 'learning';
    }
    
    return 'general';
  }
  
  /**
   * Load session analytics from Brain memory
   */
  private async loadSessionAnalytics(brainInterface: any): Promise<SessionAnalytics | undefined> {
    try {
      const analytics = await brainInterface.brain_recall('mercury_analytics');
      if (analytics && analytics.length > 0) {
        return analytics[0];
      }
    } catch (error) {
      console.error('Failed to load session analytics:', error);
    }
    return undefined;
  }
  
  /**
   * Persist analysis result for future learning
   */
  private async persistAnalysisResult(
    result: ContextAnalysisResult,
    brainInterface: any
  ): Promise<void> {
    try {
      await brainInterface.brain_remember(
        `mercury_session_${result.sessionId}`,
        {
          sessionId: result.sessionId,
          intent: result.intent,
          timestamp: result.timestamp,
          learningValue: result.learningValue,
          overallScore: result.success.overallScore,
          insightCount: result.insights.length,
          patternCount: result.toolPatterns.length,
          recommendations: result.recommendations
        },
        'mercury_sessions'
      );
    } catch (error) {
      console.error('Failed to persist analysis result:', error);
    }
  }
  
  /**
   * Generate learning trends summary
   */
  private async generateLearningTrends(brainInterface: any): Promise<string | null> {
    try {
      const sessions = await brainInterface.brain_recall('mercury_sessions');
      if (!sessions || sessions.length < 2) {
        return null;
      }
      
      const recentSessions = sessions.slice(-5); // Last 5 sessions
      const avgScore = recentSessions.reduce((sum: number, s: any) => sum + s.overallScore, 0) / recentSessions.length;
      const totalInsights = recentSessions.reduce((sum: number, s: any) => sum + s.insightCount, 0);
      
      const trends = [];
      trends.push('## 📈 Learning Trends');
      trends.push(`- **Recent Average Score**: ${(avgScore * 100).toFixed(1)}%`);
      trends.push(`- **Total Learning Insights**: ${totalInsights}`);
      trends.push(`- **Sessions Analyzed**: ${recentSessions.length}`);
      
      // Trend analysis
      if (recentSessions.length >= 3) {
        const firstHalf = recentSessions.slice(0, Math.floor(recentSessions.length / 2));
        const secondHalf = recentSessions.slice(Math.floor(recentSessions.length / 2));
        
        const firstAvg = firstHalf.reduce((sum: number, s: any) => sum + s.overallScore, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum: number, s: any) => sum + s.overallScore, 0) / secondHalf.length;
        
        if (secondAvg > firstAvg + 0.1) {
          trends.push('- **Trend**: 📈 Improving efficiency detected');
        } else if (firstAvg > secondAvg + 0.1) {
          trends.push('- **Trend**: 📉 Consider reviewing recent workflow patterns');
        } else {
          trends.push('- **Trend**: ➡️ Stable performance');
        }
      }
      
      trends.push('');
      return trends.join('\n');
      
    } catch (error) {
      console.error('Failed to generate learning trends:', error);
      return null;
    }
  }
  
  /**
   * Get current Mercury session status
   */
  public getMercurySessionStatus(): MercurySession | null {
    if (!this.activeMercurySession) {
      return null;
    }
    return this.mercuryBridge.getSessionStatus(this.activeMercurySession);
  }
  
  /**
   * Get learning statistics
   */
  public getLearningStats() {
    return this.mercuryBridge.getLearningStats();
  }
  
  /**
   * Export session data for analysis
   */
  public exportSessionData() {
    return this.mercuryBridge.exportSessionData();
  }
  
  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<BrainManagerConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Update Mercury bridge configuration
    this.mercuryBridge.updateConfig({
      enableAutoAnalysis: this.config.enableMercuryLearning,
      learningThreshold: this.config.autoAnalysisThreshold,
      storePatterns: this.config.learningPersistence,
      storeInsights: this.config.learningPersistence
    });
  }
  
  /**
   * Get configuration
   */
  public getConfig(): BrainManagerConfig {
    return { ...this.config };
  }
  
  /**
   * Complete current session and generate final analysis
   */
  public async completeSession(
    conversationMessages: ConversationMessage[],
    brainInterface?: any
  ): Promise<ContextAnalysisResult | null> {
    
    if (!this.activeMercurySession) {
      return null;
    }
    
    try {
      const result = await this.analyzeContextWindow(
        conversationMessages,
        this.activeMercurySession,
        brainInterface
      );
      
      // Clear active session
      this.activeMercurySession = null;
      
      return result;
      
    } catch (error) {
      console.error('Failed to complete session:', error);
      this.activeMercurySession = null;
      return null;
    }
  }
  
  /**
   * Generate recommendations based on learning history
   */
  public async generateRecommendations(
    currentIntent: string,
    brainInterface?: any
  ): Promise<string[]> {
    
    if (!brainInterface || !this.config.learningPersistence) {
      return [];
    }
    
    try {
      // Get similar sessions
      const sessions = await brainInterface.brain_recall('mercury_sessions');
      const similarSessions = sessions?.filter((s: any) => s.intent === currentIntent) || [];
      
      if (similarSessions.length === 0) {
        return [];
      }
      
      // Aggregate recommendations
      const recommendations = new Set<string>();
      
      for (const session of similarSessions) {
        if (session.recommendations) {
          for (const rec of session.recommendations) {
            recommendations.add(rec);
          }
        }
      }
      
      return Array.from(recommendations).slice(0, 3); // Top 3 recommendations
      
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      return [];
    }
  }
  
  /**
   * Extract conversation messages from various input formats
   */
  public extractConversationMessages(
    contextData: any,
    toolCalls: any[] = []
  ): ConversationMessage[] {
    return this.mercuryBridge.extractConversationMessages(contextData, toolCalls);
  }
}

// Export types for use in other modules
export {
  ContextAnalysisResult,
  ConversationMessage,
  ToolCall,
  SuccessMetrics,
  AnalysisInsight,
  ToolPattern
} from './ContextWindowAnalyzer';

export {
  MercurySession,
  BrainIntegrationConfig,
  LearningInsight
} from './MercuryProtocolBridge';
