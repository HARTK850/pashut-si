// api/gemini.js - לטיפול בכל קריאות ג'מיני (תסריט ו-TTS)

import { GoogleGenAI } from '@google/genai';

// פונקציה לבחירה וסיבוב של מפתחות
function getAvailableApiKey() {
    // קריאת רשימת המפתחות ממשתני הסביבה
    const keysString = process.env.GEMINI_API_KEYS;
    if (!keysString) {
        throw new Error('GEMINI_API_KEYS environment variable is not set.');
    }
    // החזרת המפתחות כמערך
    return keysString.split(',').map(key => key.trim()).filter(key => key.length > 0);
}

// פונקציה ראשית שמבצעת את קריאת ה-API ומטפלת בסיבוב מפתחות
async function callGeminiWithRotation(requestBody, modelName) {
    const apiKeys = getAvailableApiKey();
    let lastError = null;

    // לולאה העוברת על כל המפתחות הזמינים
    for (const apiKey of apiKeys) {
        const ai = new GoogleGenAI({ apiKey });
        
        try {
            console.log(`Attempting API call with key starting with: ${apiKey.substring(0, 5)}...`);
            
            // המודל `gemini-2.5-flash` משמש גם לטקסט וגם לשמע (TTS)
            const response = await ai.models.generateContent({
                model: modelName,
                contents: requestBody.contents,
                config: requestBody.generationConfig
            });

            // אם הצליח, החזר את התשובה
            return response; 

        } catch (error) {
            lastError = error;
            console.warn(`Key failed (status: ${error.httpStatus || 'N/A'}): ${error.message}`);
            
            // אם השגיאה היא 429 (Too Many Requests) או 403 (Forbidden - מכסה)
            // נמשיך ללולאה הבאה כדי לנסות מפתח אחר.
            if (error.httpStatus === 429 || error.httpStatus === 403) {
                continue; // עובר למפתח הבא ברשימה
            } else {
                // אם זו שגיאה אחרת (לדוגמה, פורמט לא תקין או מפתח לא חוקי), זרוק שגיאה
                throw lastError; 
            }
        }
    }

    // אם כל המפתחות נכשלו
    throw new Error(`All API keys failed. Last error: ${lastError ? lastError.message : 'Unknown.'}`);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { model, requestBody } = req.body;

        if (!model || !requestBody) {
            return res.status(400).json({ error: 'Missing model or requestBody in payload.' });
        }

        const response = await callGeminiWithRotation(requestBody, model);

        // מחזיר את התשובה של ג'מיני ישירות ללקוח
        res.status(200).json(response); 

    } catch (error) {
        console.error('Server error during Gemini API call:', error);
        res.status(error.httpStatus || 500).json({ 
            error: error.message,
            httpStatus: error.httpStatus || 500 
        });
    }
}
