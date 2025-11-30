const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// מגדיר את נתיבי FFMPEG ו-FFPROBE עבור סביבת Vercel
const ffmpegStatic = require('@ffmpeg-installer/ffmpeg');
const ffprobeStatic = require('@ffprobe-installer/ffprobe');

ffmpeg.setFfmpegPath(ffmpegStatic.path);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// פונקציית עזר לשמירת Base64 כקובץ זמני
const saveBase64ToFile = (base64Data, fileName) => {
    // ב-Serverless Functions, התיקייה היחידה לכתיבה היא /tmp
    const tempDir = path.join('/tmp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    const filePath = path.join(tempDir, fileName);
    // הנתונים מה-TTS שלך הם base64
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    return filePath;
};

// פונקציית השרת הראשית
module.exports = async (req, res) => {
    // הגדרת כותרות CORS (חשוב מאוד לאתר שלך ב-GitHub Pages)
    res.setHeader('Access-Control-Allow-Origin', '*'); // מאפשר לכל דומיין לגשת
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // טיפול בבקשות OPTIONS (Preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const tempDir = path.join('/tmp');
    const inputFiles = [];
    const outputFilePath = path.join(tempDir, 'final_story.wav');

    try {
        // מצפים לקבל מערך של אובייקטים, כל אחד מכיל את נתוני ה-Base64 של קטע שמע
        const { audioSegments } = req.body; 

        if (!audioSegments || !Array.isArray(audioSegments) || audioSegments.length === 0) {
            return res.status(400).json({ error: 'חסרים קטעי אודיו או שהם לא תקינים.' });
        }
        
        let totalDuration = 0;
        
        // 1. שמירת קטעי הדיבור כקבצים זמניים וחישוב משך הזמן הכולל
        for (let i = 0; i < audioSegments.length; i++) {
            // הנתונים שנשלחים מהלקוח הם רק ה-base64 של נתוני האודיו (ה-WAV data)
            const fileName = `segment-${i}.wav`;
            const filePath = saveBase64ToFile(audioSegments[i], fileName); 
            inputFiles.push({ path: filePath, stream: `d${i}` });
            
            // שימוש ב-FFPROBE כדי לקבוע במדויק את אורך הקטע (חיוני למיקסינג)
            const duration = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(filePath, (err, metadata) => {
                    if (err) return reject(new Error(`ffprobe error: ${err.message}`));
                    resolve(parseFloat(metadata.format.duration)); // משך הזמן בשניות
                });
            });
            totalDuration += duration;
        }

        // 2. הגדרת נתיב למוזיקת הרקע
        // הקובץ 'background.mp3' צריך להיות בתיקייה הראשית של הפרויקט
        const bgMusicPath = path.join(process.cwd(), 'background.mp3');
        
        // 3. לוגיקת המיקסינג של FFMPEG
        await new Promise((resolve, reject) => {
            let command = ffmpeg();
            
            // הוספת כל קטעי הדיאלוג כקלט
            for (const file of inputFiles) {
                command = command.input(file.path);
            }
            
            let filterChain = [];
            const dialogueStreamNames = inputFiles.map(f => f.stream); // d0, d1, d2...
            
            // א. חיבור (Concatenation) של כל קטעי הדיבור
            filterChain.push({
                filter: 'concat',
                options: `n=${dialogueStreamNames.length}:v=0:a=1`, 
                inputs: dialogueStreamNames,
                outputs: 'dialogue_concat' // הזרם שמכיל את כל הדיאלוגים מחוברים
            });

            if (fs.existsSync(bgMusicPath)) {
                // ב. אם יש קובץ מוזיקת רקע (background.mp3)
                command = command.input(bgMusicPath); // מוסיף את המוזיקה כקלט נוסף

                // ג. לולאת המוזיקה (Alopp)
                filterChain.push({
                    filter: 'aloop',
                    options: `loop=-1:size=2147483647`, 
                    inputs: '1:a', // הקלט השני (האינדקס 1:a הוא המוזיקה)
                    outputs: 'bg_loop'
                });
                
                // ד. חיתוך המוזיקה (Atrim) לאורך הדיאלוגים
                filterChain.push({
                    filter: 'atrim',
                    options: `0:${totalDuration}`,
                    inputs: 'bg_loop',
                    outputs: 'bg_trim'
                });

                // ה. עמעום יציאה (Fade-out) למוזיקת הרקע לקראת הסוף
                filterChain.push({
                    filter: 'afade',
                    options: `t=out:st=${totalDuration - 3}:d=3`, 
                    inputs: 'bg_trim',
                    outputs: 'bg_faded'
                });

                // ו. ערבוב סופי (Amix) של הדיאלוג והמוזיקה
                // הורדת עוצמת המוזיקה ל-20% (volume=0.2)
                filterChain.push({
                    filter: 'amix',
                    options: 'inputs=2:duration=first:dropout_transition=3:weights=1 0.2', 
                    inputs: ['dialogue_concat', 'bg_faded'],
                    outputs: 'final_output'
                });
                
                command = command.complexFilter(filterChain, 'final_output');
            } else {
                // ז. אם אין BGM, הזרם המחובר הוא הפלט הסופי
                command = command.complexFilter(filterChain, 'dialogue_concat');
            }

            // 4. הגדרות סופיות ושמירה
            command
                .output(outputFilePath)
                .audioCodec('pcm_s16le') // קידוד WAV סטנדרטי
                .audioChannels(1) // מונו
                .audioFrequency(24000) // קצב דגימה שמתאים ל-TTS
                .on('end', () => resolve())
                .on('error', (err) => reject(new Error(`ffmpeg error: ${err.message}`)))
                .run();
        });

        // 5. שליחת הקובץ המוגמר בחזרה למשתמש
        const finalAudioBuffer = fs.readFileSync(outputFilePath);
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', finalAudioBuffer.length);
        res.status(200).send(finalAudioBuffer);

    } catch (error) {
        console.error('Error during audio mixing:', error);
        res.status(500).json({ error: 'שגיאה פנימית בשרת בעת יצירת השמע.', details: error.message });
    } finally {
        // 6. ניקוי הקבצים הזמניים (חשוב מאוד ב-Serverless)
        for (const file of inputFiles) {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        }
        if (fs.existsSync(outputFilePath)) {
            fs.unlinkSync(outputFilePath);
        }
    }
};
