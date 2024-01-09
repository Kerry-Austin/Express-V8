/** BUGS & TODO LIST
[] Assistant joke messages play back incomplete audio. The problem could be the new line or with the semi colon that's included. Upon further testing, it's most likely the semicolon.
		"Sure, here's a lighthearted joke for you:\n" +
		"Why don't scientists trust atoms?\n" +
		'Because they make up everything!
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
import { jsonrepair } from 'jsonrepair'
import fetch from 'node-fetch';
import { Readable } from 'stream';

const backupApiKey = process.env['apiKey']
console.log({ backupApiKey })
const openai_BACKUP = new OpenAI({
	apiKey: backupApiKey,
});
const modelToUse = "gpt-3.5-turbo"
// openAI = gpt-3.5-turbo || gpt-4-1106-preview
// openRouter = openai/gpt-3.5-turbo

// let company = (openai || openRouter || whatever)
let openai = new OpenAI({ // openai -> llmProvider
	// if (company === openai, etc) {apiKey, etc}
	apiKey: "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",
	baseURL: "https://openrouter.ai/api/v1",
	defaultHeaders: {
		"HTTP-Referer": "https://github.com/OpenRouterTeam/openrouter-examples",
	},
});

openai = openai_BACKUP

function makeNewClient() {
	return new OpenAI({
		apiKey: backupApiKey,
	});
}


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
	constructor(location, socket = null) {
		this.userId = location.userId.toString();
		this.conversationId = location.conversationId.toString();
		this.userRef = doc(db, 'ConversationsByUser', this.userId);
		this.conversationsRef = collection(this.userRef, 'conversations');
		console.log(`=====> New Instance created, userId: ${this.userId} conversationId: ${this.conversationId}`);
		this.socket = socket
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

	async updateThoughtProcess(updatedThoughtProcess) {
		console.log("updateThoughtProcess()")
		try {
			const conversationRef = doc(this.conversationsRef, this.conversationId);
			await updateDoc(conversationRef, {
				thoughtProcess: updatedThoughtProcess,
				updatedAt: Date.now(),
			});
		}
		catch (error) {
			console.error("updateThoughtProcess() -> failed")
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

	async getThoughtProcess() {
		console.log("getThoughtProcess()")
		try {
			const conversationRef = doc(this.conversationsRef, this.conversationId);
			const snapShot = await getDoc(conversationRef)
			const conversation = snapShot.data()
			const thoughtProcess = conversation.thoughtProcess
			//console.log({ conversation })
			//console.log({ thoughtProcess })
			if (!thoughtProcess) {
				const empty_thoughtProcess = {
					userInstructions: "",
					objective: "",
					objectiveStatement: "",
					plan: [],
					planStatement: ""
				}
				return empty_thoughtProcess
			}
			else {
				return thoughtProcess
			}
		}
		catch (error) {
			console.error("getThoughtProcess() -> failed")
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

	async reasoningEngine(apiOptions) {
		console.log("************************************************************")
		console.log("reasoningEngine()")
		console.log("reasoningEngine() -> getThoughtProcess()...")
		this.socket.emit("progressMessage", { message: "REASONING ENGINE!!!!" })
		//[] delete method from class
		//let original_thoughtProcess = await this.getThoughtProcess()

		let toolBox = [
			// talk
			{
				type: "function",
				function: {
					name: "talk",
					description: "Asks the user a question to learn more about their wants and/or needs, or gives information to the user. ALL commuincation to the user is done with this function.",
					parameters: {
						type: "object",
						properties: {
							message: {
								type: "string",
								description: `The question, statement, or information the assitant should tell the user. It is an instruction for another AI agent and should be worded as such. For example, instead of, "How's your day going?" it should be "Ask the user how their day is going."`
							},
						},
						required: ["message"],
					},
				},
			},
			// get_joke_text
			/*
			{
				type: "function",
				function: {
					name: "get_joke_text",
					description: "Retrieve a random joke's setup and punchline. Only use if a joke is asked for. The setup should be told first, then the punchline AFTER the user responds.",
					parameters: {
						type: "object",
						properties: {},
						required: []
					}
				}
			},
			*/

		];
		//toolBox = []
		const toolBoxNames = toolBox.map(object => object.function.name);
		// array -> eg ["calculator", "get_weather", "google_search"]

		let toolString = ``
		toolBox.forEach(tool => {
			toolString += `Tool name: ${tool.function.name}:\nDescription: ${tool.function.description}\n\n`
		})
		let toolsAvailable = `\n\n${toolString}\n\n`
		if (toolString === "") { toolsAvailable = "N/A" }
		console.log({ toolsAvailable })

		const apiConfig = { ...apiOptions }
		//console.log({ apiConfig })
		apiConfig.model = "gpt-3.5-turbo-1106"
		// gpt-4-1106-preview 
		// gpt-3.5-turbo-1106


		// Definitions
		const allMessages = apiConfig.messages
		//console.log({ allMessages })
		const systemMessages = apiConfig.messages.filter(message => message.role === "system");
		//console.log({ systemMessages })
		const messageHistory = apiConfig.messages.filter(message => message.role !== "system");
		//console.log({ messageHistory })
		const lastUserMessage = [...messageHistory].reverse().find(message => message.role === "user");
		//console.log({lastUserMessage})


		let userInstructions = ``
		if (systemMessages) {
			systemMessages.forEach(systemMessage => {
				userInstructions += `\n${systemMessage.content}`
			})
		}


		// Functions
		async function agentCore(instructions = "", messageHistory = [], apiConfig, tools = []) {
			const { model } = apiConfig
			if (tools.length === 0) {
				console.log("agentCore() -> tools.length = 0")
				if (instructions) {
					const command = { role: "system", content: instructions }
					messageHistory.push(command)
				}
				const completion = await openai.chat.completions.create({
					messages: messageHistory,
					model: model,
				});
				const botMessage = completion.choices[0].message
				//console.log({ botMessage })
				return botMessage
			}
			if (tools.length === 1) {
				console.log("agentCore() -> tools.length = 1")
				//console.log(`TOOL: ${tools[0].function.name}`)
				if (instructions) {
					const command = { role: "system", content: instructions }
					messageHistory.push(command)
				}
				if (apiConfig.streamResponse === true) {
					const stream = await openai.chat.completions.create({
						messages: messageHistory,
						model: model,
						tools: tools,
						stream: true,
						tool_choice: { type: "function", function: { name: `${tools[0].function.name}` } },
					});
					return stream
				}
				const completion = await openai.chat.completions.create({
					messages: messageHistory,
					model: model,
					tools: tools,
					tool_choice: { type: "function", function: { name: `${tools[0].function.name}` } },
				});
				const functionCall = completion.choices[0].message.tool_calls[0].function
				//console.log({ functionCall })
				const action = {}
				action.name = functionCall.name
				action.arguments = JSON.parse(jsonrepair(functionCall.arguments))
				//console.log({ action })
				return action
			}
			if (tools.length > 1) {
				console.log("agentCore() -> tools.length > 1")
				const command = { role: "system", content: instructions }
				const messageHistory_copy = [command, ...messageHistory]
				// hard copy to avoid a double command push on re-run
				const arrayOfGivenToolNames = tools.map(object => object.function.name);
				// array -> eg ["calculator", "get_weather", "google_search"]
				const selectorAgent = {
					type: "function",
					function: {
						name: 'select_action',
						description: 'Selects an action',
						parameters: {
							type: 'object',
							properties: {
								reasoning: {
									type: 'string',
									description: 'The reasoning behind the selection of an action'
								},
								action: {
									type: 'string',
									enum: arrayOfGivenToolNames,
									description: 'Action name to accomplish a task'
								}
							},
							required: ['reasoning', 'action']
						}
					}
				}
				const completion = await openai.chat.completions.create({
					messages: messageHistory_copy,
					model: model,
					tools: [selectorAgent],
					tool_choice: { type: "function", function: { "name": `${selectorAgent.function.name}` } },

				});
				const functionCall = completion.choices[0].message.tool_calls[0].function
				const selectedAction = JSON.parse(jsonrepair(functionCall.arguments))
				console.log({ selectedAction })
				const selectedTool = toolBox.filter((tool) => {
					return tool.function.name === selectedAction.action
				})
				const action = await agentCore(instructions, messageHistory, apiConfig, selectedTool)
				return action
			}
		}
		async function getAgentInstructions(agentRole, thoughtProcessLog) {
			
			const thoughtProcessLogString = convertThoughtProcessLogToString(thoughtProcessLog)
			const agentInstructions = {
				instructions:
					`As part of an advanced decision-making system, your role is crucial in processing the user's input and contributing to the system's overall response. This system operates on a Think and Act loop, where agents like you collaborate to generate thoughts, execute actions, and observe the outcomes. 

			The Thought Process Log is a critical component of this system. It records the sequence of thoughts, actions, and observations made by the agents throughout the decision-making process. Your contributions to this log are essential for maintaining a coherent and context-aware interaction with the user.

			- Thought Process Log: A dynamic record of the system's thought process, actions taken, and their results. Each entry in the log helps inform subsequent decisions and actions.

			- Agents in the System:
			- Thinking Agent: Responsible for analyzing the current situation and determining the next logical step.
			- Acting Agent: Executes actions based on the thinking agent's decisions.
			- Observing Agent: Observes and logs the outcomes of actions taken.
			- Responding Agent: Reviews the Thought Process Log to formulate the final response to the user.

			Tools Available: ${toolsAvailable}
			These are the tools at your disposal, each designed for specific functions within the system. Select the appropriate tool based on the current need and your specific role.

			User Instructions: ${userInstructions}
			These instructions from the user guide how the assistant should behave and respond. It's crucial to align your actions with these expectations for an effective and satisfactory user experience.

			Your specific role in this process is to ${agentRole}. Utilize the Thought Process Log, the available tools, and the user instructions to guide your actions and contribute effectively to the assistant's response.

			Current Thought Process Log:
			${thoughtProcessLogString}

			This is the current state of the Thought Process Log, which includes all previous thoughts, actions, and observations. Use this information to understand the context of your decision-making and actions within the loop.
			`}
			return agentInstructions.instructions
		}
		function convertThoughtProcessLogToString(thoughtProcessLog) {
			return thoughtProcessLog.map(item => {
				if (item.thought) {
					return `Thought: ${item.thought}`;
				} else if (item.action) {
					return `Action: ${item.action}`;
				} else if (item.observation) {
					return `Observation: ${item.observation}`;
				}
			}).join('\n');
		}
		const showClientThoughtProcess = (thoughtProcess) => {
			const thoughtProcessString = convertThoughtProcessLogToString(thoughtProcess)
			this.socket.emit("progressMessage", { message: thoughtProcessString })
		}

		async function referenceFunctions() {
			async function objectiveAgent(previousObjective = "", feedback = "") {
				const objectiveMaker = [
					{
						type: "function",
						function: {
							name: "Determine_Objective",
							description: "Provides an objective for the AI assistant's next response to the user. The objective should be about 3 sentences.",
							parameters: {
								type: "object",
								properties: {
									objective: {
										type: "string",
										description: "The objective for the AI assistant's next response.",
									},
									reasoning: {
										type: "string",
										description: "The reasoning behind the objective",
									},
								},
								required: ["objective", "reasoning"],
							},
						},
					}
				]
				//console.log({ userInstructions })
				if (previousObjective) {
					previousObjective = `\n\nThe previous objective has be given for addtional context:\n\n--- BEGIN LAST OBJECTIVE ---\n\n${previousObjective}\n\n--- END LAST OBJECTUVE ---\n\n`
				}
				if (feedback) {
					feedback = `\n\nA seperate ai agent designed to provide assistance has the current feedback for creating the new objective: "${feedback}"\n\n`
				}
				const commandPrompt = `You are part of a decision making system. Your goal is to examine the conversation and provide an objective for the AI assistant's next response to the user. The objective should be about 3 sentences.${userInstructions}${previousObjective}${feedback}\n\nMake sure to follow the instructions given by the user when making the new objective.`

				const response = await agentCore(`${commandPrompt}`, messageHistory, apiConfig, objectiveMaker)
				//console.log({ response })
				objective = response.arguments.objective
				//console.log({ objectiveObject: response.arguments })
				objectiveStatement = `\n\nThe assistant has this current objective:\n\n--- BEGIN CURRENT OBJECTIVE ---\n\n${objective}\n\n--- END CURRENT OBJECTIVE ---\n\n`
				return objective
			}
			async function planningAgent(previousPlan = "", feedback = "") {
				const planMaker = [
					{
						type: "function",
						function: {
							name: "Create_Plan",
							description: "Executes a step-by-step plan to achieve a given objective. This function is given a series of actionable steps, each with specific instructions, based on the identified objective.",
							parameters: {
								type: "object",
								properties: {
									plan: {
										type: "array",
										items: {
											type: "object",
											properties: {
												stepNumber: {
													type: "integer",
													description: "The sequential number of the step in the plan."
												},
												tool: {
													type: 'string',
													enum: toolBoxNames,
													description: 'Name of the tool used to accomplish the task'
												},
												instructions: {
													type: "string",
													description: "Guidance for executing this specific step, outlining the approach but not the actual content."
												},
												content: {
													type: "string",
													description: "The actual content to be used or communicated in this step, separate from the execution instructions."
												},

											},
											required: ["stepNumber", "instructions", "tool", "content"]
										},
										description: "An array of steps, each an object with a step number, corresponding instructions, and content."
									}
								},
								required: ["plan"]
							}
						}
					}
				]


				//console.log({ userInstructions })
				let isPlanValid = false;

				let attempts = 0
				while (isPlanValid === false) {
					// If previousPlan is not empty, format it for the command prompt
					if (previousPlan) {
						let oldPlanString = ``;
						previousPlan.forEach(step => {
							oldPlanString += `Step ${step.stepNumber}: ${step.instructions}\nTool to use: ${step.tool}\nResult: ${step.result}\n\n`;
						});
						previousPlan = `\n\nThe previous plan has been given for additional context:\n\n--- BEGIN PREVIOUS PLAN ---\n\n${oldPlanString}\n\n--- END PREVIOUS PLAN ---\n\n`;
					}

					// If there's feedback, format it for the command prompt
					if (feedback) {
						feedback = `\n\nA separate AI agent designed to provide assistance has the current feedback for creating the new objective: "${feedback} Avoid repeating the same action or question as before unless necessary."\n\n`;
					}

					// Construct the command prompt
					const commandPrompt = `You are part of a decision-making system. Your goal is to examine the conversation and provide a plan for an AI assistant's next response to it's user. Consider if the content or context requires user interaction and plan accordingly. ${previousPlan}${feedback}${userInstructions}${objectiveStatement}${toolsAvailable}\n\nThe new plan should end with the assistant talking to the user, and may include steps requiring user responses.`

					// Talk to the bot and get the response
					const response = await agentCore(`${commandPrompt}`, messageHistory, apiConfig, planMaker);
					plan = response.arguments.plan;

					// Check if the last step is 'talk'
					const lastStep = plan[plan.length - 1];
					if (lastStep.tool === "talk") {
						attempts += 1
						isPlanValid = true;
						console.log({ attempts }, `Plan ends with "talk", good to go!`);
					} else {
						attempts += 1
						feedback = "The last step didn't end with the talk action. Ensure the final action in the plan is 'talk'.";
						previousPlan = plan
						console.log({ attempts }, `Trying again....`)
					}
				}

				plan = plan.map(step => {
					step.result = "Step not completed yet."
					return step
				})
				//console.log({ "Plan per agent": plan })
				let planString = ``
				plan.forEach(step => {
					planString += `Step ${step.stepNumber}: ${step.instructions}\nTool to use: ${step.tool}\nResult: ${step.result}\n\n`
				})
				//console.log({ planString })
				planStatement = `\n\nThe assistant has created the following plan:\n\n--- BEGIN CURRENT PLAN ---\n\n${planString}\n\n--- END CURRENT PLAN ---\n\n`
				return plan
			}
		}

		let placeholder = null
		async function thinkingAgent(thoughtProcess) {
			const thinkingTool = [{
				"type": "function",
				"function": {
					"name": "Determine_Next_Step",
					"description": "Decides what the AI assistant needs to do next to progress towards answering the user's query.",
					"parameters": {
						"type": "object",
						"properties": {
							"latestObservation": {
								"type": "string",
								"description": "The most recent observation or result from the last action."
							},
							"nextThought": {
								"type": "string",
								"description": "The next logical thought or step in the process."
							}
						},
						"required": ["latestObservation", "nextThought"]
					}
				}
			}
			]
			const agentRoleThinking = "analyze the current situation and determine the next logical step in the assistant's response process. As the Thinking Agent, utilize the Thought Process Log, the available tools, and the user instructions to guide your decisions and contribute effectively to the assistant's response.";
			const instructions = await getAgentInstructions(agentRoleThinking, thoughtProcess)
			const thinkingResponse = await agentCore(instructions, messageHistory, apiConfig, thinkingTool)
			console.log({ "Thinking agent response": thinkingResponse.arguments })
			const thought = { thought: thinkingResponse.arguments.nextThought }
			return thought
		}
		async function actingAgent(thoughtProcess) {
			const actingTool = [{
				"type": "function",
				"function": {
					"name": "Execute_Action",
					"description": "Performs the action decided by the Thinking Agent.",
					"parameters": {
						"type": "object",
						"properties": {
							"action": {
								"type": "string",
								"description": "The action to be executed."
							},
							"input": {
								"type": "string",
								"description": "The input required for the action."
							}
						},
						"required": ["action", "input"]
					}
				}
			}
			]
			const agentRoleActing = "execute the action determined by the Thinking Agent, utilizing the appropriate tool. As the Acting Agent, use the information from the Thought Process Log and user instructions to perform actions that progress the system's response to the user's query.";
			const instructions = await getAgentInstructions(agentRoleActing, thoughtProcess)
			const actingResponse = await agentCore(instructions, messageHistory, apiConfig, actingTool)
			console.log({ "Acting agent response": actingResponse.arguments })
			const action = { action: `[${actingResponse.arguments.action}] "${actingResponse.arguments.input}"` }
			return action

		}
		async function observingAgent(thoughtProcess) {
			const observingTool = [{
				"type": "function",
				"function": {
					"name": "Record_Observation",
					"description": "Logs the result of the executed action.",
					"parameters": {
						"type": "object",
						"properties": {
							"actionResult": {
								"type": "string",
								"description": "The outcome or result of the action taken."
							},
							"observation": {
								"type": "string",
								"description": "The observation to be recorded in the Thought Process Log."
							}
						},
						"required": ["actionResult", "observation"]
					}
				}
			}
			]
			const agentRoleObserving = "observe and record the outcome of the action taken, adding this information to the Thought Process Log. As the Observing Agent, your observations are key to informing future actions and thoughts within the system.";
			const instructions = await getAgentInstructions(agentRoleObserving, thoughtProcess)
			const observingResponse = await agentCore(instructions, messageHistory, apiConfig, observingTool)
			console.log({ "Observing agent response": observingResponse.arguments })
			const observation = { observation: observingResponse.arguments.observation }
			return observation
		}
		async function respondingAgent(thoughtProcess) {
			const respondingTool = [{
				"type": "function",
				"function": {
					"name": "Formulate_Response",
					"description": "Creates a final response based on the Thought Process Log.",
					"parameters": {
						"type": "object",
						"properties": {
							"thoughtProcessLog": {
								"type": "array",
								"items": {
									"type": "object",
									"properties": {
										"thought": { "type": "string" },
										"action": { "type": "string" },
										"observation": { "type": "string" }
									}
								},
								"description": "The complete log of thoughts, actions, and observations."
							},
							"finalResponse": {
								"type": "string",
								"description": "The final response to be communicated to the user."
							}
						},
						"required": ["thoughtProcessLog", "finalResponse"]
					}
				}
			}
			]
			const agentRoleResponding = "review the Thought Process Log and formulate a coherent and appropriate final response to the user. As the Responding Agent, synthesize the information from the Thought Process Log and user instructions to create a response that effectively addresses the user's needs and expectations.";
			const instructions = await getAgentInstructions(agentRoleResponding, thoughtProcess)
			const streamConfig = { ...apiConfig, streamResponse: true }
			const respondingResponse = await agentCore(instructions, messageHistory, streamConfig, respondingTool)
			console.log({ respondingResponse })
			return respondingResponse
			//console.log({"Responding agent response": respondingResponse.arguments})
			//const response = {response: respondingResponse.arguments.finalResponse}
			//return response
		}


		async function createFirstObservation(messageHistory, lastMessage) {
			if (messageHistory.length === 0) {
				return [{ observation: "The conversation has just started. The assistant should greet the user." }];
			} else {
				const content = lastMessage.content
				return [{ observation: `The user replied: "${content}"` }];
			}
		}


		async function thinkActObserve() {
			let thoughtProcess = await createFirstObservation() // array of objects
			//thoughtProcess = [{thought: "string"}, {action: "string"}, {observation: "string"}]
			let loopCounter = 0

			while (loopCounter < 6) {
				loopCounter += 1
				thoughtProcess.push(await thinkingAgent(thoughtProcess))
				thoughtProcess.push(await actingAgent(thoughtProcess))
				const agentsLastAction = placeholder
				if (agentsLastAction === "finish") {
					break
				}
				thoughtProcess.push(await observingAgent(thoughtProcess))
			}
			return thoughtProcess
		}

		async function testing123abc() {
			let thoughtProcess = await createFirstObservation(messageHistory, lastUserMessage)
			showClientThoughtProcess(thoughtProcess)
			thoughtProcess.push(await thinkingAgent(thoughtProcess))
			showClientThoughtProcess(thoughtProcess)
			thoughtProcess.push(await actingAgent(thoughtProcess))
			showClientThoughtProcess(thoughtProcess)
			thoughtProcess.push(await observingAgent(thoughtProcess))
			showClientThoughtProcess(thoughtProcess)
			console.log({ thoughtProcess })
			return thoughtProcess
		}

		const finalThoughtProcess = await testing123abc()
		const stream = await respondingAgent(finalThoughtProcess)
		return stream



		//let finalThoughtProcess = await thinkActObserve()	
		//let finalResponseStream = await respondingAgent(finalThoughtProcess)
		//return finalResponseStream


		const tempPassThrough = await openai.chat.completions.create(apiOptions)
		console.log({ tempPassThrough })
		return tempPassThrough
	}

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

		if (sentMessage.role !== "system") {
			trimmedChatHistory.push(sentMessage);
		}

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


		// apiOptions shouldn't be used to save messages, etc, only for the API call.
		// reason being that they could be changed in the reasoning engine.
		const apiOptions = {
			messages: trimmedChatHistory,
			model,
			stream: true,
			...(temperature && { temperature }),
			...(max_tokens && { max_tokens }),
		};

		console.log("streamResponse() -> reasoningEngine()...")
		console.log({"messages!!!": apiOptions.messages})
		let response = await this.reasoningEngine(apiOptions)

		try {
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
			} catch (error) {
				consoole.log("ERROR :(")
			return ":("
			}
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
		let {
			systemMessage,
			staticMemory,
			model = modelToUse,
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