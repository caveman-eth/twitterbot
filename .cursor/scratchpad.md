# NFT Sales Twitter Bot - Project Plan

## Background and Motivation

The goal is to build an automated Twitter bot that monitors NFT sales for specific contract addresses (2 ENS names) and posts real-time sales updates to Twitter. This system will help provide transparency and engagement around NFT collection activity.

### Key Requirements:
- Monitor NFT sales for 2 specific contract addresses (ENS names)
- Use Alchemy's NFT Sales API initially (may pivot to other data sources)
- Automated Twitter posting via Twitter API
- Admin dashboard for monitoring and management
- Real-time or near real-time posting capability

### Target Users:
- NFT community members interested in sales activity
- Collection holders wanting transparency
- Traders looking for market insights

### Project Specifications:
- **Contract Addresses**: 
  - 0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401
  - 0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85
- **Deployment**: Local testing initially, Vercel for production
- **Database**: SQLite for testing phase
- **Polling Frequency**: Every 5 minutes (with manual lookup UI button)

## Key Challenges and Analysis

### Technical Challenges:
1. **Data Source Reliability**: Alchemy may not cover all marketplaces needed
2. **Twitter Rate Limiting**: CRITICAL - Only 17 posts per 24h on current plan
3. **Manual Control Required**: No automated posting - admin must manually approve each post
4. **Duplicate Detection**: Ensuring we don't post the same sale multiple times
5. **Real-time Processing**: Need efficient polling or webhook system
6. **Error Handling**: Robust system for API failures and network issues
7. **Data Formatting**: Converting blockchain data into engaging Twitter content

### Twitter API Integration Considerations:
1. **Authentication**: OAuth 1.0a User Context required for posting tweets
2. **Rate Limit Management**: Track and enforce 17 posts/24h limit strictly
3. **Manual Posting Only**: No automated tweet posting due to rate limits
4. **Tweet Content Strategy**: Format NFT sales data into engaging, informative tweets
5. **Error Recovery**: Handle Twitter API failures gracefully
6. **Preview System**: Allow admin to preview tweets before posting

### Architecture Considerations:
1. **Manual Control**: Admin dashboard with manual post buttons instead of automated posting
2. **Rate Limit Tracking**: Database storage of posting history and daily limits
3. **Tweet Preview**: Admin can see formatted tweet before posting
4. **Queue Management**: Unposted sales available for manual selection and posting
5. **Twitter Service**: Separate service for authentication, formatting, and posting

## High-level Task Breakdown

### Phase 1: Foundation & Data Pipeline ✅ COMPLETED
- [x] **Task 1.1**: Set up project structure and development environment
- [x] **Task 1.2**: Implement Alchemy NFT Sales API integration  
- [x] **Task 1.3**: Set up database schema for tracking processed sales
- [x] **Task 1.4**: Create sales data processing and deduplication logic

### Phase 2: Admin Dashboard & Scheduling (CURRENT)
- [ ] **Task 2.1**: Build responsive HTML/CSS admin dashboard
  - Success Criteria: Clean, functional web interface showing system status and recent sales
- [ ] **Task 2.2**: Add real-time dashboard features and manual controls
  - Success Criteria: Live stats, manual sync button, sales table with pagination
- [ ] **Task 2.3**: Implement automated scheduling system
  - Success Criteria: Cron job runs every 5 minutes, processes new sales automatically
- [ ] **Task 2.4**: Add system health monitoring and logging dashboard
  - Success Criteria: Error tracking, API status, database health visible in dashboard

### Phase 3: Twitter Integration (CURRENT)
- [ ] **Task 3.1**: Set up Twitter API v2 authentication and service
  - Success Criteria: Can authenticate with OAuth 1.0a and make test API calls
- [ ] **Task 3.2**: Create tweet formatting and content strategy
  - Success Criteria: NFT sales formatted into engaging tweets with proper data
- [ ] **Task 3.3**: Build manual posting system with rate limit protection
  - Success Criteria: Admin can manually post tweets, rate limits tracked (17/24h limit)
- [ ] **Task 3.4**: Add tweet preview and confirmation system
  - Success Criteria: Preview tweets before posting, confirm/cancel functionality

