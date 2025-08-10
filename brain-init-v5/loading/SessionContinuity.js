/**
 * SessionContinuity - Cross-Chat Session Management
 * 
 * Maintains context and learning across chat sessions to enable warm starts
 * and intelligent context pre-loading based on user patterns and project continuity.
 */

class SessionContinuity {
  constructor() {
    this.sessionStore = new Map();
    this.userPatterns = new Map();
    this.projectContinuity = new Map();
    
    // Continuity configuration
    this.config = {
      maxSessionHistory: 50,
      patternLearningThreshold: 3,
      continuityDecayHours: 24,
      warmStartEnabled: true,
      contextPreservationRate: 0.7
    };
    
    // Pattern tracking
    this.patterns = {
      frequentResources: new Map(),
      taskSequences: [],
      projectSwitching: [],
      timeBasedUsage: {},
      contextEffectiveness: {}
    };
    
    // Session metadata
    this.metadata = {
      totalSessions: 0,
      successfulWarmStarts: 0,
      continuityBreaks: 0,
      averageSessionLength: 0
    };
    
    console.error('🔗 SessionContinuity initialized with warm start capability');
  }

  /**
   * Get session data for continuity analysis
   * @param {Object} intent - Current session intent
   * @returns {Object|null} Session continuity data or null if none available
   */
  async getSessionData(intent) {
    try {
      // Check for recent session with similar intent
      const similarSession = this.findSimilarSession(intent);
      
      if (similarSession) {
        console.error(`🔗 Found similar session for continuity: ${similarSession.sessionId}`);
        return this.buildContinuityData(similarSession, intent);
      }
      
      // Check for project-based continuity
      const projectContinuity = this.getProjectContinuity(intent);
      
      if (projectContinuity) {
        console.error(`📁 Found project continuity data: ${intent.projectContext?.name}`);
        return projectContinuity;
      }
      
      // Check for pattern-based predictions
      const patternContinuity = this.getPatternBasedContinuity(intent);
      
      if (patternContinuity) {
        console.error('📊 Generated pattern-based continuity data');
        return patternContinuity;
      }
      
      console.error('🆕 No continuity data available - starting fresh session');
      return null;
      
    } catch (error) {
      console.error('❌ Error retrieving session data:', error);
      return null;
    }
  }

  /**
   * Update session data with loading results and metrics
   * @param {Object} session - Loading session data
   * @param {Object} metrics - Session metrics and results
   */
  async updateSessionData(session, metrics) {
    try {
      const sessionData = {
        sessionId: session.sessionId,
        intent: session.intent,
        startTime: session.startTime,
        endTime: Date.now(),
        metrics: metrics,
        loadedResources: metrics.tierResults ? this.extractLoadedResources(metrics.tierResults) : [],
        effectiveness: this.calculateSessionEffectiveness(metrics),
        continuitySource: session.continuitySource || 'fresh',
        projectContext: session.intent.projectContext,
        timestamp: new Date().toISOString()
      };
      
      // Store in session store
      this.sessionStore.set(session.sessionId, sessionData);
      
      // Update patterns
      this.updatePatterns(sessionData);
      
      // Update project continuity
      this.updateProjectContinuity(sessionData);
      
      // Update user patterns
      this.updateUserPatterns(sessionData);
      
      // Clean up old sessions
      this.cleanupOldSessions();
      
      // Update metadata
      this.updateMetadata(sessionData);
      
      console.error(`🔗 Session continuity updated for ${session.sessionId}`);
      
    } catch (error) {
      console.error('❌ Error updating session data:', error);
    }
  }

  /**
   * Find sessions with similar intent patterns
   * @param {Object} intent - Current intent to match
   * @returns {Object|null} Most similar session or null
   */
  findSimilarSession(intent) {
    let bestMatch = null;
    let bestScore = 0;
    const recentSessions = this.getRecentSessions(this.config.continuityDecayHours);
    
    for (const session of recentSessions) {
      const similarity = this.calculateIntentSimilarity(intent, session.intent);
      
      if (similarity > bestScore && similarity > 0.7) {
        bestScore = similarity;
        bestMatch = session;
      }
    }
    
    return bestMatch;
  }

