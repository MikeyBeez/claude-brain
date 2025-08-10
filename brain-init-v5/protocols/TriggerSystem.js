/**
 * TriggerSystem - Event-Driven Protocol Loading Engine
 * 
 * Monitors system events, context changes, and user interactions to automatically
 * trigger appropriate protocol loading. Implements intelligent event analysis
 * with learning optimization for trigger accuracy and response timing.
 */

class TriggerSystem {
  constructor(options = {}) {
    this.protocolRegistry = options.protocolRegistry || new ProtocolRegistry();
    this.protocolDetector = options.protocolDetector || null;
    
    // Trigger configuration
    this.config = {
      eventBufferSize: 100,
      triggerDelay: 500, // ms delay before processing triggers
      batchSize: 10,
      learningEnabled: true,
      autoTriggerEnabled: true,
      debugMode: false
    };
    
    // Event processing
    this.eventBuffer = [];
    this.eventHandlers = new Map();
    this.triggerQueue = [];
    this.processingTimer = null;
    
    // Trigger state management
    this.activeTriggers = new Map();
    this.triggerHistory = [];
    this.conditionCache = new Map();
    
    // Learning and optimization
    this.triggerPatterns = new Map();
    this.effectivenessScores = new Map();
    this.falsePositiveTracking = new Map();
    
    // Performance metrics
    this.metrics = {
      totalEvents: 0,
      triggersActivated: 0,
      averageResponseTime: 0,
      accuracy: 0,
      falsePositiveRate: 0
    };
    
    console.error('⚡ TriggerSystem initialized with event-driven protocol loading');
    
    // Initialize event handlers
    this.initializeEventHandlers();
  }

  /**
   * Initialize built-in event handlers
   */
  initializeEventHandlers() {
    // Error event handlers
    this.registerEventHandler('error', {
      type: 'error_condition',
      priority: 1.0,
      autoTrigger: true,
      handler: this.handleErrorEvent.bind(this)
    });
    
    // Context change handlers
    this.registerEventHandler('context_change', {
      type: 'context_update',
      priority: 0.8,
      autoTrigger: true,
      handler: this.handleContextChange.bind(this)
    });
    
    // User interaction handlers
    this.registerEventHandler('user_interaction', {
      type: 'user_event',
      priority: 0.7,
      autoTrigger: false,
      handler: this.handleUserInteraction.bind(this)
    });
    
    // Task completion handlers
    this.registerEventHandler('task_completion', {
      type: 'task_event',
      priority: 0.6,
      autoTrigger: true,
      handler: this.handleTaskCompletion.bind(this)
    });
    
    // Resource events
    this.registerEventHandler('resource_event', {
      type: 'resource_change',
      priority: 0.5,
      autoTrigger: true,
      handler: this.handleResourceEvent.bind(this)
    });
    
    console.error(`⚡ Registered ${this.eventHandlers.size} event handlers`);
  }

  /**
   * Register a custom event handler
   * @param {string} eventType - Type of event to handle
   * @param {Object} handlerConfig - Handler configuration
   */
  registerEventHandler(eventType, handlerConfig) {
    this.eventHandlers.set(eventType, {
      ...handlerConfig,
      registeredAt: Date.now(),
      callCount: 0,
      lastCalled: null
    });
    
    console.error(`📝 Registered event handler: ${eventType}`);
  }

  /**
   * Process incoming system event
   * @param {Object} event - System event data
   */
  async processEvent(event) {
    try {
      // Validate event structure
      if (!this.validateEvent(event)) {
        console.warn('⚠️  Invalid event structure:', event);
        return;
      }
      
      // Add to event buffer
      this.addToEventBuffer(event);
      
      // Update metrics
      this.metrics.totalEvents++;
      
      // Check for immediate trigger conditions
      const immediateTriggers = await this.checkImmediateTriggers(event);
      
      if (immediateTriggers.length > 0) {
        console.error(`⚡ Immediate triggers detected: ${immediateTriggers.length}`);
        await this.processImmediateTriggers(immediateTriggers, event);
      }
      
      // Schedule batch processing
      this.scheduleBatchProcessing();
      
    } catch (error) {
      console.error('❌ Error processing event:', error);
    }
  }