### Phase 4: Production Deployment & Monitoring
- [ ] **Task 4.1**: Set up production environment and deployment
  - Success Criteria: System running reliably in production environment
- [ ] **Task 4.2**: Implement comprehensive logging and monitoring
  - Success Criteria: Can track system health, API usage, posting success rates
- [ ] **Task 4.3**: Add alerting for system issues
  - Success Criteria: Notifications for API failures, posting issues, system downtime

## Recommended Architecture

Based on your web app background, I recommend a **Node.js/TypeScript** stack with the following architecture:

### Core Components:
1. **Data Fetcher Service**: Polls Alchemy API for new sales
2. **Database Layer**: PostgreSQL or SQLite for sales tracking
3. **Processing Engine**: Validates, deduplicates, and formats sales data
4. **Twitter Service**: Handles posting with queue management
5. **Admin Dashboard**: Express.js web app for monitoring
6. **Scheduler**: Cron jobs or task scheduler for regular polling

### Technology Stack:
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for web dashboard
- **Database**: PostgreSQL (production) or SQLite (development)
- **Queue**: Simple in-memory queue initially, Redis for production
- **APIs**: Alchemy Web3 API, Twitter API v2
- **Frontend**: Simple HTML/CSS/JS (or React if preferred)
- **Deployment**: Docker containers, PM2 for process management

### Data Flow:
1. Scheduler triggers data fetcher every 5 minutes (or manual trigger)
2. Data fetcher queries Alchemy for new sales since last check
3. Processing engine filters new sales, formats data
4. Twitter service adds formatted tweets to queue
5. Queue processor posts to Twitter respecting rate limits
6. Dashboard displays real-time status and metrics

## Project Status Board

### Current Sprint: Foundation Setup ✅ COMPLETED
- [x] Initialize project structure
- [x] Set up development environment  
- [x] Implement basic Alchemy integration
- [x] Create database schema
- [x] Build sales processing and deduplication system

### Next Sprint: Admin Dashboard & Scheduling
- [ ] Build HTML/CSS admin dashboard with real-time stats
- [ ] Add manual controls (sync, view sales, system status)
- [ ] Implement cron-based scheduling (every 5 minutes)
- [ ] Add dashboard monitoring and health checks

### Next Sprint: Twitter API Integration (CURRENT)
- [ ] Research Twitter API v2 authentication and rate limits
- [ ] Implement Twitter service with OAuth 1.0a User Context
- [ ] Create tweet formatting service for NFT sales
- [ ] Add manual posting controls to admin dashboard
- [ ] Implement rate limit tracking and protection
- [ ] Add tweet preview and confirmation system

### Future Backlog:
- [ ] Production deployment
- [ ] Advanced monitoring and alerting

## Executor's Feedback or Assistance Requests

### Task 1.1 ✅ COMPLETED
- Set up Node.js/TypeScript project structure with proper tooling
- Configured ESLint, Prettier, and build scripts
- Created organized directory structure
- Basic Express server with health check endpoint

### Task 1.2 ✅ COMPLETED  
- Implemented Alchemy NFT Sales API service
- Added comprehensive error handling and logging
- Created test endpoints for manual verification
- Built API integration for both individual contracts and batch fetching

### Ready for Testing - ACTION REQUIRED
**To test the Alchemy integration, you need to:**

1. Get an Alchemy API key from https://www.alchemy.com/
2. Create a `.env` file in the project root (copy from `env.example`)
3. Add your `ALCHEMY_API_KEY=your_key_here` to the `.env` file
4. Run `npm run dev` to start the development server
5. Test these endpoints:
   - `http://localhost:3000/api/test-alchemy` - Test API connection
   - `http://localhost:3000/api/fetch-sales?limit=5` - Fetch recent sales from both contracts
   - `http://localhost:3000/api/fetch-sales?contractAddress=0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401&limit=3` - Test specific contract

### Task 1.3 ✅ COMPLETED
- Created comprehensive SQLite database schema with proper indexing
- Built DatabaseService with full CRUD operations for sales tracking
- Added system state tracking for last processed blocks
- Implemented proper connection management and graceful shutdown

### Task 1.4 ✅ COMPLETED
- Built SalesProcessingService with deduplication logic
- Implemented Wei to ETH conversion and price calculation
- Added automatic duplicate detection using transaction hashes
- Created manual sync capability for testing
- Built comprehensive statistics and monitoring endpoints

