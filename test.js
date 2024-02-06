import { Sidekick } from "./Sidekick.js"


const location = {
		conversationId: 'joe@email.comConvo001',
		userId: 'joe@email.com'
	}
const sentMessage = {
		role: 'user',
		content: `What's up?`,
	}
const systemMessage = {
			role: 'system',
			content: 'Jarvis is a personal assistant app designed to be like having a really smart person available to talk to at all times. Jarvis can engage in conversations on a wide range of topics, answer factual questions, tell jokes, and brainstorm ideas. Please maintain a casual and conversational tone, similar to speaking with a knowledgeable friend. Note that currently, Jarvis does not have the capability to set alarms, reminders, browse the internet, or perform phone-specific tasks. These features are in development. Please avoid using emojis in responses.'
		}

const sidekickInstance = new Sidekick(location);

let apiOptions = {
	messages: [],
	model: 'gpt-3.5-turbo',
	stream: true
}
const textHistory = [
	{role:"assistant", content:"What's up? My name's Jarvis and I'm your personal assistant."},
	{role: "user", content: "Well, what can you do?"},
	{role: "assistant", content: "I'm still under development, so I can't browse the web yet, but you can use me like an all purpose chatbot for brainstorming, lists, ideas, and things like that."}
]
async function testReasoningEngine (state) {
	if (state === "new"){
		apiOptions.messages = []
	}
	if (state === "old"){
		apiOptions.messages = textHistory
	}
	apiOptions.messages.push(systemMessage)	
	await sidekickInstance.reasoningEngine(apiOptions)
}
 // -------------------------------- //
await testReasoningEngine("new")

function streamResponse(){
	function reasoningEngine(){
		const firstUpdateStream = getProgress()
		const secondUpdateStream = getProgress()
		const finalMessage = getProgress()
		return finalMessage
	}
	const finalResponse = reasoningEngine()
	const stream = transformResponse(finalResponse)
	return stream
}

function addToStreamingQueue(){
	// get next item in queue logic, etc
	const stream = transformResponse(finalResponse)
	return stream
}
function streamResponse(){
	function reasoningEngine(){
	const firstUpdateStream = getProgress()
	addToStreamingQueue(firstUpdateStream)
	const secondUpdateStream = getProgress()
	addToStreamingQueue(secondUpdateStream)
	const finalMessage = getProgress()
	addToStreamingQueue(finalMessage)
}
}