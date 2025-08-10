/**
 * MercuryProtocolBridge - Integration layer between Mercury Evolution and Brain Manager
 * 
 * Provides seamless integration of context window analysis into existing Brain workflows
 * Enables automatic learning without user overhead or workflow disruption
 */

import { ContextWindowAnalyzer, ContextAnalysisResult, ConversationMessage } from './ContextWindowAnalyzer';

export interface MercurySession {
  sessionId: string;
  intent: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'failed';
  analysisResult?: ContextAnalysisResult;
}

export interface BrainIntegrationConfig {
  enableAutoAnalysis: boolean;
  learningThreshold: number; // Minimum learning value to store insights
  maxSessionAge: number; // Maximum age in ms before session expires
  storePatterns: boolean;
  storeInsights: boolean;
}

export interface LearningInsight {
  sessionId: string;
  timestamp: number;
  insight: string;
  significance: number;
  toolsInvolved: string[];
  context: string;
  actionable: boolean;
}

export class MercuryProtocolBridge {
  private analyzer: ContextWindowAnalyzer;
  private activeSessions: Map<string, MercurySession>;
  private config: BrainIntegrationConfig;
  
  constructor(config: Partial<BrainIntegrationConfig> = {}) {
    this.analyzer = new ContextWindowAnalyzer();
    this.activeSessions = new Map();
    this.config = {
      enableAutoAnalysis: true,
      learningThreshold: 0.3,
      maxSessionAge: 24 * 60 * 60 * 1000, // 24 hours
      storePatterns: true,
      storeInsights: true,
      ...config
    };
  }
  
  /**
   * Start tracking a new Mercury session
   */
  public startSession(intent: string): string {
    const sessionId = this.generateSessionId();
    
    const session: MercurySession = {
      sessionId,
      intent,
      startTime: Date.now(),
      status: 'active'
    };
    
    this.activeSessions.set(sessionId, session);
    this.cleanupExpiredSessions();
    
    return sessionId;
  }
  
  /**
   * Complete a Mercury session with context analysis
   * This is the main integration point called by Brain Manager
   */
  public async completeSession(
    sessionId: string,
    conversationMessages: ConversationMessage[],
    brainInterface?: any
  ): Promise<ContextAnalysisResult | null> {
    
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      console.warn(`Mercury session ${sessionId} not found or not active`);
      return null;
    }
    
    if (!this.config.enableAutoAnalysis) {
      session.status = 'completed';
      session.endTime = Date.now();
      return null;
    }
    