  /**
   * Calculate similarity between two intents
   * @param {Object} intent1 - First intent
   * @param {Object} intent2 - Second intent
   * @returns {number} Similarity score (0-1)
   */
  calculateIntentSimilarity(intent1, intent2) {
    let score = 0;
    let factors = 0;
    
    // Task type similarity
    if (intent1.taskType === intent2.taskType) {
      score += 0.4;
    }
    factors += 0.4;
    
    // Project context similarity
    if (intent1.projectContext && intent2.projectContext) {
      if (intent1.projectContext.name === intent2.projectContext.name) {
        score += 0.3;
      }
      factors += 0.3;
    }
    
    // Domain similarity
    if (intent1.domain === intent2.domain) {
      score += 0.2;
    }
    factors += 0.2;
    
    // Keywords overlap
    const keywords1 = new Set(intent1.keywords || []);
    const keywords2 = new Set(intent2.keywords || []);
    const overlap = [...keywords1].filter(k => keywords2.has(k)).length;
    const union = new Set([...keywords1, ...keywords2]).size;
    
    if (union > 0) {
      score += (overlap / union) * 0.1;
    }
    factors += 0.1;
    
    return factors > 0 ? score / factors : 0;
  }

  /**
   * Build continuity data from similar session
   * @param {Object} similarSession - Previously successful session
   * @param {Object} currentIntent - Current session intent
   * @returns {Object} Continuity data for loading optimization
   */
  buildContinuityData(similarSession, currentIntent) {
    const continuityData = {
      source: 'similar_session',
      sourceSessionId: similarSession.sessionId,
      confidence: this.calculateContinuityConfidence(similarSession),
      
      // Resource prioritization
      frequentResources: this.getFrequentResources(similarSession),
      highValueResources: this.getHighValueResources(similarSession),
      
      // Loading optimizations
      recommendedTierAdjustments: this.calculateTierAdjustments(similarSession),
      budgetOptimizations: this.calculateBudgetOptimizations(similarSession),
      
      // Context preservation
      preservedContext: this.extractPreservableContext(similarSession),
      
      // Temporal patterns
      timeBasedOptimizations: this.getTimeBasedOptimizations(currentIntent),
      
      // Performance predictions
      predictedLoadTime: similarSession.metrics?.totalLoadTime || 0,
      predictedSuccessRate: similarSession.effectiveness || 0.8
    };
    
    return continuityData;
  }

  /**
   * Get project-based continuity data
   * @param {Object} intent - Current intent with project context
   * @returns {Object|null} Project continuity data or null
   */
  getProjectContinuity(intent) {
    if (!intent.projectContext?.name) {
      return null;
    }
    
    const projectName = intent.projectContext.name;
    const projectData = this.projectContinuity.get(projectName);
    
    if (!projectData) {
      return null;
    }
    
    return {
      source: 'project_continuity',
      projectName: projectName,
      confidence: 0.8,
      
      // Project-specific optimizations
      frequentResources: projectData.frequentResources || [],
      projectProtocols: projectData.protocols || [],
      contextPatterns: projectData.contextPatterns || {},
      
      // Project state
      lastSessionTime: projectData.lastSessionTime,
      sessionCount: projectData.sessionCount,
      averageEffectiveness: projectData.averageEffectiveness || 0.7,
      
      // Warm start data
      warmStartContext: projectData.warmStartContext || {}
    };
  }

  /**
   * Get pattern-based continuity predictions
   * @param {Object} intent - Current intent
   * @returns {Object|null} Pattern-based continuity data or null
   */
  getPatternBasedContinuity(intent) {
    const patterns = this.analyzeUserPatterns(intent);
    
    if (!patterns || patterns.confidence < 0.6) {
      return null;
    }
    
    return {
      source: 'pattern_prediction',
      confidence: patterns.confidence,
      
      // Pattern-based predictions
      predictedResources: patterns.predictedResources || [],
      predictedProtocols: patterns.predictedProtocols || [],
      
      // Behavioral patterns
      typicalSessionLength: patterns.sessionLength || 0,
      preferredLoadingStyle: patterns.loadingStyle || 'balanced',
      
      // Optimization hints
      budgetRecommendations: patterns.budgetHints || {},
      tierPreferences: patterns.tierPreferences || {}
    };
  }

