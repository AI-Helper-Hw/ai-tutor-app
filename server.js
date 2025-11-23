require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const app = express();
const port = 3000;

// Setup Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Setup file upload
const upload = multer({ dest: 'uploads/' });

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// System instruction
const systemInstruction = `You are an AI Homework Helper and Tutor. Your role is to:

1. ONLY answer educational questions related to homework, assignments, studying, and learning
2. Help with subjects like: Math, Science, Physics, Chemistry, Biology, History, English, Programming, JEE, NEET, UPSC preparation, etc.
3. Explain step-by-step solutions clearly
4. When analyzing images, describe what you see and solve the problem shown
5. For competitive exams (JEE/NEET/UPSC), provide detailed explanations with concepts
6. Encourage learning and understanding, not just giving answers
7. Remember previous context in the conversation and reference it when needed
8. If asked non-educational questions, politely decline and say: "I'm here specifically to help with homework and studying. Please ask me an educational question!"

Be friendly, patient, and supportive like a good tutor.`;

// API endpoint
app.post('/ask', upload.single('image'), async (req, res) => {
    try {
        const question = req.body.question;
        const imageFile = req.file;
        const historyJson = req.body.history || '[]';
        
        console.log('=== NEW REQUEST ===');
        console.log('Question:', question);
        console.log('Image:', imageFile ? 'YES' : 'NO');
        
        // Parse conversation history
        let conversationHistory = [];
        try {
            conversationHistory = JSON.parse(historyJson);
        } catch (e) {
            console.log('No history or parse error');
        }
        
        console.log('History messages:', conversationHistory.length);

        // Initialize model (CHANGE THIS TO YOUR MODEL!)
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash-lite", // 👈 CHANGE THIS to your model!
            systemInstruction: systemInstruction
        });

        // Format history for Gemini
        const formattedHistory = conversationHistory.map(msg => ({
            role: msg.role, // 'user' or 'model'
            parts: [{ text: msg.text }]
        }));

        let result;

        // If there's an image
        if (imageFile) {
            console.log('Processing with image...');
            
            const imageBuffer = fs.readFileSync(imageFile.path);
            const base64Image = imageBuffer.toString('base64');
            let mimeType = imageFile.mimetype || 'image/jpeg';
            
            const imagePart = {
                inlineData: {
                    data: base64Image,
                    mimeType: mimeType
                }
            };

            // Start chat with history
            const chat = model.startChat({
                history: formattedHistory
            });

            const prompt = question || "Please analyze this image and help me solve the problem shown in it. Explain step by step.";
            
            result = await chat.sendMessage([prompt, imagePart]);
            
            fs.unlinkSync(imageFile.path);
            
        } else {
            // Text only with history
            console.log('Processing text with history...');
            
            const chat = model.startChat({
                history: formattedHistory
            });
            
            result = await chat.sendMessage(question);
        }

        const answer = result.response.text();
        console.log('Response length:', answer.length);
        console.log('===================\n');

        res.json({ success: true, answer: answer });

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        res.json({ success: false, error: error.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`✅ Homework Helper at http://localhost:${port}`);
    console.log(`🤖 Model: Gemini 2.0 Flash Lite`); // Update this text too!
});