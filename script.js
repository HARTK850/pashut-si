class StoryGenerator {
  constructor() {
    this.apiKey = localStorage.getItem("gemini_api_key") || "";
    this.currentAudioBlob = null;
    this.currentScript = "";
    this.speakers = [];
    this.settings = JSON.parse(localStorage.getItem("story_settings")) || {};
    this.history = JSON.parse(localStorage.getItem("story_history")) || [];
    this.currentStoryId = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadApiKey();
    this.showApiKeyModalIfNeeded();
    this.loadSettings();
    this.setupSelectModals();
  }

  bindEvents() {
    // API Key management
    document.getElementById("saveApiKey").addEventListener("click", () => this.saveApiKey());
    document.getElementById("apiKey").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.saveApiKey();
    });

    // Story generation
    document.getElementById("generateScript").addEventListener("click", () => this.generateScript());
    document.getElementById("generateAudio").addEventListener("click", () => this.generateAudio());

    // Audio controls
    document.getElementById("downloadAudio").addEventListener("click", () => this.downloadAudio());
    document.getElementById("createNew").addEventListener("click", () => this.resetForm());

    // Modals
    this.setupModals();

    // Settings
    document.getElementById("saveSettings").addEventListener("click", () => this.saveSettings());
  }

  setupModals() {
    // Close buttons
    const modals = document.querySelectorAll(".modal, .select-modal");
    modals.forEach(modal => {
      const close = modal.querySelector(".close");
      if (close) {
        close.addEventListener("click", () => {
          modal.style.display = "none";
        });
      }
    });

    // Settings button
    document.getElementById("settingsBtn").addEventListener("click", () => {
      document.getElementById("settingsModal").style.display = "flex";
    });

    // History button
    document.getElementById("historyBtn").addEventListener("click", () => {
      this.loadHistory();
      document.getElementById("historyModal").style.display = "flex";
    });

    // API Key button
    document.getElementById("apiKeyBtn").addEventListener("click", () => {
      document.getElementById("apiKeyModal").style.display = "flex";
    });
  }

  setupSelectModals() {
    const selectFields = [
      { trigger: "storyStyleTrigger", modal: "storyStyleModal", setting: "storyStyle" },
      { trigger: "storyLengthTrigger", modal: "storyLengthModal", setting: "storyLength" },
      { trigger: "speakingRateTrigger", modal: "speakingRateModal", setting: "speakingRate" },
      { trigger: "narrationStyleTrigger", modal: "narrationStyleModal", setting: "narrationStyle" },
      { trigger: "voicePitchTrigger", modal: "voicePitchModal", setting: "voicePitch" }
    ];

    selectFields.forEach(field => {
      const trigger = document.getElementById(field.trigger);
      const modal = document.getElementById(field.modal);
      const options = modal.querySelectorAll(".select-option");

      trigger.addEventListener("click", () => {
        modal.style.display = "flex";
      });

      options.forEach(option => {
        option.addEventListener("click", () => {
          this.settings[field.setting] = option.getAttribute("data-value");
          trigger.textContent = option.textContent;
          modal.style.display = "none";
        });
      });
    });
  }

  showApiKeyModalIfNeeded() {
    if (!this.apiKey) {
      document.getElementById("apiKeyModal").style.display = "flex";
    }
  }

  async saveApiKey() {
    const apiKeyInput = document.getElementById("apiKey");
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      this.showStatus("apiStatus", "אנא הכנס מפתח API תקין", "error");
      return;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Test" }] }],
          }),
        }
      );

      if (!response.ok) {
        throw new Error("API Key not valid");
      }

      this.apiKey = apiKey;
      localStorage.setItem("gemini_api_key", apiKey);
      this.showStatus("apiStatus", "מפתח API נשמר בהצלחה", "success");
      document.getElementById("apiKeyModal").style.display = "none";
    } catch (error) {
      this.showStatus("apiStatus", "מפתח API לא תקין", "error");
    }
  }

  loadApiKey() {
    if (this.apiKey) {
      document.getElementById("apiKey").value = this.apiKey;
    }
  }

  loadSettings() {
    const selectFields = [
      { id: "storyStyleTrigger", setting: "storyStyle", default: "תן לגמיני להחליט" },
      { id: "storyLengthTrigger", setting: "storyLength", default: "תן לגמיני להחליט" },
      { id: "speakingRateTrigger", setting: "speakingRate", default: "תן לגמיני להחליט" },
      { id: "narrationStyleTrigger", setting: "narrationStyle", default: "תן לגמיני להחליט (מומלץ)" },
      { id: "voicePitchTrigger", setting: "voicePitch", default: "תן לגמיני להחליט" }
    ];

    selectFields.forEach(field => {
      const elem = document.getElementById(field.id);
      if (elem) {
        const options = document.querySelectorAll(`#${field.id.replace("Trigger", "Modal")} .select-option`);
        let selectedText = field.default;
        options.forEach(option => {
          if (option.getAttribute("data-value") === this.settings[field.setting]) {
            selectedText = option.textContent;
          }
        });
        elem.textContent = selectedText;
      }
    });
  }

  saveSettings() {
    const fields = ["storyStyle", "storyLength", "speakingRate", "narrationStyle", "voicePitch"];
    fields.forEach(field => {
      if (this.settings[field] === undefined) {
        delete this.settings[field];
      }
    });
    localStorage.setItem("story_settings", JSON.stringify(this.settings));
    document.getElementById("settingsModal").style.display = "none";
  }

  loadHistory() {
    const historyList = document.getElementById("historyList");
    historyList.innerHTML = "";
    this.history.forEach((story, index) => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `<p>${story.idea.substring(0, 100)}...</p>`;
      item.addEventListener("click", () => this.loadStory(index));
      historyList.appendChild(item);
    });
  }

  loadStory(index) {
    const story = this.history[index];
    document.getElementById("storyIdea").value = story.idea;
    document.getElementById("scriptContent").value = story.script;
    this.currentScript = story.script;
    this.extractSpeakersFromScript(story.script);
    this.setupSpeakersList();
    this.showStep(2);
    this.currentAudioBlob = null;
    document.getElementById("audioPlayer").style.display = "none";
    document.getElementById("audioPlaceholder").style.display = "block";
    document.getElementById("downloadAudio").style.display = "none";
    document.getElementById("historyModal").style.display = "none";
  }

  saveToHistory() {
    const idea = document.getElementById("storyIdea").value.trim();
    const script = this.currentScript;
    if (idea && script) {
      this.history.unshift({ idea, script });
      // Limit history to 10 stories to prevent storage issues
      if (this.history.length > 10) {
        this.history.pop();
      }
      try {
        localStorage.setItem("story_history", JSON.stringify(this.history));
      } catch (error) {
        console.error("Error saving to localStorage:", error);
        this.showError("שגיאה בשמירת ההיסטוריה: מכסת האחסון מלאה. נסה למחוק סיפורים ישנים.");
      }
    }
  }

  async generateScript() {
    if (!this.validateApiKey()) return;

    const button = document.getElementById("generateScript");
    const spinner = button.querySelector(".spinner");
    const btnText = button.querySelector(".btn-text");

    this.setLoading(button, spinner, btnText, true);

    try {
      const storyIdea = document.getElementById("storyIdea").value.trim();
      const prompt = this.buildScriptPrompt(storyIdea);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const scriptContent = data.candidates[0].content.parts[0].text;

      document.getElementById("scriptContent").value = scriptContent;
      this.currentScript = scriptContent;

      this.extractSpeakersFromScript(scriptContent);
      this.setupSpeakersList();
      this.showStep(2);
      this.saveToHistory();
    } catch (error) {
      console.error("Error generating script:", error);
      this.showError("שגיאה ביצירת התסריט: " + error.message);
    } finally {
      this.setLoading(button, spinner, btnText, false);
    }
  }

  buildScriptPrompt(storyIdea) {
    let prompt = `צור סיפור מעניין ומקורי`;

    if (storyIdea) {
      prompt += ` על בסיס הרעיון: ${storyIdea}`;
    } else {
      prompt += ` עם רעיון מקורי ומעניין`;
    }

    if (this.settings.storyStyle) {
      prompt += `\n- סגנון: ${this.settings.storyStyle}`;
    } else {
      prompt += `\n- בחר סגנון מתאים (כמו דרמה, קומדיה, הרפתקאות) בעצמך`;
    }

    if (this.settings.storyLength) {
      prompt += `\n- הסיפור צריך להיות באורך ${this.settings.storyLength} דקות קריאה`;
    } else {
      prompt += `\n- הסיפור צריך להיות באורך 2-5 דקות קריאה`;
    }

    prompt += `

הוראות חשובות:
- כתב את הסיפור בפורמט של דובר אחד (קריין) שמספר את הסיפור
- השתמש בפורמט: [קריין]: הטקסט של הסיפור
- כתב בסגנון סיפור מסופר (לדוגמא: "חיים נכנס הביתה, אמו קיבלה אותו באהבה")
- אל תכתב דיאלוגים ישירים, אלא תאר את מה שקורה
- השתמש בניקוד עברי מלא בכל הטקסט של הסיפור כדי להפחית טעויות בהקראה

התסריט צריך להיות:
- מעניין ומושך
- מתאים לקהל הרחב
- עם קריין אחד שמספר את כל הסיפור

דוגמה לפורמט:
[קריין]: פַּעַם, בְּעִיר קְטַנָּה, חַי יֶלֶד בְּשֵׁם דָּוִד. יוֹם אֶחָד הוּא יָצָא לְחַפֵּשׂ הַרְפָּטְקָאוֹת. הוּא פָּגַשׁ חָבֵר יָשָׁן שֶׁהִצִּיעַ לוֹ לָלֶכֶת יַחַד לְחַפֵּשׂ אוֹצָר נִסְתָּר...

חשוב מאוד: החזר רק את התסריט עצמו ללא הקדמות, הסברים או טקסט נוסף. התחל ישירות עם השורה הראשונה של התסריט.`;

    return prompt;
  }

  async generateAudio() {
    if (!this.validateApiKey()) return;

    const button = document.getElementById("generateAudio");
    const spinner = button.querySelector(".spinner");
    const btnText = button.querySelector(".btn-text");

    this.setLoading(button, spinner, btnText, true);

    try {
      const scriptContent = document.getElementById("scriptContent").value.trim();

      if (!scriptContent) {
        throw new Error("אנא הכנס תסריט לפני יצירת השמע");
      }

      await this.generateAudioWithGeminiTTS(scriptContent);
      this.showStep(3);
    } catch (error) {
      console.error("Error generating audio:", error);
      this.showError("שגיאה ביצירת השמע: " + error.message);
    } finally {
      this.setLoading(button, spinner, btnText, false);
    }
  }

  async generateAudioWithGeminiTTS(scriptContent) {
    try {
      const segments = this.parseScriptSegments(scriptContent);

      if (segments.length === 0) {
        throw new Error("לא נמצאו קטעי דיבור בתסריט");
      }

      const allText = segments.map((seg) => seg.text).join(" ");

      console.log("[v0] Starting Gemini TTS generation with single narrator, text length:", allText.length);

      let narrationPrompt = "Narrate this story dynamically, adjusting tone, pace, and emotion to match the content: " + allText;

      if (this.settings.narrationStyle && this.settings.narrationStyle !== "") {
        narrationPrompt = `Narrate this story in a ${this.settings.narrationStyle} style: ` + allText;
      }

      const requestBody = {
        contents: [{ parts: [{ text: narrationPrompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Achird",
              },
            },
            speakingRate: this.settings.speakingRate ? parseFloat(this.settings.speakingRate) : undefined,
            pitch: this.settings.voicePitch ? parseFloat(this.settings.voicePitch) : undefined,
          },
        },
      };

      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${this.apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          },
        );

        if (response.ok || response.status !== 429) break;

        console.log(`[v0] Retry ${attempt + 1} after 47s due to 429`);
        await new Promise((r) => setTimeout(r, 47000));
      }

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("שגיאה 429: מלאה מכסת חינם, עבור לתשלום ב-https://console.cloud.google.com/");
        }
        const errorText = await response.text();
        console.error(`[v0] API Error:`, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (
        !data.candidates ||
        !data.candidates[0] ||
        !data.candidates[0].content ||
        !data.candidates[0].content.parts ||
        !data.candidates[0].content.parts[0] ||
        !data.candidates[0].content.parts[0].inlineData
      ) {
        throw new Error("לא התקבל אודיו מה-API");
      }

      const audioData = data.candidates[0].content.parts[0].inlineData.data;
      if (!audioData) {
        throw new Error("נתוני האודיו ריקים");
      }

      const pcmBytes = Uint8Array.from(atob(audioData), (c) => c.charCodeAt(0));
      const wavBlob = this.createWavBlob(pcmBytes);

      this.handleAudioResponse(wavBlob);
      console.log("[v0] Gemini TTS audio generation completed successfully");
    } catch (error) {
      console.error("[v0] Error in generateAudioWithGeminiTTS:", error);

      if (error.message.includes("429")) {
        throw error;
      }

      if (error.message.includes("400") || error.message.includes("HTTP error")) {
        throw new Error("שגיאה ב-API: נסה טקסט קצר יותר או בדוק את המפתח.");
      }

      throw error;
    }
  }

  parseScriptSegments(script) {
    const lines = script.split("\n");
    const segments = [];

    for (const line of lines) {
      const match = line.match(/\[([^\]]+)\]:\s*(.+)/);
      if (match) {
        const speaker = match[1].trim();
        const text = match[2].trim();

        if (!speaker.includes("צליל") && !speaker.includes("מוזיקה") && text) {
          segments.push({ speaker, text });
        }
      }
    }

    return segments;
  }

  handleAudioResponse(audioBlob) {
    try {
      console.log("[v0] Handling audio response, blob size:", audioBlob.size);
      this.currentAudioBlob = audioBlob;

      const audioPlayer = document.getElementById("audioPlayer");
      const audioPlaceholder = document.getElementById("audioPlaceholder");
      const downloadButton = document.getElementById("downloadAudio");

      const audioUrl = URL.createObjectURL(this.currentAudioBlob);
      audioPlayer.src = audioUrl;
      audioPlayer.style.display = "block";
      audioPlaceholder.style.display = "none";
      downloadButton.style.display = "inline-flex";

      console.log("[v0] Audio player setup complete");
    } catch (error) {
      console.error("[v0] Error handling audio response:", error);
      this.showError("שגיאה בעיבוד קובץ השמע: " + error.message);
    }
  }

  downloadAudio() {
    if (!this.currentAudioBlob) {
      this.showError("אין קובץ שמע להורדה");
      return;
    }

    const url = URL.createObjectURL(this.currentAudioBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `story_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("[v0] Audio download initiated");
  }

  validateApiKey() {
    if (!this.apiKey) {
      this.showError("אנא הכנס מפתח API תקין לפני המשך");
      return false;
    }
    return true;
  }

  setLoading(button, spinner, btnText, isLoading) {
    button.disabled = isLoading;
    spinner.style.display = isLoading ? "block" : "none";
    btnText.style.display = isLoading ? "none" : "block";
  }

  showStep(stepNumber) {
    for (let i = 1; i <= 3; i++) {
      const step = document.getElementById(`step${i}`);
      if (step) {
        step.style.display = i <= stepNumber ? "block" : "none";
      }
    }
  }

  showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.style.display = "block";

    if (type === "success") {
      setTimeout(() => {
        element.style.display = "none";
      }, 3000);
    }
  }

  showError(message) {
    const errorElement = document.getElementById("errorMessage");
    errorElement.textContent = message;
    errorElement.style.display = "block";

    setTimeout(() => {
      errorElement.style.display = "none";
    }, 5000);
  }

  resetForm() {
    document.getElementById("storyIdea").value = "";
    document.getElementById("scriptContent").value = "";

    this.speakers = [];
    this.currentScript = "";

    const audioPlayer = document.getElementById("audioPlayer");
    const audioPlaceholder = document.getElementById("audioPlaceholder");
    const downloadButton = document.getElementById("downloadAudio");

    audioPlayer.style.display = "none";
    audioPlayer.src = "";
    audioPlaceholder.style.display = "block";
    downloadButton.style.display = "none";

    this.currentAudioBlob = null;

    this.showStep(1);

    document.getElementById("errorMessage").style.display = "none";
  }

  createSilenceBlob(durationMs) {
    const sampleRate = 24000;
    const numSamples = Math.floor((sampleRate * durationMs) / 1000);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
      view.setInt16(44 + i * 2, 0, true);
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  createWavBlob(pcmData) {
    const numChannels = 1;
    const sampleRate = 24000;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length * 2;
    const fileSize = 44 + dataSize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, fileSize - 8, true);
    writeString(8, "WAVE");

    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    for (let i = 0; i < pcmData.length / 2; i++) {
      const sample = (pcmData[i * 2 + 1] << 8) | pcmData[i * 2];
      view.setInt16(44 + i * 2, sample, true);
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  extractSpeakersFromScript(script) {
    const speakerRegex = /\[([^\]]+)\]:/g;
    const speakerSet = new Set();
    let match;

    while ((match = speakerRegex.exec(script)) !== null) {
      const speakerName = match[1].trim();
      if (speakerName && !speakerName.includes("צליל") && !speakerName.includes("מוזיקה")) {
        speakerSet.add(speakerName);
      }
    }

    this.speakers = Array.from(speakerSet);
    console.log("[v0] Extracted speakers:", this.speakers);
  }

  setupSpeakersList() {
    if (this.speakers.length > 0) {
      console.log("[v0] Speakers setup complete:", this.speakers);
      this.showStatus("scriptStatus", `נמצאו ${this.speakers.length} דוברים: ${this.speakers.join(", ")}`, "success");
    } else {
      console.log("[v0] No speakers found in script");
      this.showStatus("scriptStatus", "לא נמצאו דוברים בתסריט", "error");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new StoryGenerator();
});
