/** TODO
[x] Use a single location object in the frontend and backend
[current] sendMessage -> location, message{role, content, id}, conversationOptions
[] responses -> message{role, content, id}, info{removedMessages, currentTokenCount, currentMessageCount}
*/

import {
	getFirestore, collection, doc, addDoc, deleteDoc,
	updateDoc, getDoc, getDocs, setDoc, query, where, serverTimestamp,
	arrayUnion, increment
} from "firebase/firestore";
import openaiTokenCounter from 'openai-gpt-token-counter';
import { initializeApp } from "firebase/app";
import OpenAI from "openai"
import { OpenAIStream, StreamingTextResponse, streamToResponse } from 'ai';
import * as PlayHT from 'playht';
import fetch from 'node-fetch';
import { Readable } from 'stream';





const firebaseConfig = {
	apiKey: "AIzaSyBDotDqTDLK7Li0ci4Uby94i3x6TrLZq6Q",
	authDomain: "chatbot-v10-fcbf7.firebaseapp.com",
	projectId: "chatbot-v10-fcbf7",
	storageBucket: "chatbot-v10-fcbf7.appspot.com",
	messagingSenderId: "721867213546",
	appId: "1:721867213546:web:86f013e821cc610019a593"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);



export class Sidekick {
	constructor(location) {
		this.userId = location.userId.toString();
		this.conversationId = location.conversationId.toString();
		this.userRef = doc(db, 'ConversationsByUser', this.userId);
		this.conversationsRef = collection(this.userRef, 'conversations');
		console.log(`=====> New Instance created, userId: ${this.userId} conversationId: ${this.conversationId}`);
	}

	createResponse(success, data = null, error = null) {
		return { success, data, error }
	}

	async createDocument() {
		console.log("=> createDocument()...");
		const docSnap = await getDoc(this.userRef);

		if (!docSnap.exists()) {
			const blankDocument = {
				userId: this.userId,
				lastConversation: "placeholderId",
			};

			await setDoc(this.userRef, blankDocument);
			console.log(`Created document with userId: ${this.userId}`);
			return this.createResponse(true);
		} else {
			console.log(`A document with userId: ${this.userId} already exists.`);
			return this.createResponse(true);
		}
	}

	async createConversation() {
		console.log("=> createConversation()...");
		try {
			const blankConversation = {
				conversationId: this.conversationId,
				name: "New Chat",
				messages: [],
				messageCount: 0,
				totalTokenCount: 0,
				updatedAt: Date.now(),
			};
			const conversationRef = doc(this.conversationsRef, this.conversationId);
			const conversationSnapshot = await getDoc(conversationRef);

			if (!conversationSnapshot.exists()) {
				await setDoc(conversationRef, {
					...blankConversation,
					createdAt: serverTimestamp()
				});
				console.log(`Created conversation with ID: ${this.conversationId}`);
				return this.createResponse(true);
			} else {
				console.log("conversation already exists")
				return this.createResponse(false, null, `Conversation already exists, conversationId: ${this.conversationId}`);
			}

		} catch (error) {
			console.error(`Error creating conversation: ${error}`);
			return this.createResponse(false, null, error);
		}
	}

	async updateSettings(testSettings) {
		console.log("=> updateSettings()...")
		testSettings = {
			theme: "dark",
		}
		try {
			await updateDoc(this.userRef, "settings", testSettings)
		} catch (error) { console.error("updateSettings() failed") }
	}

	async getConversations() {
		console.log("=> getConversations()...");
		try {
			const querySnapshot = await getDocs(this.conversationsRef);
			const conversations = querySnapshot.docs.map(doc => doc.data());
			console.log(`There's ${conversations.length} conversation(s)`);
			return this.createResponse(true, conversations);
		} catch (error) {
			console.error(`Error fetching conversations: ${error}`);
			return this.createResponse(false, null, error);
		}
	}

	async getLastConversation() {
		console.log(`=> getLastConversation()...`)
		try {
			const querySnapshot = await getDoc(this.userRef)
			const lastConversation = querySnapshot.data().lastConversation
			return this.createResponse(true, lastConversation)
		}
		catch (error) { console.error("getLastConversation() failed") }
	}

