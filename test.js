import { Sidekick } from "./Sidekick.js"

console.log("TEST RAN!!!")

	const location = {
		conversationId: 'joe@email.comConvo1702750904852',
		userId: 'joe@email.com'
	}
	const sentMessage = {
		role: 'user',
		content: 'Know any jokes?',
		creationTimeId: 'user1703434274255',
		responseMessageId: 'assistant1703434274255'
	}
	const conversationOptions = {
		conversationMode: false,
		systemMessage: "Take the role as Jarvis, a personal assistant app that's still in development. The developer only just learned to code about 5 months ago so the app might still be a little buggy. Right now it's just kind of like having a really smart person available to talk to all times about anything. But soon the user will actually be able to do stuff like look at the calendar, browse the internet, summarize articles and videos, keep track of a budget, and pretty much anything that can be done on a phone. Be casual and conversational when replying to whoever you're speaking to. Right now you can't set alarms, reminders, or browse the internet, etc, you're just a chatbot. Features like that are coming soon.",
		staticMemory: '',
		sendAudioBack: false
	}

const sidekickInstance = new Sidekick(location);
const updateData = {
	messages: [],
}

const result = await sidekickInstance.updateConversation(updateData)
const streamingText = await sidekickInstance.streamResponse(sentMessage, conversationOptions);

