/**
 * IntentAnalyzer - Semantic Intent Classification System
 * 
 * Analyzes user messages to determine task type, complexity, and context requirements.
 * Uses pattern matching and heuristics for fast, reliable intent classification.
 */

class IntentAnalyzer {
  constructor() {
    this.intentPatterns = this.buildIntentPatterns();
    this.complexityAnalyzer = new ComplexityAnalyzer();
    this.domainClassifier = new DomainClassifier();
  }

  /**
   * Analyze user intent from message text
   * @param {string} message - User's message
   * @param {Object} context - Additional context (previous messages, session state)
   * @returns {Object} Intent analysis result
   */
  async analyze(message, context = {}) {
    const analysis = {
      taskType: 'unknown',
      complexity: 'medium',
      domain: 'general',
      protocols: [],
      contextNeeds: {},
      confidence: 0.0,
      metadata: {
        messageLength: message.length,
        timestamp: new Date().toISOString(),
        patterns: []
      }
    };

    try {
      // Step 1: Pattern-based task type classification
      const taskClassification = this.classifyTaskType(message);
      Object.assign(analysis, taskClassification);

      // Step 2: Complexity assessment
      analysis.complexity = this.complexityAnalyzer.assess(message, context);

      // Step 3: Domain classification
      analysis.domain = this.domainClassifier.classify(message, context);

      // Step 4: Protocol requirements
      analysis.protocols = this.determineRequiredProtocols(analysis);

      // Step 5: Context needs mapping
      analysis.contextNeeds = this.mapContextNeeds(analysis);

      // Step 6: Confidence calculation
      analysis.confidence = this.calculateConfidence(analysis);

      return analysis;

    } catch (error) {
      console.error('Intent analysis failed:', error);
      return this.getDefaultAnalysis(message);
    }
  }