	async getConversation() {
		console.log(`=> getConversation(${this.conversationId})...`);
		const conversationRef = doc(this.conversationsRef, this.conversationId);
		try {
			const conversationSnapshot = await getDoc(conversationRef);
			if (conversationSnapshot.exists()) {
				console.log(`Got conversation with ID: ${this.conversationId}`);
				const conversation = conversationSnapshot.data()
				const data = conversation
				return this.createResponse(true, data);
			} else {
				console.error(`Conversation with ID: ${this.conversationId} does not exist`);
				return this.createResponse(false, null, 'Conversation not found');
			}
		} catch (error) {
			console.error(`Error fetching conversation: ${error}`);
			return this.createResponse(false, null, error);
		}
	}

	async renameConversation(newName) {
		console.log(`=> renameConversation(${this.conversationId}, ${newName})...`);
		const conversationRef = doc(this.conversationsRef, this.conversationId);
		try {
			await updateDoc(conversationRef, {
				name: newName,
				updatedAt: Date.now(),
			});
			console.log(`Renamed conversation with ID: ${this.conversationId} to ${newName}`);
			return this.createResponse(true);
		} catch (error) {
			console.error(`Error renaming conversation: ${error}`);
			return this.createResponse(false, null, error);
		}
	}

	async deleteConversation() {
		console.log(`=> deleteConversation(${this.conversationId})...`);
		const conversationRef = doc(this.conversationsRef, this.conversationId);
		try {
			await deleteDoc(conversationRef);
			console.log(`Deleted conversation with ID: ${this.conversationId}`);
			return this.createResponse(true);
		} catch (error) {
			console.error(`Error deleting conversation: ${error}`);
			return this.createResponse(false, null, error);
		}
	}

	async updateConversation(updatedData) {
		console.log(`=> updateConversation(${this.conversationId})...`);
		const conversationRef = doc(this.conversationsRef, this.conversationId);
		try {
			await updateDoc(conversationRef, updatedData);
			console.log(`Updated conversation with ID: ${this.conversationId}`);
			return this.createResponse(true);
		} catch (error) {
			console.error(`Error updating conversation: ${error}`);
			return this.createResponse(false, null, error);
		}
	}

	async startConvoHere(creationTimeId) {
		console.log("startConvoHere()...")
		const getResponse = await this.getConversation()
		const oldChatHistory = getResponse.data.messages

		const stopHere = (creationTimeId, chatHistory) => {
			const newList = [];
			const removedList = [];  // <-- New array for removed messages

			let found = false;

			// Iterate backwards
			for (let i = chatHistory.length - 1; i >= 0; i--) {
				const message = chatHistory[i];

				if (message.creationTimeId === creationTimeId) {
					found = true;
					removedList.unshift(message)
					continue
				}

				if (found) {
					// Unshift to add the message at the beginning of the array
					newList.unshift(message);
				} else {
					// These messages are the ones that will be removed
					removedList.unshift(message); // <-- Populating removed messages
				}
			}

			return { newList, removedList };  // <-- Return both arrays
		};

		const { newList: newChatHistory, removedList: removedMessages } = stopHere(creationTimeId, oldChatHistory)

		const updateData = {
			messages: newChatHistory,
			messageCount: newChatHistory.length,
			totalTokenCount: openaiTokenCounter.chat(
				newChatHistory.map(message => ({ role: message.role, content: message.content })),
				"gpt-3.5-turbo"),
			updatedAt: Date.now(),
		}
		const updateResponse = await this.updateConversation(updateData)
		//console.log("OLD VS NEW CHAT HX:")
		//console.log(oldChatHistory, newChatHistory)
		const data = { newChatHistory, removedMessages }
		if (updateResponse.success) {
			return this.createResponse(true, data)
		}
		else { return this.createResponse(false) }
	}

