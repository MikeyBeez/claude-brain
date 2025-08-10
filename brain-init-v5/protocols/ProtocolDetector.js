/**
 * ProtocolDetector - Intelligent Protocol Detection Engine
 * 
 * Analyzes context and user intent to automatically detect which protocols
 * are needed for optimal task execution. Uses trigger-based matching with
 * machine learning optimization for protocol recommendation accuracy.
 */

class ProtocolDetector {
  constructor(options = {}) {
    this.protocolRegistry = options.protocolRegistry || new ProtocolRegistry();
    this.triggerSystem = options.triggerSystem || new TriggerSystem();
    
    // Detection configuration
    this.config = {
      confidenceThreshold: 0.7,
      maxProtocolsPerSession: 8,
      learningEnabled: true,
      triggerCacheSize: 100,
      detectionTimeout: 2000
    };
    
    // Detection state
    this.detectionHistory = [];
    this.triggerCache = new Map();
    this.protocolUsageStats = new Map();
    
    // Performance metrics
    this.metrics = {
      totalDetections: 0,
      accurateDetections: 0,
      averageDetectionTime: 0,
      triggerHitRate: 0,
      protocolUtilization: {}
    };
    
    // Learning patterns
    this.learningPatterns = {
      contextProtocolPairs: new Map(),
      taskTypeProtocols: new Map(),
      sequentialProtocols: new Map(),
      effectivenessScores: new Map()
    };
    
    console.error('🎯 ProtocolDetector initialized with intelligent trigger analysis');
  }

  /**
   * Main detection method - analyzes context to determine required protocols
   * @param {Object} context - Context from discovery and loading phases
   * @param {Object} options - Detection options
   * @returns {Promise<Object>} Protocol detection results
   */
  async detectRequiredProtocols(context, options = {}) {
    const detectionSession = {
      sessionId: this.generateDetectionId(),
      startTime: Date.now(),
      context: context,
      options: options
    };

    console.error(`🎯 Starting protocol detection session ${detectionSession.sessionId}`);

    try {
      // Step 1: Initialize detection session
      await this.initializeDetection(detectionSession);
      
      // Step 2: Analyze context triggers
      const triggerAnalysis = await this.analyzeTriggers(detectionSession);
      
      // Step 3: Apply protocol matching rules
      const protocolMatches = await this.matchProtocols(triggerAnalysis, detectionSession);
      
      // Step 4: Apply learning-based optimization
      const optimizedProtocols = await this.applyLearningOptimization(protocolMatches, detectionSession);
      
      // Step 5: Validate and rank protocols
      const finalProtocols = await this.validateAndRankProtocols(optimizedProtocols, detectionSession);
      
      // Step 6: Generate detection report
      const detectionResult = await this.generateDetectionReport(finalProtocols, detectionSession);
      
      return detectionResult;

    } catch (error) {
      console.error('❌ Protocol detection failed:', error);
      return this.handleDetectionFailure(detectionSession, error);
    }
  }

  /**
   * Initialize detection session with context analysis
   */
  async initializeDetection(session) {
    console.error('🏁 Initializing protocol detection...');
    
    // Analyze context structure
    session.contextAnalysis = {
      intentType: session.context.intent?.taskType || 'unknown',
      projectContext: session.context.intent?.projectContext,
      loadedResources: session.context.loadedResources || [],
      sessionContinuity: session.context.continuityData,
      complexity: this.analyzeContextComplexity(session.context),
      urgency: session.context.intent?.urgency || 'normal'
    };
    
    // Initialize trigger analysis workspace
    session.triggerWorkspace = {
      activeTriggers: [],
      conditionalTriggers: [],
      contextualTriggers: [],
      temporalTriggers: []
    };
    
    // Load relevant protocol metadata
    session.availableProtocols = await this.protocolRegistry.getAvailableProtocols(
      session.contextAnalysis.intentType
    );
    
    console.error(`🔍 Context analysis: ${session.contextAnalysis.intentType} task, complexity: ${session.contextAnalysis.complexity}`);
  }