### 🎉 PHASE 1 COMPLETE - Ready for Testing!

**New testing endpoints available:**
- `http://localhost:3000/api/process-sales` - **Main endpoint**: Process and store new sales
- `http://localhost:3000/api/stats` - View database statistics and recent sales
- `http://localhost:3000/api/unposted-sales` - See sales ready for Twitter posting

**Test the complete data pipeline:**
1. Run `npm run dev` to start the server
2. Visit `http://localhost:3000/api/process-sales` to fetch and process sales
3. Check `http://localhost:3000/api/stats` to see stored data
4. View `http://localhost:3000/api/unposted-sales` to see what's ready for Twitter

### Task 2.1 ✅ COMPLETED
- Built modern, responsive admin dashboard using Tailwind CSS
- Created clean interface with system status cards and recent sales table
- Added real-time stats display and navigation

### Task 2.2 ✅ COMPLETED  
- Implemented live dashboard features with Alpine.js
- Added manual sync button and API testing controls
- Built interactive sales table with transaction links to Etherscan
- Added auto-refresh functionality (every 30 seconds)

### Task 2.3 ✅ COMPLETED
- Created comprehensive SchedulerService with cron job functionality
- Implemented automated sales processing every 5 minutes
- Added error handling with consecutive error limits and auto-stop safety
- Built scheduler control endpoints (start/stop/reset errors)

### Task 2.4 ✅ COMPLETED
- Added scheduler status monitoring to dashboard
- Implemented system health checks and status indicators
- Built comprehensive error tracking and logging
- Added scheduler controls in the admin interface

### 🎉 PHASE 2 COMPLETE - Full Admin Dashboard & Scheduling!

**The system now includes:**
- **Complete Data Pipeline**: Alchemy API → Processing → SQLite → Ready for Twitter
- **Professional Admin Dashboard**: Real-time stats, manual controls, sales monitoring
- **Automated Scheduling**: Runs every 5 minutes with error handling and safety stops
- **System Monitoring**: Health checks, scheduler status, error tracking

**Ready for testing:**
1. Run `npm run dev` 
2. Visit `http://localhost:3000` for the full admin dashboard
3. The scheduler will automatically start and process sales every 5 minutes
4. Use manual controls to test processing and monitor system health

### 🎯 PHASE 3 PLANNING: Twitter API Integration

Based on the Twitter API v2 documentation analysis:

**Required Credentials:**
1. **API Key** (Consumer Key)
2. **API Secret Key** (Consumer Secret) 
3. **OAuth 1.0a User Access Token**
4. **OAuth 1.0a User Access Token Secret**

**Authentication Method:**
- **OAuth 1.0a User Context** (required for posting tweets)
- NOT Bearer Token (read-only access)

**Rate Limits to Respect:**
- **17 posts per 24-hour window** (user's current plan)
- Must track posting history in database
- Must prevent exceeding daily limit

**Implementation Strategy:**
1. **Manual Posting Only**: Admin clicks button to post individual tweets
2. **Tweet Preview**: Show formatted tweet before posting for approval
3. **Rate Limit Dashboard**: Show remaining posts for today (X/17)
4. **Posting History**: Track all posted tweets with timestamps
5. **Error Handling**: Graceful failure if rate limit exceeded or API errors

**Tweet Format Strategy:**
- NFT sale details (price, marketplace, token ID)
- Contract name/collection name
- Transaction hash link to Etherscan
- Emojis and engaging format
- Keep under 280 character limit

**Required Dependencies:**
- `oauth-1.0a` package for Twitter authentication
- `got` or `axios` for HTTP requests
- Tweet formatting utilities

**User-Provided Information:**
- **Bot Account**: @BotMarket66066
- **X Dev App ID**: 30234785
- **Next Step**: Deploy to Vercel for OAuth callback URL

**OAuth Setup Requirements:**
- **Website URL**: Will be `https://your-app.vercel.app`
- **Callback URI**: Will be `https://your-app.vercel.app/auth/twitter/callback`
- Need public deployment for Twitter OAuth authentication

## Lessons

*To be populated during development*