  /**
   * Update learned patterns from session data
   * @param {Object} sessionData - Completed session data
   */
  updatePatterns(sessionData) {
    // Update resource frequency patterns
    for (const resource of sessionData.loadedResources) {
      const key = `${resource.type}:${resource.id}`;
      const current = this.patterns.frequentResources.get(key) || { count: 0, lastUsed: 0, effectiveness: 0 };
      
      this.patterns.frequentResources.set(key, {
        count: current.count + 1,
        lastUsed: Date.now(),
        effectiveness: (current.effectiveness + (resource.effectiveness || 0.5)) / 2,
        type: resource.type,
        id: resource.id
      });
    }
    
    // Update task sequence patterns
    this.patterns.taskSequences.push({
      taskType: sessionData.intent.taskType,
      timestamp: sessionData.endTime,
      effectiveness: sessionData.effectiveness,
      duration: sessionData.endTime - sessionData.startTime
    });
    
    // Keep only recent sequences
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    this.patterns.taskSequences = this.patterns.taskSequences.filter(seq => seq.timestamp > cutoff);
    
    // Update time-based usage patterns
    const hour = new Date(sessionData.startTime).getHours();
    if (!this.patterns.timeBasedUsage[hour]) {
      this.patterns.timeBasedUsage[hour] = { count: 0, avgEffectiveness: 0 };
    }
    
    const timePattern = this.patterns.timeBasedUsage[hour];
    timePattern.count++;
    timePattern.avgEffectiveness = (timePattern.avgEffectiveness + sessionData.effectiveness) / 2;
  }

  /**
   * Update project-specific continuity data
   * @param {Object} sessionData - Session data with project context
   */
  updateProjectContinuity(sessionData) {
    const projectName = sessionData.intent.projectContext?.name;
    
    if (!projectName) {
      return;
    }
    
    const current = this.projectContinuity.get(projectName) || {
      sessionCount: 0,
      frequentResources: [],
      protocols: [],
      contextPatterns: {},
      totalEffectiveness: 0,
      lastSessionTime: 0,
      warmStartContext: {}
    };
    
    // Update project statistics
    current.sessionCount++;
    current.totalEffectiveness += sessionData.effectiveness;
    current.averageEffectiveness = current.totalEffectiveness / current.sessionCount;
    current.lastSessionTime = sessionData.endTime;
    
    // Update frequent resources for this project
    const resourceFrequency = new Map();
    for (const resource of sessionData.loadedResources) {
      const key = `${resource.type}:${resource.id}`;
      resourceFrequency.set(key, (resourceFrequency.get(key) || 0) + 1);
    }
    
    // Merge with existing frequent resources
    for (const [key, frequency] of resourceFrequency) {
      const existing = current.frequentResources.find(r => `${r.type}:${r.id}` === key);
      if (existing) {
        existing.frequency += frequency;
      } else {
        const [type, id] = key.split(':');
        current.frequentResources.push({ type, id, frequency });
      }
    }
    
    // Sort by frequency and keep top resources
    current.frequentResources.sort((a, b) => b.frequency - a.frequency);
    current.frequentResources = current.frequentResources.slice(0, 20);
    
    // Update warm start context with most effective resources
    if (sessionData.effectiveness > 0.8) {
      current.warmStartContext = {
        effectiveResources: sessionData.loadedResources.slice(0, 10),
        budgetAllocation: sessionData.metrics.tierBreakdown,
        lastUpdated: sessionData.endTime
      };
    }
    
    this.projectContinuity.set(projectName, current);
  }

  /**
   * Update user behavior patterns
   * @param {Object} sessionData - Session data for pattern learning
   */
  updateUserPatterns(sessionData) {
    const userId = 'default_user'; // In real system, would use actual user ID
    
    const current = this.userPatterns.get(userId) || {
      sessionCount: 0,
      preferredTasks: {},
      loadingPreferences: {},
      timePatterns: {},
      averageSessionDuration: 0
    };
    
    // Update session statistics
    current.sessionCount++;
    const sessionDuration = sessionData.endTime - sessionData.startTime;
    current.averageSessionDuration = (current.averageSessionDuration + sessionDuration) / 2;
    
    // Update task preferences
    const taskType = sessionData.intent.taskType;
    current.preferredTasks[taskType] = (current.preferredTasks[taskType] || 0) + 1;
    
    // Update loading preferences based on session effectiveness
    if (sessionData.effectiveness > 0.7) {
      const budgetUtilization = sessionData.metrics.budgetUtilization;
      
      if (budgetUtilization < 0.6) {
        current.loadingPreferences.conservative = (current.loadingPreferences.conservative || 0) + 1;
      } else if (budgetUtilization > 0.9) {
        current.loadingPreferences.aggressive = (current.loadingPreferences.aggressive || 0) + 1;
      } else {
        current.loadingPreferences.balanced = (current.loadingPreferences.balanced || 0) + 1;
      }
    }
    
    this.userPatterns.set(userId, current);
  }

