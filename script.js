class StoryGenerator {
  constructor() {
    this.apiKey = localStorage.getItem("gemini_api_key") || "";
    this.currentAudioBlob = null;
    this.currentScript = "";
    this.speakers = [];
    this.settings = JSON.parse(localStorage.getItem("story_settings")) || { storyModel: "gemini-2.5-flash" };
    this.history = JSON.parse(localStorage.getItem("story_history")) || [];
    this.currentStoryId = null;
    this.currentEpisode = 1;
    this.seriesScripts = [];
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadApiKey();
    this.showApiKeyModalIfNeeded();
    this.loadSettings();
    this.setupSelectModals();
    this.setupSeriesOptions();
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
    document.getElementById("generateNextEpisode").addEventListener("click", () => this.generateNextEpisode());

    // Audio controls
    document.getElementById("downloadAudio").addEventListener("click", () => this.downloadAudio());
    document.getElementById("createNew").addEventListener("click", () => this.resetForm());

    // Modals
    this.setupModals();

    // Settings
    document.getElementById("saveSettings").addEventListener("click", () => this.saveSettings());
  }

  setupModals() {
    const modals = document.querySelectorAll(".modal, .select-modal");
    modals.forEach(modal => {
      const close = modal.querySelector(".close");
      if (close) {
        close.addEventListener("click", () => {
          modal.style.display = "none";
        });
      }
    });

    document.getElementById("settingsBtn").addEventListener("click", () => {
      document.getElementById("settingsModal").style.display = "flex";
    });

    document.getElementById("historyBtn").addEventListener("click", () => {
      this.loadHistory();
      document.getElementById("historyModal").style.display = "flex";
    });

    document.getElementById("apiKeyBtn").addEventListener("click", () => {
      document.getElementById("apiKeyModal").style.display = "flex";
    });
  }

  setupSelectModals() {
    const selectFields = [
      { trigger: "storyStyleTrigger", modal: "storyStyleModal", setting: "storyStyle", customInput: "storyStyleCustom" },
      { trigger: "storyLengthTrigger", modal: "storyLengthModal", setting: "storyLength", customInput: "storyLengthCustom" },
      { trigger: "storyModelTrigger", modal: "storyModelModal", setting: "storyModel" },
      { trigger: "voiceNameTrigger", modal: "voiceNameModal", setting: "voiceName" },
      { trigger: "speakingRateTrigger", modal: "speakingRateModal", setting: "speakingRate" },
      { trigger: "narrationStyleTrigger", modal: "narrationStyleModal", setting: "narrationStyle" },
      { trigger: "voicePitchTrigger", modal: "voicePitchModal", setting: "voicePitch" }
    ];

    selectFields.forEach(field => {
      const trigger = document.getElementById(field.trigger);
      const modal = document.getElementById(field.modal);
      const options = modal.querySelectorAll(".select-option");
      const customInput = field.customInput ? document.getElementById(field.customInput) : null;

      trigger.addEventListener("click", () => {
        modal.style.display = "flex";
      });

      options.forEach(option => {
        option.addEventListener("click", () => {
          const value = option.getAttribute("data-value");
          this.settings[field.setting] = value;
          trigger.textContent = option.textContent;
          modal.style.display = "none";

          if (value === "other" && customInput) {
            customInput.style.display = "block";
            customInput.focus();
            customInput.addEventListener("input", () => {
              this.settings[field.setting] = customInput.value.trim();
              trigger.textContent = customInput.value.trim() || option.textContent;
            }, { once: true });
          } else if (customInput) {
            customInput.style.display = "none";
            customInput.value = "";
          }
        });
      });
    });
  }

  setupSeriesOptions() {
    const seriesCheckbox = document.getElementById("seriesStory");
    const episodeCountGroup = document.getElementById("episodeCountGroup");
    seriesCheckbox.addEventListener("change", () => {
      episodeCountGroup.style.display = seriesCheckbox.checked ? "block" : "none";
      if (!seriesCheckbox.checked) {
        this.settings.episodeCount = undefined;
      }
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
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
      this.showStatus("apiStatus", "מפתח API תקין! החלון ייסגר בעוד מספר שניות...", "success");
      setTimeout(() => {
        document.getElementById("apiKeyModal").style.display = "none";
        document.getElementById("apiStatus").style.display = "none";
      }, 3000);
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
      { id: "storyStyleTrigger", setting: "storyStyle", default: "תן לגמיני להחליט", customInput: "storyStyleCustom" },
      { id: "storyLengthTrigger", setting: "storyLength", default: "תן לגמיני להחליט", customInput: "storyLengthCustom" },
      { id: "storyModelTrigger", setting: "storyModel", default: "גמיני 2.5 פלאש" },
      { id: "voiceNameTrigger", setting: "voiceName", default: "תן לגמיני להחליט" },
      { id: "speakingRateTrigger", setting: "speakingRate", default: "תן לגמיני להחליט" },
      { id: "narrationStyleTrigger", setting: "narrationStyle", default: "תן לגמיני להחליט (מומלץ)" },
      { id: "voicePitchTrigger", setting: "voicePitch", default: "תן לגמיני להחליט" }
    ];

    selectFields.forEach(field => {
      const elem = document.getElementById(field.id);
      const customInput = field.customInput ? document.getElementById(field.customInput) : null;
      if (elem) {
        const options = document.querySelectorAll(`#${field.id.replace("Trigger", "Modal")} .select-option`);
        let selectedText = field.default;
        let isCustom = false;

        options.forEach(option => {
          if (option.getAttribute("data-value") === this.settings[field.setting]) {
            selectedText = option.textContent;
          }
        });

        if (this.settings[field.setting] && !Array.from(options).some(option => option.getAttribute("data-value") === this.settings[field.setting]) && field.customInput) {
          selectedText = this.settings[field.setting];
          isCustom = true;
        }

        elem.textContent = selectedText;
        if (customInput && isCustom) {
          customInput.style.display = "block";
          customInput.value = this.settings[field.setting];
        }
      }
    });

    // Load series settings
    const seriesCheckbox = document.getElementById("seriesStory");
    const episodeCountGroup = document.getElementById("episodeCountGroup");
    const episodeCountInput = document.getElementById("episodeCount");
    const addIntroCheckbox = document.getElementById("addIntro");

    if (this.settings.seriesStory) {
      seriesCheckbox.checked = true;
      episodeCountGroup.style.display = "block";
      episodeCountInput.value = this.settings.episodeCount || "";
    }

    if (this.settings.addIntro) {
      addIntroCheckbox.checked = true;
    }
  }

  saveSettings() {
    const fields = ["storyStyle", "storyLength", "storyModel", "voiceName", "speakingRate", "narrationStyle", "voicePitch"];
    fields.forEach(field => {
      if (this.settings[field] === undefined || this.settings[field] === "" || this.settings[field] === "תן לגמיני להחליט") {
        delete this.settings[field];
      }
    });

    const seriesCheckbox = document.getElementById("seriesStory");
    this.settings.seriesStory = seriesCheckbox.checked;
    if (seriesCheckbox.checked) {
      const episodeCount = document.getElementById("episodeCount").value;
      if (!episodeCount || episodeCount < 1) {
        this.showError("חובה להגדיר מספר פרקים עבור סיפור בהמשכים");
        return;
      }
      this.settings.episodeCount = parseInt(episodeCount);
    } else {
      delete this.settings.episodeCount;
    }

    const addIntroCheckbox = document.getElementById("addIntro");
    this.settings.addIntro = addIntroCheckbox.checked;

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
    this.seriesScripts = story.seriesScripts || [story.script];
    this.currentEpisode = story.currentEpisode || 1;
    this.extractSpeakersFromScript(story.script);
    this.setupSpeakersList();
    this.showStep(2);
    this.currentAudioBlob = null;
    document.getElementById("audioPlayer").style.display = "none";
    document.getElementById("audioPlaceholder").style.display = "block";
    document.getElementById("downloadAudio").style.display = "none";
    document.getElementById("continueStorySection").style.display = this.settings.seriesStory ? "block" : "none";
    document.getElementById("historyModal").style.display = "none";
  }

  saveToHistory() {
    const idea = document.getElementById("storyIdea").value.trim();
    const script = this.currentScript;
    if (idea && script) {
      this.history.unshift({
        idea,
        script,
        seriesScripts: this.seriesScripts,
        currentEpisode: this.currentEpisode
      });
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

      const model = this.settings.storyModel || "gemini-2.5-flash";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
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
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let scriptContent = data.candidates[0].content.parts[0].text;

      let processedScript = scriptContent;
      const firstDialogueIndex = processedScript.indexOf('[');
      if (firstDialogueIndex > -1) {
        processedScript = processedScript.substring(firstDialogueIndex);
      }
      processedScript = processedScript.trim();

      document.getElementById("scriptContent").value = processedScript;
      this.currentScript = processedScript;
      this.seriesScripts = this.settings.seriesStory ? [processedScript] : [];
      this.currentEpisode = 1;

      this.extractSpeakersFromScript(processedScript);
      this.setupSpeakersList();
      this.showStep(2);
      this.saveToHistory();
      document.getElementById("continueStorySection").style.display = this.settings.seriesStory ? "block" : "none";
    } catch (error) {
      console.error("Error generating script:", error);
      this.showError("שגיאה ביצירת התסריט: " + error.message);
    } finally {
      this.setLoading(button, spinner, btnText, false);
    }
  }

  async generateNextEpisode() {
    if (!this.validateApiKey()) return;

    const button = document.getElementById("generateNextEpisode");
    const spinner = button.querySelector(".spinner");
    const btnText = button.querySelector(".btn-text");

    this.setLoading(button, spinner, btnText, true);

    try {
      const storyNotes = document.getElementById("storyNotes").value.trim();
      const prompt = this.buildNextEpisodePrompt(storyNotes);

      const model = this.settings.storyModel || "gemini-2.5-flash";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
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
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let scriptContent = data.candidates[0].content.parts[0].text;

      let processedScript = scriptContent;
      const firstDialogueIndex = processedScript.indexOf('[');
      if (firstDialogueIndex > -1) {
        processedScript = processedScript.substring(firstDialogueIndex);
      }
      processedScript = processedScript.trim();

      document.getElementById("scriptContent").value = processedScript;
      this.currentScript = processedScript;
      this.seriesScripts.push(processedScript);
      this.currentEpisode++;

      this.extractSpeakersFromScript(processedScript);
      this.setupSpeakersList();
      this.showStep(2);
      this.saveToHistory();
      document.getElementById("continueStorySection").style.display = this.settings.seriesStory && this.currentEpisode < this.settings.episodeCount ? "block" : "none";
    } catch (error) {
      console.error("Error generating next episode:", error);
      this.showError("שגיאה ביצירת פרק הבא: " + error.message);
    } finally {
      this.setLoading(button, spinner, btnText, false);
    }
  }

  buildScriptPrompt(storyIdea) {
    let lengthPrompt = "אורך הסיפור צריך להיות לפחות 10 דקות ויכול להגיע עד 15 דקות, עם דיאלוגים מפורטים ומגוונים.";
    if (this.settings.storyLength && this.settings.storyLength !== "תן לגמיני להחליט") {
      const [min, max] = this.settings.storyLength.split('-').map(Number);
      lengthPrompt = `אורך הסיפור צריך להיות בין ${min} ל-${max} דקות, עם דיאלוגים מפורטים ומגוונים שמתאימים לאורך זה.`;
    } else if (this.settings.storyLength && this.settings.storyLength === "other" && this.settings.storyLengthCustom) {
      lengthPrompt = `אורך הסיפור צריך להיות ${this.settings.storyLengthCustom} דקות, עם דיאלוגים מפורטים ומגוונים שמתאימים לאורך זה.`;
    }

    let seriesPrompt = "";
    if (this.settings.seriesStory && this.settings.episodeCount) {
      seriesPrompt = `הסיפור הוא חלק מסדרה בת ${this.settings.episodeCount} פרקים. צור תסריט לפרק הראשון שמבסס את העלילה ומשאיר פתח להמשך אם יש פרקים נוספים, או מסיים את העלילה אם זה הפרק הראשון והאחרון.`;
    }

    let introPrompt = "";
    if (this.settings.addIntro) {
      const storyStyle = this.settings.storyStyle || "מגוון";
      introPrompt = `התחל את התסריט עם פתיח קצר הכולל שם ייחודי לסיפור, סגנון הסיפור (${storyStyle}), וברכת "האזנה ערבה!" (לדוגמה: "הבוגד - סיפור מתח, האזנה ערבה!"). הפתיח לא צריך להיות בתוך סוגריים מרובעים או כחלק מדיאלוג, והוא צריך להיקרא כחלק טבעי מהסיפור על ידי ה-TTS ללא קריאת סוגריים או הוראות.`;
    }

    let prompt = `צור תסריט מפורט ומלא בעברית על פי הרעיון הבא: "${storyIdea}". ${lengthPrompt} ${seriesPrompt} ${introPrompt}

הנחיות קריטיות לפורמט הפלט:
- ניקוד מלא וחובה: יש לנקד את כל טקסט הדיאלוגים בתסריט בניקוד עברי תקני ומלא. זהו תנאי הכרחי. כל מילה בטקסט הדיאלוג חייבת להיות מנוקדת במלואה.
- פורמט שורות קבוע: כל שורת דיאלוג חייבת להיות בפורמט: [שם הדמות]: (הנחיית טון ורגש) טקסט הדיאלוג המנוקד.
- פלט נקי: הפלט חייב להכיל אך ורק את שורות הדיאלוג של התסריט, כולל הפתיח אם נדרש. אין לכלול כותרות, רשימת דמויות, או כל טקסט אחר לפני שורת הדיאלוג הראשונה שמתחילה ב- '[' או לפני הפתיח.
- וודא שהתסריט כולל מספיק דיאלוגים ותיאורים קצרים כדי לעמוד באורך המבוקש.`;

    return prompt;
  }

  buildNextEpisodePrompt(storyNotes) {
    let lengthPrompt = "אורך הפרק צריך להיות לפחות 10 דקות ויכול להגיע עד 15 דקות, עם דיאלוגים מפורטים ומגוונים.";
    if (this.settings.storyLength && this.settings.storyLength !== "תן לגמיני להחליט") {
      const [min, max] = this.settings.storyLength.split('-').map(Number);
      lengthPrompt = `אורך הפרק צריך להיות בין ${min} ל-${max} דקות, עם דיאלוגים מפורטים ומגוונים שמתאימים לאורך זה.`;
    } else if (this.settings.storyLength && this.settings.storyLength === "other" && this.settings.storyLengthCustom) {
      lengthPrompt = `אורך הפרק צריך להיות ${this.settings.storyLengthCustom} דקות, עם דיאלוגים מפורטים ומגוונים שמתאימים לאורך זה.`;
    }

    let introPrompt = "";
    if (this.settings.addIntro) {
      const storyStyle = this.settings.storyStyle || "מגוון";
      introPrompt = `התחל את התסריט עם פתיח קצר הכולל שם ייחודי לסיפור, סגנון הסיפור (${storyStyle}), מספר הפרק, וברכת "האזנה ערבה!" (לדוגמה: "הבוגד - פרק 2, סיפור מתח, האזנה ערבה!"). הפתיח לא צריך להיות בתוך סוגריים מרובעים או כחלק מדיאלוג, והוא צריך להיקרא כחלק טבעי מהסיפור על ידי ה-TTS ללא קריאת סוגריים או הוראות.`;
    }

    const previousScripts = this.seriesScripts.join("\n\n---\n\n");
    let prompt = `צור תסריט מפורט ומלא בעברית לפרק ${this.currentEpisode + 1} של סדרת סיפורים, בהתבסס על הפרקים הקודמים הבאים:\n\n${previousScripts}\n\nהערות או הנחיות לפרק הבא: "${storyNotes}". ${lengthPrompt} ${introPrompt}

הנחיות קריטיות לפורמט הפלט:
- ניקוד מלא וחובה: יש לנקד את כל טקסט הדיאלוגים בתסריט בניקוד עברי תקני ומלא. זהו תנאי הכרחי. כל מילה בטקסט הדיאלוג חייבת להיות מנוקדת במלואה.
- פורמט שורות קבוע: כל שורת דיאלוג חייבת להיות בפורמט: [שם הדמות]: (הנחיית טון ורגש) טקסט הדיאלוג המנוקד.
- פלט נקי: הפלט חייב להכיל אך ורק את שורות הדיאלוג של התסריט, כולל הפתיח אם נדרש. אין לכלול כותרות, רשימת דמויות, או כל טקסט אחר לפני שורת הדיאלוג הראשונה שמתחילה ב- '[' או לפני הפתיח.
- וודא שהתסריט כולל מספיק דיאלוגים ותיאורים קצרים כדי לעמוד באורך המבוקש.
- אם זה הפרק האחרון בסדרה (פרק ${this.settings.episodeCount} מתוך ${this.settings.episodeCount}), וודא שהעלילה מסתיימת בצורה מלאה וברורה ללא פתח להמשך.`;

    return prompt;
  }

  async generateAudio() {
    if (!this.validateApiKey()) return;

    const button = document.getElementById("generateAudio");
    const spinner = button.querySelector(".spinner");
    const btnText = button.querySelector(".btn-text");

    this.setLoading(button, spinner, btnText, true);

    try {
      await this.generateAudioWithGeminiTTS();
      this.showStep(3);
    } catch (error) {
      console.error("Error generating audio:", error);
      if (error.message.includes("429")) {
        this.showError("מכסת API מלאה. נסה מאוחר יותר או שדרג חשבון.");
      } else {
        this.showError("שגיאה ביצירת שמע: " + error.message);
      }
    } finally {
      this.setLoading(button, spinner, btnText, false);
    }
  }

  async generateAudioWithGeminiTTS() {
    const narrationText = this.currentScript;
    if (!narrationText) {
      throw new Error("אין תסריט להקראה");
    }

    const lines = narrationText.split('\n').filter(line => line.trim());
    let processedText = '';
    const toneInstructions = [];

    const dialogueRegex = /\[([^\]]+)\]: \(([^\)]+)\) (.+)/;

    for (const line of lines) {
      const match = line.match(dialogueRegex);
      if (match) {
        const character = match[1].trim();
        const tone = match[2].trim();
        const dialogue = match[3].trim();
        toneInstructions.push(`Speak the following line for ${character} in a ${tone} tone: ${dialogue}`);
        processedText += `${dialogue}\n`;
      } else {
        processedText += `${line}\n`;
      }
    }

    const narrationPrompt = `TTS the following conversation in Hebrew. Use the tone instructions provided to determine the speaking style for each line, but do not read the tone instructions or character names aloud (ignore anything within square brackets []). Apply the specified tone for each line until the next line or tone change. Ensure the text is spoken exactly as provided, preserving all Hebrew vocalization (niqqud):\n\nTone Instructions:\n${toneInstructions.join('\n')}\n\nText to speak:\n${processedText}`;

    const requestBody = {
      contents: [{
        parts: [{ text: narrationPrompt }]
      }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: this.settings.voiceName || "kore"
            }
          }
        }
      }
    };

    const model = "gemini-2.5-flash-preview-tts";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) break;

      if (response.status === 429) {
        console.log(`Retry ${attempt + 1} after 60s due to 429`);
        await new Promise((r) => setTimeout(r, 60000));
      } else {
        const errorText = await response.text();
        console.error("Full error response:", errorText);
        throw new Error(`שגיאת API: ${errorText}`);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Full error response:", errorText);
      throw new Error(`שגיאת API: ${errorText}`);
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0] || !data.candidates[0].content.parts[0].inlineData || !data.candidates[0].content.parts[0].inlineData.data) {
      throw new Error("לא התקבל אודיו תקין מה-API");
    }

    const audioData = data.candidates[0].content.parts[0].inlineData.data;
    if (!audioData || audioData.length === 0) {
      throw new Error("נתוני האודיו ריקים");
    }

    const pcmBytes = Uint8Array.from(atob(audioData), (c) => c.charCodeAt(0));
    const wavBlob = this.createWavBlob(pcmBytes);

    if (wavBlob.size < 44) {
      throw new Error("קובץ השמע שנוצר קטן מדי");
    }

    this.handleAudioResponse(wavBlob);
  }

  handleAudioResponse(audioBlob) {
    if (audioBlob.size === 0) {
      console.error("Generated audio blob is empty");
      this.showError("קובץ השמע שנוצר ריק - בדוק את הקונסולה לשגיאות");
      return;
    }

    this.currentAudioBlob = audioBlob;

    const audioPlayer = document.getElementById("audioPlayer");
    const audioPlaceholder = document.getElementById("audioPlaceholder");
    const downloadButton = document.getElementById("downloadAudio");

    const audioUrl = URL.createObjectURL(this.currentAudioBlob);
    audioPlayer.src = audioUrl;
    audioPlayer.style.display = "block";
    audioPlaceholder.style.display = "none";
    downloadButton.style.display = "inline-flex";
  }

  downloadAudio() {
    if (!this.currentAudioBlob) {
      this.showError("אין קובץ שמע להורדה");
      return;
    }

    const url = URL.createObjectURL(this.currentAudioBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `story_episode_${this.currentEpisode}_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    for (let i = 1; i <= 4; i++) {
      const step = document.getElementById(`step${i}`);
      if (step) {
        step.style.display = i <= stepNumber ? "block" : "none";
      }
    }
    document.getElementById("continueStorySection").style.display = stepNumber >= 3 && this.settings.seriesStory && this.currentEpisode < this.settings.episodeCount ? "block" : "none";
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
    const element = document.getElementById("errorMessage");
    element.textContent = message;
    element.className = "status-message error";
    element.style.display = "block";

    setTimeout(() => {
      element.style.display = "none";
    }, 5000);
  }

  resetForm() {
    document.getElementById("storyIdea").value = "";
    document.getElementById("scriptContent").value = "";
    document.getElementById("storyNotes").value = "";

    this.speakers = [];
    this.currentScript = "";
    this.seriesScripts = [];
    this.currentEpisode = 1;

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
    const dataSize = pcmData.length;
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

    for (let i = 0; i < dataSize; i++) {
      view.setUint8(44 + i, pcmData[i]);
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  extractSpeakersFromScript(script) {
    const lines = script.split('\n').filter(line => line.trim());
    const speakerRegex = /\[([^\]]+)\]:/;
    this.speakers = [...new Set(lines.map(line => {
      const match = line.match(speakerRegex);
      return match ? match[1] : null;
    }).filter(s => s))];
  }

  setupSpeakersList() {
    // Not implemented in this version, can be added if needed
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new StoryGenerator();
});
