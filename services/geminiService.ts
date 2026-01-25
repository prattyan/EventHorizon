import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

console.debug("Gemini Service Init - API Key present:", !!apiKey, "Length:", apiKey.length);

// Initialize the API with the key
// Initialize the API with the key
const genAI = new GoogleGenerativeAI(apiKey);

export const isGeminiConfigured = () => !!apiKey && apiKey.length > 0;

export const generateEventDescription = async (title: string, date: string, location: string): Promise<string | null> => {
  try {
    // For text-only input, use the gemini-1.5-flash model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert event planner. Write a compelling, professional, and exciting description for an event.
      
      Event Details:
      Title: ${title}
      Date: ${date}
      Location: ${location}

      Requirements:
      1. Two concise paragraphs engaging the potential attendee.
      2. A suggested simplified agenda (3-4 bullet points) formatted cleanly.
      3. Tone: Professional yet enthusiastic.
      4. Return ONLY the text, no markdown code blocks.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return text?.trim() || null;
  } catch (error: any) {
    console.error("Gemini API Error details:", error);
    let errorMessage = "Unknown error";
    if (error.message) {
      if (error.message.includes('API key expired')) errorMessage = "API Key Expired. Please update .env file.";
      else if (error.message.includes('API_KEY_INVALID')) errorMessage = "Invalid API Key.";
      else errorMessage = error.message;
    }
    return `Error: ${errorMessage}`;
  }
};

export const getEventRecommendations = async (
  pastEvents: { title: string; description: string; type: string }[],
  upcomingEvents: { id: string; title: string; description: string; date: string; type: string }[]
): Promise<string[]> => {
  if (pastEvents.length === 0 || upcomingEvents.length === 0) return [];

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const pastEventsContext = pastEvents.map(e => `- ${e.title} (${e.type}): ${e.description.substring(0, 100)}...`).join('\n');
    const upcomingEventsContext = upcomingEvents.map(e => `ID: ${e.id} | Title: ${e.title} (${e.type}) | Desc: ${e.description.substring(0, 100)}...`).join('\n');

    const prompt = `
      As an AI Recommender System, analyze the user's past event attendance and recommend the top 3 most relevant upcoming events.

      User's Past Events:
      ${pastEventsContext}

      Available Upcoming Events:
      ${upcomingEventsContext}

      Task:
      1. Identify patterns in the user's interests based on past events.
      2. Match these interests with the upcoming events.
      3. Return ONLY a JSON array of the top 3 matching Event IDs. Do not include any explanations or markdown formatting.
      Example Output: ["ev_123", "ev_456", "ev_789"]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const recommendedIds = JSON.parse(cleanedText);

    return Array.isArray(recommendedIds) ? recommendedIds : [];
  } catch (error) {
    console.error("Gemini Recommendation Error:", error);
    return [];
  }
};

export const chatWithAI = async (
  query: string,
  eventsContext: { title: string; date: string; location: string; description: string; type: string; isPaid?: boolean; price?: number; capacity?: number }[]
): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Summarize events to save tokens, focusing on key details
    const eventsSummary = eventsContext.map(e =>
      `- ${e.title} (${e.type}) on ${e.date} at ${e.location}. Price: ${e.isPaid ? `₹${e.price}` : 'Free'}. Capacity: ${e.capacity}. Details: ${e.description.substring(0, 150)}...`
    ).join('\n');

    const currentDateTime = new Date().toLocaleString();

    const prompt = `
      You are an intelligent virtual assistant for an event management platform called "Eventron".
      Your role is to help users find information about based on the provided list.

      Current Date: ${currentDateTime}

      Context - Available Events:
      ${eventsSummary}

      User Query: "${query}"

      Instructions:
      1. Answer the user's question accurately based ONLY on the provided event context.
      2. If the user asks for "upcoming" events, strictly ONLY list events scheduled AFTER the Current Date provided above. Do not list events that have already passed.
      3. If the user asks about something not in the list, politely say you don't have information on that.
      4. Be helpful, concise, and professional.
      5. If recommending an event, mention its title and date.
      6. Do not invent facts.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return text?.trim() || "I apologize, but I couldn't process your request at the moment.";
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    return `Error: ${error.message || "Connection failed"}. Please check your API key and network.`;
  }
};