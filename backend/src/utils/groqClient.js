import Groq from "groq-sdk";

let groqInstance = null;

export const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  if (!groqInstance) {
    groqInstance = new Groq({ apiKey });
  }
  return groqInstance;
};

// Proxy to guarantee lazy evaluation when imported before dotenv.config()
export const client = new Proxy(
  {},
  {
    get(_, prop) {
      const instance = getGroqClient();
      return instance ? instance[prop] : undefined;
    },
  }
);