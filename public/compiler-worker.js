/**
 * Web Worker for handling compilation requests.
 * Processes Server-Sent Events (SSE) streams off the main thread to prevent UI blocking.
 */

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { type, id, apiUrl, requestBody } = event.data;

    if (type === 'compile') {
        try {
            // Start the SSE stream request
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Process the SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let currentEventType = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;

                    // Parse SSE format: event and data are on separate lines
                    if (line.startsWith('event: ')) {
                        currentEventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));

                        // Forward the event to the main thread
                        self.postMessage({
                            type: 'event',
                            id,
                            eventType: currentEventType,
                            data,
                        });
                    }
                }
            }

            // Signal completion
            self.postMessage({
                type: 'complete',
                id,
            });
        } catch (error) {
            // Forward errors to the main thread
            self.postMessage({
                type: 'error',
                id,
                error: error.message,
            });
        }
    }
});

// Signal that the worker is ready
self.postMessage({ type: 'ready' });
