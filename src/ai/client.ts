import { Ollama } from 'ollama';

export const ollama = new Ollama({
    host: 'http://localhost:11434',
    headers: {
        Authorization: "Bearer " + process.env.OLLAMA_API_KEY,
    },
});