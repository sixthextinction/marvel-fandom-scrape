# Marvel Fandom Wiki Scraper

A (Node.js-based) web scraping tool designed to archive Fandom wiki pages. This tool captures both HTML and Markdown versions of pages, storing them locally and in a SQLite database for future AI training (or whatever, really).

## Features

- Automated scraping of Fandom wiki pages (using the Marvel Wiki for my example)
- Stores both HTML and Markdown versions of pages
- Uses Bright Data's Scraping Browser for reliable web scraping
- SQLite database for storing page metadata and content
- CSV-based URL input for batch processing
- Automatic file system organization of snapshots
- Error handling and logging

## Prerequisites

- Node.js
- Bright Data Scraping Browser account and credentials
- `puppeteer-core`: For web scraping
- `sqlite3`: Database ops
- `turndown`: HTML to Markdown conversion
- `csv-parser`: CSV file processing

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/marvel-fandom-scrape.git
cd marvel-fandom-scrape
```

2. Install dependencies:
```bash
npm install
```

3. Configure your Bright Data credentials:
   - Open `index.js`
   - Replace `"your-auth-string-here"` with your Bright Data authentication string
   - The auth string should follow the format: `brd-customer-<ACCOUNT ID>-zone-<ZONE NAME>:<PASSWORD>`

## Usage

1. Create a `target_urls.csv` file in the project root with the following format:
```csv
url
https://marvel.fandom.com/wiki/Page1
https://marvel.fandom.com/wiki/Page2
```

2. Run the scraper:
```bash
node index.js
```

The script will:
- Read URLs from the CSV file
- Connect to Bright Data's Scraping Browser
- Visit each URL and capture the content
- Store HTML snapshots in the `snapshots` directory
- Each snapshot filename is sanitized from the URL and includes a timestamp
- Save page content and metadata to the SQLite database

## Database Schema

The SQLite database (`archive.db`) contains a `snapshots` table with the following structure:
- `id`: Auto-incrementing primary key
- `url`: Unique URL of the scraped page
- `timestamp`: When the page was scraped
- `markdown`: Markdown version of the page content
- `html_path`: Path to the stored HTML file