  /**
   * Analyze user patterns to predict preferences
   * @param {Object} intent - Current intent for analysis
   * @returns {Object} Pattern analysis results
   */
  analyzeUserPatterns(intent) {
    const userId = 'default_user';
    const patterns = this.userPatterns.get(userId);
    
    if (!patterns || patterns.sessionCount < this.config.patternLearningThreshold) {
      return { confidence: 0 };
    }
    
    // Analyze task type patterns
    const taskPreference = patterns.preferredTasks[intent.taskType] || 0;
    const taskConfidence = Math.min(taskPreference / patterns.sessionCount, 1.0);
    
    // Analyze loading style preferences
    const loadingStyles = patterns.loadingPreferences;
    const preferredStyle = Object.keys(loadingStyles).reduce((a, b) => 
      loadingStyles[a] > loadingStyles[b] ? a : b);
    
    // Generate predictions based on patterns
    const predictions = {
      confidence: (taskConfidence + 0.5) / 2, // Base confidence + task familiarity
      sessionLength: patterns.averageSessionDuration,
      loadingStyle: preferredStyle,
      
      // Resource predictions based on task type frequency
      predictedResources: this.predictResourcesFromPatterns(intent.taskType),
      
      // Budget recommendations
      budgetHints: this.generateBudgetHints(preferredStyle),
      
      // Tier preferences
      tierPreferences: this.calculateTierPreferences(patterns)
    };
    
    return predictions;
  }

  /**
   * Helper methods for pattern analysis
   */
  predictResourcesFromPatterns(taskType) {
    const predicted = [];
    
    // Get resources frequently used with this task type
    for (const [key, data] of this.patterns.frequentResources) {
      if (data.count >= 3) { // Used at least 3 times
        predicted.push({
          type: data.type,
          id: data.id,
          confidence: Math.min(data.count / 10, 1.0),
          effectiveness: data.effectiveness
        });
      }
    }
    
    return predicted.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }

  generateBudgetHints(loadingStyle) {
    const hints = {
      conservative: { tier1: 0.08, tier2: 0.10, tier3: 0.05 },
      balanced: { tier1: 0.10, tier2: 0.15, tier3: 0.10 },
      aggressive: { tier1: 0.12, tier2: 0.18, tier3: 0.15 }
    };
    
    return hints[loadingStyle] || hints.balanced;
  }

  calculateTierPreferences(patterns) {
    // Simple heuristic based on loading style
    const style = Object.keys(patterns.loadingPreferences).reduce((a, b) => 
      patterns.loadingPreferences[a] > patterns.loadingPreferences[b] ? a : b);
    
    return {
      tier1Priority: 1.0, // Always high priority
      tier2Priority: style === 'aggressive' ? 0.9 : 0.7,
      tier3Priority: style === 'conservative' ? 0.3 : 0.6
    };
  }