  /**
   * Analyze context for protocol triggers
   */
  async analyzeTriggers(session) {
    console.error('🔍 Analyzing protocol triggers...');
    
    const triggerAnalysis = {
      directTriggers: [],
      contextualTriggers: [],
      patternTriggers: [],
      emergencyTriggers: [],
      confidence: 0
    };

    // Direct trigger analysis - explicit conditions
    const directTriggers = await this.analyzeDirectTriggers(session);
    triggerAnalysis.directTriggers = directTriggers;
    
    // Contextual trigger analysis - implicit conditions
    const contextualTriggers = await this.analyzeContextualTriggers(session);
    triggerAnalysis.contextualTriggers = contextualTriggers;
    
    // Pattern-based trigger analysis - learned associations
    const patternTriggers = await this.analyzePatternTriggers(session);
    triggerAnalysis.patternTriggers = patternTriggers;
    
    // Emergency trigger analysis - failure conditions
    const emergencyTriggers = await this.analyzeEmergencyTriggers(session);
    triggerAnalysis.emergencyTriggers = emergencyTriggers;
    
    // Calculate overall trigger confidence
    triggerAnalysis.confidence = this.calculateTriggerConfidence(triggerAnalysis);
    
    console.error(`🎯 Trigger analysis: ${triggerAnalysis.directTriggers.length} direct, ${triggerAnalysis.contextualTriggers.length} contextual`);
    
    return triggerAnalysis;
  }

