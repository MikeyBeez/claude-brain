/**
 * BudgetManager - Real-time Context Budget Management
 * 
 * Manages context budget allocation, tracking, and optimization across loading sessions.
 * Implements real-time budget monitoring with tier-based allocation strategies.
 */

class BudgetManager {
  constructor(totalBudget = 0.30) {
    this.totalBudget = totalBudget;
    this.currentSession = null;
    
    // Budget allocation tracking
    this.budgetState = {
      total: totalBudget,
      used: 0,
      remaining: totalBudget,
      tierAllocations: {},
      tierUsed: {},
      reservedBudget: 0.05 // 5% emergency reserve
    };
    
    // Budget monitoring
    this.usageHistory = [];
    this.allocationStrategy = 'adaptive'; // adaptive, conservative, aggressive
    this.budgetThresholds = {
      warning: 0.80,    // 80% of budget used
      critical: 0.95,   // 95% of budget used
      emergency: 0.99   // 99% of budget used
    };
    
    // Performance metrics
    this.metrics = {
      averageUtilization: 0,
      efficiencyScore: 0,
      wastePercentage: 0,
      optimalAllocation: {}
    };
    
    console.log('💰 BudgetManager initialized with total budget:', totalBudget);
  }

  /**
   * Initialize budget for new session
   * @param {string} sessionId - Session identifier
   * @param {Object} options - Budget configuration options
   */
  resetForSession(sessionId, options = {}) {
    this.currentSession = sessionId;
    
    // Reset budget state
    this.budgetState.used = 0;
    this.budgetState.remaining = this.totalBudget;
    this.budgetState.tierUsed = {};
    
    // Apply session-specific budget adjustments
    if (options.budgetMultiplier) {
      this.budgetState.total = this.totalBudget * options.budgetMultiplier;
      this.budgetState.remaining = this.budgetState.total;
    }
    
    console.log(`💰 Budget reset for session ${sessionId}: ${this.budgetState.total} total budget`);
  }

  /**
   * Set tier-specific budget allocations
   * @param {Object} tierBudgets - Budget allocation per tier
   */
  setTierBudgets(tierBudgets) {
    this.budgetState.tierAllocations = { ...tierBudgets };
    this.budgetState.tierUsed = {};
    
    // Initialize tier usage tracking
    for (const tier of Object.keys(tierBudgets)) {
      this.budgetState.tierUsed[tier] = 0;
    }
    
    console.log('📊 Tier budgets allocated:', tierBudgets);
  }

