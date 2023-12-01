import express from "express"
import { Sidekick } from "./Sidekick.js"
import cors from "cors"
import { streamToResponse } from "ai"
// move Readable, and etc to Sidekick maybe
import { Readable } from 'stream';
import * as PlayHT from 'playht';
import expressWs from 'express-ws';
import { TextDecoder } from 'util';
import { Server } from "socket.io";
import * as natural from 'natural';

const textDecoder = new TextDecoder('utf-8');
const tokenizer = new natural.default.SentenceTokenizer();

/*
Todo List
[] change the websocket callbacks to use sidekickInstance.createResponse()
*/



PlayHT.init({
	apiKey: '2111d113542d43298034d49903ed9334',
	userId: 'hfF1DKXkMNXhQfOx24NnrLq178C2',
	defaultVoiceId: 's3://voice-cloning-zero-shot/028a32d4-6a79-4ca3-a303-d6559843114b/chris/manifest.json',
	defaultVoiceEngine: 'PlayHT2.0',
});

const voiceOptions = {
	apiOptions: {
		quality: 'draft',
		temperature: 0.1,
	},
	sentencesPerCall: 1,
	KbPerChunk: 64
}
const apiOptions = voiceOptions.apiOptions



const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS
app.use(cors({ origin: '*' }));

const server = app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

const io = new Server(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"]
	}
});


app.use(cors())
app.use(express.json())

expressWs(app);

let streams = new Map() //(ws, textStream)
let userSocketMap = new Map() // (userId, ws)



app.get('/', (req, res) => {
	res.send('The API is up and running!');
});


// SOCKET.IO
// [] Plan -> use this readable instead. No writers just push to it. I think the playHT wants the read() method in there.
const audioTextStream = new Readable({ // change to map w/ userIds
	read() {
	}
});

const { writable, readable } = new TransformStream();
const readableTextStream = readable
//const forceReader = readableTextStream.getReader();
const textWriter = writable.getWriter();


//const reader = readableTextStream.getReader();
async function logStream() {
	while (true) {
		const { done, value } = await reader.read();

		if (done) {
			console.log("Stream complete.");
			break;
		}

		console.log(`Received from stream: ${value}`);
	}
}
//logStream().catch(err => console.error("Stream error:", err));


const activeStreams = new Map();
const createNewReadable = () => new Readable({ read() { } });


