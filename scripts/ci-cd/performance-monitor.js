#!/usr/bin/env node

/**
 * Performance Monitor and Regression Detector for CI/CD Pipeline
 * 
 * Monitors CI/CD performance metrics, detects regressions,
 * and provides optimization recommendations.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class PerformanceMonitor {
  constructor() {
    this.metricsFile = path.join(__dirname, '../../.github/metrics/ci-performance.json');
    this.baselineFile = path.join(__dirname, '../../.github/metrics/baseline.json');
    this.thresholds = this.loadThresholds();
    this.ensureMetricsDir();
  }

  /**
   * Main entry point for performance monitoring
   */
  async monitorPerformance(options = {}) {
    console.log('=Ê Starting CI/CD performance monitoring...');
    
    try {
      const currentMetrics = await this.collectCurrentMetrics();
      const baseline = this.loadBaseline();
      const regressionReport = this.detectRegressions(currentMetrics, baseline);
      const optimizationPlan = this.generateOptimizationPlan(currentMetrics, regressionReport);

      const report = {
        timestamp: new Date().toISOString(),
        metrics: currentMetrics,
        baseline,
        regressions: regressionReport,
        optimizations: optimizationPlan,
        recommendations: this.generateRecommendations(currentMetrics, regressionReport)
      };

      await this.saveMetrics(currentMetrics);
      await this.saveReport(report);

      if (regressionReport.hasRegressions && options.failOnRegression) {
        console.error('L Performance regressions detected');
        process.exit(1);
      }

      return report;

    } catch (error) {
      console.error('L Performance monitoring failed:', error);
      throw error;
    }
  }

  /**
   * Collect current CI/CD performance metrics
   */
  async collectCurrentMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      ci: await this.collectCIMetrics(),
      build: await this.collectBuildMetrics(),
      test: await this.collectTestMetrics(),
      deployment: await this.collectDeploymentMetrics(),
      resource: await this.collectResourceMetrics()
    };

    console.log('=È Collected performance metrics');
    return metrics;
  }

  /**
   * Collect CI pipeline metrics
   */
  async collectCIMetrics() {
    const metrics = {
      pipelineDuration: 0,
      jobDurations: {},
      queueTime: 0,
      successRate: 0,
      parallelizationRatio: 0
    };

    try {
      // Get recent workflow runs
      const { stdout } = await execAsync('gh run list --limit 10 --json status,conclusion,createdAt,updatedAt,name');
      const runs = JSON.parse(stdout);

      const completedRuns = runs.filter(run => run.status === 'completed');
      
      if (completedRuns.length > 0) {
        // Calculate average pipeline duration
        const durations = completedRuns.map(run => {
          const start = new Date(run.createdAt);
          const end = new Date(run.updatedAt);
          return (end - start) / 1000; // seconds
        });

        metrics.pipelineDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        
        // Calculate success rate
        const successfulRuns = completedRuns.filter(run => run.conclusion === 'success');
        metrics.successRate = (successfulRuns.length / completedRuns.length) * 100;
      }

    } catch (error) {
      console.warn('  Could not collect CI metrics:', error.message);
    }

    return metrics;
  }

  /**
   * Collect build performance metrics
   */
  async collectBuildMetrics() {
    const metrics = {
      totalBuildTime: 0,
      packageBuildTimes: {},
      cacheHitRate: 0,
      artifactSize: 0
    };

    try {
      // Collect build times for each package
      const packages = ['core', 'api', 'cli', 'sdk', 'admin-ui', 'audit-service'];
      
      for (const pkg of packages) {
        const packagePath = path.join(process.cwd(), 'packages', pkg);
        if (fs.existsSync(packagePath)) {
          const startTime = Date.now();
          try {
            await execAsync(`cd ${packagePath} && npm run build`, { timeout: 60000 });
            metrics.packageBuildTimes[pkg] = (Date.now() - startTime) / 1000;
          } catch (error) {
            metrics.packageBuildTimes[pkg] = -1; // Build failed
          }
        }
      }

      metrics.totalBuildTime = Object.values(metrics.packageBuildTimes)
        .filter(time => time > 0)
        .reduce((a, b) => a + b, 0);

    } catch (error) {
      console.warn('  Could not collect build metrics:', error.message);
    }

    return metrics;
  }

  /**
   * Collect test execution metrics
   */
  async collectTestMetrics() {
    const metrics = {
      totalTestTime: 0,
      unitTestTime: 0,
      integrationTestTime: 0,
      e2eTestTime: 0,
      testCount: 0,
      coveragePercentage: 0,
      flakyTests: []
    };

    try {
      // Run tests with timing
      const packages = ['core', 'api', 'cli', 'sdk'];
      
      for (const pkg of packages) {
        const packagePath = path.join(process.cwd(), 'packages', pkg);
        if (fs.existsSync(packagePath)) {
          try {
            const startTime = Date.now();
            const { stdout } = await execAsync(`cd ${packagePath} && npm test`, { timeout: 120000 });
            const duration = (Date.now() - startTime) / 1000;
            
            metrics.unitTestTime += duration;
            
            // Extract test count from output
            const testMatch = stdout.match(/(\d+) tests? passed/);
            if (testMatch) {
              metrics.testCount += parseInt(testMatch[1]);
            }
            
          } catch (error) {
            console.warn(`  Test metrics collection failed for ${pkg}:`, error.message);
          }
        }
      }

      metrics.totalTestTime = metrics.unitTestTime + metrics.integrationTestTime + metrics.e2eTestTime;

    } catch (error) {
      console.warn('  Could not collect test metrics:', error.message);
    }

    return metrics;
  }

  /**
   * Collect deployment metrics
   */
  async collectDeploymentMetrics() {
    const metrics = {
      deploymentDuration: 0,
      rollbackTime: 0,
      successRate: 100,
      mttr: 0, // Mean Time To Recovery
      changeFailureRate: 0
    };

    try {
      // Analyze deployment history from logs or external monitoring
      // This is a placeholder for actual deployment metrics collection
      
    } catch (error) {
      console.warn('  Could not collect deployment metrics:', error.message);
    }

    return metrics;
  }

  /**
   * Collect resource utilization metrics
   */
  async collectResourceMetrics() {
    const metrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkUsage: 0,
      concurrentJobs: 0
    };

    try {
      // Get system resource usage
      const { stdout: memInfo } = await execAsync('free -m').catch(() => ({ stdout: '' }));
      if (memInfo) {
        const memMatch = memInfo.match(/Mem:\s+(\d+)\s+(\d+)/);
        if (memMatch) {
          const total = parseInt(memMatch[1]);
          const used = parseInt(memMatch[2]);
          metrics.memoryUsage = (used / total) * 100;
        }
      }

      const { stdout: cpuInfo } = await execAsync('top -bn1 | grep "Cpu(s)"').catch(() => ({ stdout: '' }));
      if (cpuInfo) {
        const cpuMatch = cpuInfo.match(/(\d+\.\d+)%id/);
        if (cpuMatch) {
          metrics.cpuUsage = 100 - parseFloat(cpuMatch[1]);
        }
      }

    } catch (error) {
      console.warn('  Could not collect resource metrics:', error.message);
    }

    return metrics;
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(current, baseline) {
    const regressions = [];
    let hasRegressions = false;

    if (!baseline || !baseline.metrics) {
      return { hasRegressions: false, regressions: [] };
    }

    // CI Pipeline regression checks
    if (this.hasRegression(current.ci.pipelineDuration, baseline.metrics.ci.pipelineDuration, 'increase', 20)) {
      regressions.push({
        type: 'ci_duration',
        severity: 'high',
        current: current.ci.pipelineDuration,
        baseline: baseline.metrics.ci.pipelineDuration,
        change: this.calculatePercentageChange(baseline.metrics.ci.pipelineDuration, current.ci.pipelineDuration),
        threshold: 20,
        message: 'CI pipeline duration increased significantly'
      });
      hasRegressions = true;
    }

    // Build time regression checks
    if (this.hasRegression(current.build.totalBuildTime, baseline.metrics.build.totalBuildTime, 'increase', 15)) {
      regressions.push({
        type: 'build_duration',
        severity: 'medium',
        current: current.build.totalBuildTime,
        baseline: baseline.metrics.build.totalBuildTime,
        change: this.calculatePercentageChange(baseline.metrics.build.totalBuildTime, current.build.totalBuildTime),
        threshold: 15,
        message: 'Build time increased beyond acceptable threshold'
      });
      hasRegressions = true;
    }

    // Test execution regression checks
    if (this.hasRegression(current.test.totalTestTime, baseline.metrics.test.totalTestTime, 'increase', 25)) {
      regressions.push({
        type: 'test_duration',
        severity: 'medium',
        current: current.test.totalTestTime,
        baseline: baseline.metrics.test.totalTestTime,
        change: this.calculatePercentageChange(baseline.metrics.test.totalTestTime, current.test.totalTestTime),
        threshold: 25,
        message: 'Test execution time increased significantly'
      });
      hasRegressions = true;
    }

    // Success rate regression checks
    if (this.hasRegression(current.ci.successRate, baseline.metrics.ci.successRate, 'decrease', 5)) {
      regressions.push({
        type: 'success_rate',
        severity: 'high',
        current: current.ci.successRate,
        baseline: baseline.metrics.ci.successRate,
        change: this.calculatePercentageChange(baseline.metrics.ci.successRate, current.ci.successRate),
        threshold: -5,
        message: 'CI success rate has decreased'
      });
      hasRegressions = true;
    }

    return { hasRegressions, regressions };
  }

  /**
   * Check if a metric has regressed beyond threshold
   */
  hasRegression(current, baseline, direction, thresholdPercent) {
    if (!baseline || baseline === 0) return false;
    
    const changePercent = this.calculatePercentageChange(baseline, current);
    
    if (direction === 'increase') {
      return changePercent > thresholdPercent;
    } else if (direction === 'decrease') {
      return changePercent < -thresholdPercent;
    }
    
    return false;
  }

  /**
   * Calculate percentage change between two values
   */
  calculatePercentageChange(baseline, current) {
    if (!baseline || baseline === 0) return 0;
    return ((current - baseline) / baseline) * 100;
  }

  /**
   * Generate optimization plan based on metrics and regressions
   */
  generateOptimizationPlan(metrics, regressions) {
    const optimizations = [];

    // Build optimization recommendations
    if (metrics.build.totalBuildTime > this.thresholds.build.maxTime) {
      optimizations.push({
        category: 'build',
        priority: 'high',
        title: 'Optimize Build Performance',
        description: 'Build time exceeds recommended threshold',
        actions: [
          'Implement incremental builds',
          'Optimize dependency caching',
          'Parallelize package builds',
          'Review webpack/bundler configuration'
        ],
        estimatedImprovement: '30-50% build time reduction'
      });
    }

    // Test optimization recommendations
    if (metrics.test.totalTestTime > this.thresholds.test.maxTime) {
      optimizations.push({
        category: 'test',
        priority: 'medium',
        title: 'Optimize Test Execution',
        description: 'Test execution time is above optimal range',
        actions: [
          'Implement smart test selection',
          'Parallelize test suites',
          'Optimize test setup/teardown',
          'Review slow test cases'
        ],
        estimatedImprovement: '40-60% test time reduction'
      });
    }

    // CI pipeline optimization
    if (metrics.ci.parallelizationRatio < this.thresholds.ci.minParallelization) {
      optimizations.push({
        category: 'ci',
        priority: 'high',
        title: 'Improve Pipeline Parallelization',
        description: 'Pipeline has low parallelization ratio',
        actions: [
          'Analyze job dependencies',
          'Break sequential jobs into parallel groups',
          'Optimize matrix strategies',
          'Implement intelligent scheduling'
        ],
        estimatedImprovement: '20-40% pipeline time reduction'
      });
    }

    return optimizations;
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(metrics, regressions) {
    const recommendations = [];

    // Regression-specific recommendations
    if (regressions.hasRegressions) {
      recommendations.push({
        type: 'regression',
        priority: 'high',
        title: 'Address Performance Regressions',
        message: `${regressions.regressions.length} performance regression(s) detected`,
        actions: regressions.regressions.map(r => `Fix ${r.type}: ${r.message}`)
      });
    }

    // General optimization recommendations
    if (metrics.build.cacheHitRate < 80) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Improve Build Caching',
        message: 'Build cache hit rate is below optimal threshold',
        actions: [
          'Review cache key strategies',
          'Optimize cache dependencies',
          'Implement layer caching for Docker builds'
        ]
      });
    }

    if (metrics.test.flakyTests.length > 0) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        title: 'Fix Flaky Tests',
        message: `${metrics.test.flakyTests.length} flaky test(s) detected`,
        actions: [
          'Investigate flaky test root causes',
          'Implement better test isolation',
          'Add retry mechanisms for network-dependent tests'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Utility methods
   */
  
  loadThresholds() {
    return {
      ci: {
        maxPipelineDuration: 900, // 15 minutes
        minSuccessRate: 95,
        minParallelization: 0.6
      },
      build: {
        maxTime: 300, // 5 minutes
        minCacheHitRate: 80
      },
      test: {
        maxTime: 600, // 10 minutes
        maxFlakyTests: 2
      },
      deployment: {
        maxDuration: 600, // 10 minutes
        minSuccessRate: 98
      }
    };
  }

  loadBaseline() {
    try {
      if (fs.existsSync(this.baselineFile)) {
        return JSON.parse(fs.readFileSync(this.baselineFile, 'utf8'));
      }
    } catch (error) {
      console.log('9 No baseline found, will create new baseline');
    }
    return null;
  }

  async saveMetrics(metrics) {
    const metricsHistory = this.loadMetricsHistory();
    metricsHistory.push({
      timestamp: metrics.timestamp,
      metrics
    });

    // Keep only last 50 entries
    if (metricsHistory.length > 50) {
      metricsHistory.splice(0, metricsHistory.length - 50);
    }

    fs.writeFileSync(this.metricsFile, JSON.stringify(metricsHistory, null, 2));
    
    // Update baseline if this is a good run
    if (this.shouldUpdateBaseline(metrics)) {
      fs.writeFileSync(this.baselineFile, JSON.stringify({
        timestamp: metrics.timestamp,
        metrics
      }, null, 2));
    }
  }

  shouldUpdateBaseline(metrics) {
    // Update baseline if success rate is high and no major issues
    return metrics.ci.successRate >= 95 && 
           metrics.ci.pipelineDuration < this.thresholds.ci.maxPipelineDuration;
  }

  loadMetricsHistory() {
    try {
      if (fs.existsSync(this.metricsFile)) {
        return JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
      }
    } catch (error) {
      console.log('9 Starting new metrics history');
    }
    return [];
  }

  async saveReport(report) {
    const reportsDir = path.join(__dirname, '../../.github/reports');
    const reportFile = path.join(reportsDir, `performance-${Date.now()}.json`);
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`=Ý Performance report saved: ${reportFile}`);
  }

  ensureMetricsDir() {
    const metricsDir = path.dirname(this.metricsFile);
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }
  }
}

