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
    this.seriesVoiceSettings = {}; 
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

  // **** תיקון API KEY VALIDATION ****
  async saveApiKey() {
    const apiKeyInput = document.getElementById("apiKey");
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      this.showStatus("apiStatus", "אנא הכנס מפתח API תקין", "error");
      return;
    }

    try {
      // בדיקה פשוטה עם מודל יציב לבדיקה
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Test" }] }],
          }),
        }
      );

      // בדיקת שגיאות נפוצות במיוחד 400 (API Key not valid)
      if (response.status === 400) {
           const errorData = await response.json();
           if (errorData.error.message.includes('API key not valid')) {
               throw new Error("API Key not valid");
           }
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.apiKey = apiKey;
      localStorage.setItem("gemini_api_key", apiKey);
      this.showStatus("apiStatus", "מפתח API תקין! החלון ייסגר בעוד מספר שניות...", "success");
      setTimeout(() => {
        document.getElementById("apiKeyModal").style.display = "none";
        document.getElementById("apiStatus").style.display = "none";
      }, 3000);
    } catch (error) {
      console.error("API Key Check Error:", error);
      this.showStatus("apiStatus", "מפתח API לא תקין או שגיאת רשת", "error");
    }
  }
  // **********************************

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
    document.getElementById("continueStorySection").style.display = "none";
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

      // **** תיקון לוגיקת ניקוי הפלט ****
      let processedScript = scriptContent;
      // הסרת כל טקסט לפני הדיאלוג או הפתיח הראשון
      const firstDialogueIndex = processedScript.indexOf('[');
      if (firstDialogueIndex > -1) {
        processedScript = processedScript.substring(firstDialogueIndex);
      }
      processedScript = processedScript.trim();

      // ניקוי נוסף: הסרת שורות אקשן שגויות שהתחילו בטעות ב- [ ]
      // שומרים רק שורות שהן דיאלוג ([דמות]: ...) או אקשן בתוך סוגריים עגולים.
      // הפילטר הזה שומר רק שורות שמכילות את הסימן ":" (דיאלוג), או שהן לא מתחילות ב- '['
      processedScript = processedScript.split('\n')
          .filter(line => line.includes(':') || !line.trim().startsWith('['))
          .join('\n');
      
      processedScript = processedScript.trim();
      // **********************************

      document.getElementById("scriptContent").value = processedScript;
      this.currentScript = processedScript;
      this.seriesScripts = this.settings.seriesStory ? [processedScript] : [];
      this.currentEpisode = 1;

      this.extractSpeakersFromScript(processedScript);
      this.setupSpeakersList();
      this.showStep(2);
      this.saveToHistory();
      document.getElementById("continueStorySection").style.display = "none";
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
      
      // ניקוי נוסף: הסרת שורות אקשן שגויות שהתחילו בטעות ב- [ ]
      processedScript = processedScript.split('\n')
          .filter(line => line.includes(':') || !line.trim().startsWith('['))
          .join('\n');
      
      processedScript = processedScript.trim();

      document.getElementById("scriptContent").value = processedScript;
      this.currentScript = processedScript;
      this.seriesScripts.push(processedScript);
      this.currentEpisode++;

      this.extractSpeakersFromScript(processedScript);
      this.setupSpeakersList();
      this.showStep(2);
      this.saveToHistory();
      document.getElementById("continueStorySection").style.display = "none";
    } catch (error) {
      console.error("Error generating next episode:", error);
      this.showError("שגיאה ביצירת פרק הבא: " + error.message);
    } finally {
      this.setLoading(button, spinner, btnText, false);
    }
  }
  
  // **** תיקון PROMPT: שיפור פורמט התסריט ****
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
      introPrompt = `צור פתיח קצר (עד 2 שורות) הכולל שם ייחודי לסיפור, סגנון הסיפור (${storyStyle}), וברכת "האזנה ערבה!". הפתיח חייב להיות בפורמט: [פתיח]: (טון נייטרלי) טקסט הפתיח המנוקד. מיד לאחר הפתיח, התחל את שורות הדיאלוג של הסיפור.`;
    }

    let prompt = `צור תסריט מפורט ומלא בעברית על פי הרעיון הבא: "${storyIdea}". ${lengthPrompt}

${seriesPrompt} ${introPrompt}

הנחיות קריטיות לפורמט הפלט:
1. **ניקוד מלא וחובה:** יש לנקד את כל טקסט הדיאלוגים בתסריט בניקוד עברי תקני ומלא. זהו תנאי הכרחי.
2. **פורמט דיאלוג קבוע:** כל שורת דיאלוג **חייבת** להיות בפורמט: **[שם הדמות]: (הנחיית טון ורגש) טקסט הדיאלוג המנוקד.**
3. **הפרדת שורות אקשן:** **אל תשתמש** בסוגריים מרובעים [ ] בשום מקום אחר מלבד שם הדמות (לדוגמה: [דמות]). אם יש צורך בתיאור אקשן או תיאור סביבה, השתמש רק בסוגריים **עגולים** () וודא שהטקסט אינו מנוקד, לדוגמה: **(צליל של דלת נפתחת).** המערכת תקריא כל שורה.
4. **פלט נקי:** הפלט חייב להכיל אך ורק את שורות הדיאלוג ושורות האקשן (בתוך סוגריים עגולים בלבד). אין לכלול כותרות, רשימת דמויות או כל טקסט אחר לפני שורת הדיאלוג/פתיח הראשונה.
5. **סיום:** וודא שהתסריט מסתיים בסימן דיאלוג או בשורת אקשן אחת בתוך סוגריים עגולים.`;

    return prompt;
  }
  // **********************************

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
      introPrompt = `צור פתיח קצר (עד 2 שורות) הכולל שם ייחודי לסיפור, סגנון הסיפור (${storyStyle}), מספר הפרק, וברכת "האזנה ערבה!". הפתיח חייב להיות בפורמט: [פתיח]: (טון נייטרלי) טקסט הפתיח המנוקד. מיד לאחר הפתיח, התחל את שורות הדיאלוג של הסיפור.`;
    }

    const previousScripts = this.seriesScripts.join("\n\n---\n\n");
    let prompt = `צור תסריט מפורט ומלא בעברית לפרק ${this.currentEpisode + 1} של סדרת סיפורים, בהתבסס על הפרקים הקודמים הבאים:\n\n${previousScripts}\n\nהערות או הנחיות לפרק הבא: "${storyNotes}". ${lengthPrompt} ${introPrompt}

הנחיות קריטיות לפורמט הפלט:
1. **ניקוד מלא וחובה:** יש לנקד את כל טקסט הדיאלוגים בתסריט בניקוד עברי תקני ומלא. זהו תנאי הכרחי.
2. **פורמט דיאלוג קבוע:** כל שורת דיאלוג **חייבת** להיות בפורמט: **[שם הדמות]: (הנחיית טון ורגש) טקסט הדיאלוג המנוקד.**
3. **הפרדת שורות אקשן:** **אל תשתמש** בסוגריים מרובעים [ ] בשום מקום אחר מלבד שם הדמות (לדוגמה: [דמות]). אם יש צורך בתיאור אקשן או תיאור סביבה, השתמש רק בסוגריים **עגולים** () וודא שהטקסט אינו מנוקד, לדוגמה: **(צליל של דלת נפתחת).** המערכת תקריא כל שורה.
4. **פלט נקי:** הפלט חייב להכיל אך ורק את שורות הדיאלוג ושורות האקשן (בתוך סוגריים עגולים בלבד). אין לכלול כותרות, רשימת דמויות או כל טקסט אחר לפני שורת הדיאלוג/פתיח הראשונה.
5. **סיום:** וודא שהתסריט מסתיים בסימן דיאלוג או בשורת אקשן אחת בתוך סוגריים עגולים.
6. אם זה הפרק האחרון בסדרה (פרק ${this.settings.episodeCount} מתוך ${this.settings.episodeCount}), וודא שהעלילה מסתיימת בצורה מלאה וברורה ללא פתח להמשך.`;

    return prompt;
  }

  async generateAudio() {
    if (!this.validateApiKey()) return;

    const button = document.getElementById("generateAudio");
    const spinner = button.querySelector(".spinner");
    const btnText = button.querySelector(".btn-text");

    this.setLoading(button, spinner, btnText, true);

    try {
      await this.generateAudioAndMix(); 
      this.showStep(3);
      if (this.settings.seriesStory && this.currentEpisode < this.settings.episodeCount) {
        document.getElementById("continueStorySection").style.display = "block";
      } else {
        document.getElementById("continueStorySection").style.display = "none";
      }
    } catch (error) {
      console.error("Error generating audio:", error);
      if (error.message.includes("429")) {
        this.showError("מכסת API מלאה או מוגבלת (429). המתן ונסה שוב, או שדרג את התוכנית.");
      } else if (error.message.includes("Vercel")) {
        this.showError("שגיאה במיקסינג: וודא שכתובת ה-Vercel נכונה ושהקובץ `background.mp3` קיים. " + error.message);
      } else {
        this.showError("שגיאה ביצירת שמע: " + error.message);
      }
    } finally {
      this.setLoading(button, spinner, btnText, false);
    }
  }

  async generateAudioAndMix() {
    // *** החלף את ה-URL הבא בכתובת ה-Vercel הסופית שלך: ***
    const VERCEL_ENDPOINT = 'https://pashut-si.vercel.app/api/mix-audio';
    // ***************************************************************

    const narrationText = this.currentScript;
    if (!narrationText) {
      throw new Error("אין תסריט להקראה");
    }

    // פיצול התסריט לשורות (קטעי אודיו בודדים)
    const lines = narrationText.split('\n').filter(line => line.trim());
    const base64Segments = [];
    // Regex מזהה: [דמות]: (הנחיה) טקסט מנוקד
    const dialogueRegex = /\[([^\]]+)\]: \(([^\)]+)\) (.+)/; 

    // --- שלב 1: יצירת קטעי אודיו בודדים מ-Gemini TTS ---
    this.showStatus("scriptStatus", `מייצר ${lines.length} קטעי שמע בודדים...`, "success");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let processedText = line;
        let voiceName = this.settings.voiceName || "kore";
        
        const match = line.match(dialogueRegex);
        if (match) {
            // שורת דיאלוג: [דמות]: (טון) דיאלוג
            const dialogue = match[3].trim();
            processedText = dialogue;
        } else {
            // שורת אקשן / פתיח: (טקסט) 
            // אם השורה מתחילה בסוגריים עגולים (הנחיית אקשן) נשאיר אותה להקראה
            if (line.trim().startsWith('(') && line.trim().endsWith(')')) {
                processedText = line.trim().slice(1, -1).trim(); // מסיר סוגריים
            }
        }
        
        // יצירת קטע שמע יחיד והמרתו ל-Base64 WAV
        const base64Data = await this.generateSegmentBase64(processedText, voiceName);
        base64Segments.push(base64Data);
        
        this.showStatus("scriptStatus", `הושלם קטע ${i + 1} מתוך ${lines.length}.`, "success");
    }
    
    // --- שלב 2: שליחת כל הקטעים לשרת המיקסינג של Vercel ---
    this.showStatus("scriptStatus", `שולח ${base64Segments.length} קטעים לשרת המיקסינג...`, "success");
    
    const mixResponse = await fetch(VERCEL_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            audioSegments: base64Segments, // מערך של מחרוזות Base64
        }),
    });
    
    if (!mixResponse.ok) {
        const errorText = await mixResponse.text();
        console.error("Vercel Mixer Error:", errorText);
        throw new Error(`שגיאה בשרת המיקסינג של Vercel: ${mixResponse.status} - ${errorText}`);
    }

    // קבלת קובץ ה-WAV הסופי מהשרת
    const finalWavBlob = await mixResponse.blob();
    
    this.handleAudioResponse(finalWavBlob);
    this.showStatus("scriptStatus", "המיקסינג הושלם בהצלחה!", "success");
  }

  // **** תיקון מכסת ה-API (429) ****
  async generateSegmentBase64(text, voiceName) {
    
    const requestBody = {
      contents: [{
        parts: [{ text: text }]
      }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName
            }
          }
        }
      }
    };

    const model = "gemini-2.5-flash-preview-tts";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    let response;
    // הגדלת ניסיונות ל-5. 
    // המתנה ארוכה יותר בין ניסיונות (90 שניות) בגלל מגבלת המכסה הנמוכה.
    for (let attempt = 0; attempt < 5; attempt++) { 
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) break;

      if (response.status === 429) {
        console.log(`Retry ${attempt + 1} after 90s due to 429`);
        // אם זה הניסיון האחרון, צא מהלולאה
        if (attempt === 4) break; 
        
        await new Promise((r) => setTimeout(r, 90000)); // המתנה של 90 שניות
      } else {
        const errorText = await response.text();
        console.error("Full error response:", errorText);
        throw new Error(`שגיאת API ב-TTS (קטע בודד): ${errorText}`);
      }
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Full error response:", errorText);
        throw new Error(`שגיאת API ב-TTS (קטע בודד): ${errorText}`);
    }
    // **********************************

    const data = await response.json();
    const audioData = data.candidates[0].content.parts[0].inlineData.data;

    if (!audioData || audioData.length === 0) {
      throw new Error("נתוני האודיו ריקים לקטע: " + text.substring(0, 50));
    }

    // המרת נתוני ה-PCM הגולמיים שמתקבלים מה-API לקובץ WAV תקין (Blob)
    const pcmBytes = Uint8Array.from(atob(audioData), (c) => c.charCodeAt(0));
    const wavBlob = this.createWavBlob(pcmBytes);

    // קריאת ה-Blob והמרתו למחרוזת Base64 כדי לשלוח לשרת המיקסינג
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // התוצאה היא 'data:audio/wav;base64,...'. אנחנו צריכים רק את המחרוזת לאחר הפסיק.
            const base64String = reader.result.split(',')[1]; 
            resolve(base64String);
        };
        reader.onerror = reject;
        // חשוב לקרוא כ-Data URL כדי לקבל את Base64
        reader.readAsDataURL(wavBlob); 
    });
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
    document.getElementById("continueStorySection").style.display = "none";
  }

  showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.style.display = "block";

    if (type === "success") {
      // לא מסתיר הצלחה אוטומטית כי זה סטטוס התקדמות
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

    for (let i = 0; i < pcmData.length; i++) {
      view.setUint8(44 + i, pcmData[i]);
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  extractSpeakersFromScript(script) {
    const speakerRegex = /\[([^\]]+)\]:/g;
    const speakerSet = new Set();
    let match;

    while ((match = speakerRegex.exec(script)) !== null) {
      const speakerName = match[1].trim();
      if (speakerName && !speakerName.includes("צליל") && !speakerName.includes("מוזיקה") && speakerName !== "פתיח") {
        speakerSet.add(speakerName);
      }
    }

    this.speakers = Array.from(speakerSet);
    console.log("Extracted speakers:", this.speakers);
  }

  setupSpeakersList() {
    if (this.speakers.length > 0) {
      this.showStatus("scriptStatus", `נמצאו ${this.speakers.length} דוברים: ${this.speakers.join(", ")}`, "success");
    } else {
      this.showStatus("scriptStatus", "לא נמצאו דוברים בתסריט", "error");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new StoryGenerator();
});
