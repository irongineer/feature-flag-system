#!/usr/bin/env node

/**
 * Intelligent Test Selector for CI/CD Pipeline Optimization
 * 
 * Analyzes code changes and selects optimal test execution strategy
 * to minimize CI time while maintaining quality assurance.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class IntelligentTestSelector {
  constructor() {
    this.packageInfo = this.loadPackageInfo();
    this.testHistoryFile = path.join(__dirname, '../../.github/test-history.json');
    this.testHistory = this.loadTestHistory();
    this.changeImpactCache = new Map();
  }

  /**
   * Main entry point for intelligent test selection
   */
  async selectTests(options = {}) {
    console.log('= Analyzing changes for intelligent test selection...');
    
    try {
      const changedFiles = await this.getChangedFiles(options.baseBranch || 'main');
      const impactAnalysis = await this.analyzeChangeImpact(changedFiles);
      const testSelection = await this.generateTestSelection(impactAnalysis);
      const optimizedPlan = this.optimizeExecutionPlan(testSelection);

      const report = {
        timestamp: new Date().toISOString(),
        changedFiles,
        impactAnalysis,
        testSelection,
        optimizedPlan,
        estimatedDuration: this.estimateDuration(optimizedPlan),
        recommendations: this.generateRecommendations(impactAnalysis)
      };

      this.saveSelectionReport(report);
      return report;

    } catch (error) {
      console.error('L Error in test selection:', error);
      return this.getFallbackPlan();
    }
  }

  /**
   * Get changed files since base branch
   */
  async getChangedFiles(baseBranch) {
    try {
      const { stdout } = await execAsync(`git diff --name-only ${baseBranch}...HEAD`);
      return stdout.trim().split('\n').filter(file => file.length > 0);
    } catch (error) {
      console.log('9 Using all files as fallback');
      return await this.getAllSourceFiles();
    }
  }

  /**
   * Analyze the impact of changes on the codebase
   */
  async analyzeChangeImpact(changedFiles) {
    const impact = {
      affectedPackages: new Set(),
      riskLevel: 'low',
      changeType: this.classifyChanges(changedFiles),
      dependencies: new Map(),
      testComplexity: 'simple'
    };

    for (const file of changedFiles) {
      // Determine affected package
      const packageName = this.getPackageFromFile(file);
      if (packageName) {
        impact.affectedPackages.add(packageName);
      }

      // Analyze dependencies
      const deps = await this.analyzeDependencies(file);
      impact.dependencies.set(file, deps);

      // Update risk level
      const fileRisk = this.assessFileRisk(file);
      if (this.getRiskScore(fileRisk) > this.getRiskScore(impact.riskLevel)) {
        impact.riskLevel = fileRisk;
      }
    }

    // Determine test complexity
    impact.testComplexity = this.calculateTestComplexity(impact);

    console.log(`=Ê Impact Analysis: ${impact.affectedPackages.size} packages, ${impact.riskLevel} risk`);
    return impact;
  }

  /**
   * Generate optimal test selection strategy
   */
  async generateTestSelection(impactAnalysis) {
    const selection = {
      unit: {
        required: [],
        optional: [],
        skip: []
      },
      integration: {
        required: [],
        optional: [],
        skip: []
      },
      e2e: {
        required: false,
        scenarios: []
      },
      performance: {
        required: false,
        benchmarks: []
      }
    };

    // Unit tests selection
    for (const packageName of impactAnalysis.affectedPackages) {
      const packageTests = await this.getPackageTests(packageName);
      
      if (this.isCorePackage(packageName)) {
        selection.unit.required.push(...packageTests.unit);
      } else {
        selection.unit.optional.push(...packageTests.unit);
      }

      // Integration tests
      if (this.hasIntegrationImpact(packageName, impactAnalysis)) {
        selection.integration.required.push(...packageTests.integration);
      }
    }

    // E2E tests decision
    selection.e2e.required = this.shouldRunE2E(impactAnalysis);
    if (selection.e2e.required) {
      selection.e2e.scenarios = this.selectE2EScenarios(impactAnalysis);
    }

    // Performance tests decision
    selection.performance.required = this.shouldRunPerformanceTests(impactAnalysis);
    if (selection.performance.required) {
      selection.performance.benchmarks = this.selectPerformanceBenchmarks(impactAnalysis);
    }

    return selection;
  }

  /**
   * Optimize test execution plan for parallel execution
   */
  optimizeExecutionPlan(testSelection) {
    const plan = {
      parallel: [],
      sequential: [],
      conditional: []
    };

    // Group unit tests for parallel execution
    const unitGroups = this.groupTestsForParallel(testSelection.unit.required);
    plan.parallel.push(...unitGroups.map(group => ({
      type: 'unit',
      group,
      estimatedDuration: this.estimateGroupDuration(group)
    })));

    // Integration tests (sequential for database consistency)
    if (testSelection.integration.required.length > 0) {
      plan.sequential.push({
        type: 'integration',
        tests: testSelection.integration.required,
        estimatedDuration: this.estimateIntegrationDuration(testSelection.integration.required)
      });
    }

    // E2E tests (conditional)
    if (testSelection.e2e.required) {
      plan.conditional.push({
        type: 'e2e',
        condition: 'ui-changes || main-branch',
        scenarios: testSelection.e2e.scenarios,
        estimatedDuration: this.estimateE2EDuration(testSelection.e2e.scenarios)
      });
    }

    // Performance tests (conditional)
    if (testSelection.performance.required) {
      plan.conditional.push({
        type: 'performance',
        condition: 'core-changes || performance-flag',
        benchmarks: testSelection.performance.benchmarks,
        estimatedDuration: this.estimatePerformanceDuration(testSelection.performance.benchmarks)
      });
    }

    return plan;
  }

  /**
   * Classify types of changes
   */
  classifyChanges(changedFiles) {
    const types = {
      feature: 0,
      bugfix: 0,
      refactor: 0,
      docs: 0,
      test: 0,
      config: 0
    };

    for (const file of changedFiles) {
      if (file.includes('.test.') || file.includes('.spec.')) {
        types.test++;
      } else if (file.includes('README') || file.includes('.md')) {
        types.docs++;
      } else if (file.includes('config') || file.includes('.json') || file.includes('.yml')) {
        types.config++;
      } else if (this.isFeatureFile(file)) {
        types.feature++;
      } else if (this.isBugfixFile(file)) {
        types.bugfix++;
      } else {
        types.refactor++;
      }
    }

    return types;
  }

  /**
   * Assess risk level of a file change
   */
  assessFileRisk(filePath) {
    // Critical files
    if (filePath.includes('packages/core/') || 
        filePath.includes('packages/api/') ||
        filePath.includes('infrastructure/')) {
      return 'high';
    }

    // Important files
    if (filePath.includes('packages/admin-ui/') ||
        filePath.includes('packages/sdk/')) {
      return 'medium';
    }

    // Documentation, tests, configs
    if (filePath.includes('.md') || 
        filePath.includes('.test.') || 
        filePath.includes('config')) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Determine if E2E tests should run
   */
  shouldRunE2E(impactAnalysis) {
    // Always run on main branch
    if (process.env.GITHUB_REF === 'refs/heads/main') {
      return true;
    }

    // Run if admin-ui changed
    if (impactAnalysis.affectedPackages.has('admin-ui')) {
      return true;
    }

    // Run if API changes are significant
    if (impactAnalysis.affectedPackages.has('api') && impactAnalysis.riskLevel === 'high') {
      return true;
    }

    // Run if explicitly requested
    if (process.env.GITHUB_EVENT_HEAD_COMMIT_MESSAGE?.includes('[e2e]')) {
      return true;
    }

    return false;
  }

  /**
   * Select specific E2E scenarios based on impact
   */
  selectE2EScenarios(impactAnalysis) {
    const scenarios = [];

    // Core functionality scenarios
    scenarios.push('flag-creation', 'flag-evaluation');

    // API-specific scenarios
    if (impactAnalysis.affectedPackages.has('api')) {
      scenarios.push('api-integration', 'tenant-isolation');
    }

    // UI-specific scenarios
    if (impactAnalysis.affectedPackages.has('admin-ui')) {
      scenarios.push('admin-ui-workflows', 'user-management');
    }

    return [...new Set(scenarios)]; // Remove duplicates
  }

  /**
   * Estimate total duration for execution plan
   */
  estimateDuration(optimizedPlan) {
    let parallelMax = 0;
    let sequentialTotal = 0;

    // Calculate parallel execution time (max of parallel groups)
    for (const parallelGroup of optimizedPlan.parallel) {
      if (parallelGroup.estimatedDuration > parallelMax) {
        parallelMax = parallelGroup.estimatedDuration;
      }
    }

    // Calculate sequential execution time
    for (const sequentialGroup of optimizedPlan.sequential) {
      sequentialTotal += sequentialGroup.estimatedDuration;
    }

    // Add conditional execution time (estimated probability)
    let conditionalTotal = 0;
    for (const conditionalGroup of optimizedPlan.conditional) {
      conditionalTotal += conditionalGroup.estimatedDuration * 0.5; // 50% probability
    }

    return {
      parallel: parallelMax,
      sequential: sequentialTotal,
      conditional: conditionalTotal,
      total: parallelMax + sequentialTotal + conditionalTotal
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(impactAnalysis) {
    const recommendations = [];

    // Test optimization recommendations
    if (impactAnalysis.affectedPackages.size <= 2) {
      recommendations.push({
        type: 'optimization',
        message: 'Small change set - consider running only affected package tests',
        impact: 'time-saving'
      });
    }

    if (impactAnalysis.riskLevel === 'high') {
      recommendations.push({
        type: 'quality',
        message: 'High-risk changes detected - full test suite recommended',
        impact: 'quality-assurance'
      });
    }

    // Performance recommendations
    if (impactAnalysis.affectedPackages.has('core')) {
      recommendations.push({
        type: 'performance',
        message: 'Core package changed - include performance regression tests',
        impact: 'performance-monitoring'
      });
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  
  getPackageFromFile(filePath) {
    const match = filePath.match(/packages\/([^\/]+)\//);
    return match ? match[1] : null;
  }

  getRiskScore(riskLevel) {
    const scores = { low: 1, medium: 2, high: 3 };
    return scores[riskLevel] || 0;
  }

  isCorePackage(packageName) {
    return ['core', 'api'].includes(packageName);
  }

  loadPackageInfo() {
    try {
      const rootPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return {
        workspaces: rootPackage.workspaces || [],
        scripts: rootPackage.scripts || {}
      };
    } catch (error) {
      return { workspaces: [], scripts: {} };
    }
  }

  loadTestHistory() {
    try {
      if (fs.existsSync(this.testHistoryFile)) {
        return JSON.parse(fs.readFileSync(this.testHistoryFile, 'utf8'));
      }
    } catch (error) {
      console.log('9 No test history found, starting fresh');
    }
    return { runs: [], durations: {} };
  }

  saveSelectionReport(report) {
    const reportsDir = path.join(__dirname, '../../.github/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportFile = path.join(reportsDir, `test-selection-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`=Ý Test selection report saved: ${reportFile}`);
  }

  getFallbackPlan() {
    console.log('  Using fallback test plan');
    return {
      timestamp: new Date().toISOString(),
      changedFiles: [],
      testSelection: {
        unit: { required: ['all'], optional: [], skip: [] },
        integration: { required: ['critical'], optional: [], skip: [] },
        e2e: { required: false, scenarios: [] },
        performance: { required: false, benchmarks: [] }
      },
      estimatedDuration: { total: 600 }, // 10 minutes fallback
      recommendations: [{
        type: 'fallback',
        message: 'Using fallback test plan due to analysis error'
      }]
    };
  }

  // Additional helper methods would be implemented here
  async getAllSourceFiles() { return []; }
  async analyzeDependencies(file) { return []; }
  calculateTestComplexity(impact) { return 'simple'; }
  async getPackageTests(packageName) { return { unit: [], integration: [] }; }
  hasIntegrationImpact(packageName, impact) { return false; }
  shouldRunPerformanceTests(impact) { return false; }
  selectPerformanceBenchmarks(impact) { return []; }
  groupTestsForParallel(tests) { return []; }
  estimateGroupDuration(group) { return 60; }
  estimateIntegrationDuration(tests) { return 120; }
  estimateE2EDuration(scenarios) { return 300; }
  estimatePerformanceDuration(benchmarks) { return 180; }
  isFeatureFile(file) { return false; }
  isBugfixFile(file) { return false; }
}

// CLI Interface
if (require.main === module) {
  const selector = new IntelligentTestSelector();
  
  const options = {
    baseBranch: process.argv[2] || 'main',
    environment: process.env.NODE_ENV || 'test'
  };

  selector.selectTests(options)
    .then(report => {
      console.log('\n=Ë Test Selection Report:');
      console.log(`Total estimated duration: ${Math.round(report.estimatedDuration.total / 60)} minutes`);
      console.log(`Affected packages: ${report.impactAnalysis?.affectedPackages?.size || 0}`);
      console.log(`Risk level: ${report.impactAnalysis?.riskLevel || 'unknown'}`);
      
      process.exit(0);
    })
    .catch(error => {
      console.error('L Test selection failed:', error);
      process.exit(1);
    });
}

module.exports = IntelligentTestSelector;