  /**
   * Add event to buffer with deduplication
   */
  addToEventBuffer(event) {
    const eventSignature = this.generateEventSignature(event);
    
    // Check for recent duplicate events
    const recent = this.eventBuffer.slice(-10);
    const isDuplicate = recent.some(e => 
      this.generateEventSignature(e) === eventSignature &&
      Date.now() - e.timestamp < 1000 // 1 second dedup window
    );
    
    if (isDuplicate) {
      console.error('🔄 Duplicate event filtered');
      return;
    }
    
    // Add event with timestamp
    const timestampedEvent = {
      ...event,
      timestamp: Date.now(),
      signature: eventSignature
    };
    
    this.eventBuffer.push(timestampedEvent);
    
    // Maintain buffer size
    if (this.eventBuffer.length > this.config.eventBufferSize) {
      this.eventBuffer.shift();
    }
  }

  /**
   * Check for immediate trigger conditions that require instant response
   */
  async checkImmediateTriggers(event) {
    const immediateTriggers = [];
    
    // Check emergency conditions
    if (this.isEmergencyEvent(event)) {
      immediateTriggers.push({
        type: 'emergency',
        priority: 1.0,
        protocolId: 'error-recovery',
        reason: 'Emergency condition detected',
        event: event
      });
    }
    
    // Check critical system events
    if (this.isCriticalSystemEvent(event)) {
      immediateTriggers.push({
        type: 'critical_system',
        priority: 0.9,
        protocolId: 'system-recovery',
        reason: 'Critical system event',
        event: event
      });
    }
    
    // Check user confusion indicators
    if (this.isUserConfusionEvent(event)) {
      immediateTriggers.push({
        type: 'user_confusion',
        priority: 0.8,
        protocolId: 'user-communication',
        reason: 'User confusion detected',
        event: event
      });
    }
    
    return immediateTriggers;
  }

  /**
   * Process immediate triggers without delay
   */
  async processImmediateTriggers(triggers, event) {
    for (const trigger of triggers) {
      try {
        const triggerResult = await this.activateTrigger(trigger, event);
        
        if (triggerResult.success) {
          console.error(`⚡ Immediate trigger activated: ${trigger.protocolId}`);
          this.recordTriggerActivation(trigger, triggerResult, 'immediate');
        }
        
      } catch (error) {
        console.error(`❌ Failed to process immediate trigger: ${trigger.protocolId}`, error);
      }
    }
  }

  /**
   * Schedule batch processing of events
   */
  scheduleBatchProcessing() {
    // Clear existing timer
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }
    