  /**
   * Build comprehensive intent pattern library
   */
  buildIntentPatterns() {
    return {
      development: {
        patterns: [
          /\b(code|implement|build|create|fix|debug|program|develop)\b/i,
          /\b(function|class|method|variable|api)\b/i,
          /\b(git|github|commit|push|pull)\b/i,
          /\b(test|unit|integration|coverage)\b/i,
          /\b(npm|package|install|dependency)\b/i
        ],
        keywords: ['code', 'implement', 'build', 'create', 'fix', 'debug'],
        protocols: ['error-recovery', 'task-approach'],
        contextNeeds: { critical: true, active: true, tools: true, protocols: true },
        confidence_boost: 0.3
      },

      research: {
        patterns: [
          /\b(research|analyze|investigate|study|explore|examine)\b/i,
          /\b(find|search|look|discover|identify)\b/i,
          /\b(understand|learn|know|explain)\b/i,
          /\b(document|paper|article|source)\b/i,
          /\b(data|information|facts|evidence)\b/i
        ],
        keywords: ['research', 'analyze', 'investigate', 'study'],
        protocols: ['information-integration', 'task-approach'],
        contextNeeds: { critical: true, architecture: true, historical: true },
        confidence_boost: 0.25
      },

      project_management: {
        patterns: [
          /\b(project|plan|organize|manage|track|coordinate)\b/i,
          /\b(milestone|deadline|schedule|timeline)\b/i,
          /\b(task|todo|assignment|work)\b/i,
          /\b(progress|status|update|report)\b/i,
          /\b(team|collaboration|meeting)\b/i
        ],
        keywords: ['project', 'plan', 'organize', 'manage'],
        protocols: ['progress-communication', 'task-approach'],
        contextNeeds: { critical: true, active: true, protocols: true },
        confidence_boost: 0.2
      },

      communication: {
        patterns: [
          /\b(explain|tell|show|describe|help|clarify)\b/i,
          /\b(what|how|why|when|where)\b/i,
          /\b(question|ask|wondering|curious)\b/i,
          /\b(understand|comprehend|grasp)\b/i
        ],
        keywords: ['explain', 'tell', 'show', 'describe', 'help'],
        protocols: ['user-communication'],
        contextNeeds: { critical: true, tools: false },
        confidence_boost: 0.15
      },

      system_operation: {
        patterns: [
          /\b(brain|init|load|memory|state|system)\b/i,
          /\b(start|initialize|boot|setup|configure)\b/i,
          /\b(protocol|engine|service|component)\b/i,
          /\b(vault|obsidian|knowledge|context)\b/i
        ],
        keywords: ['brain', 'init', 'load', 'memory', 'system'],
        protocols: ['task-approach', 'error-recovery'],
        contextNeeds: { critical: true, protocols: true, tools: true },
        confidence_boost: 0.35
      },

      troubleshooting: {
        patterns: [
          /\b(error|problem|issue|bug|broken|fail)\b/i,
          /\b(troubleshoot|diagnose|solve|resolve)\b/i,
          /\b(not working|doesn't work|won't|can't)\b/i,
          /\b(help|assist|support|guidance)\b/i
        ],
        keywords: ['error', 'problem', 'troubleshoot', 'fix'],
        protocols: ['error-recovery', 'user-communication'],
        contextNeeds: { critical: true, tools: true, protocols: true },
        confidence_boost: 0.3
      }
    };
  }

  /**
   * Classify task type based on pattern matching
   */
  classifyTaskType(message) {
    let bestMatch = { type: 'unknown', confidence: 0.0, patterns: [] };

    for (const [type, config] of Object.entries(this.intentPatterns)) {
      let matchScore = 0;
      let matchedPatterns = [];

      // Check pattern matches
      for (const pattern of config.patterns) {
        if (pattern.test(message)) {
          matchScore += 1;
          matchedPatterns.push(pattern.source);
        }
      }

      // Check keyword density
      const keywordDensity = this.calculateKeywordDensity(message, config.keywords);
      matchScore += keywordDensity * config.confidence_boost;

      if (matchScore > bestMatch.confidence) {
        bestMatch = {
          type,
          confidence: Math.min(0.95, matchScore),
          patterns: matchedPatterns,
          protocols: config.protocols,
          contextNeeds: config.contextNeeds
        };
      }
    }

    return {
      taskType: bestMatch.type,
      confidence: bestMatch.confidence,
      protocols: bestMatch.protocols || [],
      contextNeeds: bestMatch.contextNeeds || {},
      metadata: { patterns: bestMatch.patterns }
    };
  }

  /**
   * Calculate keyword density for relevance scoring
   */
  calculateKeywordDensity(message, keywords) {
    const words = message.toLowerCase().split(/\s+/);
    const keywordMatches = keywords.filter(keyword => 
      words.some(word => word.includes(keyword.toLowerCase()))
    );
    return keywordMatches.length / Math.max(keywords.length, 1);
  }

  /**
   * Determine required protocols based on task classification
   */
  determineRequiredProtocols(analysis) {
    const baseProtocols = analysis.protocols || [];
    
    // Add complexity-based protocols
    if (analysis.complexity === 'complex') {
      baseProtocols.push('progress-communication');
    }

    // Add domain-specific protocols
    if (analysis.domain === 'system') {
      baseProtocols.push('task-approach');
    }

    // Remove duplicates
    return [...new Set(baseProtocols)];
  }

  /**
   * Map context needs based on analysis
   */
  mapContextNeeds(analysis) {
    const needs = { ...analysis.contextNeeds };
    
    // Complexity-based adjustments
    if (analysis.complexity === 'complex') {
      needs.architecture = true;
      needs.historical = true;
    } else if (analysis.complexity === 'simple') {
      needs.tools = false;
      needs.historical = false;
    }

    // Domain-based adjustments
    if (analysis.domain === 'system') {
      needs.protocols = true;
      needs.tools = true;
    }

    return needs;
  }

  /**
   * Calculate overall confidence score
   */
  calculateConfidence(analysis) {
    let confidence = analysis.confidence || 0.0;
    
    // Boost confidence based on pattern matches
    if (analysis.metadata.patterns.length > 2) {
      confidence += 0.1;
    }

    // Adjust for message characteristics
    if (analysis.metadata.messageLength > 100) {
      confidence += 0.05; // Longer messages provide more context
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Fallback analysis for error cases
   */
  getDefaultAnalysis(message) {
    return {
      taskType: 'communication',
      complexity: 'simple',
      domain: 'general',
      protocols: ['user-communication'],
      contextNeeds: { critical: true },
      confidence: 0.1,
      metadata: {
        messageLength: message.length,
        timestamp: new Date().toISOString(),
        patterns: [],
        fallback: true
      }
    };
  }
}

/**
 * ComplexityAnalyzer - Assesses task complexity
 */
class ComplexityAnalyzer {
  assess(message, context = {}) {
    let complexityScore = 0;

    // Length-based indicators
    if (message.length > 300) complexityScore += 2;
    else if (message.length > 150) complexityScore += 1;

    // Complexity keywords
    const complexityKeywords = [
      'comprehensive', 'detailed', 'thorough', 'complete', 'full',
      'analyze', 'evaluate', 'assess', 'compare', 'optimize',
      'integrate', 'coordinate', 'synchronize', 'architect'
    ];

    const complexityMatches = complexityKeywords.filter(keyword =>
      message.toLowerCase().includes(keyword)
    );
    complexityScore += complexityMatches.length;

    // Technical depth indicators
    const technicalPatterns = [
      /\b(algorithm|architecture|framework|infrastructure)\b/i,
      /\b(optimization|performance|scalability|reliability)\b/i,
      /\b(integration|synchronization|coordination)\b/i
    ];

    const technicalMatches = technicalPatterns.filter(pattern => pattern.test(message));
    complexityScore += technicalMatches.length;

    // Map score to complexity level
    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'medium';
    return 'simple';
  }
}

/**
 * DomainClassifier - Classifies problem domain
 */
class DomainClassifier {
  classify(message, context = {}) {
    const domainPatterns = {
      system: [/brain|fuzzy.?os|protocol|engine|vault|obsidian/i],
      development: [/code|program|software|application|api/i],
      research: [/study|research|analysis|investigation|data/i],
      communication: [/explain|help|show|tell|describe/i]
    };

    for (const [domain, patterns] of Object.entries(domainPatterns)) {
      if (patterns.some(pattern => pattern.test(message))) {
        return domain;
      }
    }

    return 'general';
  }
}

// Export classes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IntentAnalyzer, ComplexityAnalyzer, DomainClassifier };
}

// Global availability
if (typeof global !== 'undefined') {
  global.IntentAnalyzer = IntentAnalyzer;
  global.ComplexityAnalyzer = ComplexityAnalyzer;
  global.DomainClassifier = DomainClassifier;
}

export default IntentAnalyzer;
