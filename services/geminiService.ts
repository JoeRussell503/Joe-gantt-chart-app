
import { GoogleGenAI, Type } from "@google/genai";
import { Task } from "../types";

export const generateTasksFromPrompt = async (prompt: string): Promise<Partial<Task>[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a detailed project plan for: "${prompt}". 
               Include around 8-12 logically ordered tasks with realistic durations and dependencies.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            duration: { type: Type.NUMBER, description: "Duration in days" },
            dependencies: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Array of task names that must finish before this starts"
            }
          },
          required: ["name", "duration", "dependencies"]
        }
      }
    }
  });

  try {
    const rawTasks = JSON.parse(response.text);
    return rawTasks;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
};

export const parseFileWithGemini = async (fileContent: string, fileName: string): Promise<Partial<Task>[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `I have a file named "${fileName}" containing project tasks. Please extract the task names, their durations (in days), and any dependencies mentioned. 
               File Content:
               """
               ${fileContent}
               """`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            duration: { type: Type.NUMBER, description: "Duration in days" },
            dependencies: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Array of task names that must finish before this starts"
            }
          },
          required: ["name", "duration", "dependencies"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse file with Gemini", e);
    return [];
  }
};
