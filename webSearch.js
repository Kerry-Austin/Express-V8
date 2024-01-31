import axios from 'axios-https-proxy-fix';
import puppeteer from 'puppeteer-core';
//import fetch from "node-fetch"
import { promises as fs } from 'fs';
import * as cheerio from 'cheerio';
//import { HttpsProxyAgent } from 'https-proxy-agent';




// Search Configuration
const username = 'brd-customer-hl_79f94069-zone-serp';
const password = 'hcjk1d8kj4gd';
const port = 22225;
const session_id = (1000000 * Math.random()) | 0;
const options = {
	auth: {
		username: `${username}-session-${session_id}`,
		password: password
	},
	host: 'brd.superproxy.io',
	port: port,
	rejectUnauthorized: false
};

// Function to perform the web search
export async function searchGoogle(searchQuery) {

	async function getResults(searchString) {
		try {
			// Disabling TLS/SSL certificate validation (Use with caution)
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

			// brigthData's serpAPI
			const response = await axios.get('https://app.scrapingbee.com/api/v1/store/google', {
				params: {
					'api_key': 'RJBZ1SD9PGYGAT1T4TVM883X2LHXVVFIIWR4JDVSZN8EAEC9YRFVW62YKPOLA6U2KGL71D2XZH6SSCPQ',

					'search': `${searchString}`,
					'language': 'en',
					'nb_results': '20',
				}
			})
			const results = response.data.organic_results

			const linksAndInfo = results.map(result => {
				let topLevelResult = {
					"Page_Title": result.title,
					"Page_Description": result.description || "No description was given.",
					"Link": result.url,
					"Date": result.date
				};

				if (result.sitelinks?.expanded?.length > 0) {
					topLevelResult.Expanded_Links = result.sitelinks.expanded.map(link => ({
						"Page_Title": link.title,
						"Page_Description": link.snippet || "No snippet provided.",
						"Link": link.link,
						"Date": link.date
					}));
				}

				return topLevelResult;
			});


			return linksAndInfo
		}
		catch (error) {
			console.error("Google search failed.")
			console.error({ "ERROR INFO": error.response });
		}
	}

	const searchResults = await getResults(searchQuery)
	const topTen = searchResults?.slice(0, 10) || ["Google Search Failed."]
	console.log({ "Top 10 Search Results": JSON.stringify(topTen.map(result => result.Page_Title), null, 2) })
	return topTen
}
//await searchGoogle("weather")

export async function askWolfram(textString) {
	const appId = "WWR9JJ-YTEPR878Q7"
	try {
		const response = await axios.get(`http://api.wolframalpha.com/v1/spoken?appid=${appId}&input=${encodeURIComponent(textString)}&units=imperial`);
		console.log({ "Wolfram Aplha": response.data })
		return response.data
	} catch (error) {
		const response = error.response
		console.log({ "Wolfram Aplha": response.data })
		return `${response.data}. It likely isn't appropriate for this use case.`
	}
}

//const resultingText = await askWolfram ("What can I do for you, Billy?")

const browserUsername = "brd-customer-hl_79f94069-zone-scraping_browser"
const browserPassword = "yh2b8q1jxslz"
const AUTH = `${browserUsername}:${browserPassword}`
const SBR_WS_ENDPOINT = `wss://${AUTH}@brd.superproxy.io:9222`;

