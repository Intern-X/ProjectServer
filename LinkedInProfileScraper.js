const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class LinkedInProfileScraper {
  constructor(options = {}) {
    this.options = {
      headless: false, // Changed to false for better debugging
      sessionCookieValue: process.env.LINKEDIN_SESSION_COOKIE,
      slowMo: 100, // Increased to reduce detection risk
      timeout: 30000, // Reduced from 30s to 10s for faster failure
      debug: true, // Enable debugging by default
      ...options
    };
    this.browser = null;
    this.context = null;
  }

  /**
   * Debug log function
   */
  debug(message) {
    if (this.options.debug) {
      console.log(`[DEBUG] ${message}`);
    }
  }

  /**
   * Take a screenshot for debugging
   */
  async takeScreenshot(page, name) {
    if (this.options.debug) {
      const dir = path.join(process.cwd(), 'debug');
      await fs.mkdir(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `${name}-${new Date().getTime()}.png`) });
      this.debug(`Screenshot saved: ${name}`);
    }
  }

  /**
   * Initialize the browser and create a new context
   */
  async setup() {
    console.log('Setting up browser...');
    
    // Add stealth plugins to reduce detection
    this.browser = await chromium.launch({ 
      headless: this.options.headless,
      slowMo: this.options.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-extensions',
        '--disable-web-security',
        '--no-zygote',
        // '--disable-gpu',
        '--hide-scrollbars'
      ]
    });
    
    // Create a new context with the session cookie
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      screen: { width: 1280, height: 800 },
      hasTouch: false,
      javaScriptEnabled: true,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Priority': 'u=1, i' // Instruct browsers to prioritize important resources
      }
    });
    
    // Set up extra headers to mimic a real browser
    await this.context.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });
    
    // Add LinkedIn session cookie
    if (this.options.sessionCookieValue) {
      await this.context.addCookies([{
        name: 'li_at',
        value: this.options.sessionCookieValue,
        domain: '.linkedin.com',
        path: '/'
      }]);
    }
    
    console.log('Browser setup complete');
  }

  /**
   * Check if the current session is logged in
   */
  async checkLogin(profileUrl) {
    console.log('Checking login status...');
    const page = await this.context.newPage();
    
    try {
      // Navigate to LinkedIn feed page
      await page.goto(profileUrl, { 
        waitUntil: 'networkidle',
        timeout: this.options.timeout
      });
      
      await this.takeScreenshot(page, 'login-check');
      
      // If we get redirected to login page, we're not logged in
      const currentUrl = page.url();
      const isLoggedIn = !currentUrl.includes('linkedin.com/login');
      
      if (!isLoggedIn) {
        console.error('Not logged in. Please provide a valid LinkedIn session cookie.');
        throw new Error('LinkedIn session is not valid');
      }
      
      console.log('Successfully logged in!');
    } finally {
      await page.close();
    }
  }

  /**
   * Scrape a LinkedIn profile
   * @param {string} profileUrl - The URL of the LinkedIn profile to scrape
   */
  async scrapeProfile(profileUrl) {
    if (!this.browser || !this.context) {
      throw new Error('Browser not initialized. Call setup() first.');
    }
    
    if (!profileUrl.includes('linkedin.com/in/')) {
      throw new Error('Invalid LinkedIn profile URL');
    }
    
    console.log(`Scraping profile: ${profileUrl}`);
    const page = await this.context.newPage();
    
    try {
      // Random wait before navigating
      await page.waitForTimeout(Math.floor(Math.random() * 1000) + 500);
      
      // Navigate to the profile page
      await page.goto(profileUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: this.options.timeout
      });
      
      // Wait a bit for dynamic content to load
      await page.waitForTimeout(2000);
      
      // Take screenshot for debugging
      await this.takeScreenshot(page, 'profile-initial');
      
      // Check if we're being challenged by LinkedIn
      if (await this.isBlocked(page)) {
        throw new Error('LinkedIn is blocking access. Try using a different account or adding delays.');
      }
      
      // Scroll to load all content
      await this.autoScroll(page);
      await this.takeScreenshot(page, 'after-scroll');
      
      // Skip expanding sections as it's causing errors
      // await this.expandSections(page);
      
      // Extract data from the profile
      const profileData = await this.extractProfileData(page);
      
      return profileData;
    } catch (error) {
      console.error(`Error scraping profile: ${error.message}`);
      await this.takeScreenshot(page, 'error-state');
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Check if LinkedIn is blocking us
   */
  async isBlocked(page) {
    const challengeText = await page.locator('text=suspicious activity').isVisible()
      .catch(() => false);
    
    const captchaVisible = await page.locator('[id*="captcha"]').isVisible()
      .catch(() => false);
    
    const verificationNeeded = await page.locator('text=Verify your identity').isVisible()
      .catch(() => false);
    
    return challengeText || captchaVisible || verificationNeeded;
  }

  /**
   * Auto-scroll to the bottom to load all content
   */
  async autoScroll(page) {
    console.log('Scrolling page to load all content...');
    
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 300;
        let scrolls = 0;
        const maxScrolls = 10; // Limit scrolling
        
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          scrolls++;
          
          // Add some randomness to scrolling
          distance = Math.floor(Math.random() * 100) + 250;
          
          // Stop after max scrolls or if we've reached the bottom
          if (scrolls >= maxScrolls || totalHeight >= document.body.scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, Math.floor(Math.random() * 200) + 300); // Random delay between scrolls
      });
    });
    
    // Wait a bit for any lazy-loaded content
    await page.waitForTimeout(1000);
    console.log('Page scrolling complete');
  }

  /**
   * Simplified section expansion that targets only important sections
   */
  async expandSections(page) {
    console.log('Expanding key profile sections...');
    
    // List of buttons to try clicking
    const buttonSelectors = [
      // About section
      'button:has-text("see more")',
      'button:has-text("Show more")',
      // Experience section
      '[data-control-name="see_more_experiences"]',
      // Skills section
      'button:has-text("Show all")'
    ];
    
    for (const selector of buttonSelectors) {
      try {
        const button = page.locator(selector).first();
        const isVisible = await button.isVisible().catch(() => false);
        
        if (isVisible) {
          this.debug(`Clicking button: ${selector}`);
          await button.click().catch(e => this.debug(`Click error: ${e.message}`));
          await page.waitForTimeout(500);
        }
      } catch (error) {
        this.debug(`Error with selector "${selector}": ${error.message}`);
      }
    }
  }

  /**
   * Extract profile data with improved error handling
   */
  async extractProfileData(page) {
    console.log('Extracting profile data...');
    
    try {
      // Extract basic profile information
      const basicInfo = await this.extractBasicInfo(page);
      await this.takeScreenshot(page, 'after-basic-info');
      
      // Extract about section
      const about = await this.extractAbout(page);
      
      // Extract experiences
      const experiences = await this.extractExperiences(page);
      
      // Extract education
      const education = await this.extractEducation(page);
      
      // Extract skills
      const skills = await this.extractSkills(page);
      
      return {
        ...basicInfo,
        about,
        experiences,
        education,
        skills,
        scrapedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error extracting profile data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract basic profile information with simplified locators
   */
  async extractBasicInfo(page) {
    console.log('Extracting basic profile information...');
    
    try {
      // More flexible locator for the name (using the actual profile page structure)
      const name = await this.safelyGetText(page, 'h1', 5000);
      
      // Simplified headline locator
      const headline = await this.safelyGetText(page, 'h1 ~ div');
      
      // More general location locator
      const locationText = await this.safelyGetText(page, 'span:has-text("Location")');
      
      // Flexible photo URL extraction
      const photoUrl = await page.locator('img[alt*="profile"], img[alt*="photo"]').first().getAttribute('src')
        .catch(() => null);
      
      return {
        name,
        headline,
        location: locationText,
        photoUrl,
        profileUrl: page.url()
      };
    } catch (error) {
      this.debug(`Error in extractBasicInfo: ${error.message}`);
      // Return partial data even if some parts fail
      return {
        name: null,
        headline: null,
        location: null,
        photoUrl: null,
        profileUrl: page.url()
      };
    }
  }

  /**
   * Safely get text with a fallback and timeout
   */
  async safelyGetText(page, selector, timeout = this.options.timeout) {
    try {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible().catch(() => false);
      
      if (isVisible) {
        return await element.textContent({ timeout })
          .then(text => text ? text.trim() : null);
      }
      return null;
    } catch (error) {
      this.debug(`Error getting text for selector "${selector}": ${error.message}`);
      return null;
    }
  }

  /**
   * Extract about section with simplified approach
   */
  async extractAbout(page) {
    console.log('Extracting about section...');
    
    try {
      // Look for the about section with multiple strategies
      const about = await this.safelyGetText(page, 'section h2:has-text("About") ~ div')
        || await this.safelyGetText(page, 'div[id*="about"] div[class*="show-more"]')
        || await this.safelyGetText(page, 'div:has-text("About") + div');
      
      return about;
    } catch (error) {
      this.debug(`Error in extractAbout: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract experiences with minimal selectors
   */
  async extractExperiences(page) {
    console.log('Extracting work experiences...');
    
    try {
      // First, check if experience section exists
      const experienceHeader = await page.locator('section h2:has-text("Experience")').first().isVisible()
        .catch(() => false);
      
      if (!experienceHeader) {
        this.debug('Experience section not found');
        return [];
      }
      
      // Get experience items - simplified approach
      const experienceItems = [];
      
      // Count li elements under the experience section
      const experienceSectionLocator = page.locator('section:has(h2:has-text("Experience"))');
      const experienceItemsCount = await experienceSectionLocator.locator('li').count()
        .catch(() => 0);
      
      this.debug(`Found ${experienceItemsCount} experience items`);
      
      // Process only the first few experiences to avoid timeout
      const itemsToProcess = Math.min(experienceItemsCount, 5);
      
      for (let i = 0; i < itemsToProcess; i++) {
        try {
          const itemLocator = experienceSectionLocator.locator('li').nth(i);
          
          // Extract title and company text
          const roleText = await itemLocator.textContent()
            .catch(() => '')
            .then(text => text ? text.trim() : '');
          
          // Simple parsing of the text to extract components
          const parts = roleText.split('\n').map(p => p.trim()).filter(p => p);
          
          experienceItems.push({
            title: parts[0] || null,
            company: parts[1] || null,
            duration: parts.find(p => /\d{4}/.test(p)) || null,
            location: parts.find(p => /location|remote/i.test(p)) || null,
            description: parts.length > 4 ? parts.slice(4).join(' ') : null
          });
        } catch (e) {
          this.debug(`Error parsing experience item ${i}: ${e.message}`);
        }
      }
      
      return experienceItems;
    } catch (error) {
      this.debug(`Error in extractExperiences: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract education with simplified approach
   */
  async extractEducation(page) {
    console.log('Extracting education...');
    
    try {
      // Check if education section exists
      const educationHeader = await page.locator('section h2:has-text("Education")').first().isVisible()
        .catch(() => false);
      
      if (!educationHeader) {
        this.debug('Education section not found');
        return [];
      }
      
      // Get education items - simplified approach
      const educationList = [];
      
      // Find the education section
      const educationSectionLocator = page.locator('section:has(h2:has-text("Education"))');
      const educationItemsCount = await educationSectionLocator.locator('li').count()
        .catch(() => 0);
      
      this.debug(`Found ${educationItemsCount} education items`);
      
      // Process only the first few education items
      const itemsToProcess = Math.min(educationItemsCount, 3);
      
      for (let i = 0; i < itemsToProcess; i++) {
        try {
          const itemLocator = educationSectionLocator.locator('li').nth(i);
          
          // Extract education text
          const eduText = await itemLocator.textContent()
            .catch(() => '')
            .then(text => text ? text.trim() : '');
          
          // Simple parsing of the text
          const parts = eduText.split('\n').map(p => p.trim()).filter(p => p);
          
          educationList.push({
            school: parts[0] || null,
            degree: parts[1] || null,
            years: parts.find(p => /\d{4}/.test(p)) || null,
            fieldOfStudy: parts.find(p => /field of study|major/i.test(p)) || null
          });
        } catch (e) {
          this.debug(`Error parsing education item ${i}: ${e.message}`);
        }
      }
      
      return educationList;
    } catch (error) {
      this.debug(`Error in extractEducation: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract skills with minimal approach
   */
  async extractSkills(page) {
    console.log('Extracting skills...');
    
    try {
      // Check if skills section exists
      const skillsHeader = await page.locator('section h2:has-text("Skills")').first().isVisible()
        .catch(() => false);
      
      if (!skillsHeader) {
        this.debug('Skills section not found');
        return [];
      }
      
      // Extract all visible skills text
      const skillsSection = page.locator('section:has(h2:has-text("Skills"))');
      const skillsText = await skillsSection.textContent()
        .catch(() => '')
        .then(text => text ? text.trim() : '');
      
      // Simple text processing to extract skills
      const lines = skillsText.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.includes('Skills') && !line.includes('Show all'));
      
      // Clean up and deduplicate
      const uniqueSkills = [...new Set(lines)];
      
      return uniqueSkills.slice(0, 10); // Return just the first few skills
    } catch (error) {
      this.debug(`Error in extractSkills: ${error.message}`);
      return [];
    }
  }

  /**
   * Save profile data to a JSON file
   */
  async saveProfileData(profileData, outputPath) {
    console.log(`Saving profile data to ${outputPath}...`);
    
    // Create directory if it doesn't exist
    const directory = path.dirname(outputPath);
    await fs.mkdir(directory, { recursive: true });
    
    // Write the profile data to a JSON file
    await fs.writeFile(outputPath, JSON.stringify(profileData, null, 2));
    
    console.log(`Profile data saved to ${outputPath}`);
  }

  /**
   * Close the browser
   */
  async close() {
    console.log('Closing browser...');
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
    }
    
    console.log('Browser closed');
  }
}

module.exports = LinkedInProfileScraper;