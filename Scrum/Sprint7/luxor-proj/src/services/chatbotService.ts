export interface ChatRequest {
    message: string;
}

export interface ChatResponse {
    response: string;
}

export async function sendMessage(
    request: ChatRequest
): Promise<ChatResponse> {

    const response = await fetch("http://127.0.0.1:8000/chat", {
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