  /**
   * Utility methods
   */
  getRecentSessions(hours) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return Array.from(this.sessionStore.values())
      .filter(session => session.endTime > cutoff)
      .sort((a, b) => b.endTime - a.endTime);
  }

  extractLoadedResources(tierResults) {
    const resources = [];
    
    for (const [tierName, tierResult] of Object.entries(tierResults)) {
      if (tierResult.resources) {
        for (const resource of tierResult.resources) {
          resources.push({
            type: resource.type,
            id: resource.id,
            tier: tierName,
            loadTime: resource.loadTime,
            effectiveness: resource.loadResult?.success ? 1.0 : 0.0
          });
        }
      }
    }
    
    return resources;
  }

  calculateSessionEffectiveness(metrics) {
    // Combined score based on success rate, budget efficiency, and load time
    const successWeight = 0.5;
    const budgetWeight = 0.3;
    const timeWeight = 0.2;
    
    const successScore = metrics.successRate || 0;
    const budgetScore = Math.min(metrics.budgetUtilization * 2, 1.0); // Optimal around 50%
    const timeScore = metrics.averageLoadTime ? Math.max(0, 1 - (metrics.averageLoadTime / 2000)) : 0.5;
    
    return (successScore * successWeight) + (budgetScore * budgetWeight) + (timeScore * timeWeight);
  }

  cleanupOldSessions() {
    if (this.sessionStore.size <= this.config.maxSessionHistory) {
      return;
    }
    
    // Remove oldest sessions beyond limit
    const sessions = Array.from(this.sessionStore.entries())
      .sort((a, b) => b[1].endTime - a[1].endTime);
    
    const toRemove = sessions.slice(this.config.maxSessionHistory);
    for (const [sessionId] of toRemove) {
      this.sessionStore.delete(sessionId);
    }
    
    console.error(`🧹 Cleaned up ${toRemove.length} old sessions`);
  }

  updateMetadata(sessionData) {
    this.metadata.totalSessions++;
    
    if (sessionData.continuitySource !== 'fresh') {
      this.metadata.successfulWarmStarts++;
    }
    
    const avgDuration = sessionData.endTime - sessionData.startTime;
    this.metadata.averageSessionLength = 
      (this.metadata.averageSessionLength + avgDuration) / 2;
  }

  /**
   * Additional helper methods for continuity calculations
   */
  calculateContinuityConfidence(session) {
    const recency = (Date.now() - session.endTime) / (1000 * 60 * 60); // Hours ago
    const recencyScore = Math.max(0, 1 - (recency / 24)); // Decay over 24 hours
    
    const effectivenessScore = session.effectiveness || 0.5;
    
    return (recencyScore * 0.6) + (effectivenessScore * 0.4);
  }

  getFrequentResources(session) {
    return session.loadedResources
      .filter(resource => resource.effectiveness > 0.7)
      .slice(0, 10);
  }

  getHighValueResources(session) {
    return session.loadedResources
      .filter(resource => resource.tier === 'tier1' && resource.effectiveness > 0.8)
      .slice(0, 5);
  }

  calculateTierAdjustments(session) {
    const tierResults = session.metrics.tierBreakdown;
    const adjustments = {};
    
    for (const [tier, results] of Object.entries(tierResults)) {
      if (results.loaded && results.attempted) {
        const successRate = results.loaded / results.attempted;
        
        if (successRate > 0.9 && results.budgetUsed < 0.5) {
          adjustments[tier] = 'increase_budget';
        } else if (successRate < 0.6) {
          adjustments[tier] = 'reduce_scope';
        }
      }
    }
    
    return adjustments;
  }

  calculateBudgetOptimizations(session) {
    const utilization = session.metrics.budgetUtilization;
    
    return {
      recommendedBudget: utilization > 0.9 ? this.config.contextBudget * 1.2 : 
                        utilization < 0.5 ? this.config.contextBudget * 0.8 : 
                        this.config.contextBudget,
      strategy: utilization > 0.9 ? 'aggressive' : 
               utilization < 0.5 ? 'conservative' : 
               'balanced'
    };
  }

  extractPreservableContext(session) {
    // Extract context that can be preserved across sessions
    return {
      projectState: session.intent.projectContext,
      criticalResources: this.getHighValueResources(session),
      protocolsUsed: session.metrics.protocolsLoaded || [],
      effectivePatterns: session.loadedResources.filter(r => r.effectiveness > 0.8)
    };
  }

  getTimeBasedOptimizations(intent) {
    const currentHour = new Date().getHours();
    const timePattern = this.patterns.timeBasedUsage[currentHour];
    
    if (timePattern && timePattern.count >= 3) {
      return {
        expectedEffectiveness: timePattern.avgEffectiveness,
        recommendations: timePattern.avgEffectiveness > 0.8 ? 
          ['increase_supplementary_loading'] : 
          ['focus_on_critical_resources']
      };
    }
    
    return null;
  }

  /**
   * Public API methods for external usage
   */
  getContinuityMetrics() {
    return {
      ...this.metadata,
      warmStartSuccessRate: this.metadata.totalSessions > 0 ? 
        this.metadata.successfulWarmStarts / this.metadata.totalSessions : 0,
      patternConfidence: this.calculateOverallPatternConfidence(),
      activePatternsCount: this.patterns.frequentResources.size
    };
  }

  calculateOverallPatternConfidence() {
    const userId = 'default_user';
    const patterns = this.userPatterns.get(userId);
    
    if (!patterns || patterns.sessionCount < this.config.patternLearningThreshold) {
      return 0;
    }
    
    return Math.min(patterns.sessionCount / 20, 1.0); // Max confidence at 20 sessions
  }

  exportContinuityData() {
    return {
      sessions: Array.from(this.sessionStore.values()),
      patterns: {
        frequentResources: Array.from(this.patterns.frequentResources.entries()),
        taskSequences: this.patterns.taskSequences,
        timeBasedUsage: this.patterns.timeBasedUsage
      },
      projectContinuity: Array.from(this.projectContinuity.entries()),
      userPatterns: Array.from(this.userPatterns.entries()),
      metadata: this.metadata
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionContinuity;
}

// Global availability
if (typeof global !== 'undefined') {
  global.SessionContinuity = SessionContinuity;
}

export default SessionContinuity;