export async function scrapeWebsite(url) {
	async function tryToConnect(webSocket, maxAttempts = 5, interval = 2000) {
		// Function to create a timeout promise
		function createTimeout(delay) {
			return new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Connection timeout')), delay)
			);
		}

		let lastError;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			console.log(`Attempt #${attempt} to connect...`);
			try {
				// Race the connect promise against a timeout
				return await Promise.race([
					puppeteer.connect({ browserWSEndpoint: webSocket }),
					createTimeout(interval)
				]);
			} catch (error) {
				console.log(`Connection attempt ${attempt} failed or timed out, retrying...`);
				lastError = error;
				// Wait for the interval before the next attempt
				await new Promise(resolve => setTimeout(resolve, interval));
			}
		}

		throw lastError; // Throw the last error after all attempts fail
	}
	let browser
	let data = {};
	let contentArray = []
	try {
		console.log("Connecting to browser...");
		browser = await tryToConnect(SBR_WS_ENDPOINT, 5, 3000);
		console.log("Connected!")


		console.log("Starting navigation...")
		const page = await browser.newPage();
		// Enable request interception
		await page.setRequestInterception(true);

		// Listen for requests
		page.on('request', (request) => {
			if (request.resourceType() === 'image') {
				// If the request is for an image, block it
				request.abort();
			} else {
				// If it's not an image request, allow it to continue
				request.continue();
			}
		});
		console.log("Created new page, going to url...")

		await page.goto(url, {
			waitUntil: 'networkidle0', // or 'networkidle2' depending on your need
			timeout: 60 * 1000 // Timeout in milliseconds (15 seconds in this case)
		});

		// Rest of your code

		// CAPTCHA handling: If you're expecting a CAPTCHA on the target page, use the following code snippet to check the status of Scraping Browser's automatic CAPTCHA solver
		const client = await page.createCDPSession();
		console.log('Waiting captcha to solve...');
		const { status } = await client.send('Captcha.waitForSolve', {
			detectTimeout: 5000,
		});
		console.log('Captcha solve status:', status);


		console.log("Navigated!")
		data = await page.evaluate(() => {
			// Define arrays for heading tags and tags to exclude from scraping
			const headingTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
			const excludeTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'HEADER', 'FOOTER', 'NAV'];
			let results = {};
			let currentHeading = { level: 0, text: '' };

			// Function to clean the text by removing excessive whitespace
			function cleanText(text) {
				return text.replace(/\s+/g, ' ').trim();
			}

			// Function to validate the text (filter out unwanted patterns)
			function isTextValid(text) {
				// Check for template syntax, inline JS, HTML-like tags, and JavaScript objects/arrays
				const invalidPatterns = [
					/{{.*?}}/,            // Template syntax
					/<.*?>/,              // HTML-like tags
					/\[.*?\]/,            // Array literals
					/{.*?}/,              // Object literals
					/function\(.*?\)/,    // Function calls
					/=>/                  // Arrow functions
				];
				return !invalidPatterns.some(pattern => pattern.test(text));
			}

			// Iterate over all elements on the page
			document.querySelectorAll('*').forEach(el => {
				let textContent = el.innerText || '';
				textContent = cleanText(textContent); // Clean the text content

				// Check if the current element is a heading
				if (headingTags.includes(el.tagName)) {
					// Update the current heading context
					currentHeading = { level: parseInt(el.tagName[1]), text: textContent };
					// Initialize the content for this heading as an empty string
					results[currentHeading.text] = '';
				}
				else if (
					// Check if the element is not in the excluded tags list and has valid text
					!excludeTags.includes(el.tagName) && textContent && currentHeading.level > 0 && isTextValid(textContent)
				) {
					// Check if the text is not already present in the content string
					if (!results[currentHeading.text].includes(textContent)) {
						// Append the text content to the string, separated by new lines
						results[currentHeading.text] += (results[currentHeading.text] ? '\n' : '\n') + textContent;
					}
				}
			});

			return results; // Return the results object containing headings and their text content
		});
		if (status === "solve_failed") {
			data = { Error: "This website has a captcha. The browser tried to solve it automatically, but failed." }
		}

	}
	catch (error) {
		console.error('Error during scraping!', { error });
		data = { Error: "Couldn't access the webpage." }
	}
	finally {
		console.log("Closed browser")
		if (browser) {
			await browser.close();
		}
		else {
			data = { Error: "Couldn't start the web browser." }
		}
	}

	const json = data
	console.log({ json })
	const string = JSON.stringify(data, null, 2)
	await saveDataToFile(json, 'websiteData.json');
	return { json, string }
}

const testUrl = 'https://example.com'; // Replace with your target URL
//const websiteData = await scrapeWebsite(testUrl)