io.on('connection', async (socket) => {
	console.log('io.on(connection) -> New socket connected!');
	socket.emit("severData", { whisperAPI: process.env['whisperAPI'] })
	//console.log("io.on(connection) -> ALL SOCKETS:")
	//console.log(Object.keys(io.sockets.sockets));

	// Function to handle audio streaming for a group
	let audioState = {
		pendingGroups: [], // [x]
		okayToSend: true, // [x]
		groupNumber: 0 // [x]
	};

	async function handleAudioGroup(group, audioState, audioId) {
		console.log("handleAudioGroup() -> group:", group)
		audioState.groupNumber += 1;
		const currentGroup = audioState.groupNumber;
		audioState.okayToSend = false;
		const audioTextStream = new Readable({ read() { } });
		audioTextStream.push(group);
		audioTextStream.push(null);
		const audioStream = await PlayHT.stream(audioTextStream, apiOptions);

		let audioBuffer = Buffer.alloc(0);  // Initialize empty buffer
		const targetSize = voiceOptions.KbPerChunk * 1024;  // KB in bytes

		audioStream.on('data', (audioChunk) => {
			audioBuffer = Buffer.concat([audioBuffer, audioChunk]);  // Append the new chunk to the buffer

			// Check if the buffer size has reached the target size (8KB)
			if (audioBuffer.length >= targetSize) {
				socket.emit("audioChunk", { audioId, audioBuffer, group });  // Send buffered audio
				console.log(`audioStream.on(data) -> GROUP #${currentGroup}: Sent ${audioBuffer.length} bytes!`);
				audioBuffer = Buffer.alloc(0);  // Reset the buffer
			}

		});
		audioStream.on('end', () => {
			console.log("audioStream.on(end)")
			audioState.okayToSend = true;

			if (audioBuffer.length > 0) {
				socket.emit("audioChunk", { audioId, audioBuffer, group });  // Send any remaining audio
				socket.emit("audioCompleted", { audioId })
			}
			if (audioState.pendingGroups.length) {
				const nextGroup = audioState.pendingGroups.shift();
				handleAudioGroup(nextGroup, audioState, audioId);
				console.log(`audioStream.on(end) -> FINAL GROUP: Sent ${audioBuffer.length} bytes!`);
			}
			else {
				socket.emit("audioCompleted", { audioId })
			}
		});
		audioStream.on('error', error => console.log(`Stream error: ${error}`));
	}

	socket.onAny((event, ...args) => {
		//console.log(`***Server (${socket.id}) received event: ${event}***`);
	});


	socket.on('ClientToServer', () => {
		console.log('***CLIENT RESPONDED***');
	});


	socket.on('ServerToServer', (msg) => {
		console.log(`***Server responded to itself***`);
	});

	socket.on('error', (error) => {
		console.log(`Socket Error: ${error}`);
	});


	// 1. Socket Event Listener
	socket.on('textRequest', async (data) => {
		console.log('socket.on(textRequest');
		socket.emit("updateMessage", { message: "Requesting text..." })

		const { location, sentMessage, conversationOptions } = data.payload;

		const audioId = Date.now().toString()

		let sentenceBuffer = '';
		const maxSentenceCount = voiceOptions.sentencesPerCall

		const sidekickInstance = new Sidekick(location);
		const streamingText = await sidekickInstance.streamResponse(sentMessage, conversationOptions);

		// 3. Text Streaming and Sentence Grouping
		for await (const chunk of streamingText) {
			const decodedTextChunk = textDecoder.decode(chunk)
			const textChunk = decodedTextChunk.toString();
			socket.emit(`textChunk`, { textChunk })

			sentenceBuffer += textChunk;
			const sentences = tokenizer.tokenize(sentenceBuffer);

			while (sentences.length > maxSentenceCount) {
				const sentenceSubset = sentences.splice(0, maxSentenceCount).join(' ');


				if (audioState.okayToSend && conversationOptions.sendAudioBack) {
					await handleAudioGroup(sentenceSubset, audioState, audioId);
				}
				else {
					audioState.pendingGroups.push(sentenceSubset);
				}
				sentenceBuffer = sentences.join(' ');


			}

		}
		if (sentenceBuffer && conversationOptions.sendAudioBack) {
			// Handle any remaining sentences here
			if (audioState.okayToSend) {
				await handleAudioGroup(sentenceBuffer, audioState, audioId);
			} else {
				audioState.pendingGroups.push(sentenceBuffer);
			}
		}


	});

	socket.on(`playMessage`, async (data) => {
		console.log('socket.on(playMessage)');
		socket.emit("updateMessage", { message: "Getting audio..." })
		const sentMessageContent = data.payload
		console.log({sentMessageContent})
		const audioId = Date.now().toString()


		let sentenceBuffer = '';
		const maxSentenceCount = voiceOptions.sentencesPerCall


		const textToChunksBySentences = (text, maxSentencesPerChunk) => {
			// Tokenize the text into sentences
			const sentences = tokenizer.tokenize(text);
			const chunks = [];
			let currentChunk = [];

			// Iterate over the sentences
			sentences.forEach(sentence => {
				currentChunk.push(sentence);

				// When the current chunk reaches the max sentence count, add it to chunks
				if (currentChunk.length > maxSentencesPerChunk) {
					chunks.push(currentChunk.join(' '));
					currentChunk = []; // Reset current chunk
				}
			});

			// Add any remaining sentences as the last chunk
			if (currentChunk.length > 0) {
				chunks.push(currentChunk.join(' '));
			}

			return chunks;
		};

		const streamingText = textToChunksBySentences(sentMessageContent, maxSentenceCount);

		// 3. Text Streaming and Sentence Grouping
		for await (const chunk of streamingText) {
			const textChunk = chunk.toString();
			sentenceBuffer += textChunk;

			const sentences = tokenizer.tokenize(sentenceBuffer);
			while (sentences.length >= maxSentenceCount) {
				const sentenceSubset = sentences.splice(0, maxSentenceCount).join(' ');

				if (audioState.okayToSend) {
					await handleAudioGroup(sentenceSubset, audioState, audioId);
				} else {
					audioState.pendingGroups.push(sentenceSubset);
				}
				sentenceBuffer = sentences.join(' ');
			}
		}
		if (sentenceBuffer) {
			// Handle any remaining sentences here
			if (audioState.okayToSend) {
				await handleAudioGroup(sentenceBuffer, audioState, audioId);
			} else {
				audioState.pendingGroups.push(sentenceBuffer);
			}
		}
	})

	socket.on(`getAPIKey`, async (data, callback) => {
		console.log("/getAPIKey Websocket event")
		try {
			const serverSideAPIKey = process.env['whisperAPI']
			console.log({serverSideAPIKey})
			console.log("/getAPIKey -> END")
			callback({ success: true, data: serverSideAPIKey })
		}
		catch (error) {
			console.error("Error in getAPIKey:", error);
			callback({ success: false, error: error.message });
		}
	})

	socket.on('createDocument', async (data, callback) => {
		console.log("/createDocument WebSocket event");
		const { location } = data;
		const sidekickInstance = new Sidekick(location);
		console.log("/createDocument -> sidekick.createDocument()...");
		try {
			const result = await sidekickInstance.createDocument();
			console.log("/createDocument -> END");
			callback({ success: true, data: result });
		} catch (error) {
			console.error("Error in createDocument:", error);
			callback({ success: false, error: error.message });
		}







		socket.on('disconnect', () => {
			console.log('socket.on(disconnnect) -> Socket closed!');
		});
	});

	socket.on('createConversation', async (data, callback) => {
		console.log("/createConversation WebSocket event");
		const { location } = data;
		const sidekickInstance = new Sidekick(location);
		console.log("/createConversation -> sidekick.createConversation()...");
		try {
			const result = await sidekickInstance.createConversation();
			console.log("/createConversation -> END");
			callback({ success: true, data: result });
		} catch (error) {
			console.error("Error in createConversation:", error);
			callback({ success: false, error: error.message });
		}
	});

	socket.on('deleteConversation', async (data, callback) => {
		console.log("/deleteConversation WebSocket event");
		const { location } = data;
		const sidekickInstance = new Sidekick(location);
		console.log("/deleteConversation -> sidekick.deleteConversation()...");
		try {
			const result = await sidekickInstance.deleteConversation();
			console.log("/deleteConversation -> END");
			callback({ success: true, data: result });
		} catch (error) {
			console.error("Error in deleteConversation:", error);
			callback({ success: false, error: error.message });
		}
	});

	socket.on('updateConversation', async (data, callback) => {
		console.log("/updateConversation WebSocket event");
		const { location, updateData } = data;
		const sidekickInstance = new Sidekick(location);
		console.log("/updateConversation -> sidekick.updateConversation()...");
		try {
			const result = await sidekickInstance.updateConversation(updateData);
			console.log("/updateConversation -> END");
			callback({ success: true, data: result });
		} catch (error) {
			console.error("Error in updateConversation:", error);
			callback({ success: false, error: error.message });
		}
	});

	socket.on("updateSettings", async (data, callback) => {
		console.log("/updateSettings WebSocket event")
		const { location, updateData } = data
		const sideKickInstance = new Sidekick(location)
		await sideKickInstance.updateSettings(updateData)
		callback(sideKickInstance.createResponse(true))
	})

	socket.on("getSettings", async (data, callback) => {
		console.log("/getSettings WebSocket event")
		const { location } = data
		const sideKickInstance = new Sidekick(location)
		const settings = await sideKickInstance.getSettings()
		callback(sideKickInstance.createResponse(true, settings))
	})

	socket.on('renameConversation', async (data, callback) => {
		console.log("/renameConversation WebSocket event");
		const { location, newName } = data;
		const sidekickInstance = new Sidekick(location);
		console.log("/renameConversation -> sidekick.renameConversation()...");
		try {
			const result = await sidekickInstance.renameConversation(newName);
			console.log("/renameConversation -> END");
			callback({ success: true, data: result });
		} catch (error) {
			console.error("Error in renameConversation:", error);
			callback({ success: false, error: error.message });
		}
	});

	socket.on('trimChatHistory', async (data, callback) => {
		console.log("/trimChatHistory WebSocket event");
		const { location, chatHistory, conversationOptions } = data;
		const sidekickInstance = new Sidekick(location);
		console.log("/trimChatHistory -> sidekick.trimChatHistory()...");
		try {
			const result = sidekickInstance.trimChatHistory(chatHistory, conversationOptions);
			console.log("/trimChatHistory -> END");
			callback({ success: true, data: result });
		} catch (error) {
			console.error("Error in trimChatHistory:", error);
			callback({ success: false, error: error.message });
		}
	});

	socket.on('getConversation', async (data, callback) => {
		console.log("/getConversation WebSocket event");
		const { location } = data;
		const sidekickInstance = new Sidekick(location);
		console.log("/getConversation -> sidekick.getConversation()...");
		try {
			const result = await sidekickInstance.getConversation();
			console.log("/getConversation -> END");
			callback({ success: true, data: result });
		} catch (error) {
			console.error("Error in getConversation:", error);
			callback({ success: false, error: error.message });
		}
	});

	socket.on('getConversations', async (data, callback) => {
		console.log("/getConversations WebSocket event");
		const { location } = data;
		const sidekickInstance = new Sidekick(location);
		console.log("/getConversations -> sidekick.getConversations()...");
		try {
			const result = await sidekickInstance.getConversations();
			console.log("/getConversations -> END");
			callback({ success: true, data: result });
		} catch (error) {
			console.error("Error in getConversations:", error);
			callback({ success: false, error: error.message });
		}
	});

	socket.on('getLastConversation', async (data, callback) => {
		console.log("/getLastConversation WebSocket event");
		console.log("USE GET SETTINGS INSTEAD!!!")
		const { location } = data;
		const sidekickInstance = new Sidekick(location);
		console.log("/getLastConversation -> sidekick.getLastConversation()...");
		try {
			const result = await sidekickInstance.getLastConversation();
			console.log("/getLastConversation -> END");
			callback({ success: true, data: result });
		} catch (error) {
			console.error("Error in getLastConversation:", error);
			callback({ success: false, error: error.message });
		}
	});

	socket.on('startConvoHere', async (data, callback) => {
		console.log("/startConvoHere WebSocket event");
		const { location, creationTimeId } = data;
		const sidekickInstance = new Sidekick(location);
		console.log("/startConvoHere -> sidekick.startConvoHere()...");
		try {
			const result = await sidekickInstance.startConvoHere(creationTimeId);
			console.log("/startConvoHere -> END");
			callback({ success: true, data: result });
		} catch (error) {
			console.error("Error in startConvoHere:", error);
			callback({ success: false, error: error.message });
		}
	});

	socket.on('talkToAPI', async (data, callback) => {
		console.log("/talkToAPI WebSocket event");
		const { location, sentMessage, conversationOptionsAPI } = data;
		let conversationOptions = conversationOptionsAPI;
		const sidekickInstance = new Sidekick(location);
		console.log("/talkToAPI -> sidekick.talkToAPI()...");
		try {
			const result = await sidekickInstance.talkToAPI(sentMessage, conversationOptions);
			console.log("/talkToAPI -> END");
			callback({ success: true, data: result });
		} catch (error) {
			console.error("Error in talkToAPI:", error);
			callback({ success: false, error: error.message });
		}
	});



}) // end of socket connections