    try {
      // Perform context analysis
      const analysisResult = this.analyzer.analyzeConversation(
        conversationMessages,
        session.intent,
        sessionId
      );
      
      // Update session
      session.status = 'completed';
      session.endTime = Date.now();
      session.analysisResult = analysisResult;
      
      // Store learning insights if enabled and threshold met
      if (this.config.storeInsights && 
          analysisResult.learningValue >= this.config.learningThreshold &&
          brainInterface) {
        await this.storeLearningInsights(analysisResult, brainInterface);
      }
      
      // Store tool patterns if enabled
      if (this.config.storePatterns && 
          analysisResult.toolPatterns.length > 0 &&
          brainInterface) {
        await this.storeToolPatterns(analysisResult, brainInterface);
      }
      
      return analysisResult;
      
    } catch (error) {
      console.error(`Mercury analysis failed for session ${sessionId}:`, error);
      session.status = 'failed';
      session.endTime = Date.now();
      return null;
    }
  }
  
  /**
   * Get analysis result for a completed session
   */
  public getSessionAnalysis(sessionId: string): ContextAnalysisResult | null {
    const session = this.activeSessions.get(sessionId);
    return session?.analysisResult || null;
  }
  
  /**
   * Get all active sessions
   */
  public getActiveSessions(): MercurySession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.status === 'active');
  }
  
  /**
   * Get session status
   */
  public getSessionStatus(sessionId: string): MercurySession | null {
    return this.activeSessions.get(sessionId) || null;
  }
  
  /**
   * Extract conversation messages from brain-manager context
   * This method bridges the gap between Brain Manager's data format and Mercury's requirements
   */
  public extractConversationMessages(
    contextData: any, 
    toolCalls: any[] = []
  ): ConversationMessage[] {
    
    const messages: ConversationMessage[] = [];
    
    // Handle different input formats from Brain Manager
    if (Array.isArray(contextData)) {
      // Direct array of messages
      for (const item of contextData) {
        if (item.role && item.content) {
          messages.push({
            role: item.role,
            content: item.content,
            timestamp: item.timestamp || Date.now(),
            toolCalls: item.toolCalls || []
          });
        }
      }
    } else if (contextData.conversationHistory) {
      // Nested conversation history
      for (const item of contextData.conversationHistory) {
        messages.push({
          role: item.role,
          content: item.content,
          timestamp: item.timestamp || Date.now(),
          toolCalls: item.toolCalls || []
        });
      }
    }
    
    // Add external tool calls if provided
    if (toolCalls.length > 0) {
      // Associate tool calls with the last assistant message or create a new one
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        lastMessage.toolCalls = toolCalls;
      } else {
        messages.push({
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          toolCalls: toolCalls
        });
      }
    }
    
    return messages;
  }
  
  /**
   * Store learning insights in Brain memory system
   */
  private async storeLearningInsights(
    analysisResult: ContextAnalysisResult,
    brainInterface: any
  ): Promise<void> {
    
    try {
      const insights: LearningInsight[] = analysisResult.insights
        .filter(insight => insight.significance >= this.config.learningThreshold)
        .map(insight => ({
          sessionId: analysisResult.sessionId,
          timestamp: analysisResult.timestamp,
          insight: insight.description,
          significance: insight.significance,
          toolsInvolved: this.extractToolsFromPatterns(analysisResult.toolPatterns),
          context: analysisResult.intent,
          actionable: insight.actionable
        }));
      
      // Store in Brain memory system
      for (const insight of insights) {
        await brainInterface.brain_remember(
          `mercury_insight_${insight.sessionId}_${Date.now()}`,
          insight,
          'mercury_learning'
        );
      }
      
      console.log(`Stored ${insights.length} learning insights for session ${analysisResult.sessionId}`);
      
    } catch (error) {
      console.error('Failed to store learning insights:', error);
    }
  }
  
  /**
   * Store tool patterns in Brain memory system
   */
  private async storeToolPatterns(
    analysisResult: ContextAnalysisResult,
    brainInterface: any
  ): Promise<void> {
    
    try {
      const significantPatterns = analysisResult.toolPatterns
        .filter(pattern => pattern.frequency > 1 || pattern.efficiency > 0.8);
      
      for (const pattern of significantPatterns) {
        const patternData = {
          sessionId: analysisResult.sessionId,
          timestamp: analysisResult.timestamp,
          sequence: pattern.sequence,
          frequency: pattern.frequency,
          successRate: pattern.successRate,
          context: analysisResult.intent,
          efficiency: pattern.efficiency
        };
        
        await brainInterface.brain_remember(
          `mercury_pattern_${pattern.sequence.join('_')}_${Date.now()}`,
          patternData,
          'mercury_patterns'
        );
      }
      
      console.log(`Stored ${significantPatterns.length} tool patterns for session ${analysisResult.sessionId}`);
      
    } catch (error) {
      console.error('Failed to store tool patterns:', error);
    }
  }
  
  /**
   * Extract tool names from patterns
   */
  private extractToolsFromPatterns(patterns: any[]): string[] {
    const tools = new Set<string>();
    
    for (const pattern of patterns) {
      if (pattern.sequence) {
        for (const tool of pattern.sequence) {
          tools.add(tool);
        }
      }
    }
    
    return Array.from(tools);
  }
  
  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `mercury_${timestamp}_${random}`;
  }
  
  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      const sessionAge = now - session.startTime;
      if (sessionAge > this.config.maxSessionAge) {
        expiredSessions.push(sessionId);
      }
    }
    
    for (const sessionId of expiredSessions) {
      this.activeSessions.delete(sessionId);
    }
    
    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired Mercury sessions`);
    }
  }
  
  /**
   * Get configuration
   */
  public getConfig(): BrainIntegrationConfig {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<BrainIntegrationConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  /**
   * Get learning statistics
   */
  public getLearningStats(): {
    totalSessions: number;
    completedSessions: number;
    averageLearningValue: number;
    topInsightTypes: { [key: string]: number };
  } {
    
    const sessions = Array.from(this.activeSessions.values());
    const completedSessions = sessions.filter(s => s.status === 'completed' && s.analysisResult);
    
    let totalLearningValue = 0;
    const insightTypes: { [key: string]: number } = {};
    
    for (const session of completedSessions) {
      if (session.analysisResult) {
        totalLearningValue += session.analysisResult.learningValue;
        
        for (const insight of session.analysisResult.insights) {
          insightTypes[insight.type] = (insightTypes[insight.type] || 0) + 1;
        }
      }
    }
    
    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      averageLearningValue: completedSessions.length > 0 ? totalLearningValue / completedSessions.length : 0,
      topInsightTypes: insightTypes
    };
  }
  
  /**
   * Export session data for analysis
   */
  public exportSessionData(): any[] {
    return Array.from(this.activeSessions.values()).map(session => ({
      sessionId: session.sessionId,
      intent: session.intent,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      duration: session.endTime ? session.endTime - session.startTime : null,
      learningValue: session.analysisResult?.learningValue || 0,
      insightCount: session.analysisResult?.insights.length || 0,
      patternCount: session.analysisResult?.toolPatterns.length || 0,
      overallScore: session.analysisResult?.success.overallScore || 0
    }));
  }
  
  /**
   * Create a summary for continuation notes
   * This is called by Brain Manager when generating project summaries
   */
  public createContinuationSummary(analysisResult: ContextAnalysisResult): string {
    if (!analysisResult) {
      return '';
    }
    
    const summary = [];
    summary.push('## 🧠 Mercury Learning Analysis\n');
    
    // Success metrics summary
    const success = analysisResult.success;
    summary.push('### Session Success Metrics:');
    summary.push(`- **Overall Score**: ${(success.overallScore * 100).toFixed(1)}% (Confidence: ${(success.confidence * 100).toFixed(1)}%)`);
    summary.push(`- **Tool Progression**: ${(success.toolProgression * 100).toFixed(1)}% - ${this.getProgressionDescription(success.toolProgression)}`);
    summary.push(`- **Efficiency**: ${(success.efficiencyScore * 100).toFixed(1)}% - ${this.getEfficiencyDescription(success.efficiencyScore)}`);
    summary.push(`- **Learning Value**: ${(analysisResult.learningValue * 100).toFixed(1)}%\n`);
    
    // Key insights
    if (analysisResult.insights.length > 0) {
      summary.push('### Key Learning Insights:');
      const topInsights = analysisResult.insights
        .filter(i => i.significance > 0.6)
        .slice(0, 3);
      
      for (const insight of topInsights) {
        const emoji = this.getInsightEmoji(insight.type);
        summary.push(`${emoji} **${insight.type.toUpperCase()}**: ${insight.description}`);
        if (insight.recommendation) {
          summary.push(`   💡 *${insight.recommendation}*`);
        }
      }
      summary.push('');
    }
    
    // Tool patterns
    if (analysisResult.toolPatterns.length > 0) {
      summary.push('### Effective Tool Patterns:');
      const topPatterns = analysisResult.toolPatterns.slice(0, 2);
      
      for (const pattern of topPatterns) {
        summary.push(`🔗 **${pattern.sequence.join(' → ')}** (${pattern.frequency}x, ${(pattern.efficiency * 100).toFixed(0)}% efficient)`);
      }
      summary.push('');
    }
    
    // Recommendations
    if (analysisResult.recommendations.length > 0) {
      summary.push('### Mercury Recommendations:');
      for (const rec of analysisResult.recommendations.slice(0, 2)) {
        summary.push(`💡 ${rec}`);
      }
      summary.push('');
    }
    
    return summary.join('\n');
  }
  
  private getProgressionDescription(score: number): string {
    if (score > 0.8) return 'Excellent tool progression';
    if (score > 0.6) return 'Good workflow advancement';
    if (score > 0.4) return 'Moderate progression';
    return 'High repetition detected';
  }
  
  private getEfficiencyDescription(score: number): string {
    if (score > 0.8) return 'Highly efficient tool usage';
    if (score > 0.6) return 'Good efficiency';
    if (score > 0.4) return 'Moderate efficiency';
    return 'Could be more efficient';
  }
  
  private getInsightEmoji(type: string): string {
    switch (type) {
      case 'pattern': return '🔍';
      case 'efficiency': return '⚡';
      case 'learning': return '🧠';
      case 'workflow': return '🔄';
      default: return '💡';
    }
  }
}
