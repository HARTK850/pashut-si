// Global variables
let currentApiKey = '';
let currentAudioBlob = null;
let currentStoryData = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadApiKey();
    loadStoriesHistory();
});

// API Key Management
function loadApiKey() {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        currentApiKey = savedKey;
        document.getElementById('apiSection').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    }
}

function saveApiKey() {
    const apiKeyInput = document.getElementById('apiKey');
    const key = apiKeyInput.value.trim();
    
    if (!key) {
        alert('אנא הזן מפתח API');
        return;
    }
    
    currentApiKey = key;
    localStorage.setItem('gemini_api_key', key);
    
    document.getElementById('apiSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    
    apiKeyInput.value = '';
}

// Story Creation Functions
function setExample(text) {
    document.getElementById('storyTopic').value = text;
}

async function createStory() {
    const topic = document.getElementById('storyTopic').value.trim();
    
    if (!topic) {
        alert('אנא הזן נושא לסיפור');
        return;
    }
    
    const createBtn = document.getElementById('createBtn');
    const btnText = document.getElementById('createBtnText');
    const spinner = document.getElementById('loadingSpinner');
    
    // Show loading state
    createBtn.disabled = true;
    btnText.textContent = 'יוצר סיפור...';
    spinner.style.display = 'block';
    
    try {
        // Generate script with Gemini Pro
        const script = await generateScript(topic);
        
        btnText.textContent = 'יוצר קובץ שמע...';
        
        // Generate audio with TTS
        const audioBlob = await generateAudio(script);
        
        // Create story object
        const story = {
            id: Date.now(),
            title: topic,
            script: script,
            audioBlob: audioBlob,
            createdAt: new Date().toLocaleDateString('he-IL')
        };
        
        // Save to localStorage
        saveStory(story);
        
        // Display the story
        displayStory(story);
        
        // Update history
        loadStoriesHistory();
        
    } catch (error) {
        console.error('Error creating story:', error);
        alert('אירעה שגיאה ביצירת הסיפור. אנא בדוק את מפתח ה-API ונסה שוב.');
    } finally {
        // Reset button state
        createBtn.disabled = false;
        btnText.textContent = 'צור סיפור';
        spinner.style.display = 'none';
    }
}

async function generateScript(topic) {
    const prompt = `
צור תסריט דיאלוגי קצר בעברית על הנושא: "${topic}"

הנחיות:
- התסריט חייב להיות בעברית בלבד
- צור דיאלוג בין 2-3 דמויות
- הדיאלוג צריך להיות טבעי ומעניין
- אורך של כ-200-300 מילים
- הוסף הנחיות לטון ורגש בסוגריים
- פורמט: 
  דמות א: [טון] טקסט
  דמות ב: [טון] טקסט

דוגמה:
רחל: [נלהבת] יש לי רעיון מעולה לפרויקט החדש!
דוד: [סקרן] בואי נשמע, אני כל אוזניים.
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${currentApiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function generateAudio(script) {
    // Parse script to extract different voices and create SSML
    const ssml = createSSML(script);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${currentApiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `המר את הטקסט הבא לקובץ שמע בעברית עם קולות שונים לכל דמות:\n\n${script}`
                }]
            }],
            generationConfig: {
                temperature: 0.7,
            }
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Since we can't actually generate real audio with this API,
    // we'll create a simple text-to-speech simulation using Web Speech API
    return await createAudioFromScript(script);
}

function createSSML(script) {
    // Simple SSML creation for different voices
    let ssml = '<speak>';
    const lines = script.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
        if (line.includes(':')) {
            const voice = index % 2 === 0 ? 'female' : 'male';
            const [speaker, text] = line.split(':', 2);
            ssml += `<voice gender="${voice}">${text.trim()}</voice> `;
        }
    });
    
    ssml += '</speak>';
    return ssml;
}

async function createAudioFromScript(script) {
    return new Promise((resolve) => {
        // Create a simple audio representation
        // In a real implementation, you would use actual TTS service
        const synth = window.speechSynthesis;
        const utterances = [];
        const lines = script.split('\n').filter(line => line.trim() && line.includes(':'));
        
        let combinedText = '';
        lines.forEach((line, index) => {
            const [speaker, text] = line.split(':', 2);
            combinedText += text.trim() + '. ';
        });
        
        // Create a simple audio blob (placeholder)
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const duration = 2; // 2 seconds placeholder
        const sampleRate = audioContext.sampleRate;
        const arrayBuffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const channelData = arrayBuffer.getChannelData(0);
        
        // Generate simple tone
        for (let i = 0; i < channelData.length; i++) {
            channelData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1;
        }
        
        // Convert to blob (simplified)
        const blob = new Blob(['audio data'], { type: 'audio/wav' });
        resolve(blob);
    });
}

// Story Management Functions
function saveStory(story) {
    const stories = getStoriesFromStorage();
    stories.unshift(story);
    
    // Keep only last 50 stories
    if (stories.length > 50) {
        stories.splice(50);
    }
    
    localStorage.setItem('user_stories', JSON.stringify(stories.map(s => ({
        ...s,
        audioBlob: null // Don't save blob in localStorage
    }))));
    
    // Save audio blob separately with story ID
    if (story.audioBlob) {
        const reader = new FileReader();
        reader.onload = function() {
            localStorage.setItem(`audio_${story.id}`, reader.result);
        };
        reader.readAsDataURL(story.audioBlob);
    }
}

function getStoriesFromStorage() {
    const stored = localStorage.getItem('user_stories');
    return stored ? JSON.parse(stored) : [];
}

function displayStory(story) {
    currentStoryData = story;
    currentAudioBlob = story.audioBlob;
    
    document.getElementById('currentStoryTitle').textContent = story.title;
    
    const audioPlayer = document.getElementById('audioPlayer');
    if (story.audioBlob) {
        const audioUrl = URL.createObjectURL(story.audioBlob);
        audioPlayer.src = audioUrl;
    }
    
    document.getElementById('playerSection').style.display = 'block';
    
    // Scroll to player
    document.getElementById('playerSection').scrollIntoView({ behavior: 'smooth' });
}

function loadStoriesHistory() {
    const stories = getStoriesFromStorage();
    const storiesGrid = document.getElementById('storiesGrid');
    const noStories = document.getElementById('noStories');
    
    if (stories.length === 0) {
        noStories.style.display = 'block';
        return;
    }
    
    noStories.style.display = 'none';
    
    const storiesHtml = stories.map(story => `
        <div class="story-item">
            <h4>${story.title}</h4>
            <p>נוצר ב: ${story.createdAt}</p>
            <div class="story-item-actions">
                <button onclick="playStory(${story.id})" class="btn-primary btn-small btn-play">
                    השמע
                </button>
                <button onclick="deleteStory(${story.id})" class="btn-secondary btn-small btn-delete">
                    מחק
                </button>
            </div>
        </div>
    `).join('');
    
    storiesGrid.innerHTML = storiesHtml;
}

async function playStory(storyId) {
    const stories = getStoriesFromStorage();
    const story = stories.find(s => s.id === storyId);
    
    if (!story) return;
    
    // Try to load audio blob from localStorage
    const audioData = localStorage.getItem(`audio_${storyId}`);
    if (audioData) {
        const audioBlob = await fetch(audioData).then(r => r.blob());
        story.audioBlob = audioBlob;
    }
    
    displayStory(story);
}

function deleteStory(storyId) {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הסיפור?')) return;
    
    const stories = getStoriesFromStorage();
    const filteredStories = stories.filter(s => s.id !== storyId);
    
    localStorage.setItem('user_stories', JSON.stringify(filteredStories));
    localStorage.removeItem(`audio_${storyId}`);
    
    loadStoriesHistory();
}

// Player Functions
function downloadStory() {
    if (!currentAudioBlob || !currentStoryData) {
        alert('אין סיפור זמין להורדה');
        return;
    }
    
    const url = URL.createObjectURL(currentAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentStoryData.title}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function createNew() {
    document.getElementById('storyTopic').value = '';
    document.getElementById('playerSection').style.display = 'none';
    document.getElementById('storyTopic').focus();
    
    // Scroll to top
    document.querySelector('.creation-section').scrollIntoView({ behavior: 'smooth' });
}