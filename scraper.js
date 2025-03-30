require('dotenv').config();
const LinkedInProfileScraper = require('./LinkedInProfileScraper');
const path = require('path');
const fs = require('fs');

// Create profiles directory if it doesn't exist
const ensureProfilesDirectory = () => {
  const profilesDir = path.join(__dirname, 'profiles');
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }
  return profilesDir;
};

// Improved function to scrape a LinkedIn profile
async function scrapeLinkedInProfile(profileUrl) {
  if (!profileUrl || !profileUrl.includes('linkedin.com/in/')) {
    throw new Error('Invalid LinkedIn profile URL');
  }

  // Create a new scraper instance with custom options
  const scraper = new LinkedInProfileScraper({
    headless: true,      // Run in headless mode for production
    slowMo: 200,         // Slow down actions to reduce detection
    timeout: 60000,      // Longer timeout for reliability
    debug: false         // Disable debug for production
  });
  
  try {
    // Setup the browser
    console.log("Setting up browser...");
    await scraper.setup();
    
    // Check if we're logged in
    console.log("Checking login status...");
    await scraper.checkLogin(profileUrl);
    
    // Scrape the profile
    console.log(`Scraping profile: ${profileUrl}`);
    const profileData = await scraper.scrapeProfile(profileUrl);
    
    if (!profileData) {
      throw new Error('Failed to retrieve profile data');
    }
    
    // Create a filename based on the LinkedIn username
    const username = profileUrl.split('/in/')[1].replace(/\/$/, '').split('?')[0];
    const profilesDir = ensureProfilesDirectory();
    const outputPath = path.join(profilesDir, `${username}.json`);
    
    // Save the data to a file
    await scraper.saveProfileData(profileData, outputPath);
    
    console.log(`Successfully scraped profile data for ${profileData.name || username}`);
    
    return {
      success: true,
      data: profileData,
      savedTo: outputPath
    };
  } catch (error) {
    console.error(`Error during scraping: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Always close the browser to free resources
    try {
      await scraper.close();
    } catch (e) {
      console.error('Error closing browser:', e);
    }
  }
}

module.exports = { scrapeLinkedInProfile };