const express = require('express');
const { LinkedInProfileScraper } = require('linkedin-profile-scraper');

const app = express();
const PORT = process.env.PORT || 8000
// Required for side-effects

const admin = require('firebase-admin');
const credientials = require("./key.json");
const cors = require("cors");
const bodyParser = require("body-parser");
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors());
const axios = require('axios');
const { getLinkedinPage } = require('./linkedin-profile-parser');
require('dotenv').config();
puppeteer = require('puppeteer-core');

// TODO: Replace the following with your app's Firebase project configuration
// See: https://support.google.com/firebase/answer/7015592
const firebaseConfig = {
  
};

// Initialize Firebase
const appF = admin.initializeApp({
  credential: admin.credential.cert(credientials),
});


// Initialize Cloud Firestore and get a reference to the service
const db = admin.firestore(); 
db.settings({ ignoreUndefinedProperties: true })

app.get('/', (req, res) => {
  res.send('Successful response.');
});

app.get('/student', (req, res) => {
  try {
    const id = req.query.id;
    db.collection('students').doc(id).get().then((doc) => {
      if (doc.exists) {
        const userRef = doc.data();
        res.send({
          "status": 200,
          "data": doc.data()
        });
      } else {
        console.log("No such document!");
        res.send({
          "status": 404
        })
      }
    }).catch((error) => {
      console.log("Error getting document:", error);
    });
  }
  catch (e) {
    console.error("Error retrieving student: ", e);
  }
});

app.post('/student', async (req, res) => {
  try {
    // console.log(req);
    const userInfo = {
      name: req.body.name,
      email: req.body.email,
      major: req.body.major,
      linkedin: req.body.linkedin,
      gpa: req.body.gpa,
      school: req.body.school,
      projects: req.body.projects == undefined ? [] : req.body.projects,
      tags: req.body.tags == undefined ? [] : req.body.tags,
      appliedProjects: req.body.appliedProjects == undefined? [] : req.body.appliedProjects,
    };
    const id = req.query.id;
    console.log(id);
    if (id != undefined) {
      const userRef = db.collection('students').doc(id).set(userInfo);
    }
    else {
      const userRef = db.collection('students').add(userInfo);
    }

    res.send({
      "status": "success"
    })
  } catch (e) {
    console.error("Error adding document: ", e);
  }
});

app.get('/project', (req, res) => {
  try {
    const id = req.query.id;
    db.collection('projects').doc(id).get().then((doc) => {
      if (doc.exists) {
        const userRef = doc.data();
        res.send({
          "status": 200,
          "data": doc.data()
        });
      } else {
        console.log("No such document!");
        res.send({
          "status": 404
        })
      }
    }).catch((error) => {
      console.log("Error getting document:", error);
    });
  }
  catch (e) {
    console.error("Error retrieving project: ", e);
  }
});

app.post('/project', async (req, res) => {
  try {
    let id = req.query.id;

    const projInfo = {
      applications: req.body.applications == undefined ? [] : req.body.applications,
      assignee: req.body.assignee,
      company: req.body.company,
      compensation: req.body.compensation,
      description: req.body.description,
      title: req.body.title,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      status: req.body.status,
      tags: req.body.tags == undefined ? [] : req.body.tags,
    };

    if (id === undefined) {
      const addRes = await db.collection('projects').add(projInfo);
      id = addRes.id;
    }
    else {
      const userRef = db.collection('projects').doc(id).set(projInfo);
    }
    db.collection('companies').doc(req.body.company).update({projects: admin.firestore.FieldValue.arrayUnion(id)});

    res.send({
      "status": "success"
    })
  } catch (e) {
    console.error("Error adding document: ", e);
  }
});

