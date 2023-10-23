[x] Change talkBack to an API call
	[x] Create the database function
	[x] Add to the API

[x] Change sendMessage() to accept an object with optional system message & persistant memory

[x] Redo the back & frontend. Result = sendMessage() => bot response, saving to chat hx done on server automatically (vs calling /saveMessage & etc),
	[x] Auto save user messages in the backend
	[x] Auto save assistant messages in the backend
	[x] Auto get chat history for assistant response in the back end
 	[x] Remove talkToBot & talkBack functions
	[x] Fix functions that used talkToBot (like auto renamer)

[] Double check current functions & features
	[x] Clearing the conversation
 	[x] Deleting the conversation
	[x] Creating a new conversation
 	[x] System Message works
	[x] Chat hx works
 	[x] Auto renaming conversations works
	[] Move renaming logic into the API

[x] Add token count to the messages & history token count (use total from assistant message)
	[x] Each message
	[x] History (currently @ getMessages(), delta to a running count to handle changes)
 
[x] Dyanamic memory trimming with rendering (start with message count)
	[x] Change messageCount to only total
 	[x] manageChatHistory isn't resetting?
 	[x] Use the result of trimHistory() for bot responses @ sendMessage()
		-> Don't trim @ saveMessage, since we want to keep old messages (vectors, etc)
	[x] Use the result of trimHistory() for html loading (@ getConversation() )
 		[x] Change appendToHTML to take an object so we can add the message trim list & ids
	[x] Memory trimming
	[x] Dynamic html rendering
	[x] Change to token count option
 		[x] Add token count to system message

[x] Change the html
	[x] Move new chat to dropdown
 	[x] Move delete & clear buttons to new dropdown navbar
	[x] Add rename button and delete & clear confirm
 	
[x] Dynamic system message & static memory
 	[x] Seperate modals for system message and static memory
	[x] Save system message and static memory to database			
 	[x] Add system message and static memory to html on page load
	[x] Use html value for passing system message and static memory

[] Change the frontend and backend to use a location, message, and conversationOptions object
		conversationOptions = {
				systemMessage,
				staticMemory,
				trimType,
				trimAmount,
				model, max_tokens, temperature
			}

[] Clean up the trimHistory function. timHistory() should limit all messages if limiting tokens, but shouldn't count the system message when limiting by count. Pull trim options from the database and sentMessage(which would soon be updated in database anyway)

[x] Add output streaming w/ the vercel ai sdk

# backend => trim chat hx, stream, save
[x] Move streaming to proper editHTML function using frontend creationTimeID
[x] Instead of updating and replacing the div after every new line, keep it as one big div and continously update the markdown to match based on the whole thing. 
[x] change input to use streaming responses
[x] edit backend to only trim chat hx, stream, and save

# frontend => get removed messages list
[x] turn trim chat hx into an api call
[x] change function to use api call instead

[x] fix conversation loading

[] ***IMPLEMENT MAX QUALITY CSS***
	[] includes spinner for loading

[] Basic Tool use:
	[] Enity memory aka learning about the user over time
	[] Basics (calculator, calendar, etc. Use wolfram alpha for now)
 	[] Web search
 	[] Web browsing (article summarzing)

[] Login system

[] Advanced tool use:
	[] Texting (w/ vector memory) option vs using app
	[] Youtube summarizing
	[] Texting reminders (start with daily and nightly updates, etc. Then to custom times)