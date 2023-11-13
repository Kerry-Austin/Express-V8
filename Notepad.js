
// Where I want the defintion of handleAudioGroup to go
io.on('connection', async (socket) => {
	// Putting it here would be okay too
	//...
	socket.on('textRequest', async (data) => {
		let pendingGroups = [];
		let okayToSend = true;
		let groupNumber = 0;
		async function handleAudioGroup(group){
			// uses pendingGroups, okayToSend, groupNumber at different points
		}
		for await (const chunk of streamingText) {
			//...
			while (sentences.length >= maxSentenceCount) {
				// Those variables are also used inside the socket event too
				if (okayToSend) {
					await handleAudioGroup(sentenceSubset);
				} else {
					pendingGroups.push(sentenceSubset);
					//...
				}
			}
		}
	})

	socket.on('PlayMessage', async (data) => {
		let pendingGroups = [];
		let okayToSend = true;
		let groupNumber = 0;
		async function handleAudioGroup(group){
			// uses pendingGroups, okayToSend, groupNumber at different points
		}
		for await (const chunk of streamingText) {
			//Slightly different code, so I don't want to combine this part
			while (sentences.length >= maxSentenceCount) {
				// The variables are also used inside this socket event too
				if (okayToSend) {
					await handleAudioGroup(sentenceSubset);
				} else {
					pendingGroups.push(sentenceSubset);
					//...
				}
			}
		}
	})
})