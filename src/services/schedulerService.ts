import { CronJob } from 'cron';
import { SalesProcessingService } from './salesProcessingService';
import { AutoTweetService, AutoPostSettings, PostResult } from './autoTweetService';
import { APIToggleService } from './apiToggleService';
import { logger } from '../utils/logger';
import { IDatabaseService } from '../types';

export class SchedulerService {
  private salesProcessingService: SalesProcessingService;
  private autoTweetService: AutoTweetService;
  private apiToggleService: APIToggleService;
  private databaseService: IDatabaseService;
  private salesSyncJob: CronJob | null = null;
  private registrationSyncJob: CronJob | null = null;
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private lastRunStats: any = null;
  private consecutiveErrors: number = 0;
  private maxConsecutiveErrors: number = 5;

  constructor(
    salesProcessingService: SalesProcessingService, 
    autoTweetService: AutoTweetService,
    databaseService: IDatabaseService
  ) {
    this.salesProcessingService = salesProcessingService;
    this.autoTweetService = autoTweetService;
    this.apiToggleService = APIToggleService.getInstance();
    this.databaseService = databaseService;
  }

  /**
   * Initialize scheduler state from database
   */
  async initializeFromDatabase(): Promise<void> {
    try {
      const savedState = await this.databaseService.getSystemState('scheduler_enabled');
      if (savedState === 'true') {
        logger.info('Scheduler was enabled, starting automatically...');
        this.start();
      } else {
        logger.info('Scheduler is disabled by default - use dashboard to start');
      }
    } catch (error: any) {
      logger.warn('Could not load scheduler state from database:', error.message);
      logger.info('Scheduler will remain stopped until manually started');
    }
  }

  /**
   * Start the automated scheduling
   * Sales processing: every 5 minutes, Registration processing: every 1 minute
   */
  start(): void {
    // Stop existing jobs if running
    if (this.salesSyncJob || this.registrationSyncJob) {
      logger.warn('Scheduler already running, stopping existing jobs first');
      this.stop();
    }

    // Create cron job for sales processing (every 5 minutes)
    this.salesSyncJob = new CronJob(
      '0 */5 * * * *', // Every 5 minutes at :00 seconds
      () => {
        this.runSalesSync();
      },
      null,
      false, // Don't start automatically
      'America/New_York' // Timezone
    );

    // Create cron job for registration processing (every 1 minute)
    this.registrationSyncJob = new CronJob(
      '0 * * * * *', // Every 1 minute at :00 seconds
      () => {
        this.runRegistrationSync();
      },
      null,
      false, // Don't start automatically
      'America/New_York' // Timezone
    );

    this.salesSyncJob.start();
    this.registrationSyncJob.start();
    this.isRunning = true;
    
    // Save enabled state to database
    this.saveSchedulerState(true);
    
    logger.info('Scheduler started - Sales: every 5 minutes, Registrations: every 1 minute');
    logger.info(`Next sales run: ${this.salesSyncJob.nextDate().toString()}`);
    logger.info(`Next registration run: ${this.registrationSyncJob.nextDate().toString()}`);
  }

  /**
   * Stop the automated scheduling
   */
  stop(): void {
    let wasRunning = false;
    
    if (this.salesSyncJob) {
      this.salesSyncJob.stop();
      this.salesSyncJob = null;
      wasRunning = true;
    }
    
    if (this.registrationSyncJob) {
      this.registrationSyncJob.stop();
      this.registrationSyncJob = null;
      wasRunning = true;
    }
    
    if (wasRunning) {
      this.isRunning = false;
      
      // Save disabled state to database
      this.saveSchedulerState(false);
      
      logger.info('Scheduler stopped - both sales and registration processing halted');
    } else {
      logger.info('Scheduler was not running');
    }
  }

  /**
   * Force stop all scheduler activity
   */
  forceStop(): void {
    this.isRunning = false;
    
    if (this.salesSyncJob) {
      this.salesSyncJob.stop();
      this.salesSyncJob = null;
    }
    
    if (this.registrationSyncJob) {
      this.registrationSyncJob.stop();
      this.registrationSyncJob = null;
    }
    
    // Save disabled state to database
    this.saveSchedulerState(false);
    
    logger.info('Scheduler force stopped - all activity halted');
  }