export async function simpleScrape(url) {
	//console.log("simpleScrape()...")

	// Fetch the HTML content from the URL
	//console.log(`going to ${url}...`)
	try {
		const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
			params: {
				'api_key': 'RJBZ1SD9PGYGAT1T4TVM883X2LHXVVFIIWR4JDVSZN8EAEC9YRFVW62YKPOLA6U2KGL71D2XZH6SSCPQ',
				'url': `${url}`,
				'block_ads': 'true',
				"timeout": "5000"
			}
		})
		const html = response.data;
		//console.log("got data!")

		// Load HTML into Cheerio
		const $ = cheerio.load(html);

		// Define arrays for heading tags and tags to exclude from scraping
		const headingTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
		const excludeTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'HEADER', 'FOOTER', 'NAV'];
		let results = {};
		let currentHeading = { level: 0, text: '' };

		// Function to clean the text by removing excessive whitespace
		function cleanText(text) {
			return text.replace(/\s+/g, ' ').trim();
		}

		// Function to validate the text (filter out unwanted patterns)
		function isTextValid(text) {
			const invalidPatterns = [
				/{{.*?}}/, /<.*?>/, /\[.*?\]/, /{.*?}/, /function\(.*?\)/, /=>/
			];
			return !invalidPatterns.some(pattern => pattern.test(text));
		}

		// Iterate over all elements on the page
		//console.log("Organizing page...")
		$('*').each((_, el) => {
			let textContent = $(el).text() || '';
			textContent = cleanText(textContent);

			// Check if the current element is a heading
			if (headingTags.includes(el.tagName.toUpperCase())) {
				currentHeading = { level: parseInt(el.tagName[1]), text: textContent };
				results[currentHeading.text] = '';
			} else if (
				!excludeTags.includes(el.tagName.toUpperCase()) && textContent && currentHeading.level > 0 && isTextValid(textContent)
			) {
				if (!results[currentHeading.text].includes(textContent)) {
					results[currentHeading.text] += (results[currentHeading.text] ? '\n' : '') + textContent;
				}
			}
		});
		//console.log("Returning results")
		results = {Website_URL: url, ...results}
		//await saveDataToFile(results, "websiteData.json")
		return JSON.stringify(results, null, 2)
	}
	catch (error) {
		//console.log("webscrape failed", { error })
		const results = {Website_URL: url, Error: "Webscrapping failed for this page."}
		return JSON.stringify(results, null, 2)
	}
}
//const scrapeResult = await simpleScrape(testUrl)
//console.log({scrapeResult: scrapeResult.json})

export async function scrapeMultiplePages(searchResults, sendUpdateFunction) {
	//const urls = searchResults.map(result => result.url)
	let progressCount = 0
	try {
		// Create an array of promises, each using simpleScrape
		const promises = searchResults.map(result =>
			simpleScrape(result.url)
				.then(data => {
					progressCount += 1
					const percentage = {1: "33%", 2: "66%", 3: "99%"}
						
					sendUpdateFunction("Web Scrape", {Action: `I'm downloading the page contents. ${percentage[progressCount]} done.`})
					return {searchResult: result, websiteData: data}
				})
				.catch(error => {
					//console.error(`Error scraping ${url}:`, error);
					return {searchResult: result, websiteData: `Error reading url (${result.url})`}
				})
		);

		// Use Promise.allSettled to wait for all to settle
		const results = await Promise.allSettled(promises);

		// Process the results
		const finalResults = results.map((result, index) => {
			if (result.status === 'fulfilled') {
				return result.value;
			} else {
				//console.warn(`Error result for ${searchResults[index].url}:`, result.reason);
				return { error: result.reason };
			}
		});

		console.log('All scraping tasks completed.');
		//sendUpdateFunction("Web Scrape", {Thought: "All of the web pages have been opened, I'm now about to read them"})
		console.log({finalResults})
		return finalResults;
	} catch (error) {
		// Handle any unexpected errors
		console.error('Unexpected error:', error);
		return []; // Return an empty array in case of unexpected errors
	}
}
//const testUrls = ["http://example.com/"]

//await scrapeMultiplePages(testUrls)


async function saveDataToFile(data, filename) {
	const jsonContent = JSON.stringify(data, null, 2); // null, 2 for pretty formatting

	try {
		await fs.writeFile(filename, jsonContent, 'utf8');
		console.log("JSON file has been saved.");
	} catch (err) {
		console.log("An error occurred while writing JSON Object to File.");
		//console.error(err);
	}
}