  /**
   * Check if we can afford a resource within budget constraints
   * @param {number} cost - Estimated cost of resource
   * @param {string} tier - Tier the resource belongs to
   * @returns {boolean} Whether the resource is affordable
   */
  canAfford(cost, tier = null) {
    // Check total budget
    if (this.budgetState.used + cost > this.budgetState.total - this.budgetState.reservedBudget) {
      console.log(`💸 Cannot afford ${cost}: would exceed total budget`);
      return false;
    }
    
    // Check tier-specific budget if specified
    if (tier && this.budgetState.tierAllocations[tier]) {
      const tierUsed = this.budgetState.tierUsed[tier] || 0;
      const tierBudget = this.budgetState.tierAllocations[tier];
      
      if (tierUsed + cost > tierBudget) {
        console.log(`💸 Cannot afford ${cost} in ${tier}: would exceed tier budget (${tierUsed + cost} > ${tierBudget})`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Record actual usage of budget
   * @param {number} actualCost - Actual cost incurred
   * @param {string} tier - Tier the resource belongs to
   * @param {Object} metadata - Additional usage metadata
   */
  recordUsage(actualCost, tier = null, metadata = {}) {
    // Update total usage
    this.budgetState.used += actualCost;
    this.budgetState.remaining = this.budgetState.total - this.budgetState.used;
    
    // Update tier usage
    if (tier) {
      this.budgetState.tierUsed[tier] = (this.budgetState.tierUsed[tier] || 0) + actualCost;
    }
    
    // Record usage event
    const usageEvent = {
      sessionId: this.currentSession,
      cost: actualCost,
      tier: tier,
      timestamp: Date.now(),
      totalUsed: this.budgetState.used,
      remaining: this.budgetState.remaining,
      utilization: this.getUtilization(),
      metadata: metadata
    };
    
    this.usageHistory.push(usageEvent);
    
    // Check thresholds and issue warnings
    this.checkBudgetThresholds();
    
    console.log(`💰 Recorded usage: ${actualCost} (${tier}) | Total: ${this.budgetState.used.toFixed(3)} | Remaining: ${this.budgetState.remaining.toFixed(3)}`);
  }

  /**
   * Get current budget utilization percentage
   * @returns {number} Utilization percentage (0-1)
   */
  getUtilization() {
    return this.budgetState.used / this.budgetState.total;
  }

  /**
   * Get tier-specific budget information
   * @param {string} tier - Tier to query
   * @returns {Object} Tier budget information
   */
  getTierBudget(tier) {
    return this.budgetState.tierAllocations[tier] || 0;
  }

  /**
   * Get tier utilization percentage
   * @param {string} tier - Tier to query
   * @returns {number} Tier utilization (0-1)
   */
  getTierUtilization(tier) {
    const used = this.budgetState.tierUsed[tier] || 0;
    const allocated = this.budgetState.tierAllocations[tier] || 0;
    return allocated > 0 ? used / allocated : 0;
  }

  /**
   * Get comprehensive budget status
   * @returns {Object} Current budget status
   */
  getBudgetStatus() {
    const status = {
      session: this.currentSession,
      total: this.budgetState.total,
      used: this.budgetState.used,
      remaining: this.budgetState.remaining,
      utilization: this.getUtilization(),
      tierStatus: {},
      thresholds: {
        warning: this.getUtilization() >= this.budgetThresholds.warning,
        critical: this.getUtilization() >= this.budgetThresholds.critical,
        emergency: this.getUtilization() >= this.budgetThresholds.emergency
      },
      recommendations: this.getBudgetRecommendations()
    };
    
    // Add tier-specific status
    for (const [tier, allocation] of Object.entries(this.budgetState.tierAllocations)) {
      status.tierStatus[tier] = {
        allocated: allocation,
        used: this.budgetState.tierUsed[tier] || 0,
        remaining: allocation - (this.budgetState.tierUsed[tier] || 0),
        utilization: this.getTierUtilization(tier)
      };
    }
    
    return status;
  }

  /**
   * Check budget thresholds and issue warnings
   */
  checkBudgetThresholds() {
    const utilization = this.getUtilization();
    
    if (utilization >= this.budgetThresholds.emergency) {
      console.warn('🚨 EMERGENCY: Budget utilization at 99%+ - consider emergency fallback');
    } else if (utilization >= this.budgetThresholds.critical) {
      console.warn('⚠️  CRITICAL: Budget utilization at 95%+ - stop non-essential loading');
    } else if (utilization >= this.budgetThresholds.warning) {
      console.warn('⚠️  WARNING: Budget utilization at 80%+ - prioritize critical resources only');
    }
  }

  /**
   * Get budget optimization recommendations
   * @returns {Array} Array of recommendation objects
   */
  getBudgetRecommendations() {
    const recommendations = [];
    const utilization = this.getUtilization();
    
    // Overall budget recommendations
    if (utilization < 0.5) {
      recommendations.push({
        type: 'underutilization',
        message: 'Budget underutilized - consider loading more supplementary resources',
        priority: 'low'
      });
    } else if (utilization > 0.9) {
      recommendations.push({
        type: 'overutilization', 
        message: 'Budget heavily utilized - prioritize only critical resources',
        priority: 'high'
      });
    }
    
    // Tier-specific recommendations
    for (const [tier, allocation] of Object.entries(this.budgetState.tierAllocations)) {
      const tierUtilization = this.getTierUtilization(tier);
      
      if (tierUtilization < 0.3 && tier === 'tier1') {
        recommendations.push({
          type: 'tier_underutilization',
          tier: tier,
          message: `${tier} underutilized (${(tierUtilization * 100).toFixed(1)}%) - ensure critical resources are loaded`,
          priority: 'medium'
        });
      } else if (tierUtilization > 0.95) {
        recommendations.push({
          type: 'tier_overutilization',
          tier: tier,
          message: `${tier} over budget (${(tierUtilization * 100).toFixed(1)}%) - reduce resource loading`,
          priority: 'high'
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Optimize budget allocation based on usage patterns
   * @param {Object} usagePatterns - Historical usage patterns
   * @returns {Object} Optimized budget allocation
   */
  optimizeBudgetAllocation(usagePatterns = {}) {
    console.log('🎯 Optimizing budget allocation based on usage patterns...');
    
    const currentAllocation = { ...this.budgetState.tierAllocations };
    const optimizedAllocation = { ...currentAllocation };
    
    // Analyze tier efficiency from usage history
    const tierEfficiency = this.calculateTierEfficiency();
    
    // Adjust allocations based on efficiency
    for (const [tier, efficiency] of Object.entries(tierEfficiency)) {
      if (efficiency.utilizationRate < 0.5 && efficiency.wasteRate > 0.3) {
        // Reduce allocation for underutilized tiers
        optimizedAllocation[tier] = Math.max(
          currentAllocation[tier] * 0.8,
          0.02 // Minimum 2% allocation
        );
      } else if (efficiency.utilizationRate > 0.9 && efficiency.successRate > 0.8) {
        // Increase allocation for highly utilized, successful tiers
        optimizedAllocation[tier] = Math.min(
          currentAllocation[tier] * 1.2,
          this.totalBudget * 0.4 // Maximum 40% to any single tier
        );
      }
    }
    
    // Ensure total allocation doesn't exceed budget
    const totalOptimized = Object.values(optimizedAllocation).reduce((sum, val) => sum + val, 0);
    if (totalOptimized > this.totalBudget * 0.9) { // Leave 10% buffer
      const scaleFactor = (this.totalBudget * 0.9) / totalOptimized;
      for (const tier of Object.keys(optimizedAllocation)) {
        optimizedAllocation[tier] *= scaleFactor;
      }
    }
    
    return {
      current: currentAllocation,
      optimized: optimizedAllocation,
      improvements: this.calculateImprovements(currentAllocation, optimizedAllocation),
      confidence: this.calculateOptimizationConfidence()
    };
  }

  /**
   * Calculate tier efficiency metrics
   */
  calculateTierEfficiency() {
    const tierEfficiency = {};
    
    for (const tier of Object.keys(this.budgetState.tierAllocations)) {
      const tierEvents = this.usageHistory.filter(event => event.tier === tier);
      
      if (tierEvents.length === 0) {
        tierEfficiency[tier] = {
          utilizationRate: 0,
          successRate: 0,
          wasteRate: 1.0,
          averageCost: 0
        };
        continue;
      }
      
      const totalAllocated = this.budgetState.tierAllocations[tier];
      const totalUsed = tierEvents.reduce((sum, event) => sum + event.cost, 0);
      const successfulLoads = tierEvents.filter(event => event.metadata?.success !== false).length;
      
      tierEfficiency[tier] = {
        utilizationRate: totalUsed / totalAllocated,
        successRate: successfulLoads / tierEvents.length,
        wasteRate: Math.max(0, (totalAllocated - totalUsed) / totalAllocated),
        averageCost: totalUsed / tierEvents.length
      };
    }
    
    return tierEfficiency;
  }

  /**
   * Calculate improvements from optimization
   */
  calculateImprovements(current, optimized) {
    const improvements = {};
    
    for (const tier of Object.keys(current)) {
      const change = optimized[tier] - current[tier];
      const percentChange = (change / current[tier]) * 100;
      
      improvements[tier] = {
        absoluteChange: change,
        percentChange: percentChange,
        direction: change > 0 ? 'increase' : change < 0 ? 'decrease' : 'unchanged'
      };
    }
    
    return improvements;
  }

  /**
   * Calculate confidence in optimization recommendations
   */
  calculateOptimizationConfidence() {
    const historySize = this.usageHistory.length;
    
    if (historySize < 10) return 0.3; // Low confidence with little data
    if (historySize < 50) return 0.6; // Medium confidence
    return 0.9; // High confidence with sufficient data
  }

  /**
   * Get budget analytics and insights
   * @returns {Object} Comprehensive budget analytics
   */
  getBudgetAnalytics() {
    const analytics = {
      overview: {
        totalSessions: new Set(this.usageHistory.map(e => e.sessionId)).size,
        totalUsageEvents: this.usageHistory.length,
        averageSessionUtilization: this.calculateAverageSessionUtilization(),
        budgetEfficiency: this.calculateBudgetEfficiency()
      },
      trends: {
        utilizationTrend: this.calculateUtilizationTrend(),
        costTrend: this.calculateCostTrend(),
        tierPopularity: this.calculateTierPopularity()
      },
      optimization: {
        potentialSavings: this.calculatePotentialSavings(),
        recommendedAllocations: this.optimizeBudgetAllocation(),
        efficiencyOpportunities: this.identifyEfficiencyOpportunities()
      }
    };
    
    return analytics;
  }

  /**
   * Helper calculation methods
   */
  calculateAverageSessionUtilization() {
    const sessionUtilizations = {};
    
    for (const event of this.usageHistory) {
      if (!sessionUtilizations[event.sessionId]) {
        sessionUtilizations[event.sessionId] = 0;
      }
      sessionUtilizations[event.sessionId] = Math.max(
        sessionUtilizations[event.sessionId],
        event.utilization
      );
    }
    
    const utilizations = Object.values(sessionUtilizations);
    return utilizations.length > 0 ? 
      utilizations.reduce((sum, util) => sum + util, 0) / utilizations.length : 0;
  }

  calculateBudgetEfficiency() {
    // Budget efficiency = successful resource usage / total budget allocation
    const successfulUsage = this.usageHistory
      .filter(event => event.metadata?.success !== false)
      .reduce((sum, event) => sum + event.cost, 0);
    
    return this.budgetState.used > 0 ? successfulUsage / this.budgetState.used : 0;
  }

  calculateUtilizationTrend() {
    // Simple trend calculation over last 10 sessions
    const recentEvents = this.usageHistory.slice(-100);
    if (recentEvents.length < 2) return 'insufficient_data';
    
    const firstHalf = recentEvents.slice(0, Math.floor(recentEvents.length / 2));
    const secondHalf = recentEvents.slice(Math.floor(recentEvents.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, e) => sum + e.utilization, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, e) => sum + e.utilization, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg * 1.1) return 'increasing';
    if (secondAvg < firstAvg * 0.9) return 'decreasing';
    return 'stable';
  }

  calculateCostTrend() {
    const recentEvents = this.usageHistory.slice(-50);
    if (recentEvents.length < 2) return 'insufficient_data';
    
    const avgCost = recentEvents.reduce((sum, e) => sum + e.cost, 0) / recentEvents.length;
    const historicalAvg = this.usageHistory.reduce((sum, e) => sum + e.cost, 0) / this.usageHistory.length;
    
    if (avgCost > historicalAvg * 1.1) return 'increasing';
    if (avgCost < historicalAvg * 0.9) return 'decreasing';
    return 'stable';
  }

  calculateTierPopularity() {
    const tierCounts = {};
    
    for (const event of this.usageHistory) {
      if (event.tier) {
        tierCounts[event.tier] = (tierCounts[event.tier] || 0) + 1;
      }
    }
    
    return tierCounts;
  }

  calculatePotentialSavings() {
    const tierEfficiency = this.calculateTierEfficiency();
    let potentialSavings = 0;
    
    for (const [tier, efficiency] of Object.entries(tierEfficiency)) {
      if (efficiency.wasteRate > 0.2) {
        const allocated = this.budgetState.tierAllocations[tier] || 0;
        potentialSavings += allocated * efficiency.wasteRate * 0.5; // Conservative estimate
      }
    }
    
    return potentialSavings;
  }

  identifyEfficiencyOpportunities() {
    const opportunities = [];
    const tierEfficiency = this.calculateTierEfficiency();
    
    for (const [tier, efficiency] of Object.entries(tierEfficiency)) {
      if (efficiency.wasteRate > 0.3) {
        opportunities.push({
          type: 'reduce_allocation',
          tier: tier,
          impact: 'high',
          description: `${tier} has ${(efficiency.wasteRate * 100).toFixed(1)}% waste rate`
        });
      }
      
      if (efficiency.utilizationRate > 0.9 && efficiency.successRate > 0.8) {
        opportunities.push({
          type: 'increase_allocation',
          tier: tier,
          impact: 'medium',
          description: `${tier} is highly utilized (${(efficiency.utilizationRate * 100).toFixed(1)}%) with good success rate`
        });
      }
    }
    
    return opportunities;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BudgetManager;
}

// Global availability
if (typeof global !== 'undefined') {
  global.BudgetManager = BudgetManager;
}

export default BudgetManager;