// POSTS
app.post('/streamAudio', async (req, res) => {
	console.log("/streamAudio")
	const { messageText } = req.body
	//console.log("currentTextStream"); console.log(currentTextStream)
	try {
		console.log("/streamAudio -> PlayHT.stream(messageText)...")
		const audioStream = await PlayHT.stream(messageText);
		res.setHeader('Content-Type', 'audio/mpeg');
		audioStream.pipe(res);

		// Logging for debugging
		audioStream.on('end', () => console.log('/streamAudio -> Stream ended'));
		audioStream.on('error', (error) => console.log(`/streamAudio -> Stream error: ${error}`))
	} catch (error) { console.error("/streamAudio -> failed", error) }
})

app.post('/streamItBack', async (req, res) => {
	console.log("/streamItBack");

	// Initialize headers
	res.setHeader('Transfer-Encoding', 'chunked');
	res.setHeader('Content-Type', 'audio/mpeg');

	// Create an initial empty Readable stream for PlayHT
	const textStream = new Readable({
		read() {
			// Initially empty
		},
	});

	// Event Listener for Incoming Text
	req.on('data', chunk => {
		console.log("/streamItBack -> chunk:", chunk)
		textStream.push(chunk.toString()); // Add text chunk to Readable stream
	});

	// Initialize PlayHT stream
	console.log("/streamItBack -> textStream:", textStream)
	const audioStream = await PlayHT.stream(textStream, {
		quality: 'premium',
	});

	// Pipe audio stream to the client
	console.log("/streamItBack -> audioStream.pipe(res)...")
	audioStream.pipe(res);

	// Logging for Debugging
	audioStream.on('end', () => console.log('/streamItBack -> Audio stream ended'));
	audioStream.on('error', error => console.log(`/streamItBack -> Stream error: ${error}`));

})

