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




PlayHT.init({
	apiKey: '2111d113542d43298034d49903ed9334',
	userId: 'hfF1DKXkMNXhQfOx24NnrLq178C2',
	defaultVoiceId: 's3://voice-cloning-zero-shot/028a32d4-6a79-4ca3-a303-d6559843114b/chris/manifest.json',
	defaultVoiceEngine: 'PlayHT2.0',
});

const voiceOptions = {
	apiOptions: {
		 quality: 'premium',
		temperature: 0.1,
	},
	sentencesPerCall: 2,
	KbPerChunk: 1
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
	console.log('New socket connected!');
	console.log("ALL SOCKETS:")
	console.log(Object.keys(io.sockets.sockets));



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
		const audioId = Date.now().toString()

		// ---> handleAudioGroup does nothing until convoOptions impletmented


		console.log('TEXT REQUEST');
		const { location, sentMessage, conversationOptions } = data.payload;

		let sentenceBuffer = '';
		const maxSentenceCount = voiceOptions.sentencesPerCall

		// 2. Queue and Flags
		let pendingGroups = [];
		let okayToSend = true;
		let groupNumber = 0;

		// Function to handle audio streaming for a group
		async function handleAudioGroup(group) {

			groupNumber += 1;
			const currentGroup = groupNumber;

			okayToSend = false;
			const audioTextStream = new Readable({ read() { } });
			audioTextStream.push(group);
			audioTextStream.push(null);

			if (conversationOptions.sendAudioBack) {
				const audioStream = await PlayHT.stream(audioTextStream, apiOptions);

				let audioBuffer = Buffer.alloc(0);  // Initialize empty buffer
				const targetSize = voiceOptions.KbPerChunk * 1024;  // KB in bytes

				audioStream.on('data', (audioChunk) => {
					audioBuffer = Buffer.concat([audioBuffer, audioChunk]);  // Append the new chunk to the buffer

					// Check if the buffer size has reached the target size (8KB)
					if (audioBuffer.length >= targetSize) {
						
						socket.emit("audioChunk", {audioId, audioBuffer});  // Send buffered audio
						console.log(`GROUP #${currentGroup}: Sent ${audioBuffer.length} bytes!`);
						audioBuffer = Buffer.alloc(0);  // Reset the buffer
					}

				});
				audioStream.on('end', () => {
					console.log('Audio stream ended');
					okayToSend = true;

					if (audioBuffer.length > 0) {
						socket.emit("audioChunk", {audioId, audioBuffer});  // Send any remaining audio
						console.log(`GROUP #${currentGroup} (Final): Sent remaining ${audioBuffer.length} bytes!`);
					}
					if (pendingGroups.length) {
						const nextGroup = pendingGroups.shift();
						handleAudioGroup(nextGroup);
					}
				});
				audioStream.on('error', error => console.log(`Stream error: ${error}`));
			}
		}

		const sidekickInstance = new Sidekick(location);
		const streamingText = await sidekickInstance.streamResponse(sentMessage, conversationOptions);

		// 3. Text Streaming and Sentence Grouping
		for await (const chunk of streamingText) {
			const decodedTextChunk = textDecoder.decode(chunk);
			sentenceBuffer += decodedTextChunk;

			const sentences = tokenizer.tokenize(sentenceBuffer);
			while (sentences.length >= maxSentenceCount) {
				const sentenceSubset = sentences.splice(0, maxSentenceCount).join(' ');

				// 4. Audio Stream Handling
				if (okayToSend) {
					console.log({sentenceSubset})
					await handleAudioGroup(sentenceSubset);
				} else {
					// 5. Queue Management
					pendingGroups.push(sentenceSubset);
				}
				sentenceBuffer = sentences.join(' ');
			}
	 
			console.log({decodedTextChunk})
			socket.emit("textChunk", { decodedTextChunk });
		}

		if (sentenceBuffer) {
			// Handle any remaining sentences here
			if (okayToSend) {
				console.log({sentenceBuffer})
				await handleAudioGroup(sentenceBuffer);
			} else {
				pendingGroups.push(sentenceBuffer);
			}
		}
	
	});

	socket.on(`playMessage`, async (data) => {
		console.log('PLAY MESSAGE');
		const sentMessageContent = data.payload
		const audioId = Date.now().toString()


		let sentenceBuffer = '';
		const maxSentenceCount = voiceOptions.sentencesPerCall

		// 2. Queue and Flags
		let pendingGroups = [];
		let okayToSend = true;
		let groupNumber = 0;

		 
		// Function to handle audio streaming for a group
		async function handleAudioGroup(group) {
			groupNumber += 1;
			const currentGroup = groupNumber;

			okayToSend = false;
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
					socket.emit("audioChunk", {audioId, audioBuffer});  // Send buffered audio
					console.log(`GROUP #${currentGroup}: Sent ${audioBuffer.length} bytes!`);
					audioBuffer = Buffer.alloc(0);  // Reset the buffer
				}

			});
			audioStream.on('end', () => {
				console.log('Audio stream ended');
				okayToSend = true;

				if (audioBuffer.length > 0) {
					socket.emit("audioChunk", {audioId, audioBuffer});  // Send any remaining audio
					console.log(`GROUP #${currentGroup} (Final): Sent remaining ${audioBuffer.length} bytes!`);
				}
				if (pendingGroups.length) {
					const nextGroup = pendingGroups.shift();
					handleAudioGroup(nextGroup);
				}
			});
			audioStream.on('error', error => console.log(`Stream error: ${error}`));
		}

		const textToChunks = (text, chunkSize) => {
			const chunks = [];
			for (let i = 0; i < text.length; i += chunkSize) {
				chunks.push(text.slice(i, i + chunkSize));
			}
			return chunks;
		};

		const streamingText = textToChunks(sentMessageContent, 100)

		// 3. Text Streaming and Sentence Grouping
		for await (const chunk of streamingText) {
			const textChunk = chunk.toString();
			sentenceBuffer += textChunk;

			const sentences = tokenizer.tokenize(sentenceBuffer);
			while (sentences.length >= maxSentenceCount) {
				const sentenceSubset = sentences.splice(0, maxSentenceCount).join(' ');

				// 4. Audio Stream Handling
				if (okayToSend) {
					await handleAudioGroup(sentenceSubset);
				} else {
					// 5. Queue Management
					pendingGroups.push(sentenceSubset);
				}
				sentenceBuffer = sentences.join(' ');
			}

		}

		if (sentenceBuffer) {
			// Handle any remaining sentences here
			if (okayToSend) {
				await handleAudioGroup(sentenceBuffer);
			} else {
				pendingGroups.push(sentenceBuffer);
			}
		}
		console.log("***DONE DONE***")
	})

	socket.on('disconnect', () => {
		console.log('---> Socket closed!');
	});
});


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

