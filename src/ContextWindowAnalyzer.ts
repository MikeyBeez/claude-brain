/**
 * ContextWindowAnalyzer - Advanced behavioral analysis for Mercury Protocol
 * 
 * Revolutionary approach: "Tool repetition = failure, progression = success"
 * Analyzes conversation patterns to detect learning opportunities and success indicators
 */

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
  result?: string;
  timestamp?: number;
}

export interface SuccessMetrics {
  toolProgression: number;
  repetitionScore: number;
  diversityScore: number;
  efficiencyScore: number;
  overallScore: number;
  confidence: number;
}

export interface AnalysisInsight {
  type: 'pattern' | 'efficiency' | 'learning' | 'workflow';
  significance: number; // 0.0-1.0
  description: string;
  actionable: boolean;
  recommendation?: string;
}

export interface ContextAnalysisResult {
  sessionId: string;
  intent: string;
  success: SuccessMetrics;
  insights: AnalysisInsight[];
  toolPatterns: ToolPattern[];
  recommendations: string[];
  learningValue: number;
  timestamp: number;
}

export interface ToolPattern {
  sequence: string[];
  frequency: number;
  successRate: number;
  context: string;
  efficiency: number;
}

export class ContextWindowAnalyzer {
  private readonly REPETITION_THRESHOLD = 3;
  private readonly EFFICIENCY_WINDOW = 5;
  
  /**
   * Analyze conversation context for behavioral success patterns
   * Core algorithm: Tool repetition indicates struggle, progression indicates success
   */
  public analyzeConversation(
    messages: ConversationMessage[],
    intent: string,
    sessionId: string
  ): ContextAnalysisResult {
    
    const toolCalls = this.extractToolCalls(messages);
    const toolSequences = this.analyzeToolSequences(toolCalls);
    const success = this.calculateSuccessMetrics(toolCalls, toolSequences);
    const insights = this.generateInsights(toolCalls, toolSequences, success);
    const patterns = this.identifyToolPatterns(toolSequences);
    const recommendations = this.generateRecommendations(insights, patterns);
    
    return {
      sessionId,
      intent,
      success,
      insights,
      toolPatterns: patterns,
      recommendations,
      learningValue: this.calculateLearningValue(success, insights),
      timestamp: Date.now()
    };
  }
  
  /**
   * Extract and normalize tool calls from conversation messages
   */
  private extractToolCalls(messages: ConversationMessage[]): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    
    for (const message of messages) {
      if (message.toolCalls) {
        toolCalls.push(...message.toolCalls);
      }
    }
    
