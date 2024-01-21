import axios from 'axios-https-proxy-fix';

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
export async function performSearch(searchQuery) {
	
	async function getResults(searchString){
		try {
		// Disabling TLS/SSL certificate validation (Use with caution)
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

		const response = await axios.get(`http://www.google.com/search?q=${encodeURIComponent(searchString)}` + `&brd_json=1`, { proxy: options });
		const results = response.data.organic
		
		const noImages = results.map(result => {
			return {
				"Page Title": result.title,
				"Page description": result.description || "No description was given! :(",
				"Link": result.link}
		})
		
		//console.log({"RESULTS": noImages});
		return noImages
	} 
		catch (error) {
		console.error(error);
	}
	}
	
	const searchResults = await getResults(searchQuery)
	const topFive = searchResults.slice(0, 5)
	console.log({topFive})
	return topFive
}

//await performSearch("weather")

export async function askWolfram (textString){
	const appId = "WWR9JJ-YTEPR878Q7"
	try{
	const response = await axios.get(`http://api.wolframalpha.com/v1/spoken?appid=${appId}&input=${encodeURIComponent(textString)}&units=imperial`);
	console.log({"Wolfram Aplha": response.data})
	return response.data
	}catch(error){
		const response = error.response
		console.log({"Wolfram Aplha": response.data})
		return response.data
	}
}

//const resultingText = await askWolfram ("What can I do for you, Billy?")
//console.log({resultingText})