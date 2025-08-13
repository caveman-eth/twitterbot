#!/usr/bin/env node

/**
 * Twitter OAuth 1.0a - Out of Band (OOB) flow
 * No callback URL required - you'll get a PIN code instead
 */

const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const https = require('https');
const readline = require('readline');

// Configuration
const config = {
  consumer_key: process.env.TWITTER_API_KEY,
  consumer_secret: process.env.TWITTER_API_SECRET,
  callback_url: 'oob' // Out of band - no callback needed
};

// Validate configuration
if (!config.consumer_key || !config.consumer_secret) {
  console.error('❌ Missing Twitter API credentials');
  process.exit(1);
}

// OAuth 1.0a setup
const oauth = OAuth({
  consumer: { key: config.consumer_key, secret: config.consumer_secret },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto
      .createHmac('sha1', key)
      .update(base_string)
      .digest('base64');
  },
});

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to make HTTP requests
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

// Parse query string
function parseQueryString(str) {
  const params = {};
  str.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value);
  });
  return params;
}

async function startOAuthFlow() {
  try {
    console.log('🚀 Starting Twitter OAuth 1.0a flow (OOB)...\n');
    
    // Step 1: Get request token
    console.log('📝 Step 1: Getting request token...');
    
    const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
    const requestData = {
      url: requestTokenUrl,
      method: 'POST',
      data: { oauth_callback: 'oob' }
    };
    
    const authHeader = oauth.toHeader(oauth.authorize(requestData));
    
    const requestTokenResponse = await makeRequest({
      hostname: 'api.twitter.com',
      path: '/oauth/request_token',
      method: 'POST',
      headers: {
        'Authorization': authHeader.Authorization,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }, 'oauth_callback=oob');
    
    const requestTokens = parseQueryString(requestTokenResponse);
    console.log('✅ Request token obtained');
    
    // Step 2: Get authorization from user
    console.log('\n🔐 Step 2: User authorization required');
    const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${requestTokens.oauth_token}`;
    
    console.log('\n📋 Please follow these steps:');
    console.log('1. Open this URL in your browser:');
    console.log(`\n   ${authUrl}\n`);
    console.log('2. Log in to Twitter and authorize the app');
    console.log('3. Twitter will show you a PIN code');
    console.log('4. Copy that PIN code and paste it below\n');
    
    const pin = await new Promise((resolve) => {
      rl.question('🔢 Enter the PIN code from Twitter: ', resolve);
    });
    
    console.log('✅ PIN code received');
    
    // Step 3: Get access token
    console.log('\n🎯 Step 3: Getting access token...');
    
    const accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
    const accessTokenData = {
      url: accessTokenUrl,
      method: 'POST',
      data: { 
        oauth_token: requestTokens.oauth_token,
        oauth_verifier: pin
      }
    };
    
    const accessAuthHeader = oauth.toHeader(oauth.authorize(accessTokenData, {
      key: requestTokens.oauth_token,
      secret: requestTokens.oauth_token_secret
    }));
    
    const accessTokenResponse = await makeRequest({
      hostname: 'api.twitter.com',
      path: '/oauth/access_token',
      method: 'POST',
      headers: {
        'Authorization': accessAuthHeader.Authorization,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }, `oauth_verifier=${pin}`);
    
    const accessTokens = parseQueryString(accessTokenResponse);
    
    console.log('✅ Access tokens obtained!\n');
    
    // Display results
    console.log('🎉 SUCCESS! Your Twitter API credentials:');
    console.log('=====================================');
    console.log(`TWITTER_API_KEY=${config.consumer_key}`);
    console.log(`TWITTER_API_SECRET=${config.consumer_secret}`);
    console.log(`TWITTER_ACCESS_TOKEN=${accessTokens.oauth_token}`);
    console.log(`TWITTER_ACCESS_TOKEN_SECRET=${accessTokens.oauth_token_secret}`);
    console.log('=====================================\n');
    
    // Test the credentials
    console.log('🧪 Testing credentials...');
    
    const testData = {
      url: 'https://api.twitter.com/1.1/account/verify_credentials.json',
      method: 'GET'
    };
    
    const testAuthHeader = oauth.toHeader(oauth.authorize(testData, {
      key: accessTokens.oauth_token,
      secret: accessTokens.oauth_token_secret
    }));
    
    try {
      const testResponse = await makeRequest({
        hostname: 'api.twitter.com',
        path: '/1.1/account/verify_credentials.json',
        method: 'GET',
        headers: {
          'Authorization': testAuthHeader.Authorization
        }
      });
      
      const userInfo = JSON.parse(testResponse);
      console.log(`✅ Credentials verified! Authenticated as: @${userInfo.screen_name}`);
      console.log(`   Account: ${userInfo.name}`);
      console.log(`   Followers: ${userInfo.followers_count.toLocaleString()}`);
      
    } catch (error) {
      console.log('⚠️  Credentials obtained but test failed:', error.message);
      console.log('   This might be normal - try using them in your app.');
    }
    
    console.log('\n📝 Copy these credentials to your VPS .env file!');
    
  } catch (error) {
    console.error('❌ OAuth flow failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Start the flow
startOAuthFlow();
