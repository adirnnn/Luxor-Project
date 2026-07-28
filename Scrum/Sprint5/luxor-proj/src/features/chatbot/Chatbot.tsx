import { useState } from "react";
import { sendMessage } from "../../services/chatbotService";

interface Message {
    sender: "user" | "bot";
    text: string;
}

export function Chatbot() {

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSend() {

        if (!input.trim()) return;

        const currentMessage = input;

        setMessages(prev => [
            ...prev,
            {
                sender: "user",
                text: currentMessage
            }
        ]);

        setInput("");
        setLoading(true);

        try {
            const response = await sendMessage({
                message: currentMessage
            });

            setMessages(prev => [
                ...prev,
                {
                    sender: "bot",
                    text: response.response
                }
            ]);

        } catch {
            setMessages(prev => [
                ...prev,
                {
                    sender: "bot",
                    text: "No fue posible contactar con el chatbot."
                }
            ]);

        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            {/* Botón flotante */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: "fixed",
                    bottom: 20,
                    right: 20,
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    border: "none",
                    background: "#C8A24A",
                    color: "white",
                    fontSize: 26,
                    cursor: "pointer",
                    boxShadow: "0 8px 20px rgba(0,0,0,.3)",
                    zIndex: 9999
                }}
            >
                💬
            </button>

            {
                isOpen && (
                    <div
                        style={{
                            position: "fixed",
                            bottom: 90,
                            right: 20,
                            width: 360,
                            height: 520,
                            background: "#ffffff",
                            color: "#000000",
                            borderRadius: 12,
                            boxShadow: "0 15px 40px rgba(0,0,0,.3)",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                            zIndex: 9999
                        }}
                    >

                        {/* Header */}
                        <div
                            style={{
                                padding: "15px",
                                background: "#C8A24A",
                                color: "white",
                                fontWeight: "bold"
                            }}
                        >
                            Luxor Assistant
                        </div>

                        {/* Mensajes */}
                        <div
                            style={{
                                flex: 1,
                                overflowY: "auto",
                                padding: 15,
                                background: "#F8F8F8"
                            }}
                        >

                            {
                                messages.map((message, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: "flex",
                                            justifyContent:
                                                message.sender === "user"
                                                    ? "flex-end"
                                                    : "flex-start",
                                            marginBottom: 12
                                        }}
                                    >
                                        <div
                                            style={{
                                                maxWidth: "75%",
                                                padding: "10px 14px",
                                                borderRadius: 12,
                                                background:
                                                    message.sender === "user"
                                                        ? "#C8A24A"
                                                        : "#E8E8E8",
                                                color:
                                                    message.sender === "user"
                                                        ? "white"
                                                        : "black",
                                                wordBreak: "break-word"
                                            }}
                                        >
                                            {message.text}
                                        </div>
                                    </div>
                                ))
                            }

                            {
                                loading && (
                                    <div
                                        style={{
                                            color: "#555"
                                        }}
                                    >
                                        Pensando...
                                    </div>
                                )
                            }
                        </div>
                        {/* Input */}
                        <div
                            style={{
                                display: "flex",
                                borderTop: "1px solid #DDD"
                            }}
                        >
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleSend();
                                    }
                                }}
                                placeholder="Escribe un mensaje..."
                                style={{
                                    flex: 1,
                                    padding: 12,
                                    border: "none",
                                    outline: "none",
                                    color: "black",
                                    background: "white"
                                }}
                            />
                            <button
                                onClick={handleSend}
                                style={{
                                    border: "none",
                                    background: "#C8A24A",
                                    color: "white",
                                    padding: "0 20px",
                                    cursor: "pointer"
                                }}
                            >
                                Enviar
                            </button>
                        </div>
                    </div>
                )
            }
        </>
    );
}