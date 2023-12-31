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


const backupApiKey = process.env['apikey']
const openai_BACKUP = new OpenAI({
				apiKey: backupApiKey,
		});
const modelToUse = "gpt-3.5-turbo"
// openAI = gpt-3.5-turbo || gpt-4-1106-preview
// openRouter = openai/gpt-3.5-turbo

let openai = new OpenAI({
        apiKey: "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",
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
            "HTTP-Referer": "https://github.com/OpenRouterTeam/openrouter-examples",
        },
    });

openai = openai_BACKUP



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
		console.log("createDocument()");
		const docSnap = await getDoc(this.userRef);

		if (!docSnap.exists()) {
			const blankDocument = {
				userId: this.userId,
			};

			await setDoc(this.userRef, blankDocument);
			console.log(`createDocument() -> Created document with userId: ${this.userId}`);
			console.log("createDocument() -> END")
			return this.createResponse(true);
		} else {
			console.log(`createDocument() -> A document with userId: ${this.userId} already exists.`);
			console.log("createDocument() -> END")
			return this.createResponse(true);
		}
	}

	async createConversation() {
		console.log("createConversation()");
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
				console.log(`createConversation() -> Created conversation with ID: ${this.conversationId}`);
				console.log("createConversation() -> END");
				return this.createResponse(true);
			} 
			else {
				console.log("createConversation() -> Conversation already exists");
				console.log("createConversation() -> END");
				return this.createResponse(false, null, `Conversation already exists, conversationId: ${this.conversationId}`);
			}

		} 
		catch (error) {
			console.error(`createConversation() -> Error creating conversation: ${error}`);
			console.log("createConversation() -> END");
			return this.createResponse(false, null, error);
		}
	}

	async updateSettings(userSettings) {
		console.log("updateSettings()");
		try {
			console.log("updateSettings() -> settings:", userSettings)
			await updateDoc(this.userRef, "settings", userSettings);
			console.log("updateSettings() -> Settings updated successfully");
			console.log("updateSettings() -> END");
			return this.createResponse(true)
		} catch (error) {
			console.error("updateSettings() -> Error updating settings:", error);
			console.log("updateSettings() -> END");
		}
	}

	async getSettings() {
		console.log("getSettings()");
		try {
			const snapShot = await getDoc(this.userRef, "settings")
			console.log("getSettings() -> Got settings successfully")
			
			const doc = snapShot.data() // why isn't this settings already?
			const settings = doc.settings
			console.log("getSettings() -> settings:", settings)
			console.log("getSettings() -> END")
			return this.createResponse(true, settings)
		} catch (error) {
			console.error("getSettings() -> Error getting settings:", error);
			console.log("getSettings() -> END");
		}
	}

	async getConversations() {
		console.log("getConversations()");
		try {
			const querySnapshot = await getDocs(this.conversationsRef);
			const conversations = querySnapshot.docs.map(doc => doc.data());
			console.log(`getConversations() -> Fetched ${conversations.length} conversation(s)`);
			console.log("getConversations() -> END");
			return this.createResponse(true, conversations);
		} catch (error) {
			console.error(`getConversations() -> Error fetching conversations: ${error}`);
			console.log("getConversations() -> END");
			return this.createResponse(false, null, error);
		}
	}

	async getLastConversation() {
		console.log("getLastConversation()");
		try {
			const querySnapshot = await getDoc(this.userRef);
			const lastConversation = querySnapshot.data().lastConversation;
			console.log("getLastConversation() -> Got last conversation:", lastConversation);
			console.log("getLastConversation() -> END");
			return this.createResponse(true, lastConversation);
		} catch (error) {
			console.error("getLastConversation() -> Error fetching last conversation:", error);
			console.log("getLastConversation() -> END");
			return this.createResponse(false, null, error);
		}
	}

	async getConversation() {
		console.log(`getConversation(${this.conversationId})`);
		console.log("getConversation() -> createConversation()... HOTFIX")
		// the createConversation hotfix should go in the else statement vs everytime
		await this.createConversation()
		const conversationRef = doc(this.conversationsRef, this.conversationId);
		try {
			const conversationSnapshot = await getDoc(conversationRef);
			if (conversationSnapshot.exists()) {
				console.log(`getConversation(${this.conversationId}) -> Got conversation with ID: ${this.conversationId}`);
				const conversation = conversationSnapshot.data();
				const data = conversation;
				console.log(`getConversation(${this.conversationId}) -> END`);
				return this.createResponse(true, data);
			} 
			else {
				console.error(`getConversation(${this.conversationId}) -> Conversation with ID: ${this.conversationId} does not exist.`);
				console.log(`getConversation(${this.conversationId}) -> END`);
				return this.createResponse(false, null, 'Conversation not found');
			}
		} catch (error) {
			console.error(`getConversation(${this.conversationId}) -> Error fetching conversation: ${error}`);
			console.log(`getConversation(${this.conversationId}) -> END`);
			return this.createResponse(false, null, error);
		}
	}

	async renameConversation(newName) {
    console.log(`renameConversation(${this.conversationId}, ${newName})`);
    const conversationRef = doc(this.conversationsRef, this.conversationId);
    try {
        await updateDoc(conversationRef, {
            name: newName,
            updatedAt: Date.now(),
        });
        console.log(`renameConversation(${this.conversationId}, ${newName}) -> Renamed conversation with ID: ${this.conversationId} to ${newName}`);
        console.log(`renameConversation(${this.conversationId}, ${newName}) -> END`);
        return this.createResponse(true);
    } catch (error) {
        console.error(`renameConversation(${this.conversationId}, ${newName}) -> Error renaming conversation: ${error}`);
        console.log(`renameConversation(${this.conversationId}, ${newName}) -> END`);
        return this.createResponse(false, null, error);
    }
}