  /**
   * Save scheduler enabled/disabled state to database
   */
  private async saveSchedulerState(enabled: boolean): Promise<void> {
    try {
      await this.databaseService.setSystemState('scheduler_enabled', enabled.toString());
      logger.debug(`Scheduler state saved: ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      logger.warn('Could not save scheduler state to database:', error.message);
    }
  }

  /**
   * Execute the sales sync process (runs every 5 minutes)
   */
  private async runSalesSync(): Promise<void> {
    if (!this.isRunning) {
      logger.debug('Skipping sales sync - scheduler is stopped');
      return;
    }

    const startTime = new Date();
    logger.info('Starting sales sync...');

    try {
      // Refresh NTP time cache before processing
      await this.autoTweetService.refreshTimeCache();
      
      // Process new sales
      const result = await this.salesProcessingService.processNewSales();
      
      // Auto-post new sales if enabled
      let autoPostResults: PostResult[] = [];
      
      if (result.newSales > 0 && result.processedSales.length > 0) {
        const autoPostSettings = await this.autoTweetService.getSettings();
        if (autoPostSettings.enabled && this.apiToggleService.isAutoPostingEnabled()) {
          logger.info(`🤖 Auto-posting ${result.processedSales.length} new sales...`);
          autoPostResults = await this.autoTweetService.processNewSales(result.processedSales, autoPostSettings);
          
          const posted = autoPostResults.filter(r => r.success).length;
          const skipped = autoPostResults.filter(r => r.skipped).length;
          const failed = autoPostResults.filter(r => !r.success && !r.skipped).length;
          
          logger.info(`🐦 Sales auto-posting results: ${posted} posted, ${skipped} skipped, ${failed} failed`);
        }
      }
      
      this.lastRunTime = startTime;
      this.lastRunStats = { ...result, autoPostResults };
      this.consecutiveErrors = 0; // Reset error counter on success

      const duration = Date.now() - startTime.getTime();
      const salesPosted = autoPostResults.filter(r => r.success).length;
      
      logger.info(`Sales sync completed in ${duration}ms:`, {
        fetched: result.fetched,
        newSales: result.newSales,
        duplicates: result.duplicates,
        errors: result.errors,
        salesAutoPosted: salesPosted
      });

      // Log notable events
      if (result.newSales > 0) {
        logger.info(`📈 Found ${result.newSales} new sales to process`);
      }
      
      if (salesPosted > 0) {
        logger.info(`🐦 Posted ${salesPosted} sale tweets`);
      }
      
      if (result.errors > 0) {
        logger.warn(`⚠️ Encountered ${result.errors} errors during processing`);
      }

    } catch (error: any) {
      this.consecutiveErrors++;
      
      logger.error(`Scheduled sync failed (attempt ${this.consecutiveErrors}/${this.maxConsecutiveErrors}):`, error.message);
      
      this.lastRunStats = {
        success: false,
        error: error.message,
        consecutiveErrors: this.consecutiveErrors
      };

      // Stop scheduler if too many consecutive errors
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        logger.error(`Too many consecutive errors (${this.consecutiveErrors}). Stopping scheduler for safety.`);
        this.stop();
        
        // TODO: In a production system, this would trigger alerts
        // For now, just log the critical error
        logger.error('🚨 SCHEDULER STOPPED DUE TO REPEATED FAILURES - Manual intervention required');
      }
    }
  }

  /**
   * Execute the registration sync process (runs every 1 minute)
   */
  private async runRegistrationSync(): Promise<void> {
    if (!this.isRunning) {
      logger.debug('Skipping registration sync - scheduler is stopped');
      return;
    }

    const startTime = new Date();
    logger.info('Starting registration sync...');

    try {
      // Auto-post unposted registrations if enabled
      const unpostedRegistrations = await this.databaseService.getUnpostedRegistrations(10);
      let registrationAutoPostResults: PostResult[] = [];
      
      if (unpostedRegistrations.length > 0) {
        const autoPostSettings = await this.autoTweetService.getSettings();
        if (autoPostSettings.enabled && autoPostSettings.registrationsEnabled && this.apiToggleService.isAutoPostingEnabled()) {
          logger.info(`🏛️ Auto-posting ${unpostedRegistrations.length} unposted registrations...`);
          registrationAutoPostResults = await this.autoTweetService.processNewRegistrations(unpostedRegistrations, autoPostSettings);
          
          const posted = registrationAutoPostResults.filter(r => r.success).length;
          const skipped = registrationAutoPostResults.filter(r => r.skipped).length;
          const failed = registrationAutoPostResults.filter(r => !r.success && !r.skipped).length;
          
          logger.info(`🏛️ Registration auto-posting results: ${posted} posted, ${skipped} skipped, ${failed} failed`);
        }
      }

      const duration = Date.now() - startTime.getTime();
      const registrationsPosted = registrationAutoPostResults.filter(r => r.success).length;
      
      logger.info(`Registration sync completed in ${duration}ms:`, {
        unpostedFound: unpostedRegistrations.length,
        registrationsAutoPosted: registrationsPosted
      });

      // Log registration processing summary
      if (unpostedRegistrations.length > 0) {
        logger.info(`🏛️ Processed ${unpostedRegistrations.length} registrations: ${registrationsPosted} posted, ${unpostedRegistrations.length - registrationsPosted} skipped/failed`);
      }
      
      if (registrationsPosted > 0) {
        logger.info(`🐦 Posted ${registrationsPosted} registration tweets`);
      }

    } catch (error: any) {
      logger.error(`Registration sync failed:`, error.message);
    }
  }

  /**
   * Get scheduler status and statistics
   */
  getStatus(): {
    isRunning: boolean;
    lastRunTime: Date | null;
    nextRunTime: Date | null;  // Backward compatibility - shows nearest upcoming run
    nextSalesRunTime: Date | null;
    nextRegistrationRunTime: Date | null;
    lastRunStats: any;
    consecutiveErrors: number;
    uptime: number;
  } {
    const nextSalesRunTime = this.salesSyncJob ? this.salesSyncJob.nextDate().toJSDate() : null;
    const nextRegistrationRunTime = this.registrationSyncJob ? this.registrationSyncJob.nextDate().toJSDate() : null;
    
    // For backward compatibility, show the nearest upcoming run
    let nextRunTime = null;
    if (nextSalesRunTime && nextRegistrationRunTime) {
      nextRunTime = nextSalesRunTime < nextRegistrationRunTime ? nextSalesRunTime : nextRegistrationRunTime;
    } else if (nextSalesRunTime) {
      nextRunTime = nextSalesRunTime;
    } else if (nextRegistrationRunTime) {
      nextRunTime = nextRegistrationRunTime;
    }

    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      nextRunTime, // Backward compatibility
      nextSalesRunTime,
      nextRegistrationRunTime,
      lastRunStats: this.lastRunStats,
      consecutiveErrors: this.consecutiveErrors,
      uptime: this.lastRunTime ? Date.now() - this.lastRunTime.getTime() : 0
    };
  }

  /**
   * Manually trigger both sales and registration sync (doesn't affect the schedule)
   */
  async triggerManualSync(): Promise<{
    success: boolean;
    stats?: any;
    error?: string;
  }> {
    try {
      logger.info('Manual sync triggered - running both sales and registration processing');
      
      // Run both sync methods manually
      await this.runSalesSync();
      await this.runRegistrationSync();
      
      return {
        success: true,
        stats: { message: 'Both sales and registration sync completed' }
      };
    } catch (error: any) {
      logger.error('Manual sync failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reset error counter (useful for recovery)
   */
  resetErrorCounter(): void {
    this.consecutiveErrors = 0;
    logger.info('Scheduler error counter reset');
  }

  /**
   * Get next few scheduled run times for monitoring
   */
  getUpcomingRuns(count: number = 5): { sales: Date[], registrations: Date[] } {
    if (!this.salesSyncJob || !this.registrationSyncJob) {
      return { sales: [], registrations: [] };
    }

    const salesRuns: Date[] = [];
    const registrationRuns: Date[] = [];
    
    // Get next few sales runs (every 5 minutes)
    let currentTime = new Date();
    for (let i = 0; i < count; i++) {
      const nextSalesRun = new Date(this.salesSyncJob.nextDate().toJSDate());
      nextSalesRun.setMinutes(nextSalesRun.getMinutes() + (i * 5));
      salesRuns.push(nextSalesRun);
    }
    
    // Get next few registration runs (every 1 minute)  
    for (let i = 0; i < count; i++) {
      const nextRegRun = new Date(this.registrationSyncJob.nextDate().toJSDate());
      nextRegRun.setMinutes(nextRegRun.getMinutes() + i);
      registrationRuns.push(nextRegRun);
    }
    
    return { sales: salesRuns, registrations: registrationRuns };
  }

  /**
   * Check if scheduler is healthy
   */
  isHealthy(): boolean {
    return this.isRunning && this.consecutiveErrors < this.maxConsecutiveErrors;
  }


}