// CLI Interface
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  
  const options = {
    failOnRegression: process.argv.includes('--fail-on-regression'),
    updateBaseline: process.argv.includes('--update-baseline')
  };

  monitor.monitorPerformance(options)
    .then(report => {
      console.log('\n=Ê Performance Monitoring Report:');
      console.log(`Pipeline Duration: ${Math.round(report.metrics.ci.pipelineDuration)}s`);
      console.log(`Build Time: ${Math.round(report.metrics.build.totalBuildTime)}s`);
      console.log(`Test Time: ${Math.round(report.metrics.test.totalTestTime)}s`);
      console.log(`Success Rate: ${report.metrics.ci.successRate.toFixed(1)}%`);
      
      if (report.regressions.hasRegressions) {
        console.log(`\n  ${report.regressions.regressions.length} regression(s) detected`);
        report.regressions.regressions.forEach(r => {
          console.log(`- ${r.message} (${r.change.toFixed(1)}% change)`);
        });
      }
      
      if (report.optimizations.length > 0) {
        console.log(`\n=¡ ${report.optimizations.length} optimization(s) recommended`);
      }
      
      process.exit(0);
    })
    .catch(error => {
      console.error('L Performance monitoring failed:', error);
      process.exit(1);
    });
}

module.exports = PerformanceMonitor;