app.get('/company', (req, res) => {
  try {
    const id = req.query.id;
    db.collection('companies').doc(id).get().then((doc) => {
      if (doc.exists) {
        const userRef = doc.data();
        res.send({
          "status": 200,
          "data": doc.data()
        });
      } else {
        console.log("No such document!");
        // check if its in students --> 404
        // db.collection('students').doc(id).get().then((doc) => {
        //   if (doc.exists) {
        //     res.send({
        //       "status": 404
        //     })
        //   }
        //   else {
        //     res.send({
        //       "status": 405
        //     });
        res.send({
          "status": 404,
        });
      }
    });
  } catch (e) {
    console.error("Error retrieving company: ", e);
  }
});

app.post('/company', async (req, res) => {
  try {
    const id = req.query.id;
    const companyInfo = {
      name: req.body.name,
      description: req.body.description,
      projects: req.body.projects == undefined ? [] : req.body.projects,
      tags: req.body.tags == undefined ? [] : req.body.tags,
      imageLink: req.body.imageLink,
      type: req.body.type,
      access: req.body.access,
      website: req.body.website
    };

    if (id != undefined) {
      const userRef = db.collection('companies').doc(id).set(companyInfo);
    }
    else {
      const userRef = db.collection('companies').add(companyInfo);
    }

    res.send({
      "status": "success"
    })
  } catch (e) {
    console.error("Error adding document: ", e);
  }
});

app.post('/application', async (req, res) => {
  const studentId = req.body.studentId;
  const projId = req.body.projectId;
  const projRef = db.collection('projects').doc(projId);
  const studRef = db.collection('students').doc(studentId);
  projRef.get().then((doc) => {
    if (doc.exists) {
      const projData = doc.data();
      if (!projData.applications.includes(studentId)) {
        projRef.update({ applications: admin.firestore.FieldValue.arrayUnion(studentId) });
        studRef.update({ appliedProjects: admin.firestore.FieldValue.arrayUnion(projId) })
        res.send({
          "status": 200
        })
      }
      else {
        console.log("Student has already applied");
        res.send({
          "status": 400
        })
      }

    } else {
      console.log("No such document!");
      res.send({
        "status": 404
      })
    }
  }).catch((error) => {
    console.log("Error getting document:", error);
  });
});

app.get('/relevantProjects', async (req, res) => {
   const tags = JSON.parse(req.query.tags);
   const queryRef = db.collection("projects").where('tags', 'array-contains-any', tags);
   const data = await queryRef.get();
   let results = [];
   data.forEach(doc => {
    const clone = Object.assign({}, doc.data());
    clone.id = doc.id;
    results.push(clone);
   })
   //inefficient
   results.sort((a, b) => {
    const aMatches = a.tags.filter(val => tags.includes(val)).length;
    const bMatches = b.tags.filter(val => tags.includes(val)).length;
    return bMatches - aMatches;
   })
   res.send({
    "status": 200,
    "data": results
  });
});

app.get('/relevantStudents', async (req, res) => {
  const tags = JSON.parse(req.query.tags);
  const queryRef = db.collection("students").where('tags', 'array-contains-any', tags);
  const data = await queryRef.get();
  const results = [];
  data.forEach(doc => {
    const clone = Object.assign({}, doc.data());
    clone.id = doc.id;
    results.push(clone);
  })
  results.sort((a, b) => {
    const aMatches = a.tags.filter(val => tags.includes(val)).length;
    const bMatches = b.tags.filter(val => tags.includes(val)).length;
    return bMatches - aMatches;
   })
  res.send({
    "status": 200,
    "data": results
  });
});

app.get('/relevantCompanies', async (req, res) => {
  const tags = JSON.parse(req.query.tags);
  const queryRef = db.collection("companies").where('tags', 'array-contains-any', tags);
  const data = await queryRef.get();
  const results = [];
  data.forEach(doc => {
    const clone = Object.assign({}, doc.data());
    clone.id = doc.id;
    results.push(clone);
  })
  results.sort((a, b) => {
    const aMatches = a.tags.filter(val => tags.includes(val)).length;
    const bMatches = b.tags.filter(val => tags.includes(val)).length;
    return bMatches - aMatches;
   })
  res.send({
   "status": 200,
   "data": results
   });
});

