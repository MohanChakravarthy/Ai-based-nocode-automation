import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';

export class Scheduler {
  constructor(storage, automationEngine, io) {
    this.storage = storage;
    this.automationEngine = automationEngine;
    this.io = io;
    this.scheduledJobs = new Map();
  }

  addSchedule(schedule) {
    // If it's a one-time scheduled run
    if (schedule.scheduledTime) {
      const runTime = new Date(schedule.scheduledTime);
      const now = new Date();
      const delay = runTime.getTime() - now.getTime();

      if (delay > 0) {
        const timeoutId = setTimeout(() => {
          this.executeScheduledRun(schedule);
        }, delay);
        
        this.scheduledJobs.set(schedule.id, { type: 'timeout', id: timeoutId });
      }
    }
    // If it's a recurring cron schedule
    else if (schedule.cronExpression && cron.validate(schedule.cronExpression)) {
      const job = cron.schedule(schedule.cronExpression, () => {
        this.executeScheduledRun(schedule);
      });
      
      this.scheduledJobs.set(schedule.id, { type: 'cron', job });
    }
  }

  removeSchedule(scheduleId) {
    const scheduled = this.scheduledJobs.get(scheduleId);
    if (scheduled) {
      if (scheduled.type === 'timeout') {
        clearTimeout(scheduled.id);
      } else if (scheduled.type === 'cron') {
        scheduled.job.stop();
      }
      this.scheduledJobs.delete(scheduleId);
    }
  }

  async executeScheduledRun(schedule) {
    const testCase = this.storage.testCases.find(tc => tc.id === schedule.testCaseId);
    if (!testCase) {
      console.error(`Test case not found for schedule: ${schedule.id}`);
      return;
    }

    const executionId = uuidv4();
    
    // Notify clients about scheduled run starting
    this.io.emit('scheduled-run-started', {
      scheduleId: schedule.id,
      executionId,
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      startedAt: new Date().toISOString()
    });

    // Execute the test case
    await this.automationEngine.executeTestCase(executionId, testCase, null);

    // Update schedule last run time
    const scheduleIndex = this.storage.scheduledRuns.findIndex(s => s.id === schedule.id);
    if (scheduleIndex !== -1) {
      this.storage.scheduledRuns[scheduleIndex].lastRun = new Date().toISOString();
    }

    // Remove one-time schedules after execution
    if (schedule.scheduledTime && !schedule.cronExpression) {
      this.removeSchedule(schedule.id);
      const index = this.storage.scheduledRuns.findIndex(s => s.id === schedule.id);
      if (index !== -1) {
        this.storage.scheduledRuns.splice(index, 1);
      }
    }
  }

  // Initialize schedules from storage on server start
  initializeSchedules() {
    for (const schedule of this.storage.scheduledRuns) {
      if (schedule.enabled) {
        this.addSchedule(schedule);
      }
    }
  }

  getUpcomingRuns() {
    const upcoming = [];
    
    for (const schedule of this.storage.scheduledRuns) {
      if (!schedule.enabled) continue;

      const testCase = this.storage.testCases.find(tc => tc.id === schedule.testCaseId);
      if (!testCase) continue;

      if (schedule.scheduledTime) {
        const runTime = new Date(schedule.scheduledTime);
        if (runTime > new Date()) {
          upcoming.push({
            ...schedule,
            testCaseName: testCase.name,
            nextRun: schedule.scheduledTime
          });
        }
      } else if (schedule.cronExpression) {
        // Calculate next cron run time
        const nextRun = this.getNextCronRun(schedule.cronExpression);
        if (nextRun) {
          upcoming.push({
            ...schedule,
            testCaseName: testCase.name,
            nextRun: nextRun.toISOString()
          });
        }
      }
    }

    return upcoming.sort((a, b) => new Date(a.nextRun) - new Date(b.nextRun));
  }

  getNextCronRun(cronExpression) {
    // Simple next run calculation for common patterns
    // In production, use a library like cron-parser
    try {
      const now = new Date();
      // Return approximate next run (1 hour from now as placeholder)
      return new Date(now.getTime() + 3600000);
    } catch {
      return null;
    }
  }
}