    return toolCalls.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }
  
  /**
   * Analyze tool call sequences for patterns and efficiency
   */
  private analyzeToolSequences(toolCalls: ToolCall[]): string[][] {
    const sequences: string[][] = [];
    let currentSequence: string[] = [];
    
    for (let i = 0; i < toolCalls.length; i++) {
      const tool = toolCalls[i];
      currentSequence.push(tool.name);
      
      // Break sequence on user input or significant time gap
      const nextTool = toolCalls[i + 1];
      if (!nextTool || this.isSequenceBreak(tool, nextTool)) {
        if (currentSequence.length > 0) {
          sequences.push([...currentSequence]);
          currentSequence = [];
        }
      }
    }
    
    if (currentSequence.length > 0) {
      sequences.push(currentSequence);
    }
    
    return sequences;
  }
  
  /**
   * Calculate comprehensive success metrics based on tool usage patterns
   */
  private calculateSuccessMetrics(
    toolCalls: ToolCall[],
    sequences: string[][]
  ): SuccessMetrics {
    
    // Tool Progression Score: Higher when tools build upon each other
    const toolProgression = this.calculateToolProgression(sequences);
    
    // Repetition Score: Lower when same tools repeated frequently 
    const repetitionScore = this.calculateRepetitionScore(toolCalls);
    
    // Diversity Score: Higher when appropriate variety of tools used
    const diversityScore = this.calculateDiversityScore(toolCalls);
    
    // Efficiency Score: Higher when minimal tools achieve objectives
    const efficiencyScore = this.calculateEfficiencyScore(sequences);
    
    // Overall Score: Weighted combination
    const overallScore = (
      toolProgression * 0.3 +
      repetitionScore * 0.25 +
      diversityScore * 0.2 +
      efficiencyScore * 0.25
    );
    
    // Confidence based on data quality and quantity
    const confidence = this.calculateConfidence(toolCalls, sequences);
    
    return {
      toolProgression,
      repetitionScore,
      diversityScore,
      efficiencyScore,
      overallScore,
      confidence
    };
  }
  
  /**
   * Calculate tool progression score - measures building/advancement vs repetition
   */
  private calculateToolProgression(sequences: string[][]): number {
    let progressionScore = 0;
    let totalSequences = 0;
    
    for (const sequence of sequences) {
      if (sequence.length < 2) continue;
      
      let sequenceProgression = 0;
      const uniqueTools = new Set(sequence);
      
      // High progression: many unique tools in logical sequence
      // Low progression: repeated tools or circular patterns
      if (uniqueTools.size === sequence.length) {
        sequenceProgression = 1.0; // Perfect progression
      } else if (uniqueTools.size / sequence.length > 0.7) {
        sequenceProgression = 0.8; // Good progression
      } else if (uniqueTools.size / sequence.length > 0.5) {
        sequenceProgression = 0.6; // Moderate progression
      } else {
        sequenceProgression = 0.3; // Poor progression (lots of repetition)
      }
      
      progressionScore += sequenceProgression;
      totalSequences++;
    }
    
    return totalSequences > 0 ? progressionScore / totalSequences : 0.5;
  }
  
  /**
   * Calculate repetition score - penalize excessive tool repetition
   */
  private calculateRepetitionScore(toolCalls: ToolCall[]): number {
    if (toolCalls.length < 2) return 1.0;
    
    const toolCounts = new Map<string, number>();
    let consecutiveRepeats = 0;
    let maxConsecutiveRepeats = 0;
    
    for (let i = 0; i < toolCalls.length; i++) {
      const toolName = toolCalls[i].name;
      toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
      
      // Track consecutive repeats
      if (i > 0 && toolCalls[i - 1].name === toolName) {
        consecutiveRepeats++;
        maxConsecutiveRepeats = Math.max(maxConsecutiveRepeats, consecutiveRepeats);
      } else {
        consecutiveRepeats = 0;
      }
    }
    
    // Penalize based on excessive repetition
    const repetitionPenalty = Math.min(maxConsecutiveRepeats / this.REPETITION_THRESHOLD, 1.0);
    return Math.max(0, 1.0 - repetitionPenalty);
  }
  
  /**
   * Calculate diversity score - reward appropriate tool variety
   */
  private calculateDiversityScore(toolCalls: ToolCall[]): number {
    if (toolCalls.length === 0) return 0.5;
    
    const uniqueTools = new Set(toolCalls.map(tc => tc.name)).size;
    const totalCalls = toolCalls.length;
    
    // Optimal diversity ratio depends on context
    const diversityRatio = uniqueTools / totalCalls;
    
    // Sweet spot: 0.3-0.7 diversity ratio
    if (diversityRatio >= 0.3 && diversityRatio <= 0.7) {
      return 1.0;
    } else if (diversityRatio >= 0.2 && diversityRatio <= 0.8) {
      return 0.8;
    } else {
      return 0.5;
    }
  }
  
  /**
   * Calculate efficiency score - reward achieving goals with minimal tools
   */
  private calculateEfficiencyScore(sequences: string[][]): number {
    if (sequences.length === 0) return 0.5;
    
    let totalEfficiency = 0;
    
    for (const sequence of sequences) {
      if (sequence.length <= 3) {
        totalEfficiency += 1.0; // Highly efficient
      } else if (sequence.length <= 5) {
        totalEfficiency += 0.8; // Good efficiency
      } else if (sequence.length <= 8) {
        totalEfficiency += 0.6; // Moderate efficiency
      } else {
        totalEfficiency += 0.3; // Low efficiency
      }
    }
    
    return totalEfficiency / sequences.length;
  }
  
  /**
   * Calculate confidence in the analysis based on data quality
   */
  private calculateConfidence(toolCalls: ToolCall[], sequences: string[][]): number {
    let confidence = 0.5; // Base confidence
    
    // More tool calls = higher confidence (up to a point)
    if (toolCalls.length >= 5) confidence += 0.2;
    if (toolCalls.length >= 10) confidence += 0.1;
    
    // Multiple sequences = higher confidence
    if (sequences.length >= 2) confidence += 0.1;
    if (sequences.length >= 3) confidence += 0.1;
    
    // Diverse tool usage = higher confidence
    const uniqueTools = new Set(toolCalls.map(tc => tc.name)).size;
    if (uniqueTools >= 3) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * Generate actionable insights from analysis
   */
  private generateInsights(
    toolCalls: ToolCall[],
    sequences: string[][],
    success: SuccessMetrics
  ): AnalysisInsight[] {
    
    const insights: AnalysisInsight[] = [];
    
    // Pattern insights
    if (success.toolProgression < 0.5) {
      insights.push({
        type: 'pattern',
        significance: 0.8,
        description: 'Detected high tool repetition indicating potential struggle or inefficiency',
        actionable: true,
        recommendation: 'Consider alternative tool approaches or breaking down complex tasks'
      });
    }
    
    if (success.repetitionScore < 0.4) {
      insights.push({
        type: 'efficiency',
        significance: 0.9,
        description: 'Excessive tool repetition detected - may indicate suboptimal workflow',
        actionable: true,
        recommendation: 'Review tool sequence effectiveness and consider workflow optimization'
      });
    }
    
    if (success.overallScore > 0.8) {
      insights.push({
        type: 'workflow',
        significance: 0.7,
        description: 'Highly effective tool usage pattern detected',
        actionable: true,
        recommendation: 'Document this workflow pattern for future similar tasks'
      });
    }
    
    // Learning insights
    if (success.diversityScore > 0.8 && success.efficiencyScore > 0.7) {
      insights.push({
        type: 'learning',
        significance: 0.6,
        description: 'Balanced tool usage suggests strong task understanding',
        actionable: false
      });
    }
    
    return insights;
  }
  
  /**
   * Identify reusable tool patterns
   */
  private identifyToolPatterns(sequences: string[][]): ToolPattern[] {
    const patterns: ToolPattern[] = [];
    const sequenceMap = new Map<string, number>();
    
    // Count sequence patterns
    for (const sequence of sequences) {
      if (sequence.length >= 2) {
        const key = sequence.join(' -> ');
        sequenceMap.set(key, (sequenceMap.get(key) || 0) + 1);
      }
    }
    
    // Convert to pattern objects
    for (const [sequence, frequency] of sequenceMap.entries()) {
      if (frequency >= 1) { // Even single occurrences can be valuable
        patterns.push({
          sequence: sequence.split(' -> '),
          frequency,
          successRate: 0.8, // Default - would be refined with more data
          context: 'general',
          efficiency: frequency > 1 ? 0.9 : 0.7
        });
      }
    }
    
    return patterns.sort((a, b) => b.frequency - a.frequency);
  }
  
  /**
   * Generate actionable recommendations based on analysis
   */
  private generateRecommendations(
    insights: AnalysisInsight[],
    patterns: ToolPattern[]
  ): string[] {
    
    const recommendations: string[] = [];
    
    // Extract actionable insights
    for (const insight of insights) {
      if (insight.actionable && insight.recommendation) {
        recommendations.push(insight.recommendation);
      }
    }
    
    // Pattern-based recommendations
    if (patterns.length > 0) {
      const topPattern = patterns[0];
      if (topPattern.frequency > 1) {
        recommendations.push(
          `Consider standardizing the pattern: ${topPattern.sequence.join(' → ')} for similar tasks`
        );
      }
    }
    
    return recommendations;
  }
  
  /**
   * Calculate overall learning value of the session
   */
  private calculateLearningValue(
    success: SuccessMetrics,
    insights: AnalysisInsight[]
  ): number {
    
    let learningValue = 0;
    
    // Base learning from success metrics
    learningValue += success.overallScore * 0.3;
    
    // Learning from insights
    const significantInsights = insights.filter(i => i.significance > 0.7);
    learningValue += Math.min(significantInsights.length * 0.2, 0.4);
    
    // Bonus for high confidence
    learningValue += success.confidence * 0.3;
    
    return Math.min(learningValue, 1.0);
  }
  
  /**
   * Determine if there should be a sequence break between tool calls
   */
  private isSequenceBreak(current: ToolCall, next: ToolCall): boolean {
    // Break on significant time gap (>30 seconds)
    const timeDiff = (next.timestamp || 0) - (current.timestamp || 0);
    if (timeDiff > 30000) return true;
    
    // Break on tool category change (heuristic)
    const currentCategory = this.getToolCategory(current.name);
    const nextCategory = this.getToolCategory(next.name);
    
    if (currentCategory !== nextCategory) return true;
    
    return false;
  }
  
  /**
   * Categorize tools for sequence analysis
   */
  private getToolCategory(toolName: string): string {
    // Simple categorization - could be enhanced
    if (toolName.includes('filesystem') || toolName.includes('read') || toolName.includes('write')) {
      return 'filesystem';
    }
    if (toolName.includes('brain') || toolName.includes('memory')) {
      return 'memory';
    }
    if (toolName.includes('search') || toolName.includes('web')) {
      return 'search';
    }
    if (toolName.includes('git') || toolName.includes('system')) {
      return 'system';
    }
    
    return 'general';
  }
}