app.get('/allProjects', async (req, res) => {
  const data = await db.collection("projects").get();
  const results = [];
  data.forEach((doc) => {
    const clone = Object.assign({}, doc.data());
    clone.id = doc.id;
    results.push(clone);
  });
  res.send({
    "status": 200,
    "data": results
    });
});

app.get('/allStudents', async (req, res) => {
  const data = await db.collection("students").get();
  const results = [];
  data.forEach((doc) => {
    const clone = Object.assign({}, doc.data());
    clone.id = doc.id;
    results.push(clone);
  });
  res.send({
    "status": 200,
    "data": results
    });
});

app.get('/allCompanies', async (req, res) => {
  const data = await db.collection("companies").get();
  const results = [];
  data.forEach((doc) => {
    const clone = Object.assign({}, doc.data());
    clone.id = doc.id;
    results.push(clone);
  });
  res.send({
    "status": 200,
    "data": results
  });
});

app.post('/assignProject', async (req, res) => {
  const studentId = req.body.studentId;
  const studentRef = db.collection('students').doc(studentId);
  const projId = req.body.projectId;
  const projRef = db.collection('projects').doc(projId);
  projRef.get().then((doc) => {
    if (doc.exists) {
      const projData = doc.data();
      if (!projData.applications.includes(studentId)) {
        console.log("No such applicant!");
        res.send({
          "status": 404
        })
      }
      else {
        projRef.update({ assignee: studentId, status: 2 });
        studentRef.update({projects: admin.firestore.FieldValue.arrayUnion(projId), 
                  appliedProjects: admin.firestore.FieldValue.arrayRemove(projId)})
      }

      res.send({
        "status": 200
      })

    } else {
      console.log("No such document!");
      res.send({
        "status": 404
      })
    }
  }).catch((error) => {
    console.log("Error getting document:", error);
  });
});

// --- LinkedIn Scraper Functions ---

async function findLinkedInUrlByName(name) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  console.log(apiKey);
  console.log(cx);

  if (!apiKey || !cx) {
    console.error("Google Search API Key or CX ID is missing in environment variables.");
    return null;
  }

  // More specific query targeting LinkedIn profiles
  const query = `${name} site:linkedin.com/in/`;
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;

  try {
    const response = await axios.get(url);
    if (response.data && response.data.items && response.data.items.length > 0) {
      // Basic check to see if the first result looks like a profile URL
      const firstLink = response.data.items[0].link;
      if (firstLink && firstLink.includes('linkedin.com/in/')) {
        console.log(`Found potential LinkedIn URL for ${name}: ${firstLink}`);
        return firstLink;
      }
    }
    console.log(`Could not find a likely LinkedIn URL for ${name} via Google Search.`);
    return null;
  } catch (error) {
    console.error(`Error searching Google for LinkedIn profile of ${name}:`, error.response?.data || error.message);
    return null;
  }
}

