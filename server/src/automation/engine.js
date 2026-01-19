import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.join(__dirname, '../../public/screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

export class AutomationEngine {
  constructor(io, storage) {
    this.io = io;
    this.storage = storage;
    this.activeBrowsers = new Map();
    this.cdpSessions = new Map();
  }

  // Start real-time screencast streaming (throttled to prevent memory issues)
  async startScreencast(executionId, page) {
    try {
      const cdpSession = await page.context().newCDPSession(page);
      
      await cdpSession.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 30, // Lower quality to reduce memory
        maxWidth: 1024,
        maxHeight: 576,
        everyNthFrame: 3 // Only every 3rd frame
      });

      let lastEmit = 0;
      const throttleMs = 200; // Max 5 frames per second

      cdpSession.on('Page.screencastFrame', async (event) => {
        const { data, sessionId } = event;
        
        const now = Date.now();
        if (now - lastEmit >= throttleMs) {
          lastEmit = now;
          // Emit frame to connected clients
          this.io.emit('screencast-frame', {
            executionId,
            frame: `data:image/jpeg;base64,${data}`,
            timestamp: now
          });
        }

        // Always acknowledge the frame
        try {
          await cdpSession.send('Page.screencastFrameAck', { sessionId });
        } catch (e) {}
      });

      this.cdpSessions.set(executionId, cdpSession);
      console.log(`Screencast started for: ${executionId}`);
      return cdpSession;
    } catch (error) {
      console.error('Screencast error:', error.message);
      return null;
    }
  }

  async stopScreencast(executionId) {
    const cdpSession = this.cdpSessions.get(executionId);
    if (cdpSession) {
      try {
        await cdpSession.send('Page.stopScreencast');
        await cdpSession.detach();
      } catch (e) {}
      this.cdpSessions.delete(executionId);
    }
  }

  async executeTestCase(executionId, testCase, aiInterpreter) {
    const startTime = Date.now();
    let browser = null;
    let status = 'running';
    const logs = [];
    const stepResults = []; // Store detailed step results with screenshots

    const emitProgress = (step, stepIndex, stepStatus, message, screenshotUrl = null) => {
      const progress = {
        executionId,
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        currentStep: stepIndex,
        totalSteps: testCase.steps.length,
        stepDescription: step,
        status: stepStatus,
        message,
        screenshotUrl,
        timestamp: new Date().toISOString()
      };
      logs.push(progress);
      console.log(`Step ${stepIndex}: ${stepStatus} - Screenshot: ${screenshotUrl || 'none'}`);
      this.io.emit('execution-progress', progress);
    };

    const saveScreenshot = async (page, stepNum) => {
      try {
        // Always get the latest active page (handles new tabs)
        const pages = page.context().pages();
        const activePage = pages[pages.length - 1];
        
        const filename = `${executionId}_step_${stepNum}.png`;
        const filepath = path.join(screenshotsDir, filename);
        await activePage.screenshot({ path: filepath });
        return `/screenshots/${filename}?t=${Date.now()}`;
      } catch (err) {
        console.error('Screenshot error:', err.message);
        return null;
      }
    };

    try {
      emitProgress('Initializing', 0, 'running', 'Starting browser automation...');
      
      // Run HEADLESS - screenshots will be shown in embedded view
      browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.activeBrowsers.set(executionId, browser);
      
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
      });
      const page = await context.newPage();

      // Start real-time screencast streaming
      await this.startScreencast(executionId, page);

      // Capture initial screenshot
      const initScreenshotUrl = await saveScreenshot(page, 0);
      emitProgress('Initializing', 0, 'completed', 'Browser started', initScreenshotUrl);
      stepResults.push({
        stepNumber: 0,
        stepDescription: 'Browser Initialization',
        status: 'completed',
        message: 'Browser started successfully',
        screenshotUrl: initScreenshotUrl,
        timestamp: new Date().toISOString()
      });

      for (let i = 0; i < testCase.steps.length; i++) {
        const step = testCase.steps[i];
        emitProgress(step, i + 1, 'running', `Executing: ${step}`);

        try {
          await this.executeStep(page, step, aiInterpreter);
          
          // Wait for page to fully settle after action
          await this.delay(1000);
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          await this.delay(500);
          
          // Capture screenshot after each successful step
          const screenshotUrl = await saveScreenshot(page, i + 1);
          console.log(`Emitting step ${i + 1}/${testCase.steps.length} completed with screenshot: ${screenshotUrl}`);
          emitProgress(step, i + 1, 'completed', `Completed: ${step}`, screenshotUrl);
          
          stepResults.push({
            stepNumber: i + 1,
            stepDescription: step,
            status: 'completed',
            message: `Step completed successfully`,
            screenshotUrl: screenshotUrl,
            timestamp: new Date().toISOString()
          });
          
          // Wait for UI to display the screenshot before next step
          await this.delay(1000);
        } catch (stepError) {
          const screenshotUrl = await saveScreenshot(page, i + 1);
          emitProgress(step, i + 1, 'failed', `Failed: ${stepError.message}`, screenshotUrl);
          
          stepResults.push({
            stepNumber: i + 1,
            stepDescription: step,
            status: 'failed',
            message: stepError.message,
            screenshotUrl: screenshotUrl,
            timestamp: new Date().toISOString()
          });
          
          throw stepError;
        }
      }

      status = 'passed';
      // Get the last step's screenshot URL to use for completion (don't take a new one)
      const lastStepScreenshot = stepResults[stepResults.length - 1]?.screenshotUrl;
      // Emit completion with the last step's screenshot so it stays visible
      emitProgress('Complete', testCase.steps.length, 'passed', 'Test case completed successfully!', lastStepScreenshot);
      
    } catch (error) {
      status = 'failed';
      emitProgress('Error', 0, 'failed', `Test failed: ${error.message}`);
    } finally {
      // Stop screencast before closing browser
      await this.stopScreencast(executionId);
      
      if (browser) {
        await browser.close();
        this.activeBrowsers.delete(executionId);
      }

      const executionResult = {
        executionId,
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        status,
        duration: Date.now() - startTime,
        logs,
        stepResults, // Detailed step results with screenshots
        completedAt: new Date().toISOString()
      };

      // Store in execution history
      if (this.storage) {
        this.storage.executionHistory.push(executionResult);
        // Keep only last 100 executions
        if (this.storage.executionHistory.length > 100) {
          this.storage.executionHistory = this.storage.executionHistory.slice(-100);
        }
      }

      // Emit final result
      this.io.emit('execution-complete', executionResult);
    }
  }

  async executeStep(page, stepDescription, aiInterpreter) {
    // Parse the step using AI or pattern matching
    const action = await this.parseStep(stepDescription, aiInterpreter);
    
    switch (action.type) {
      case 'open_browser':
        // Browser already opened
        break;
        
      case 'navigate':
        let url = action.url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        break;
        
      case 'click':
        await this.smartClick(page, action.target);
        break;
        
      case 'type':
        await this.smartType(page, action.target, action.value);
        break;
        
      case 'search':
        await this.performSearch(page, action.value);
        break;
        
      case 'select_product':
        await this.selectProduct(page, action.index);
        break;
        
      case 'add_to_cart':
        await this.addToCart(page);
        break;
        
      case 'wait':
        await this.delay(action.duration || 2000);
        break;
        
      case 'scroll':
        await page.evaluate(() => window.scrollBy(0, 500));
        break;
        
      case 'press_key':
        await page.keyboard.press(action.key);
        break;
        
      default:
        // Try AI interpretation for complex steps
        await this.executeAIInterpretedStep(page, stepDescription, aiInterpreter);
    }
  }

  async parseStep(stepDescription, aiInterpreter) {
    const step = stepDescription.toLowerCase();
    
    // Pattern matching for common actions
    if (step.includes('open browser') || step.includes('launch browser')) {
      return { type: 'open_browser' };
    }
    
    if (step.includes('navigate to') || step.includes('go to') || step.includes('open ')) {
      const urlMatch = step.match(/(?:navigate to|go to|open)\s+["']?([^"'\n]+)["']?/i);
      if (urlMatch) {
        return { type: 'navigate', url: urlMatch[1].trim() };
      }
    }
    
    if (step.includes('search for') || step.includes('search ')) {
      const searchMatch = step.match(/search\s+(?:for\s+)?(?:the\s+)?(?:product\s+)?(?:called\s+)?["']?([^"'\n]+)["']?/i);
      if (searchMatch) {
        return { type: 'search', value: searchMatch[1].trim() };
      }
    }
    
    if (step.includes('select') && step.includes('product')) {
      const indexMatch = step.match(/(\d+)(?:st|nd|rd|th)/i);
      const index = indexMatch ? parseInt(indexMatch[1]) : 1;
      return { type: 'select_product', index };
    }
    
    if (step.includes('add') && step.includes('cart')) {
      return { type: 'add_to_cart' };
    }
    
    if (step.includes('click')) {
      const targetMatch = step.match(/click\s+(?:on\s+)?["']?([^"'\n]+)["']?/i);
      if (targetMatch) {
        return { type: 'click', target: targetMatch[1].trim() };
      }
    }
    
    if (step.includes('type') || step.includes('enter')) {
      const typeMatch = step.match(/(?:type|enter)\s+["']?([^"'\n]+)["']?\s+(?:in|into)\s+["']?([^"'\n]+)["']?/i);
      if (typeMatch) {
        return { type: 'type', value: typeMatch[1].trim(), target: typeMatch[2].trim() };
      }
    }
    
    if (step.includes('wait')) {
      const durationMatch = step.match(/(\d+)\s*(?:seconds?|s)/i);
      const duration = durationMatch ? parseInt(durationMatch[1]) * 1000 : 2000;
      return { type: 'wait', duration };
    }
    
    if (step.includes('scroll')) {
      return { type: 'scroll' };
    }
    
    if (step.includes('press')) {
      const keyMatch = step.match(/press\s+["']?(\w+)["']?/i);
      if (keyMatch) {
        return { type: 'press_key', key: keyMatch[1] };
      }
    }
    
    // Generic click action - "click on X", "click the X button"
    if (step.includes('click')) {
      const clickMatch = step.match(/click\s+(?:on\s+)?(?:the\s+)?["']?([^"'\n]+)["']?/i);
      if (clickMatch) {
        return { type: 'click', target: clickMatch[1].trim() };
      }
    }
    
    // Generic type/enter action - "type X in Y", "enter X"
    if (step.includes('type') || step.includes('enter') || step.includes('fill')) {
      const typeMatch = step.match(/(?:type|enter|fill)\s+["']?([^"']+)["']?\s+(?:in|into|in the)\s+["']?([^"'\n]+)["']?/i);
      if (typeMatch) {
        return { type: 'type', value: typeMatch[1].trim(), target: typeMatch[2].trim() };
      }
      // Just value, no target specified
      const valueMatch = step.match(/(?:type|enter|fill)\s+["']?([^"'\n]+)["']?/i);
      if (valueMatch) {
        return { type: 'type', value: valueMatch[1].trim(), target: 'input' };
      }
    }
    
    // For any unrecognized step, pass to AI handler
    return { type: 'unknown', description: stepDescription };
  }

  async smartClick(page, target) {
    // Get the active page (handle new tabs)
    const pages = page.context().pages();
    const activePage = pages[pages.length - 1];
    
    // Try multiple selectors - ordered by specificity
    const selectors = [
      // Exact text match
      `text="${target}"`,
      `text="${target}" >> visible=true`,
      // Buttons and links with text
      `button:has-text("${target}")`,
      `a:has-text("${target}")`,
      `[role="button"]:has-text("${target}")`,
      // Partial text match
      `*:has-text("${target}")`,
      // Attributes
      `[aria-label="${target}"]`,
      `[aria-label*="${target}" i]`,
      `[title="${target}"]`,
      `[title*="${target}" i]`,
      `[placeholder="${target}"]`,
      `[placeholder*="${target}" i]`,
      `[name="${target}"]`,
      `[name*="${target}" i]`,
      `[id="${target}"]`,
      `[id*="${target}" i]`,
      `[class*="${target}" i]`,
      `[data-testid*="${target}" i]`,
      // Direct selector (if target is a CSS selector)
      target
    ];

    for (const selector of selectors) {
      try {
        const element = await activePage.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          await this.delay(500);
          return;
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error(`Could not find clickable element: ${target}`);
  }

  async smartType(page, target, value) {
    // Get the active page (handle new tabs)
    const pages = page.context().pages();
    const activePage = pages[pages.length - 1];
    
    const selectors = [
      // By placeholder
      `input[placeholder*="${target}" i]`,
      `textarea[placeholder*="${target}" i]`,
      // By name
      `input[name*="${target}" i]`,
      `textarea[name*="${target}" i]`,
      // By aria-label
      `input[aria-label*="${target}" i]`,
      `textarea[aria-label*="${target}" i]`,
      // By id
      `input[id*="${target}" i]`,
      `textarea[id*="${target}" i]`,
      // By label text
      `label:has-text("${target}") + input`,
      `label:has-text("${target}") ~ input`,
      // By type
      `input[type="text"]`,
      `input[type="search"]`,
      `input[type="email"]`,
      `input[type="password"]`,
      `input:not([type="hidden"]):not([type="submit"]):not([type="button"])`,
      `textarea`,
      `[contenteditable="true"]`,
      // Direct selector
      target
    ];

    for (const selector of selectors) {
      try {
        const element = await activePage.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          await element.fill('');
          await element.fill(value);
          await this.delay(300);
          return;
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error(`Could not find input field: ${target}`);
  }

  async performSearch(page, searchTerm) {
    // Get the active page (handle new tabs)
    const pages = page.context().pages();
    const activePage = pages[pages.length - 1];
    
    // Common search input selectors - expanded for more sites
    const searchSelectors = [
      'input[type="search"]',
      'input[name="q"]',
      'input[name="query"]',
      'input[name="search"]',
      'input[name="search_query"]',
      'input[name="keyword"]',
      'input[name="keywords"]',
      'input[placeholder*="search" i]',
      'input[placeholder*="find" i]',
      'input[placeholder*="what are you looking" i]',
      'input[aria-label*="search" i]',
      'input[class*="search" i]',
      'input[id*="search" i]',
      'input[id*="query" i]',
      '#search',
      '#searchInput',
      '#search-input',
      '#twotabsearchtextbox', // Amazon
      '.search-input',
      '.searchInput',
      '[data-testid*="search"]',
      'input[type="text"]' // Last resort
    ];

    for (const selector of searchSelectors) {
      try {
        const element = await activePage.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          await this.delay(300);
          await element.fill('');
          await element.fill(searchTerm);
          await this.delay(500);
          await activePage.keyboard.press('Enter');
          await this.delay(1000);
          await activePage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          await this.delay(1000);
          return;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Fallback: Try to find any visible input and type
    try {
      const inputs = await activePage.locator('input:visible').all();
      for (const input of inputs) {
        const type = await input.getAttribute('type');
        if (type === 'text' || type === 'search' || !type) {
          await input.click();
          await input.fill(searchTerm);
          await activePage.keyboard.press('Enter');
          await activePage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          return;
        }
      }
    } catch (e) {}
    
    throw new Error('Could not find search input');
  }

  async selectProduct(page, index) {
    await this.delay(2000); // Wait for products to load
    
    // Get the active page (handle new tabs)
    const pages = page.context().pages();
    const activePage = pages[pages.length - 1];
    
    // Common product selectors - expanded for more sites
    const productSelectors = [
      // Generic product cards
      '[data-component-type="s-search-result"]', // Amazon
      '.s-result-item[data-asin]', // Amazon
      '.product-card',
      '.product-item',
      '.product-tile',
      '.product-box',
      '[class*="ProductCard"]',
      '[class*="product-card"]',
      '[class*="productCard"]',
      // Flipkart
      '._1AtVbE',
      '.CGtC98',
      '[data-id]',
      // Generic
      '.item-card',
      '.search-result',
      '[class*="result-item"]',
      '[class*="search-result"]',
      '[data-testid*="product"]',
      '[data-testid*="item"]',
      // Fallback patterns
      'article',
      '.card',
      '[class*="product"]'
    ];

    for (const selector of productSelectors) {
      try {
        const products = await activePage.locator(selector).all();
        // Filter to only visible products
        const visibleProducts = [];
        for (const p of products) {
          if (await p.isVisible().catch(() => false)) {
            visibleProducts.push(p);
          }
          if (visibleProducts.length >= index) break;
        }
        
        if (visibleProducts.length >= index) {
          console.log(`Found ${visibleProducts.length} products with selector: ${selector}`);
          await visibleProducts[index - 1].click();
          await this.delay(1000);
          await activePage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          return;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Fallback: click on nth link that looks like a product
    try {
      const links = await activePage.locator('a[href*="product"], a[href*="item"], a[href*="/dp/"], a[href*="/p/"]').all();
      const visibleLinks = [];
      for (const link of links) {
        if (await link.isVisible().catch(() => false)) {
          visibleLinks.push(link);
        }
        if (visibleLinks.length >= index) break;
      }
      if (visibleLinks.length >= index) {
        await visibleLinks[index - 1].click();
        await activePage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        return;
      }
    } catch (e) {}
    
    // Last resort: click on any clickable card-like element
    try {
      const cards = await activePage.locator('div[onclick], a:has(img)').all();
      const visibleCards = [];
      for (const card of cards) {
        if (await card.isVisible().catch(() => false)) {
          visibleCards.push(card);
        }
        if (visibleCards.length >= index) break;
      }
      if (visibleCards.length >= index) {
        await visibleCards[index - 1].click();
        await activePage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        return;
      }
    } catch (e) {}
    
    throw new Error(`Could not select product at index ${index}`);
  }

  async addToCart(page) {
    await this.delay(1500);
    
    // Handle new tab if opened
    const context = page.context();
    let pages = context.pages();
    const currentPage = pages[pages.length - 1];
    
    const cartSelectors = [
      // Standard buttons
      'button:has-text("Add to Cart")',
      'button:has-text("ADD TO CART")',
      'button:has-text("Add to cart")',
      'button:has-text("Add to Bag")',
      'button:has-text("ADD TO BAG")',
      'button:has-text("Add to basket")',
      'button:has-text("ADD TO BASKET")',
      // Amazon
      '#add-to-cart-button',
      'input[name="submit.add-to-cart"]',
      '#buy-now-button',
      // Generic IDs and classes
      '[id*="add-to-cart"]',
      '[id*="addToCart"]',
      '[class*="add-to-cart"]',
      '[class*="addToCart"]',
      '[class*="add_to_cart"]',
      '.add-to-cart',
      '.addToCart',
      // Data attributes
      'button[data-testid*="cart"]',
      'button[data-action*="cart"]',
      '[data-button-action="add-to-cart"]',
      // Buy buttons
      'button:has-text("Buy Now")',
      'button:has-text("BUY NOW")',
      'button:has-text("Buy")',
      // Flipkart specific
      '.L0Z3Pu',
      '._2KpZ6l._2U9uOA._3v1-ww',
      'button._2KpZ6l',
      // Generic fallbacks
      'button[class*="add"]',
      'button[class*="cart"]',
      'input[type="submit"][value*="cart" i]',
      'input[type="submit"][value*="add" i]'
    ];

    for (const selector of cartSelectors) {
      try {
        const element = await currentPage.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          // Get page count before click
          const pageCountBefore = context.pages().length;
          
          await element.click();
          
          // Wait a bit for potential new tab
          await this.delay(2000);
          
          // Check if new tab opened
          pages = context.pages();
          if (pages.length > pageCountBefore) {
            // New tab opened - wait for it to load
            const newPage = pages[pages.length - 1];
            console.log('New tab detected, waiting for it to load...');
            await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
            await newPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
            await this.delay(2000);
          } else {
            // Same page - wait for update
            await currentPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
            await this.delay(1000);
          }
          return;
        }
      } catch (e) {
        continue;
      }
    }
    
    // If no button found, try scrolling and looking again
    await currentPage.evaluate(() => window.scrollTo(0, 0));
    await this.delay(500);
    
    for (const selector of cartSelectors) {
      try {
        const element = await currentPage.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          const pageCountBefore = context.pages().length;
          await element.click();
          await this.delay(2000);
          
          pages = context.pages();
          if (pages.length > pageCountBefore) {
            const newPage = pages[pages.length - 1];
            await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
            await newPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
            await this.delay(2000);
          } else {
            await currentPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
            await this.delay(1000);
          }
          return;
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error('Could not find Add to Cart button');
  }

  async executeAIInterpretedStep(page, stepDescription, aiInterpreter) {
    // Get the active page (handle new tabs)
    const pages = page.context().pages();
    const activePage = pages[pages.length - 1];
    
    console.log(`AI interpreting step: ${stepDescription}`);
    
    try {
      // Use AI to find the right element on the page
      const elementInfo = await aiInterpreter.findElementForAction(activePage, stepDescription);
      console.log(`AI found element:`, elementInfo);
      
      if (elementInfo.selector) {
        const step = stepDescription.toLowerCase();
        
        // Determine action type from step description
        if (step.includes('click') || step.includes('press') || step.includes('tap') || 
            step.includes('select') || step.includes('choose') || step.includes('open')) {
          await activePage.locator(elementInfo.selector).first().click({ timeout: 10000 });
          await this.delay(1000);
          await activePage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          
        } else if (step.includes('type') || step.includes('enter') || step.includes('input') || 
                   step.includes('fill') || step.includes('write')) {
          // Extract the value to type
          const valueMatch = step.match(/(?:type|enter|input|fill|write)\s+["']?([^"']+)["']?/i);
          const value = valueMatch ? valueMatch[1].trim() : '';
          
          if (value) {
            await activePage.locator(elementInfo.selector).first().fill(value);
            await this.delay(500);
          }
          
        } else if (step.includes('search')) {
          // Extract search term
          const searchMatch = step.match(/search\s+(?:for\s+)?["']?([^"']+)["']?/i);
          const searchTerm = searchMatch ? searchMatch[1].trim() : '';
          
          if (searchTerm) {
            await activePage.locator(elementInfo.selector).first().fill(searchTerm);
            await this.delay(300);
            await activePage.keyboard.press('Enter');
            await activePage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          }
          
        } else {
          // Default: try clicking
          await activePage.locator(elementInfo.selector).first().click({ timeout: 10000 });
          await this.delay(1000);
        }
        
        return;
      }
      
      // Fallback: try to interpret and execute recursively
      const interpretation = await aiInterpreter.interpretSingleStep(stepDescription);
      if (interpretation && interpretation.selector) {
        await activePage.locator(interpretation.selector).first().click({ timeout: 10000 });
        return;
      }
      
      throw new Error(`Could not find element for: ${stepDescription}`);
      
    } catch (error) {
      console.error(`AI step execution error:`, error.message);
      throw new Error(`Could not execute step: ${stepDescription} - ${error.message}`);
    }
  }

  // Generic action executor - works for any website
  async executeGenericAction(page, actionDescription) {
    const pages = page.context().pages();
    const activePage = pages[pages.length - 1];
    const action = actionDescription.toLowerCase();
    
    // Try to find and interact with elements based on text content
    const keywords = actionDescription.match(/["']([^"']+)["']/g)?.map(k => k.replace(/["']/g, '')) || [];
    
    for (const keyword of keywords) {
      try {
        // Try clicking element with matching text
        const element = await activePage.locator(`text="${keyword}"`).first();
        if (await element.isVisible({ timeout: 3000 })) {
          if (action.includes('click') || action.includes('select') || action.includes('choose')) {
            await element.click();
            return true;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    return false;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stopExecution(executionId) {
    const browser = this.activeBrowsers.get(executionId);
    if (browser) {
      await browser.close();
      this.activeBrowsers.delete(executionId);
    }
  }
}