app.post('/playAudio', async (req, res) => {
	console.log("/playAudio")
	const { messageText } = req.body;
	console.log("/playAudio -> PlayHT.stream(messageText)...")
	const audioStream = await PlayHT.stream(messageText)

	const range = req.headers.range;
	if (!range) {
		res.status(400).send("Range header required");
		return;
	}

	res.writeHead(206, {
		'Accept-Ranges': 'bytes',
		'Content-Type': 'audio/mpeg'
	});

	audioStream.on('data', (chunk) => {
		//console.log("chunk:")
		//console.log(chunk)
		res.write(chunk);
	});

	audioStream.on('end', () => {
		console.log("/playAudio -> Stream ended")
		res.end();
	});
});

/*
app.post('/createDocument', async (req, res) => {
	console.log("/createDocument")
	const { location } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/createDocument -> sidekick.createDocument()...")
	const result = await sidekickInstance.createDocument();
	console.log("/createDocument -> END")
	res.json(result);
});
*/

/*
app.post('/talkToAPI', async (req, res) => {
	console.log("/talkToAPI")
	const { location, sentMessage, conversationOptionsAPI } = req.body;
	let conversationOptions = conversationOptionsAPI
	console.log("/talkToAPI -> location:", location)
	console.log("/talkToAPI -> message:", sentMessage)
	console.log("/talkToAPI -> conversationOptions:", conversationOptions)
	const sidekickInstance = new Sidekick(location);
	console.log("/talkToAPI -> sidekick.talkToAPI()...")
	const result = await sidekickInstance.talkToAPI(sentMessage, conversationOptions);
	console.log("/talkToAPI -> END")
	res.json(result);
});
*/