async deleteConversation() {
    console.log(`deleteConversation(${this.conversationId})`);
    const conversationRef = doc(this.conversationsRef, this.conversationId);
    try {
        await deleteDoc(conversationRef);
        console.log(`deleteConversation(${this.conversationId}) -> Deleted conversation with ID: ${this.conversationId}`);
        console.log(`deleteConversation(${this.conversationId}) -> END`);
        return this.createResponse(true);
    } catch (error) {
        console.error(`deleteConversation(${this.conversationId}) -> Error deleting conversation: ${error}`);
        console.log(`deleteConversation(${this.conversationId}) -> END`);
        return this.createResponse(false, null, error);
    }
}

async updateConversation(updatedData) {
    console.log(`updateConversation(${this.conversationId})`);
    const conversationRef = doc(this.conversationsRef, this.conversationId);
    try {
        await updateDoc(conversationRef, updatedData);
        console.log(`updateConversation(${this.conversationId}) -> Updated conversation with ID: ${this.conversationId}`);
        console.log(`updateConversation(${this.conversationId}) -> END`);
        return this.createResponse(true);
    } catch (error) {
        console.error(`updateConversation(${this.conversationId}) -> Error updating conversation: ${error}`);
        console.log(`updateConversation(${this.conversationId}) -> END`);
        return this.createResponse(false, null, error);
    }
}


	async startConvoHere(creationTimeId) {
			console.log(`startConvoHere(${creationTimeId})`);

			// Get the existing conversation data
			const getResponse = await this.getConversation();
			const oldChatHistory = getResponse.data.messages;

			// Define a function to stop at the specified creationTimeId
			const stopHere = (creationTimeId, chatHistory) => {
					const newList = [];
					const removedList = []; // New array for removed messages
					let found = false;

					// Iterate backwards through the chat history
					for (let i = chatHistory.length - 1; i >= 0; i--) {
							const message = chatHistory[i];

							if (message.creationTimeId === creationTimeId) {
									found = true;
									removedList.unshift(message);
									continue;
							}

							if (found) {
									// Unshift to add the message at the beginning of the array
									newList.unshift(message);
							} else {
									// These messages are the ones that will be removed
									removedList.unshift(message); // Populating removed messages
							}
					}

					return { newList, removedList }; // Return both arrays
			};

			// Apply the stopHere function to get the new chat history and removed messages
			const { newList: newChatHistory, removedList: removedMessages } = stopHere(creationTimeId, oldChatHistory);

			// Prepare the update data for the conversation
			const updateData = {
					messages: newChatHistory,
					messageCount: newChatHistory.length,
					totalTokenCount: openaiTokenCounter.chat(
							newChatHistory.map((message) => ({ role: message.role, content: message.content })),
							"gpt-3.5-turbo"
					),
					updatedAt: Date.now(),
			};

			// Update the conversation with the new data
			const updateResponse = await this.updateConversation(updateData);

			const data = { newChatHistory, removedMessages };

			if (updateResponse.success) {
					console.log(`startConvoHere(${creationTimeId}) -> Success`);
					console.log(`startConvoHere(${creationTimeId}) -> END`);
					return this.createResponse(true, data);
			} else {
					console.error(`startConvoHere(${creationTimeId}) -> Update conversation failed`);
					console.log(`startConvoHere(${creationTimeId}) -> END`);
					return this.createResponse(false);
			}
	}


	async saveMessage(sentMessage, conversationOptions) {
    console.log("saveMessage()");
    const conversationRef = doc(this.conversationsRef, this.conversationId);

    const { systemMessage, staticMemory } = conversationOptions;
    const updateData = {
        messages: arrayUnion(sentMessage),
        messageCount: increment(1),
        updatedAt: Date.now(),
    };

    if (systemMessage) {
        updateData.systemMessage = systemMessage;
        console.log("saveMessage() -> Updated system message");
    }
    if (staticMemory) {
        updateData.staticMemory = staticMemory;
        console.log("saveMessage() -> Updated static memory");
    }

    try {
        await updateDoc(conversationRef, updateData);


        const docSnapshot = await getDoc(conversationRef); // Retrieve the updated data
        console.log(`saveMessage() -> Saved ${sentMessage.role} data to conversation with ID: ${this.conversationId}`);
        console.log("saveMessage() -> END");
        return this.createResponse(true, docSnapshot.data()); // Return the updated data
    } catch (error) {
        console.error(`saveMessage() -> Error saving ${sentMessage.role} message: ${error}`);
        console.log("saveMessage() -> END");
        return this.createResponse(false, null, error);
    }
}

	trimChatHistory = (chatHistory, conversationOptions) => {
    console.log("trimChatHistory()");
    let { limitType, chosenLimit } = conversationOptions;
    limitType = "tokens"; // For testing purposes only
    chosenLimit = 12000; // For testing purposes only

    console.log(`trimChatHistory() -> Limit set to ${chosenLimit} ${limitType}...`);
    //console.log({ chatHistory }); console.log({ conversationOptions })

    // Get the system message and remove it from chatHistory
    let systemMessage = chatHistory.find(message => message.role === 'system');

    chatHistory = chatHistory.filter(message => message.role !== 'system');
    //console.log("systemMessage:"); console.log(systemMessage);
    let currentTokenCount = 0;
    let totalMessageCount = 0;
    const removedMessages = [];
    if (systemMessage) {
        systemMessage.tokenCount = openaiTokenCounter.text(systemMessage.content, "gpt-3.5-turbo");
        currentTokenCount += systemMessage.tokenCount;
        console.log(`trimChatHistory() -> Starting currentTokenCount:`, currentTokenCount);
    }

    // First, count the total tokens and messages
    chatHistory.forEach(message => {
        //console.log("message:", message);
        currentTokenCount += message.tokenCount || 0;
        totalMessageCount++;
        //console.log("Current totalTokens:", currentTokenCount);
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
            console.log("trimChatHistory() -> Removed message:", removedMessage.content);
        }
        currentTokenCount -= removedMessage.tokenCount || 0;
        totalMessageCount--;
    }

    if (systemMessage) {
        chatHistory.push(systemMessage);
    }
    let trimmedChatHistory = chatHistory;
    const data = { trimmedChatHistory, removedMessages, currentTokenCount };
    console.log("trimChatHistory() -> END");
    return this.createResponse(true, data);
}


	async getMessages() {
    console.log(`getMessages(${this.conversationId})`);
    const conversationRef = doc(this.conversationsRef, this.conversationId);
    try {
        const conversationSnapshot = await getDoc(conversationRef);
        if (conversationSnapshot.exists()) {
            const messages = conversationSnapshot.data().messages;
            console.log(`getMessages() -> Got ${messages.length} messages from conversation with ID: ${this.conversationId}`);
            console.log("getMessages() -> END");
            return this.createResponse(true, messages);
        } else {
            console.error(`getMessages() -> Conversation with ID: ${this.conversationId} does not exist`);
            console.log("getMessages() -> END");
            return this.createResponse(false, null, 'Conversation not found');
        }
    } catch (error) {
        console.error(`getMessages() -> Error fetching messages: ${error}`);
        console.log("getMessages() -> END");
        return this.createResponse(false, null, error);
    }
}