	async saveMessage(sentMessage, conversationOptions) {
		console.log(`=> saveMessage()...`)
		const conversationRef = doc(this.conversationsRef, this.conversationId);

		const { systemMessage, staticMemory } = conversationOptions
		const updateData = {
			messages: arrayUnion(sentMessage),
			messageCount: increment(1),
			updatedAt: Date.now(),
		};
		if (systemMessage) {
			updateData.systemMessage = systemMessage
			console.log("updated system message")
		}
		if (staticMemory) {
			updateData.staticMemory = staticMemory
			console.log("updated static memory")
		}

		try {
			await updateDoc(conversationRef, updateData);
			//////// updating the user's last conversation
			const entireDocument = {
				lastConversation: this.conversationId,
			};
			await updateDoc(this.userRef, entireDocument);
			///////
			const docSnapshot = await getDoc(conversationRef); // Retrieve the updated data
			console.log(`Saved ${sentMessage.role} data to conversation with ID: ${this.conversationId}`);
			return this.createResponse(true, docSnapshot.data()); // Return the updated data
		} catch (error) {
			console.error(`Error saving ${sentMessage.role} message: ${error}`);
			return this.createResponse(false, null, error);
		}
	}

	trimChatHistory = (chatHistory, conversationOptions) => {
		let { limitType, chosenLimit } = conversationOptions
		limitType = "tokens"; chosenLimit = 12000 // Testing only

		console.log(`trimChatHistory(limit to ${chosenLimit} ${limitType})...`);
		//console.log({ chatHistory }); console.log({ conversationOptions })

		// Get the system message and remove it from chatHistory
		let systemMessage = chatHistory.find(message => message.role === 'system')

		chatHistory = chatHistory.filter(message => message.role !== 'system');
		//console.log("systemMessage:"); console.log(systemMessage)
		let currentTokenCount = 0;
		let totalMessageCount = 0;
		const removedMessages = [];
		if (systemMessage) {
			systemMessage.tokenCount = openaiTokenCounter.text(systemMessage.content, "gpt-3.5-turbo")
			currentTokenCount += systemMessage.tokenCount
			//console.log(`starting currentTokenCount:`, currentTokenCount)
		}

		// First, count the total tokens and messages
		chatHistory.forEach(message => {
			//console.log("message:", message)
			currentTokenCount += message.tokenCount || 0;
			totalMessageCount++;
			//console.log("current totalTokens:", currentTokenCount)
		});

		// Trim the messages from the front until the total is under or equal to the limit
		while (chatHistory.length > 0) {
			if ((limitType === 'tokens' && currentTokenCount <= chosenLimit) ||
				(limitType === 'messages' && totalMessageCount <= chosenLimit)) {
				break;
			}

			// Capture the first message to be removed
			const [removedMessage, ...otherMessages] = chatHistory;

			// Perform the actual removal
			chatHistory.shift();

			if (removedMessage.creationTimeId) {
				removedMessages.push(removedMessage);
				//console.log("removed message:", removedMessage.content);
			}
			currentTokenCount -= removedMessage.tokenCount || 0;
			totalMessageCount--;
		}

		if (systemMessage) {
			chatHistory.push(systemMessage)
		}
		let trimmedChatHistory = chatHistory
		const data = { trimmedChatHistory, removedMessages, currentTokenCount }
		return this.createResponse(true, data)
	}

	async getMessages() {
		console.log(`=> getMessages(${this.conversationId})...`);
		const conversationRef = doc(this.conversationsRef, this.conversationId);
		try {
			const conversationSnapshot = await getDoc(conversationRef);
			if (conversationSnapshot.exists()) {
				const messages = conversationSnapshot.data().messages;
				console.log(`Got ${messages.length} messages from conversation with ID: ${this.conversationId} `);
				return this.createResponse(true, messages);
			} else {
				console.error(`Conversation with ID: ${this.conversationId} does not exist`);
				return this.createResponse(false, null, 'Conversation not found');
			}
		} catch (error) {
			console.error(`Error fetching messages: ${error} `);
			return this.createResponse(false, null, error);
		}
	}