  /**
   * Analyze direct, explicit trigger conditions
   */
  async analyzeDirectTriggers(session) {
    const directTriggers = [];
    const context = session.context;
    
    // Error conditions trigger error recovery protocols
    if (this.hasErrorConditions(context)) {
      directTriggers.push({
        type: 'error_condition',
        protocol: 'error-recovery',
        confidence: 0.95,
        trigger: 'Error conditions detected in context',
        priority: 1.0
      });
    }
    
    // Communication needs trigger user communication protocols
    if (this.hasCommunicationNeeds(context)) {
      directTriggers.push({
        type: 'communication_need',
        protocol: 'user-communication', 
        confidence: 0.90,
        trigger: 'User communication requirements detected',
        priority: 0.8
      });
    }
    
    // Task complexity triggers appropriate approach protocols
    if (session.contextAnalysis.complexity === 'high') {
      directTriggers.push({
        type: 'complexity_condition',
        protocol: 'task-approach',
        confidence: 0.85,
        trigger: 'High complexity task requires systematic approach',
        priority: 0.7
      });
    }
    
    // Multiple information sources trigger integration protocols
    if (this.hasMultipleSources(context)) {
      directTriggers.push({
        type: 'integration_need',
        protocol: 'information-integration',
        confidence: 0.80,
        trigger: 'Multiple information sources require integration',
        priority: 0.6
      });
    }
    
    // Long-running tasks trigger progress communication
    if (this.isLongRunningTask(context)) {
      directTriggers.push({
        type: 'progress_need',
        protocol: 'progress-communication',
        confidence: 0.75,
        trigger: 'Long-running task requires progress updates',
        priority: 0.5
      });
    }
    
    return directTriggers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Analyze contextual, implicit trigger conditions
   */
  async analyzeContextualTriggers(session) {
    const contextualTriggers = [];
    const context = session.context;
    
    // Project-based protocol preferences
    if (session.contextAnalysis.projectContext) {
      const projectProtocols = await this.getProjectProtocolPreferences(
        session.contextAnalysis.projectContext
      );
      
      for (const protocol of projectProtocols) {
        contextualTriggers.push({
          type: 'project_preference',
          protocol: protocol.id,
          confidence: protocol.confidence,
          trigger: `Project ${session.contextAnalysis.projectContext.name} prefers ${protocol.id}`,
          priority: protocol.priority
        });
      }
    }
    
    // Intent-based protocol associations
    const intentProtocols = await this.getIntentProtocolAssociations(
      session.contextAnalysis.intentType
    );
    
    for (const protocol of intentProtocols) {
      contextualTriggers.push({
        type: 'intent_association',
        protocol: protocol.id,
        confidence: protocol.confidence,
        trigger: `Intent ${session.contextAnalysis.intentType} commonly uses ${protocol.id}`,
        priority: protocol.priority
      });
    }
    
    // Resource-based protocol implications
    const resourceProtocols = await this.getResourceProtocolImplications(
      session.contextAnalysis.loadedResources
    );
    
    for (const protocol of resourceProtocols) {
      contextualTriggers.push({
        type: 'resource_implication',
        protocol: protocol.id,
        confidence: protocol.confidence,
        trigger: `Loaded resources suggest ${protocol.id} usage`,
        priority: protocol.priority
      });
    }
    
    return contextualTriggers.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze pattern-based triggers from learning
   */
  async analyzePatternTriggers(session) {
    const patternTriggers = [];
    
    if (!this.config.learningEnabled) {
      return patternTriggers;
    }
    
    // Check learned context-protocol associations
    const contextKey = this.generateContextKey(session.context);
    const learnedProtocols = this.learningPatterns.contextProtocolPairs.get(contextKey);
    
    if (learnedProtocols) {
      for (const [protocolId, stats] of learnedProtocols) {
        if (stats.usage >= 3 && stats.effectiveness > 0.7) {
          patternTriggers.push({
            type: 'learned_pattern',
            protocol: protocolId,
            confidence: Math.min(stats.effectiveness, 0.9),
            trigger: `Learned pattern: ${protocolId} effective in similar contexts`,
            priority: stats.effectiveness * 0.6,
            usage: stats.usage
          });
        }
      }
    }
    
    // Check task sequence patterns
    const taskSequence = this.getRecentTaskSequence();
    const sequentialProtocols = this.learningPatterns.sequentialProtocols.get(
      JSON.stringify(taskSequence)
    );
    
    if (sequentialProtocols) {
      for (const [protocolId, frequency] of sequentialProtocols) {
        if (frequency >= 2) {
          patternTriggers.push({
            type: 'sequence_pattern',
            protocol: protocolId,
            confidence: Math.min(frequency / 5, 0.8),
            trigger: `Sequential pattern: ${protocolId} often follows this task sequence`,
            priority: 0.4,
            frequency: frequency
          });
        }
      }
    }
    
    return patternTriggers.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze emergency trigger conditions
   */
  async analyzeEmergencyTriggers(session) {
    const emergencyTriggers = [];
    
    // System failure indicators
    if (this.hasSystemFailureIndicators(session.context)) {
      emergencyTriggers.push({
        type: 'system_failure',
        protocol: 'error-recovery',
        confidence: 1.0,
        trigger: 'System failure detected - emergency recovery needed',
        priority: 1.0,
        emergency: true
      });
    }
    
    // User confusion indicators
    if (this.hasUserConfusionIndicators(session.context)) {
      emergencyTriggers.push({
        type: 'user_confusion',
        protocol: 'user-communication',
        confidence: 0.9,
        trigger: 'User confusion detected - clarification needed',
        priority: 0.9,
        emergency: true
      });
    }
    
    // Resource exhaustion
    if (this.hasResourceExhaustionIndicators(session.context)) {
      emergencyTriggers.push({
        type: 'resource_exhaustion',
        protocol: 'resource-optimization',
        confidence: 0.85,
        trigger: 'Resource exhaustion detected - optimization needed',
        priority: 0.8,
        emergency: true
      });
    }
    
    return emergencyTriggers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Match triggers to specific protocols
   */
  async matchProtocols(triggerAnalysis, session) {
    console.error('🔗 Matching triggers to protocols...');
    
    const protocolMatches = new Map();
    
    // Process each category of triggers
    const allTriggers = [
      ...triggerAnalysis.directTriggers,
      ...triggerAnalysis.contextualTriggers,
      ...triggerAnalysis.patternTriggers,
      ...triggerAnalysis.emergencyTriggers
    ];
    
    for (const trigger of allTriggers) {
      const protocolId = trigger.protocol;
      
      if (!protocolMatches.has(protocolId)) {
        protocolMatches.set(protocolId, {
          protocolId: protocolId,
          triggers: [],
          totalConfidence: 0,
          maxPriority: 0,
          hasEmergency: false,
          metadata: {}
        });
      }
      
      const match = protocolMatches.get(protocolId);
      match.triggers.push(trigger);
      match.totalConfidence = Math.max(match.totalConfidence, trigger.confidence);
      match.maxPriority = Math.max(match.maxPriority, trigger.priority);
      
      if (trigger.emergency) {
        match.hasEmergency = true;
      }
      
      // Aggregate trigger metadata
      if (trigger.usage) match.metadata.usage = trigger.usage;
      if (trigger.frequency) match.metadata.frequency = trigger.frequency;
    }
    
    console.error(`🎯 Protocol matching: ${protocolMatches.size} protocols identified`);
    
    return Array.from(protocolMatches.values());
  }

  /**
   * Apply learning-based optimization to protocol selection
   */
  async applyLearningOptimization(protocolMatches, session) {
    console.error('🧠 Applying learning optimization...');
    
    if (!this.config.learningEnabled) {
      return protocolMatches;
    }
    
    const optimizedMatches = [];
    
    for (const match of protocolMatches) {
      const optimizedMatch = { ...match };
      
      // Apply effectiveness learning
      const effectivenessKey = `${session.contextAnalysis.intentType}:${match.protocolId}`;
      const effectivenessScore = this.learningPatterns.effectivenessScores.get(effectivenessKey);
      
      if (effectivenessScore) {
        // Adjust confidence based on learned effectiveness
        const learningFactor = effectivenessScore.score > 0.8 ? 1.1 : 
                              effectivenessScore.score < 0.5 ? 0.8 : 1.0;
        
        optimizedMatch.totalConfidence = Math.min(
          optimizedMatch.totalConfidence * learningFactor, 
          1.0
        );
        
        optimizedMatch.learningAdjustment = {
          originalConfidence: match.totalConfidence,
          effectivenessScore: effectivenessScore.score,
          usageCount: effectivenessScore.count,
          adjustmentFactor: learningFactor
        };
      }
      
      // Apply co-occurrence optimization
      const coOccurringProtocols = this.getCoOccurringProtocols(match.protocolId);
      const contextProtocols = protocolMatches.map(m => m.protocolId);
      
      const coOccurrenceBoost = coOccurringProtocols.filter(
        p => contextProtocols.includes(p)
      ).length * 0.05;
      
      optimizedMatch.totalConfidence = Math.min(
        optimizedMatch.totalConfidence + coOccurrenceBoost,
        1.0
      );
      
      optimizedMatches.push(optimizedMatch);
    }
    
    console.error('🎯 Learning optimization applied to protocol selection');
    
    return optimizedMatches;
  }

  /**
   * Validate and rank final protocol selection
   */
  async validateAndRankProtocols(protocolMatches, session) {
    console.error('✅ Validating and ranking protocols...');
    
    const validatedProtocols = [];
    
    for (const match of protocolMatches) {
      // Validate protocol availability
      const protocolMetadata = await this.protocolRegistry.getProtocolMetadata(match.protocolId);
      
      if (!protocolMetadata) {
        console.warn(`⚠️  Protocol ${match.protocolId} not found in registry`);
        continue;
      }
      
      // Check protocol prerequisites
      const prerequisitesMet = await this.checkProtocolPrerequisites(
        protocolMetadata, 
        session.context
      );
      
      if (!prerequisitesMet) {
        console.warn(`⚠️  Protocol ${match.protocolId} prerequisites not met`);
        continue;
      }
      
      // Calculate final ranking score
      const rankingScore = this.calculateProtocolRankingScore(match, protocolMetadata);
      
      validatedProtocols.push({
        ...match,
        metadata: protocolMetadata,
        rankingScore: rankingScore,
        validated: true
      });
    }
    
    // Sort by ranking score (emergency protocols first, then by score)
    validatedProtocols.sort((a, b) => {
      if (a.hasEmergency && !b.hasEmergency) return -1;
      if (!a.hasEmergency && b.hasEmergency) return 1;
      return b.rankingScore - a.rankingScore;
    });
    
    // Apply session limits
    const limitedProtocols = validatedProtocols.slice(0, this.config.maxProtocolsPerSession);
    
    console.error(`✅ Validated ${limitedProtocols.length} protocols for loading`);
    
    return limitedProtocols;
  }

  /**
   * Generate comprehensive detection report
   */
  async generateDetectionReport(protocols, session) {
    const endTime = Date.now();
    const detectionTime = endTime - session.startTime;
    
    const report = {
      sessionId: session.sessionId,
      success: true,
      detectionTime: detectionTime,
      protocols: protocols,
      
      // Detection metrics
      metrics: {
        totalProtocolsDetected: protocols.length,
        averageConfidence: protocols.reduce((sum, p) => sum + p.totalConfidence, 0) / protocols.length,
        emergencyProtocols: protocols.filter(p => p.hasEmergency).length,
        learningOptimized: protocols.filter(p => p.learningAdjustment).length
      },
      
      // Context analysis summary
      contextAnalysis: session.contextAnalysis,
      
      // Trigger analysis summary
      triggerSummary: {
        directTriggers: session.triggerAnalysis?.directTriggers?.length || 0,
        contextualTriggers: session.triggerAnalysis?.contextualTriggers?.length || 0,
        patternTriggers: session.triggerAnalysis?.patternTriggers?.length || 0,
        emergencyTriggers: session.triggerAnalysis?.emergencyTriggers?.length || 0
      },
      
      // Recommendations
      recommendations: this.generateProtocolRecommendations(protocols, session),
      
      // Learning updates
      learningUpdates: this.generateLearningUpdates(protocols, session),
      
      timestamp: new Date().toISOString()
    };
    
    // Update metrics
    this.updateDetectionMetrics(report);
    
    // Store detection history
    this.detectionHistory.push({
      sessionId: session.sessionId,
      timestamp: endTime,
      protocolCount: protocols.length,
      detectionTime: detectionTime,
      success: true
    });
    
    console.error(`🎉 Protocol detection complete: ${protocols.length} protocols in ${detectionTime}ms`);
    
    return report;
  }

  /**
   * Helper methods for trigger analysis
   */
  hasErrorConditions(context) {
    return context.errors || 
           context.failures || 
           (context.loadedResources && context.loadedResources.length === 0) ||
           (context.metrics && context.metrics.successRate < 0.5);
  }

  hasCommunicationNeeds(context) {
    return context.intent?.urgency === 'high' ||
           context.intent?.complexity === 'high' ||
           context.userConfusion ||
           context.clarificationNeeded;
  }

  hasMultipleSources(context) {
    const sources = new Set();
    if (context.loadedResources) {
      context.loadedResources.forEach(resource => sources.add(resource.type));
    }
    return sources.size > 2;
  }

  isLongRunningTask(context) {
    return context.intent?.complexity === 'high' ||
           context.intent?.estimatedDuration > 300000 || // 5 minutes
           context.intent?.taskType === 'analysis' ||
           context.intent?.taskType === 'research';
  }

  analyzeContextComplexity(context) {
    let complexityScore = 0;
    
    if (context.intent?.keywords && context.intent.keywords.length > 5) complexityScore += 1;
    if (context.loadedResources && context.loadedResources.length > 10) complexityScore += 1;
    if (context.intent?.projectContext) complexityScore += 1;
    if (context.continuityData) complexityScore += 1;
    
    if (complexityScore >= 3) return 'high';
    if (complexityScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Utility methods
   */
  generateDetectionId() {
    return `detect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateContextKey(context) {
    const key = {
      taskType: context.intent?.taskType || 'unknown',
      complexity: this.analyzeContextComplexity(context),
      projectType: context.intent?.projectContext?.type || 'none'
    };
    return JSON.stringify(key);
  }

  calculateTriggerConfidence(triggerAnalysis) {
    const allTriggers = [
      ...triggerAnalysis.directTriggers,
      ...triggerAnalysis.contextualTriggers,
      ...triggerAnalysis.patternTriggers,
      ...triggerAnalysis.emergencyTriggers
    ];
    
    if (allTriggers.length === 0) return 0;
    
    const avgConfidence = allTriggers.reduce((sum, t) => sum + t.confidence, 0) / allTriggers.length;
    const emergencyBoost = triggerAnalysis.emergencyTriggers.length > 0 ? 0.1 : 0;
    
    return Math.min(avgConfidence + emergencyBoost, 1.0);
  }

  calculateProtocolRankingScore(match, metadata) {
    const confidenceWeight = 0.4;
    const priorityWeight = 0.3;
    const emergencyWeight = 0.2;
    const usageWeight = 0.1;
    
    const confidenceScore = match.totalConfidence;
    const priorityScore = match.maxPriority;
    const emergencyScore = match.hasEmergency ? 1.0 : 0.0;
    const usageScore = match.metadata.usage ? Math.min(match.metadata.usage / 10, 1.0) : 0.5;
    
    return (confidenceScore * confidenceWeight) +
           (priorityScore * priorityWeight) +
           (emergencyScore * emergencyWeight) +
           (usageScore * usageWeight);
  }

  updateDetectionMetrics(report) {
    this.metrics.totalDetections++;
    
    const detectionTime = report.detectionTime;
    this.metrics.averageDetectionTime = 
      (this.metrics.averageDetectionTime + detectionTime) / 2;
    
    // Update protocol utilization stats
    for (const protocol of report.protocols) {
      if (!this.metrics.protocolUtilization[protocol.protocolId]) {
        this.metrics.protocolUtilization[protocol.protocolId] = 0;
      }
      this.metrics.protocolUtilization[protocol.protocolId]++;
    }
  }

  /**
   * Placeholder methods for integration with ProtocolRegistry and TriggerSystem
   */
  async getProjectProtocolPreferences(projectContext) {
    // Will be implemented when ProtocolRegistry is created
    return [];
  }

  async getIntentProtocolAssociations(intentType) {
    // Basic associations for now
    const associations = {
      'development': [
        { id: 'task-approach', confidence: 0.8, priority: 0.7 },
        { id: 'error-recovery', confidence: 0.6, priority: 0.6 }
      ],
      'debugging': [
        { id: 'error-recovery', confidence: 0.9, priority: 0.9 },
        { id: 'information-integration', confidence: 0.7, priority: 0.5 }
      ],
      'research': [
        { id: 'information-integration', confidence: 0.8, priority: 0.8 },
        { id: 'progress-communication', confidence: 0.6, priority: 0.4 }
      ]
    };
    
    return associations[intentType] || [];
  }

  async getResourceProtocolImplications(loadedResources) {
    // Will be enhanced with actual resource analysis
    return [];
  }

  getRecentTaskSequence() {
    // Will be implemented with actual task history
    return [];
  }

  getCoOccurringProtocols(protocolId) {
    // Will be implemented with actual co-occurrence analysis
    return [];
  }

  async checkProtocolPrerequisites(metadata, context) {
    // Basic prerequisite checking - will be enhanced
    return true;
  }

  generateProtocolRecommendations(protocols, session) {
    const recommendations = [];
    
    if (protocols.length === 0) {
      recommendations.push({
        type: 'no_protocols',
        message: 'No protocols detected - consider manual protocol selection',
        priority: 'medium'
      });
    } else if (protocols.length > 6) {
      recommendations.push({
        type: 'too_many_protocols',
        message: 'High number of protocols detected - consider simplifying task',
        priority: 'low'
      });
    }
    
    const emergencyCount = protocols.filter(p => p.hasEmergency).length;
    if (emergencyCount > 0) {
      recommendations.push({
        type: 'emergency_protocols',
        message: `${emergencyCount} emergency protocols detected - prioritize these`,
        priority: 'high'
      });
    }
    
    return recommendations;
  }

  generateLearningUpdates(protocols, session) {
    if (!this.config.learningEnabled) {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      contextKey: this.generateContextKey(session.context),
      protocolsForLearning: protocols.map(p => p.protocolId),
      sessionMetadata: {
        intentType: session.contextAnalysis.intentType,
        complexity: session.contextAnalysis.complexity,
        timestamp: Date.now()
      }
    };
  }

  hasSystemFailureIndicators(context) {
    return context.systemFailure || 
           (context.metrics && context.metrics.successRate < 0.3);
  }

  hasUserConfusionIndicators(context) {
    return context.userConfusion || 
           context.intent?.clarificationRequested;
  }

  hasResourceExhaustionIndicators(context) {
    return context.resourceExhaustion ||
           (context.metrics && context.metrics.budgetUtilization > 0.95);
  }

  async handleDetectionFailure(session, error) {
    console.error('🚨 Protocol detection failed, applying emergency fallback');
    
    return {
      sessionId: session.sessionId,
      success: false,
      error: error.message,
      protocols: [
        {
          protocolId: 'error-recovery',
          totalConfidence: 1.0,
          hasEmergency: true,
          triggers: [{
            type: 'detection_failure',
            trigger: 'Protocol detection failed - emergency recovery',
            confidence: 1.0
          }],
          fallback: true
        }
      ],
      fallback: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Public API methods
   */
  getDetectionMetrics() {
    return {
      ...this.metrics,
      historySize: this.detectionHistory.length,
      cacheSize: this.triggerCache.size,
      learningEnabled: this.config.learningEnabled
    };
  }

  updateLearningFromFeedback(sessionId, protocolEffectiveness) {
    if (!this.config.learningEnabled) return;
    
    const session = this.detectionHistory.find(h => h.sessionId === sessionId);
    if (!session) return;
    
    // Update effectiveness scores for learning
    for (const [protocolId, effectiveness] of Object.entries(protocolEffectiveness)) {
      const key = `${session.intentType}:${protocolId}`;
      const current = this.learningPatterns.effectivenessScores.get(key) || 
                     { score: 0.5, count: 0 };
      
      current.score = (current.score * current.count + effectiveness) / (current.count + 1);
      current.count++;
      
      this.learningPatterns.effectivenessScores.set(key, current);
    }
    
    console.error(`🧠 Learning updated for session ${sessionId}`);
  }

  exportLearningData() {
    return {
      patterns: {
        contextProtocolPairs: Array.from(this.learningPatterns.contextProtocolPairs.entries()),
        taskTypeProtocols: Array.from(this.learningPatterns.taskTypeProtocols.entries()),
        sequentialProtocols: Array.from(this.learningPatterns.sequentialProtocols.entries()),
        effectivenessScores: Array.from(this.learningPatterns.effectivenessScores.entries())
      },
      metrics: this.metrics,
      config: this.config
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProtocolDetector;
}

// Global availability
if (typeof global !== 'undefined') {
  global.ProtocolDetector = ProtocolDetector;
}

export default ProtocolDetector;