async clearMessages() {
    console.log(`clearMessages(${this.conversationId})`);
    const conversationRef = doc(this.conversationsRef, this.conversationId);
    try {
        await updateDoc(conversationRef, {
            messages: [],
            messageCount: { user: 0, assistant: 0 },
            userId: this.userId, // Why is this necessary?
            updatedAt: Date.now(),
        });
        console.log(`clearMessages() -> Cleared messages and reset count for conversation with ID: ${this.conversationId}`);
        console.log("clearMessages() -> END");
        return this.createResponse(true);
    } catch (error) {
        console.error(`clearMessages() -> Error clearing messages: ${error}`);
        console.log("clearMessages() -> END");
        return this.createResponse(false, null, error);
    }
}


	async sendMessage(sentMessage, conversationOptions)
	// using streamResponse() instead
	/*
	{
		console.log("=> sendMessage()")
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
    console.log("streamResponse()");
    console.log("streamResponse() -> Given:", { sentMessage }, { conversationOptions });
    sentMessage = {
        ...sentMessage,
        tokenCount: openaiTokenCounter.text(sentMessage.content, "gpt-3.5-turbo"),
    };

    const {
        systemMessage,
        staticMemory,
        model = modelToUse,
        temperature,
        max_tokens,
        limitType,
        chosenLimit,
    } = conversationOptions;

    const responseData = await this.getConversation();
    const conversation = responseData.data;
    let chatHistory = conversation.messages || [];

    const trimResponse = this.trimChatHistory(chatHistory, conversationOptions);
    let { trimmedChatHistory } = trimResponse.data;

    trimmedChatHistory.push(sentMessage);

    // Filter falsey values (eg, undefined), join, and push to chatHistory
    // [] change to simply a 2nd system message that's sent
    let systemContent = [systemMessage, staticMemory]
        .filter(Boolean)
        .join(`
        
    Extra context given by the user:
    `);
    if (systemContent) {
        trimmedChatHistory.push({ role: 'system', content: systemContent });
    }

    trimmedChatHistory = trimmedChatHistory.map(message => ({ role: message.role, content: message.content }));

    

    
		
    const apiOptions = {
        messages: trimmedChatHistory.map(message => ({ role: message.role, content: message.content })),
        model,
        stream: true,
        ...(temperature && { temperature }),
        ...(max_tokens && { max_tokens }),
    };

    console.log({ apiOptions });

    const response = await openai.chat.completions.create(apiOptions);

    const stream = OpenAIStream(response, {
        onStart: async () => {
            console.log('stream.onStart() -> Stream started');
            if (sentMessage.role !== "system") {
                await this.saveMessage(sentMessage, conversationOptions);
            }
        },
        onToken: async token => {
						//console.log("stream.onToken -> token:")
            //console.log({ token });
        },
        onCompletion: async completion => {
            //console.log('stream.onCompletion() -> Completion completed:', completion);
            const botResponse = {
                role: "assistant",
                content: completion,
                creationTimeId: sentMessage.responseMessageId,
                tokenCount: openaiTokenCounter.text(completion, "gpt-3.5-turbo"),
                messageCount: chatHistory.length,
            };
            //console.log("stream.onCompletion -> token count:", botResponse.tokenCount);
            await this.saveMessage(botResponse, conversationOptions);
        },
        onFinal: async completion => {
            //console.log("stream.onFinal() -> Stream completed:", completion);
        },
    });
    console.log("streamResponse() -> END");
    return stream;
}


	async fetchAudio() {
		console.log("fetchAudio() -> PlayHT.stream(this.textStream)...")
		const audioStream = await PlayHT.stream(this.textStream)
	}

	sendMessageData(messageData) {
		console.log("sendMessageData()")
		return messageData;
	}

	async talkToAPI(sentMessage, conversationOptions = {}) {
    console.log("talkToAPI()");
    console.log("talkToAPI() -> Given:", { sentMessage }, { conversationOptions });

    // Extract needed values from conversationOptions using destructuring
    const {
        systemMessage,
        staticMemory,
        model = modelToUse, //"openai/gpt-3.5-turbo", // default model
        temperature,
        max_tokens
    } = conversationOptions;

   

    // Construct the initial chatHistory array with the message.
    let chatHistory = [sentMessage];

    // Construct the system message
    let systemContent = [systemMessage, staticMemory]
        // filter falsey values (eg, undefined) & join
        .filter(Boolean)
        .join(' ');
    if (systemContent) {
        chatHistory.push({ role: 'system', content: systemContent });
    }

    console.log("talkToAPI() -> TALK TO API CHAT HX:", chatHistory);

    // Construct API call params using spread for optionals.
    const apiOptions = {
        messages: chatHistory.map(message => ({ role: message.role, content: message.content })),
        model,
        ...(temperature && { temperature }),
        ...(max_tokens && { max_tokens })
    };

    // Make the API call
    const completion = await openai.chat.completions.create(apiOptions);
    const botMessage = completion.choices[0].message;

    console.log("talkToAPI() -> END");
    return this.createResponse(true, botMessage);
}


}