	async clearMessages() {
		console.log(`=> clearMessages(${this.conversationId})...`);
		const conversationRef = doc(this.conversationsRef, this.conversationId);
		try {
			await updateDoc(conversationRef, {
				messages: [],
				messageCount: { user: 0, assistant: 0 },
				userId: this.userId, // Why is this necessary?
				updatedAt: Date.now(),
			});
			console.log(`Cleared messages and reset count for conversation with ID: ${this.conversationId} `);
			return this.createResponse(true);
		} catch (error) {
			console.error(`Error clearing messages: ${error} `);
			return this.createResponse(false, null, error);
		}
	}

	async sendMessage(sentMessage, conversationOptions)
	// using streamResponse() instead
	/*
	{
		console.log("=> sendMessage()...")
		sentMessage.tokenCount = openaiTokenCounter.text(sentMessage.content, "gpt-3.5-turbo") // RQ'd for trimChatHistory()
		console.log(sentMessage, conversationOptions)


		const {
			systemMessage,
			staticMemory,
			model = "openai/gpt-3.5-turbo", // default model
			temperature,
			max_tokens
		} = conversationOptions;

		const getConversation_response = await this.getConversation()
		const conversation = getConversation_response.data.conversation
		let chatHistory = conversation.messages || []
		chatHistory.push(sentMessage)

		// Filter falsey values (eg, undefiended), join, and push to chatHistory
		let systemContent = [systemMessage, staticMemory]
			.filter(Boolean).join(' ')
		if (systemContent) {
			chatHistory.push({ role: 'system', content: systemContent });
		}

		// Trim down chatHistory for bot response to use
		//console.log("SENT MESSAGE:", sentMessage)
		let trimResponse
		trimResponse = this.trimChatHistory(chatHistory)
		let { trimmedChatHistory } = trimResponse.data
		//console.log("TRIMMED CHAT HX:", trimmedChatHistory)

		// API call
		trimmedChatHistory = trimmedChatHistory.map(message => ({ role: message.role, content: message.content }))
		console.log("CHAT CONTEXT:", trimmedChatHistory)
		const openai = new OpenAI({
			apiKey: "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",
			baseURL: "https://openrouter.ai/api/v1",
			defaultHeaders: {
				// this will be fixed later, this header is from the example code, the API breaks without a header?
				"HTTP-Referer": "https://github.com/OpenRouterTeam/openrouter-examples",
			},
		})
		const apiOptions = {
			messages: chatHistory.map(message => ({ role: message.role, content: message.content })),
			model,
			...(temperature && { temperature }),
			...(max_tokens && { max_tokens })
		};
		const completion = await openai.chat.completions.create(apiOptions)
		let botMessage = completion.choices[0].message
		console.log("botMessage:", botMessage)
		botMessage = {
			...botMessage,
			creationTimeId: `msg${Date.now().toString()}`,
			tokenCount: openaiTokenCounter.text(botMessage.content, "gpt-3.5-turbo")
		}

		//Save message data & update local chatHistory
		chatHistory.push(botMessage)
		await this.saveMessage(sentMessage, conversationOptions)
		await this.saveMessage(botMessage, conversationOptions)

		// plan is to include these in the response definition
		// [] add options from conversation to trimChatHistory()
		trimResponse = this.trimChatHistory(chatHistory)
		const { removedMessages } = trimResponse.data
		const { currentTokenCount } = trimResponse.data

		//prep final response
		let response = {
			...botMessage,
			removedMessages,
			currentTokenCount,
			messageCount: chatHistory.length,
			// firstMessage: (chatHistory.length > 3),
		}

		console.log("END sendMessage()")
		return this.createResponse(true, response)
	}
	*/ { console.error("not used") }

