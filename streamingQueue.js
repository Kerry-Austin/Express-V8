/**
// Usage example
const streamQueue = new StreamingQueue();

// Add streams to the queue as needed
streamQueue.addToQueue(async () => {
	// Your streaming logic here for the first stream
});
streamQueue.addToQueue(async () => {
	// Your streaming logic here for the second stream
});

// When ready, process the final response, prioritizing it over any remaining queued streams
streamQueue.processFinalResponse(async () => {
	// Your streaming logic here for the final response
});
*/
export class StreamingQueue {
	constructor() {
		this.queue = [];
		this.processing = false;
	}

	addToQueue(streamFunction) {
		this.queue.push(streamFunction);
		this.processNext();
	}

	async processNext() {
		if (this.processing || this.queue.length === 0) {
			return; // Exit if already processing or no streams in the queue
		}
		this.processing = true;
		const streamFunction = this.queue.shift(); // Get the next stream function from the queue

		try {
			await streamFunction(); // Process the stream
		} catch (error) {
			console.error("Error processing stream", error);
		} finally {
			this.processing = false;
			this.processNext(); // Attempt to process the next stream in the queue
		}
	}

	async processFinalResponse(finalStreamFunction) {
		// Wait for the currently processing stream to finish
		while (this.processing) {
			await new Promise(resolve => setTimeout(resolve, 100)); // Wait a bit before checking again
		}

		this.queue = []; // Clear the queue to ignore any pending streams

		// Directly process the final response without adding it to the queue
		this.processing = true;
		try {
			await finalStreamFunction(); // Process the final stream
		} catch (error) {
			console.error("Error processing final stream", error);
		} finally {
			this.processing = false;
			// Optionally, handle anything after the final stream is processed (like resetting state if needed)
		}
	}
}