/*
app.post(`/startConvoHere`, async (req, res) => {
	console.log("/startConvoHere")
	const { location, creationTimeId } = req.body
	const sidekickInstance = new Sidekick(location)
	console.log("/startConvoHere -> sidekick.startConvoHere()...")
	const result = await sidekickInstance.startConvoHere(creationTimeId)
	console.log("/startConvoHere -> END")
	res.json(result)
})
*/

/*
app.post('/createConversation', async (req, res) => {
	console.log("/createConversation");
	const { location } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/createConversation -> sidekick.createConversation()...");
	const result = await sidekickInstance.createConversation();
	console.log("/createConversation -> END");
	res.json(result);
});
*/

/*
app.post('/deleteConversation', async (req, res) => {
console.log("/deleteConversation");
const { location } = req.body;
const sidekickInstance = new Sidekick(location);
console.log("/deleteConversation -> sidekick.deleteConversation()...");
const result = await sidekickInstance.deleteConversation();
console.log("/deleteConversation -> END");
res.json(result);
});
*/

/* This isn't used?
app.post('/saveMessage', async (req, res) => {
	console.log("/saveMessage");
	const { location, role, content } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/saveMessage -> sidekick.saveMessage()...");
	const result = await sidekickInstance.saveMessage(role, content);
	console.log("/saveMessage -> END");
	res.json(result);
});
*/

/* Not used
app.post('/sendMessage', async (req, res) => {
	console.log("/sendMessage");
	const { location, sentMessage, conversationOptions } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/sendMessage -> sidekick.sendMessage()...");
	const result = await sidekickInstance.sendMessage(sentMessage, conversationOptions);
	console.log("/sendMessage -> END");
	res.json(result);
});
*/

