export interface ChatRequest {
    message: string;
}

export interface ChatResponse {
    response: string;
}

// url del microservicio del chatbot (fastapi). en local el chatbot corre en
// el puerto 8000; en produccion se define VITE_CHATBOT_URL con la url publica
// del servicio (ver docs/DEPLOY_RENDER.md). igual que VITE_API_URL, vite la
// resuelve en tiempo de build.
const CHATBOT_URL = import.meta.env.VITE_CHATBOT_URL || "http://127.0.0.1:8000";

export async function sendMessage(
    request: ChatRequest
): Promise<ChatResponse> {

    const response = await fetch(`${CHATBOT_URL}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        throw new Error("No fue posible conectar con el chatbot.");
    }

    return await response.json();
}