app.post('/createDocument', async (req, res) => {
	console.log("/createDocument")
	const { location } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/createDocument -> sidekick.createDocument()...")
	const result = await sidekickInstance.createDocument();
	console.log("/createDocument -> END")
	res.json(result);
});

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

app.post(`/startConvoHere`, async (req, res) => {
	console.log("/startConvoHere")
	const { location, creationTimeId } = req.body
	const sidekickInstance = new Sidekick(location)
	console.log("/startConvoHere -> sidekick.startConvoHere()...")
	const result = await sidekickInstance.startConvoHere(creationTimeId)
	console.log("/startConvoHere -> END")
	res.json(result)
})

app.post('/createConversation', async (req, res) => {
	console.log("/createConversation");
	const { location } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/createConversation -> sidekick.createConversation()...");
	const result = await sidekickInstance.createConversation();
	console.log("/createConversation -> END");
	res.json(result);
});

app.post('/deleteConversation', async (req, res) => {
	console.log("/deleteConversation");
	const { location } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/deleteConversation -> sidekick.deleteConversation()...");
	const result = await sidekickInstance.deleteConversation();
	console.log("/deleteConversation -> END");
	res.json(result);
});

app.post('/saveMessage', async (req, res) => {
	console.log("/saveMessage");
	const { location, role, content } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/saveMessage -> sidekick.saveMessage()...");
	const result = await sidekickInstance.saveMessage(role, content);
	console.log("/saveMessage -> END");
	res.json(result);
});

app.post('/sendMessage', async (req, res) => {
	console.log("/sendMessage");
	const { location, sentMessage, conversationOptions } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/sendMessage -> sidekick.sendMessage()...");
	const result = await sidekickInstance.sendMessage(sentMessage, conversationOptions);
	console.log("/sendMessage -> END");
	res.json(result);
});


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

app.post('/updateConversation', async (req, res) => {
	console.log("/updateConversation");
	const { location, updateData } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/updateConversation -> sidekick.updateConversation()...");
	const result = await sidekickInstance.updateConversation(updateData);
	console.log("/updateConversation -> END");
	res.json(result);
});

app.post('/updateSettings', async (req, res) => {
	console.log("/updateSettings");
	const { location, updateData } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/updateSettings -> sidekick.updateSettings()...");
	const result = await sidekickInstance.updateSettings(updateData);
	console.log("/updateSettings -> END");
	res.json(result);
});

app.post('/clearMessages', async (req, res) => {
	console.log("/clearMessages");
	const { location } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/clearMessages -> sidekick.clearMessages()...");
	const result = await sidekickInstance.clearMessages();
	console.log("/clearMessages -> END");
	res.json(result);
});

app.post('/renameConversation', async (req, res) => {
	console.log("/renameConversation");
	const { location, newName } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/renameConversation -> sidekick.renameConversation()...");
	const result = await sidekickInstance.renameConversation(newName);
	console.log("/renameConversation -> END");
	res.json(result);
});

app.post('/trimChatHistory', async (req, res) => {
	console.log("/trimChatHistory");
	const { location, chatHistory, conversationOptions } = req.body;
	const sidekickInstance = new Sidekick(location);
	console.log("/trimChatHistory -> sidekick.trimChatHistory()...");
	const result = sidekickInstance.trimChatHistory(chatHistory, conversationOptions);
	console.log("/trimChatHistory -> END");
	res.json(result);
});


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

app.get('/getMessages', async (req, res) => {
	console.log("/getMessages");
	const location = JSON.parse(req.query.location);
	const sidekickInstance = new Sidekick(location);
	console.log("/getMessages -> sidekick.getMessages()...");
	const result = await sidekickInstance.getMessages();
	console.log("/getMessages -> END");
	res.json(result);
});

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

app.get('/getConversation', async (req, res) => {
	console.log("/getConversation");
	const location = JSON.parse(req.query.location);
	const sidekickInstance = new Sidekick(location);
	console.log("/getConversation -> sidekick.getConversation()...");
	const result = await sidekickInstance.getConversation();
	console.log("/getConversation -> END");
	res.json(result);
});

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



//take care of errors
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).send('Something went wrong!');
});