/* Not used
app.post('/streamResponse', async (req, res) => {
	console.log("/streamResponse");
	const { location, sentMessage, conversationOptions } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/streamResponse -> sidekick.streamResponse()...");
	const stream = await sidekickInstance.streamResponse(sentMessage, conversationOptions);
	// Pipe the stream to the response to send it to the client
	res.setHeader('Content-Type', 'text/plain; charset=utf-8');
	res.setHeader('Transfer-Encoding', 'chunked');
	streamToResponse(stream, res);
	console.log("/streamResponse -> END");
});
*/

/*
app.post('/updateConversation', async (req, res) => {
	console.log("/updateConversation");
	const { location, updateData } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/updateConversation -> sidekick.updateConversation()...");
	const result = await sidekickInstance.updateConversation(updateData);
	console.log("/updateConversation -> END");
	res.json(result);
});
*/

/* Not used?
app.post('/updateSettings', async (req, res) => {
	console.log("/updateSettings");
	const { location, updateData } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/updateSettings -> sidekick.updateSettings()...");
	const result = await sidekickInstance.updateSettings(updateData);
	console.log("/updateSettings -> END");
	res.json(result);
});
*/

/* Not used
app.post('/clearMessages', async (req, res) => {
	console.log("/clearMessages");
	const { location } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/clearMessages -> sidekick.clearMessages()...");
	const result = await sidekickInstance.clearMessages();
	console.log("/clearMessages -> END");
	res.json(result);
});
*/

/*
app.post('/renameConversation', async (req, res) => {
	console.log("/renameConversation");
	const { location, newName } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/renameConversation -> sidekick.renameConversation()...");
	const result = await sidekickInstance.renameConversation(newName);
	console.log("/renameConversation -> END");
	res.json(result);
});
*/

/*
app.post('/trimChatHistory', async (req, res) => {
	console.log("/trimChatHistory");
	const { location, chatHistory, conversationOptions } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/trimChatHistory -> sidekick.trimChatHistory()...");
	const result = sidekickInstance.trimChatHistory(chatHistory, conversationOptions);
	console.log("/trimChatHistory -> END");
	res.json(result);
});
*/


// GETS

app.get('/events', (req, res) => {
	console.log("/events");
	const location = JSON.parse(req.query.location);

	const sidekickInstance = new Sidekick(location);
	console.log("/events -> sidekick.sendMessageData()...");
	const botResponse = sidekickInstance.sendMessageData();

	// Set headers and send the bot response
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.write(`data: ${JSON.stringify(botResponse)}\n\n`);

	// Close the connection after sending
	req.on('close', () => {
		res.end();
	});
	console.log("/events -> END");
});


/* Not used
app.get('/getMessages', async (req, res) => {
	console.log("/getMessages");
	const location = JSON.parse(req.query.location);
	const sidekickInstance = new Sidekick(location);
	console.log("/getMessages -> sidekick.getMessages()...");
	const result = await sidekickInstance.getMessages();
	console.log("/getMessages -> END");
	res.json(result);
});
*/

/*
app.get('/getConversations', async (req, res) => {
	console.log("/getConversations");
	const location = JSON.parse(req.query.location);
	console.log("location:", location)
	const sidekickInstance = new Sidekick(location);
	console.log("/getConversations -> sidekick.getConversations()...");
	const result = await sidekickInstance.getConversations();
	console.log("/getConversations -> END");
	res.json(result);
});
*/

/*
app.get('/getConversation', async (req, res) => {
	console.log("/getConversation");
	const location = JSON.parse(req.query.location);
	const sidekickInstance = new Sidekick(location);
	console.log("/getConversation -> sidekick.getConversation()...");
	const result = await sidekickInstance.getConversation();
	console.log("/getConversation -> END");
	res.json(result);
});
*/

/*
app.get('/getLastConversation', async (req, res) => {
	console.log("/getLastConversation");
	const location = JSON.parse(req.query.location);
	console.log("location:", location);
	const sidekickInstance = new Sidekick(location);
	console.log("/getLastConversation -> sidekick.getLastConversation()...");
	const result = await sidekickInstance.getLastConversation();
	console.log("/getLastConversation -> END");
	res.json(result);
});
*/


//take care of errors
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).send('Something went wrong!');
});

