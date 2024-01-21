export const LogExamples = 
`
EXAMPLE 1:

observation: The conversation has just started. The assistant should greet the user.
thought: The next step is to formulate a greeting that is casual and sets a friendly tone for the conversation, in line with the user instructions.

Hello there! What can I do for you today?"

EXAMPLE 2:

observation: The user replied: "Can you help me with my todo list?"
thought: I should ask the user what specific tasks they need help with for their todo list.
action: [Retrieve_Data_From_Wolfram_Alpha] "query: Create todo list"
observation: Wolfram Alpha did not understand the input. The action to create a todo list using Wolfram Alpha was not appropriate since Wolfram Alpha is not designed for interactive task management. 
thought: The action did not yield a valid result. We should instead engage directly with the user to determine their specific tasks and offer help in organizing or prioritizing their todo list.

Absolutely, I'd be happy to help you with your to-do list! Let's start by listing out the tasks you need to get done. Could you please share with me what tasks you'd like to add to your to-do list? Once we have all your tasks listed, I can help you prioritize them or structure your list in a way that works best for you."

EXAMPLE 3:

observation: The user replied: "When's the best time to vist Niagra Falls?"
thought: I need to consider the seasonal weather patterns, crowd factors, and special events that could affect the experience at Niagara Falls to determine the best time to visit. I also can't use Wolfram Alpha because the user asked for an opinion and not a concrete fact.

The best time to visit Niagara Falls largely depends on your preferences for weather, crowds, and activities. Generally, the peak season is from June to August, when the weather is warm and all attractions, including the Maid of the Mist and Cave of the Winds, are open. The falls are a spectacular sight in the summer with vibrant rainbows appearing in the mist. However, this is also when the site is most crowded, which can affect accommodation prices and waiting times for attractions.\n\nVisiting in the spring or fall can offer a more peaceful experience. In May, June, September, and October, the weather is cooler but still pleasant, and the crowds are thinner. You might also catch beautiful flowers blooming in the spring or the fall foliage, which can add a picturesque backdrop to the falls.\n\nWinter offers a unique visit, with the falls surrounded by ice formations, but you should be prepared for cold temperatures and some attraction closures. The Winter Festival of Lights, from November to January, is a draw for visitors seeking a dazzling display.\n\nUltimately, looking at what I know about you so far, I would suggest sometime between June and August since all the attractions are open, just try to get there early to avoid the crowds."

EXAMPLE 4:

observation: The user replied: "What's a good name for a black and white kitten I found in a car engine? Currently he's called Biscuit. Like "burnt biscuit"
thought: Considering the unique circumstance in which the kitten was found and its current name, 'Biscuit,' we can suggest a creative and suitable name that is related to either the color pattern (black and white) or the circumstances of discovery (in a car engine).

Oreo might be a classic choice for a black and white kitten, paying homage to its distinctive cookie-like fur pattern. If you're looking for a name that nods to the 'burnt biscuit' theme and its car engine discovery, you could consider 'Ash,' as it evokes the color of soot and the kitten's fiery spirit. 'Diesel' is another fitting option, with a playful reference to the engine and energy the kitten presumably has. 'Piston' also makes a fun, quirky name for a car-found kitten with a subtle nod to the black-and-ash coloration, but that one's kinda lame. I like Diesel, personally."

EXAMPLE 5:

observation: The user replied: "What's the weather like in Indy?"
thought: Provide the user with the current weather conditions in Indianapolis.
action: [Retrieve_Data_From_Wolfram_Alpha] "query: weather in Indianapolis"
observation: The current weather conditions in Indianapolis are partly cloudy with a temperature of 74°F.
thought: Since, I now know the weather, I can tell the user.

The current weather in Indianapolis is partly cloudy with a temperature of 74°F. Need to know anything else?"
`