async function scrapeLinkedInProfile(profileUrl) {


  let data = getLinkedinPage(profileUrl);

  console.log(data);


  return null;
  const sessionCookieValue = process.env.LINKEDIN_SESSION_COOKIE;
  
  let scraper;

  // console.log(LINKEDIN_SESSION_COOKIE)
  
  if (!sessionCookieValue) {
    console.error("LINKEDIN_SESSION_COOKIE is not set in environment variables.");
    return null;
  }

  try {
    console.log(`Initializing LinkedIn Profile Scraper for URL: ${profileUrl}`);
    

    (async () => {
      console.log('Launching Chromium from /usr/local/bin/chromium');
      const browser = await puppeteer.launch({
        executablePath: '/usr/local/bin/chromium',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      console.log('Browser launched successfully');
      
      scraper = new LinkedInProfileScraper({
        sessionCookieValue: sessionCookieValue,
        executablePath: '/usr/local/bin/chromium',
        puppeteerOptions: {
          headless: true,
          executablePath: '/usr/local/bin/chromium',
        },
        keepAlive: false // Set to true for faster recurring scrapes, but higher memory usage
      });
  
      // Prepare the scraper
      await scraper.setup();

      console.log(`Running scraper for LinkedIn profile: ${profileUrl}`);
      const result = await scraper.run(profileUrl);
    
    if (result) {
      console.log(`Successfully scraped LinkedIn profile: ${profileUrl}`);
      return result;
    } else {
      console.warn(`Scraper returned no data for ${profileUrl}`);
      return null;
    }
    })();

    

  } catch (error) {
    console.error(`Error initializing LinkedIn Profile Scraper for URL: ${profileUrl}`, error);
    return null;
  }

    
    
    
}

// --- LinkedIn Scraper Endpoints ---

// Scrape Profile w/ URL
app.get('/linkedin/profile/url', async (req, res) => {
  const profileUrl = req.query.url;
  if (!profileUrl) {
    return res.status(400).json({ status: 400, error: 'Missing profile URL parameter' });
  }

  try {
    let scrapedData = await scrapeLinkedInProfile(profileUrl);
    if (scrapedData) {
      res.status(200).json({ status: 200, data: scrapedData });
    } else {
      res.status(404).json({ status: 404, error: 'Could not scrape profile data' });
    }
  } catch (error) {
    console.error('Error in /linkedin/profile/url endpoint:', error);
    res.status(500).json({ status: 500, error: 'Internal server error during scraping' });
  }
});

// Find LinkedIn URL by Name
app.get('/linkedin/profile/name', async (req, res) => {
  const name = req.query.name;
  if (!name) {
    return res.status(400).json({ status: 400, error: 'Missing name parameter' });
  }

  try {
    const linkedInUrl = await findLinkedInUrlByName(name);
    if (linkedInUrl) {
      const profileUrl = linkedInUrl;
      if (!profileUrl) {
        return res.status(400).json({ status: 400, error: 'Missing profile URL parameter' });
      }

      try {
        const scrapedData = await scrapeLinkedInProfile(profileUrl);
        if (scrapedData) {
          res.status(200).json({ status: 200, data: scrapedData });
        } else {
          res.status(404).json({ status: 404, error: 'Could not scrape profile data' });
        }
      } catch (error) {
        console.error('Error in /linkedin/profile/url endpoint:', error);
        res.status(500).json({ status: 500, error: 'Internal server error during scraping' });
      }

    } else {
      res.status(404).json({ status: 404, error: 'Could not find LinkedIn URL for the given name' });
    }
  } catch (error) {
    console.error('Error in /linkedin/profile/name endpoint:', error);
    res.status(500).json({ status: 500, error: 'Internal server error during search' });
  }
});


app.get("/recruiters", async (req, res) => {
  try {
    const { domain } = req.query;
    
    if (!domain) {
      return res.status(400).json({ 
        success: false, 
        error: "Domain parameter is required" 
      });
    }
    
    const API_KEY = process.env.HUNTER_API_KEY; 
    
    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        error: "API key not configured"
      });
    }
    
    const response = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&department=hr&api_key=${API_KEY}`);
    
    if (!response.ok) {
      throw new Error(`Hunter API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    let formattedData = {
      success: true,
      domain: data.data.domain,
      organization: data.data.organization,
      emails: data.data.emails.map(email => ({
        email: email.value,
        firstName: email.first_name,
        lastName: email.last_name,
        position: email.position,
        department: email.department,
        confidence: email.confidence,
        verification: email.verification ? email.verification.status : null
      }))
    };

    for (let i = 0; i < formattedData.emails.length; i++) {
      let name = formattedData.emails[i].firstName;
      if (name == null) {
        formattedData.emails.splice(i, 1);
        i--;
      }
    }
    
    
    res.json(formattedData);
  }
  catch (e) {
    console.error("Error retrieving recruiter: ", e);
    res.status(500).json({
      success: false,
      error: e.message || "Failed to retrieve data from Hunter.io"
    });
  }
});

app.listen(PORT || 8000, () => console.log('Example app is listening on port 8000.'));
