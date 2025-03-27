const puppeteer = require('puppeteer-core');
const TurndownService = require('turndown'); 
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const csv = require('csv-parser');

// Bright Data Scraping Browser auth
// should look like 'brd-customer-<ACCOUNT ID>-zone-<ZONE NAME>:<PASSWORD>'
const AUTH = "your-auth-string-here";

const SBR_WS_ENDPOINT = `wss://${AUTH}@brd.superproxy.io:9222`;

// initialize database
const db = new sqlite3.Database('archive.db');

// ensure snapshots table exists
db.run(`CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE,
    timestamp TEXT,
    markdown TEXT,
    html_path TEXT
)`);

const turndownService = new TurndownService(); // turndown service - converts HTML to Markdown

function sanitizeFilename(url) {
    return url.replace(/https?:\/\//, '').replace(/\W/g, '_') + `_${Date.now()}.html`;
}

// stores page snapshot in HTML (filesystem) and Markdown (database)
async function storeSnapshot(url, markdown, html) {
    const timestamp = new Date().toISOString();
    const snapshotsDir = path.join(__dirname, 'snapshots');

    if (!fs.existsSync(snapshotsDir)) {
        fs.mkdirSync(snapshotsDir, { recursive: true });
    }

    const htmlFilename = path.join(snapshotsDir, sanitizeFilename(url));
    fs.writeFileSync(htmlFilename, html, 'utf8');

    db.run(
        `INSERT OR REPLACE INTO snapshots (url, timestamp, markdown, html_path) VALUES (?, ?, ?, ?)`,
        [url, timestamp, markdown, htmlFilename],
        (err) => {
            if (err) console.error('Error inserting snapshot:', err.message);
            else console.log(`✅ Snapshot stored: ${url}`);
        }
    );
}

// scrapes a single given URL
async function scrapePage(url) {
    console.log(`🚀 Connecting to Bright Data Scraping Browser...`);
    let browser = null;
    let page = null;

    try {
        browser = await puppeteer.connect({ browserWSEndpoint: SBR_WS_ENDPOINT });
        console.log(`Navigating to ${url}...`);
        page = await browser.newPage();
        
        // ensure page is fully loaded
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        
        try {
            await page.waitForSelector('.marvel_database_section', { timeout: 30000 });
        } catch (selectorErr) {
            console.warn(`⚠️ Marvel database section not found on page. Will try to scrape anyway.`);
        }

        console.log('Scraping page content...');
        const html = await page.content();
        const markdown = turndownService.turndown(html);

        await storeSnapshot(url, markdown, html);

    } catch (err) {
        console.error(`❌ Error scraping ${url}: ${err.message}`);
        if (err.stack) {
            console.debug(err.stack.split('\n').slice(0, 3).join('\n'));
        }
    } finally {
        if (page) {
            try {
                await page.close();
                console.log(`Page closed successfully`);
            } catch (closeErr) {
                console.error(`Error closing page: ${closeErr.message}`);
            }
        }
        if (browser) {
            try {
                await browser.close();
                console.log(`Browser closed successfully`);
            } catch (closeErr) {
                console.error(`Error closing browser: ${closeErr.message}`);
            }
        }
    }
}

// automated scraping function
async function scrapeAndArchive(urls) {
    console.log(`📋 Starting batch scraping of ${urls.length} URLs...`);
    
    // connect to browser once for the entire batch
    console.log(`🚀 Connecting to Bright Data Scraping Browser...`);
    let browser = null;
    
    try {
        browser = await puppeteer.connect({ browserWSEndpoint: SBR_WS_ENDPOINT });
        
        for (const url of urls) {
            console.log(`\n⏳ Processing: ${url}`);
            let page = null;
            
            try {
                console.log(`Navigating to ${url}...`);
                page = await browser.newPage();
                
                // ensure page is fully loaded
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
                
                try {
                    await page.waitForSelector('.marvel_database_section', { timeout: 30000 });
                } catch (selectorErr) {
                    console.warn(`⚠️ Required section not found. Archiving the page anyway.`);
                }

                console.log('Scraping page content...');
                const html = await page.content();
                const markdown = turndownService.turndown(html);

                await storeSnapshot(url, markdown, html);
            } catch (err) {
                console.error(`❌ Error scraping ${url}: ${err.message}`);
                if (err.stack) {
                    console.debug(err.stack.split('\n').slice(0, 3).join('\n'));
                }
            } finally {
                if (page) {
                    try {
                        await page.close();
                        console.log(`Page closed successfully`);
                    } catch (closeErr) {
                        console.error(`Error closing page: ${closeErr.message}`);
                    }
                }
            }
            
            // add a small delay between requests to avoid overloading the service
            console.log(`Waiting 2 seconds before next URL...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } catch (browserErr) {
        console.error(`❌ Browser error: ${browserErr.message}`);
    } finally {
        if (browser) {
            try {
                await browser.close();
                console.log(`Browser closed successfully`);
            } catch (closeErr) {
                console.error(`Error closing browser: ${closeErr.message}`);
            }
        }
    }
    
    console.log('✅ Batch scraping completed!');
}

// check if target_urls.csv exists, and use it by default if it does
const csvPath = path.join(__dirname, 'target_urlsv.csv');

if (fs.existsSync(csvPath)) {
    console.log('📄 Found target_urls.csv - processing URLs from CSV file');
    // Read URLs from CSV file
    const urls = [];
    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
            if (row.url) urls.push(row.url);
        })
        .on('end', () => {
            if (urls.length > 0) {
                console.log(`Found ${urls.length} URLs in CSV file`);
                scrapeAndArchive(urls);
            } else {
                console.error('No URLs found in the CSV file or invalid format');
            }
        })
        .on('error', (error) => {
            console.error('Error reading CSV file:', error.message);
        });
} else {
    // error out if no csv file is found
    console.error('Error: target_urls.csv not found');
}