	async streamResponse(sentMessage, conversationOptions) {
		console.log("=> streamResponse()...");
		sentMessage = {
			...sentMessage,
			tokenCount: openaiTokenCounter.text(sentMessage.content, "gpt-3.5-turbo")
		}

		const {
			systemMessage,
			staticMemory,
			model = "gpt-3.5-turbo", //"openai/gpt-3.5-turbo"
			temperature,
			max_tokens,
			limitType,
			chosenLimit,
		} = conversationOptions;

		const responseData = await this.getConversation()
		const conversation = responseData.data
		let chatHistory = conversation.messages || []

		const trimResponse = this.trimChatHistory(chatHistory, conversationOptions)
		let { trimmedChatHistory } = trimResponse.data

		trimmedChatHistory.push(sentMessage)

		// Filter falsey values (eg, undefiended), join, and push to chatHistory
		// [] change to simply a 2nd system message that's sent
		let systemContent = [systemMessage, staticMemory]
			.filter(Boolean).join(`
	 
	 Extra context given by the user:
	`)
		if (systemContent) {
			trimmedChatHistory.push({ role: 'system', content: systemContent });
		}


		trimmedChatHistory = trimmedChatHistory.map(message => ({ role: message.role, content: message.content }))

		const openai_BACKUP = new OpenAI({
				apiKey: "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",
		})
		
		const openai = new OpenAI({
			apiKey: "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",
			baseURL: "https://openrouter.ai/api/v1",
			defaultHeaders: {
				// this will be fixed later, this header is from the example code, the API breaks without a header?
				"HTTP-Referer": "https://github.com/OpenRouterTeam/openrouter-examples",
			},
		})
		const apiOptions = {
			messages: trimmedChatHistory.map(message => ({ role: message.role, content: message.content })),
			model,
			stream: true,
			// only adding these if they were given & exist
			...(temperature && { temperature }),
			...(max_tokens && { max_tokens }),
		};

		console.log({apiOptions})
		
		const response = await openai.chat.completions.create(apiOptions)

		const stream = OpenAIStream(response, {
			onStart: async () => {
				console.log('Stream started');
				if (sentMessage.role !== "system") {
					await this.saveMessage(sentMessage, conversationOptions)
				}
			},
			onToken: async token => {
				console.log({token})
			},
			onCompletion: async completion => {
				console.log('Completion completed:', completion)
				const botResponse = {
					role: "assistant",
					content: completion,
					creationTimeId: sentMessage.responseMessageId,
					tokenCount: openaiTokenCounter.text(completion, "gpt-3.5-turbo"),
					messageCount: chatHistory.length,

				}
				console.log("TOKEN COUNT:", botResponse.tokenCount)
				await this.saveMessage(botResponse, conversationOptions)
			},
			onFinal: async completion => {
				console.log("Stream completed:", completion)
			},
		});
		return stream

	}

	async fetchAudio() {
		const audioStream = await PlayHT.stream(this.textStream)
	}

	sendMessageData(messageData) {
		return messageData;
	}

	async talkToAPI(sentMessage, conversationOptions = {}) {
		// Extract needed values from conversationOptions using destructuring
		const {
			systemMessage,
			staticMemory,
			model = "openai/gpt-3.5-turbo", // default model
			temperature,
			max_tokens
		} = conversationOptions;

		const openai = new OpenAI({
			apiKey: "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",
			baseURL: "https://openrouter.ai/api/v1",
			defaultHeaders: {
				// this will be fixed later, this header is from the example code, the API breaks without a header?
				"HTTP-Referer": "https://github.com/OpenRouterTeam/openrouter-examples",
			},
		})

		// Construct the initial chatHistory array with the message.
		let chatHistory = [sentMessage];

		// Construct the system message
		let systemContent = [systemMessage, staticMemory]
			// filter falsey values (eg, undefiended) & join
			.filter(Boolean).join(' ')
		if (systemContent) {
			chatHistory.push({ role: 'system', content: systemContent });
		}

		console.log("TALK TO API CHAT HX:", chatHistory)

		// Construct API call params using spread for optionals.
		const apiOptions = {
			messages: chatHistory.map(message => ({ role: message.role, content: message.content })),
			model,
			...(temperature && { temperature }),
			...(max_tokens && { max_tokens })
		};

		// Make the API call
		const completion = await openai.chat.completions.create(apiOptions);
		const botMessage = completion.choices[0].message


		return this.createResponse(true, botMessage)
	}

}