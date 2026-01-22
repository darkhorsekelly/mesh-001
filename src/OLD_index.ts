import readline from 'readline';
import { ollama } from './ai/client.js';

async function getUserInput() {
    const game = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        game.question('What do you do next?: ', (input) => {
            resolve(input);
        });
    });
}

async function whatsNext(): Promise<void> {
    const response = await ollama.chat({
        model: "gemma3",
        messages: [{
            role: "system", content: "You are an invisible gamemaster. You respond to a user action with a structured output that is either a monster, an item, or a location. Whether it's a monster, item, or location, you will write a thematic description (10 words or less) that fit a mashup galactic universe of Murderbot/Hyperion/Seven Eves."
        }, {
            // Inject the CLI input into the user prompt
            role: "user", content: "Generate SciFi structured output based on the user's CLI input: " + await getUserInput()
        }],
        stream: true,
        format: 'json',
        options: { temperature: 0.1 },
    });

    let content = '';

    for await (const chunk of response) {
        content += chunk.message.content;
    }

    console.log(content);
}

whatsNext();