    // Schedule new batch processing
    this.processingTimer = setTimeout(() => {
      this.processBatchTriggers();
    }, this.config.triggerDelay);
  }

  /**
   * Process events in batch for pattern detection
   */
  async processBatchTriggers() {
    try {
      console.error('📊 Processing batch triggers...');
      
      // Analyze recent event patterns
      const recentEvents = this.getRecentEvents();
      const patterns = await this.analyzeEventPatterns(recentEvents);
      
      // Generate trigger candidates
      const triggerCandidates = await this.generateTriggerCandidates(patterns);
      
      // Filter and prioritize triggers
      const finalTriggers = await this.filterAndPrioritizeTriggers(triggerCandidates);
      
      // Process final triggers
      for (const trigger of finalTriggers) {
        await this.processBatchTrigger(trigger);
      }
      
      console.error(`⚡ Batch processing complete: ${finalTriggers.length} triggers processed`);
      
    } catch (error) {
      console.error('❌ Error in batch trigger processing:', error);
    }
  }

  /**
   * Analyze patterns in recent events
   */
  async analyzeEventPatterns(events) {
    const patterns = {
      eventTypes: new Map(),
      timePatterns: [],
      sequencePatterns: [],
      contextPatterns: new Map()
    };
    
    // Analyze event type frequency
    for (const event of events) {
      const type = event.type;
      patterns.eventTypes.set(type, (patterns.eventTypes.get(type) || 0) + 1);
    }
    
    // Analyze temporal patterns
    patterns.timePatterns = this.analyzeTemporalPatterns(events);
    
    // Analyze event sequences
    patterns.sequencePatterns = this.analyzeSequencePatterns(events);
    
    // Analyze context patterns
    patterns.contextPatterns = this.analyzeContextPatterns(events);
    
    return patterns;
  }

  /**
   * Generate trigger candidates based on patterns
   */
  async generateTriggerCandidates(patterns) {
    const candidates = [];
    
    // Frequency-based triggers
    for (const [eventType, frequency] of patterns.eventTypes) {
      if (frequency >= 3) { // Threshold for pattern recognition
        const protocolSuggestions = await this.getProtocolsForEventType(eventType);
        
        for (const protocol of protocolSuggestions) {
          candidates.push({
            type: 'frequency_pattern',
            eventType: eventType,
            frequency: frequency,
            protocolId: protocol.id,
            confidence: Math.min(frequency / 10, 0.8),
            reason: `High frequency of ${eventType} events (${frequency})`
          });
        }
      }
    }
    
    // Sequence-based triggers
    for (const sequence of patterns.sequencePatterns) {
      const protocolSuggestions = await this.getProtocolsForSequence(sequence);
      
      for (const protocol of protocolSuggestions) {
        candidates.push({
          type: 'sequence_pattern',
          sequence: sequence.events,
          protocolId: protocol.id,
          confidence: sequence.confidence,
          reason: `Event sequence pattern detected: ${sequence.pattern}`
        });
      }
    }
    
    // Context-based triggers
    for (const [context, data] of patterns.contextPatterns) {
      if (data.significance > 0.7) {
        const protocolSuggestions = await this.getProtocolsForContext(context);
        
        for (const protocol of protocolSuggestions) {
          candidates.push({
            type: 'context_pattern',
            context: context,
            significance: data.significance,
            protocolId: protocol.id,
            confidence: data.significance,
            reason: `Significant context pattern: ${context}`
          });
        }
      }
    }
    
    return candidates;
  }

  /**
   * Filter and prioritize trigger candidates
   */
  async filterAndPrioritizeTriggers(candidates) {
    const filtered = [];
    
    for (const candidate of candidates) {
      // Apply confidence threshold
      if (candidate.confidence < 0.5) continue;
      
      // Check for recent activation of same protocol
      if (this.wasRecentlyActivated(candidate.protocolId)) continue;
      
      // Apply learning-based filtering
      const learningScore = this.getLearningScore(candidate);
      candidate.finalScore = (candidate.confidence * 0.7) + (learningScore * 0.3);
      
      // Check for conflicts
      if (!this.hasConflicts(candidate)) {
        filtered.push(candidate);
      }
    }
    
    // Sort by final score
    filtered.sort((a, b) => b.finalScore - a.finalScore);
    
    // Limit batch size
    return filtered.slice(0, this.config.batchSize);
  }

  /**
   * Process individual batch trigger
   */
  async processBatchTrigger(trigger) {
    try {
      const startTime = Date.now();
      
      // Activate the trigger
      const result = await this.activateTrigger(trigger);
      
      if (result.success) {
        const responseTime = Date.now() - startTime;
        this.recordTriggerActivation(trigger, result, 'batch', responseTime);
        
        console.error(`⚡ Batch trigger activated: ${trigger.protocolId} (${responseTime}ms)`);
      } else {
        console.warn(`⚠️  Batch trigger failed: ${trigger.protocolId} - ${result.error}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing batch trigger: ${trigger.protocolId}`, error);
    }
  }

  /**
   * Activate a specific trigger
   */
  async activateTrigger(trigger, originalEvent = null) {
    try {
      const triggerId = this.generateTriggerId();
      
      // Create trigger context
      const triggerContext = {
        triggerId: triggerId,
        type: trigger.type,
        protocolId: trigger.protocolId,
        confidence: trigger.confidence || trigger.finalScore,
        reason: trigger.reason,
        originalEvent: originalEvent,
        timestamp: Date.now()
      };
      
      // Add to active triggers
      this.activeTriggers.set(triggerId, triggerContext);
      
      // Load the protocol (this would integrate with the actual protocol loading system)
      const loadResult = await this.loadProtocol(trigger.protocolId, triggerContext);
      
      // Update metrics
      this.metrics.triggersActivated++;
      
      return {
        success: true,
        triggerId: triggerId,
        loadResult: loadResult,
        context: triggerContext
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        triggerId: null
      };
    }
  }

  /**
   * Load protocol (integration point with protocol loading system)
   */
  async loadProtocol(protocolId, context) {
    // This is a mock implementation - in the real system this would
    // integrate with the actual protocol loading mechanism
    
    console.error(`🔄 Loading protocol: ${protocolId} (trigger: ${context.type})`);
    
    // Simulate protocol loading time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      protocolId: protocolId,
      loaded: true,
      loadTime: 100,
      triggerContext: context.type
    };
  }

  /**
   * Event handler implementations
   */
  async handleErrorEvent(event) {
    console.error('🚨 Processing error event');
    
    const triggers = [];
    
    // Critical errors trigger immediate recovery
    if (event.severity === 'critical' || event.severity === 'fatal') {
      triggers.push({
        protocolId: 'error-recovery',
        priority: 1.0,
        immediate: true,
        reason: `Critical error: ${event.message}`
      });
    }
    
    // Resource errors might need resource optimization
    if (event.category === 'resource') {
      triggers.push({
        protocolId: 'resource-optimization',
        priority: 0.8,
        immediate: false,
        reason: 'Resource-related error detected'
      });
    }
    
    return triggers;
  }

  async handleContextChange(event) {
    console.error('🔄 Processing context change event');
    
    const triggers = [];
    
    // Major context changes might need communication
    if (event.changeType === 'major' || event.impact === 'high') {
      triggers.push({
        protocolId: 'user-communication',
        priority: 0.7,
        immediate: false,
        reason: 'Major context change requires user communication'
      });
    }
    
    // Complex context changes might need task approach protocol
    if (event.complexity === 'high') {
      triggers.push({
        protocolId: 'task-approach',
        priority: 0.6,
        immediate: false,
        reason: 'Complex context change needs systematic approach'
      });
    }
    
    return triggers;
  }

  async handleUserInteraction(event) {
    console.error('👤 Processing user interaction event');
    
    const triggers = [];
    
    // User confusion indicators
    if (event.indicators && event.indicators.includes('confusion')) {
      triggers.push({
        protocolId: 'user-communication',
        priority: 0.9,
        immediate: true,
        reason: 'User confusion detected in interaction'
      });
    }
    
    // Complex requests
    if (event.complexity === 'high') {
      triggers.push({
        protocolId: 'task-approach',
        priority: 0.7,
        immediate: false,
        reason: 'Complex user request needs systematic approach'
      });
    }
    
    return triggers;
  }

  async handleTaskCompletion(event) {
    console.error('✅ Processing task completion event');
    
    const triggers = [];
    
    // Long tasks might need progress communication
    if (event.duration > 300000) { // 5 minutes
      triggers.push({
        protocolId: 'progress-communication',
        priority: 0.6,
        immediate: false,
        reason: 'Long task completion warrants progress update'
      });
    }
    
    // Failed tasks need error recovery
    if (event.status === 'failed') {
      triggers.push({
        protocolId: 'error-recovery',
        priority: 0.8,
        immediate: false,
        reason: 'Task failure requires error analysis'
      });
    }
    
    return triggers;
  }

  async handleResourceEvent(event) {
    console.error('📦 Processing resource event');
    
    const triggers = [];
    
    // Resource exhaustion
    if (event.type === 'exhaustion' || event.utilizationRate > 0.9) {
      triggers.push({
        protocolId: 'resource-optimization',
        priority: 0.8,
        immediate: false,
        reason: 'Resource exhaustion detected'
      });
    }
    
    // Resource conflicts
    if (event.type === 'conflict') {
      triggers.push({
        protocolId: 'conflict-resolution',
        priority: 0.7,
        immediate: false,
        reason: 'Resource conflict needs resolution'
      });
    }
    
    return triggers;
  }

  /**
   * Pattern analysis methods
   */
  analyzeTemporalPatterns(events) {
    const patterns = [];
    
    // Group events by time windows
    const timeWindows = this.groupEventsByTimeWindows(events, 60000); // 1 minute windows
    
    for (const [window, windowEvents] of timeWindows) {
      if (windowEvents.length >= 3) {
        patterns.push({
          timeWindow: window,
          eventCount: windowEvents.length,
          dominantType: this.getDominantEventType(windowEvents),
          pattern: 'burst'
        });
      }
    }
    
    return patterns;
  }

  analyzeSequencePatterns(events) {
    const patterns = [];
    
    // Look for common event sequences
    for (let i = 0; i < events.length - 2; i++) {
      const sequence = events.slice(i, i + 3);
      const sequenceSignature = sequence.map(e => e.type).join(' -> ');
      
      patterns.push({
        events: sequence,
        pattern: sequenceSignature,
        confidence: this.calculateSequenceConfidence(sequence)
      });
    }
    
    return patterns.filter(p => p.confidence > 0.6);
  }

  analyzeContextPatterns(events) {
    const patterns = new Map();
    
    for (const event of events) {
      if (event.context) {
        const contextKey = JSON.stringify(event.context);
        const current = patterns.get(contextKey) || { count: 0, events: [] };
        
        current.count++;
        current.events.push(event);
        current.significance = Math.min(current.count / events.length, 1.0);
        
        patterns.set(contextKey, current);
      }
    }
    
    return patterns;
  }

  /**
   * Helper methods
   */
  validateEvent(event) {
    return event && 
           typeof event === 'object' && 
           event.type && 
           typeof event.type === 'string';
  }

  generateEventSignature(event) {
    return `${event.type}_${JSON.stringify(event.data || {})}_${event.source || 'unknown'}`;
  }

  generateTriggerId() {
    return `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  isEmergencyEvent(event) {
    return event.severity === 'critical' || 
           event.severity === 'fatal' ||
           event.emergency === true ||
           event.type === 'system_failure';
  }

  isCriticalSystemEvent(event) {
    return event.category === 'system' && 
           (event.severity === 'high' || event.critical === true);
  }

  isUserConfusionEvent(event) {
    return event.type === 'user_interaction' && 
           (event.indicators?.includes('confusion') || 
            event.clarificationRequested === true);
  }

  getRecentEvents(timeWindow = 30000) {
    const cutoff = Date.now() - timeWindow;
    return this.eventBuffer.filter(event => event.timestamp > cutoff);
  }

  wasRecentlyActivated(protocolId, timeWindow = 60000) {
    const cutoff = Date.now() - timeWindow;
    
    for (const trigger of this.activeTriggers.values()) {
      if (trigger.protocolId === protocolId && trigger.timestamp > cutoff) {
        return true;
      }
    }
    
    return false;
  }

  getLearningScore(candidate) {
    const key = `${candidate.type}_${candidate.protocolId}`;
    const effectiveness = this.effectivenessScores.get(key);
    
    if (!effectiveness) return 0.5; // Neutral score for unknown patterns
    
    return effectiveness.score;
  }

  hasConflicts(candidate) {
    // Check for protocol conflicts
    for (const activeTrigger of this.activeTriggers.values()) {
      if (this.areProtocolsConflicting(candidate.protocolId, activeTrigger.protocolId)) {
        return true;
      }
    }
    
    return false;
  }

  areProtocolsConflicting(protocol1, protocol2) {
    // Basic conflict detection - would be enhanced with actual protocol metadata
    const conflicts = {
      'error-recovery': ['task-approach'], // Can't plan while recovering
      'user-communication': [] // Generally compatible with others
    };
    
    return conflicts[protocol1]?.includes(protocol2) || 
           conflicts[protocol2]?.includes(protocol1);
  }

  recordTriggerActivation(trigger, result, type, responseTime = null) {
    const activation = {
      triggerId: result.triggerId,
      protocolId: trigger.protocolId,
      type: type,
      confidence: trigger.confidence || trigger.finalScore,
      success: result.success,
      responseTime: responseTime,
      timestamp: Date.now()
    };
    
    this.triggerHistory.push(activation);
    
    // Update effectiveness tracking
    if (this.config.learningEnabled) {
      this.updateEffectivenessLearning(trigger, result);
    }
    
    // Update metrics
    if (responseTime) {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime + responseTime) / 2;
    }
  }

  updateEffectivenessLearning(trigger, result) {
    const key = `${trigger.type}_${trigger.protocolId}`;
    const current = this.effectivenessScores.get(key) || { score: 0.5, count: 0 };
    
    const effectiveness = result.success ? 1.0 : 0.0;
    current.score = (current.score * current.count + effectiveness) / (current.count + 1);
    current.count++;
    
    this.effectivenessScores.set(key, current);
  }

  /**
   * Placeholder methods for protocol integration
   */
  async getProtocolsForEventType(eventType) {
    // Mock implementation - would use actual protocol registry
    const mappings = {
      'error': [{ id: 'error-recovery' }],
      'user_interaction': [{ id: 'user-communication' }],
      'context_change': [{ id: 'task-approach' }],
      'resource_event': [{ id: 'resource-optimization' }]
    };
    
    return mappings[eventType] || [];
  }

  async getProtocolsForSequence(sequence) {
    // Mock implementation
    return [{ id: 'task-approach' }];
  }

  async getProtocolsForContext(context) {
    // Mock implementation
    return [{ id: 'information-integration' }];
  }

  groupEventsByTimeWindows(events, windowSize) {
    const windows = new Map();
    
    for (const event of events) {
      const window = Math.floor(event.timestamp / windowSize) * windowSize;
      
      if (!windows.has(window)) {
        windows.set(window, []);
      }
      windows.get(window).push(event);
    }
    
    return windows;
  }

  getDominantEventType(events) {
    const counts = new Map();
    
    for (const event of events) {
      counts.set(event.type, (counts.get(event.type) || 0) + 1);
    }
    
    let dominant = null;
    let maxCount = 0;
    
    for (const [type, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        dominant = type;
      }
    }
    
    return dominant;
  }

  calculateSequenceConfidence(sequence) {
    // Simple confidence calculation based on event timing and types
    let confidence = 0.5;
    
    // Events close in time are more likely to be related
    const timeDiffs = [];
    for (let i = 1; i < sequence.length; i++) {
      timeDiffs.push(sequence[i].timestamp - sequence[i-1].timestamp);
    }
    
    const avgTimeDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
    
    if (avgTimeDiff < 5000) { // 5 seconds
      confidence += 0.3;
    } else if (avgTimeDiff < 30000) { // 30 seconds
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Public API methods
   */
  getTriggerMetrics() {
    return {
      ...this.metrics,
      activeTriggersCount: this.activeTriggers.size,
      triggerHistorySize: this.triggerHistory.length,
      eventBufferSize: this.eventBuffer.length,
      learningEnabled: this.config.learningEnabled
    };
  }

  getActiveTriggers() {
    return Array.from(this.activeTriggers.values());
  }

  clearActiveTrigger(triggerId) {
    const removed = this.activeTriggers.delete(triggerId);
    if (removed) {
      console.error(`🗑️  Cleared active trigger: ${triggerId}`);
    }
    return removed;
  }

  exportTriggerData() {
    return {
      history: this.triggerHistory,
      patterns: Array.from(this.triggerPatterns.entries()),
      effectiveness: Array.from(this.effectivenessScores.entries()),
      metrics: this.metrics,
      config: this.config
    };
  }

  importTriggerData(data) {
    this.triggerHistory = data.history || [];
    this.triggerPatterns = new Map(data.patterns || []);
    this.effectivenessScores = new Map(data.effectiveness || []);
    
    if (data.metrics) {
      this.metrics = { ...this.metrics, ...data.metrics };
    }
    
    console.error('📥 Imported trigger system data');
  }

  /**
   * Maintenance methods
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    // Clean up old active triggers
    for (const [triggerId, trigger] of this.activeTriggers) {
      if (now - trigger.timestamp > maxAge) {
        this.activeTriggers.delete(triggerId);
      }
    }
    
    // Clean up event buffer
    this.eventBuffer = this.eventBuffer.filter(event => 
      now - event.timestamp < maxAge
    );
    
    // Clean up condition cache
    this.conditionCache.clear();
    
    console.error('🧹 Trigger system cleanup completed');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TriggerSystem;
}

// Global availability
if (typeof global !== 'undefined') {
  global.TriggerSystem = TriggerSystem;
}

export default TriggerSystem;