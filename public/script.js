(() => {
  const projectListEl = document.getElementById('project-list');
  const chatListEl = document.getElementById('chat-list');
  const newProjectBtn = document.getElementById('new-project-btn');
  const newChatBtn = document.getElementById('new-chat-btn');
  const currentProjectNameEl = document.getElementById('current-project-name');
  const currentChatNameEl = document.getElementById('current-chat-name');
  const chatWindowEl = document.getElementById('chat-window');
  const composerEl = document.getElementById('composer');
  const messageInputEl = document.getElementById('message-input');
  const sendBtnEl = document.getElementById('send-btn');
  const fileInputEl = document.getElementById('file-input');
  const botSettingsBtnEl = document.getElementById('bot-settings-btn');
  const botSettingsModalEl = document.getElementById('bot-settings-modal');
  const apiKeySettingsBtnEl = document.getElementById('api-key-settings-btn');

  // Simple in-memory state with localStorage persistence
  const storageKey = 'chatbot.projects.v1';
  let projects = readProjects();
  let currentProjectId = projects[0]?.id || createProject('Projekt 1');
  let currentChatId = getProject(currentProjectId).chats[0]?.id || createChat(currentProjectId, 'Neuer Chat', true);
  let sessionFiles = []; // RAG session files (text only)
  let botSettings = loadBotSettings();

  renderProjects();
  renderChats();
  renderMessages();
  initBotSettings();
  checkApiKey();

  // Event listeners
  newProjectBtn.addEventListener('click', () => {
    const name = prompt('Projektname?') || `Projekt ${projects.length + 1}`;
    currentProjectId = createProject(name);
    currentChatId = createChat(currentProjectId, 'Neuer Chat', true);
    sessionFiles = [];
    renderProjects();
    renderChats();
    renderMessages();
  });

  projectListEl.addEventListener('click', (e) => {
    const addBtn = e.target.closest('button.add-chat');
    if (addBtn){
      const projId = addBtn.closest('li[data-id]')?.dataset.id;
      if (!projId) return;
      const name = prompt('Chat-Name?') || 'Neuer Chat';
      if (!name.trim()) return;
      currentProjectId = projId;
      currentChatId = createChat(projId, name.trim(), false);
      sessionFiles = [];
      renderProjects();
      renderChats();
      renderMessages();
      return;
    }
    const renameBtn = e.target.closest('button.rename-project');
    if (renameBtn){
      const projId = renameBtn.closest('li[data-id]')?.dataset.id;
      if (!projId) return;
      const proj = getProject(projId);
      const name = prompt('Neuer Projektname?', proj.name || 'Projekt');
      if (name && name.trim()){
        proj.name = name.trim();
        saveState();
        renderProjects();
        if (currentProjectId === projId){
          renderChats();
        }
      }
      return;
    }
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    currentProjectId = li.dataset.id;
    const proj = getProject(currentProjectId);
    currentChatId = proj.chats[0]?.id || createChat(currentProjectId, 'Neuer Chat', true);
    sessionFiles = [];
    renderProjects();
    renderChats();
    renderMessages();
  });

  // Also support rename on double click
  projectListEl.addEventListener('dblclick', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const proj = getProject(li.dataset.id);
    const name = prompt('Neuer Projektname?', proj.name || 'Projekt');
    if (name && name.trim()){
      proj.name = name.trim();
      saveState();
      renderProjects();
      if (currentProjectId === proj.id){
        renderChats();
      }
    }
  });

  chatListEl.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('button.delete-chat');
    if (deleteBtn){
      const chatId = deleteBtn.closest('li[data-id]')?.dataset.id;
      if (!chatId) return;
      const chat = getChat(currentProjectId, chatId);
      if (confirm(`Chat "${chat.name}" wirklich löschen?`)){
        deleteChat(currentProjectId, chatId);
        const proj = getProject(currentProjectId);
        if (proj.chats.length === 0){
          currentChatId = createChat(currentProjectId, 'Neuer Chat', true);
        } else {
          currentChatId = proj.chats[0].id;
        }
        sessionFiles = [];
        renderChats();
        renderMessages();
      }
      return;
    }
    const renameBtn = e.target.closest('button.rename-chat');
    if (renameBtn){
      const chatId = renameBtn.closest('li[data-id]')?.dataset.id;
      if (!chatId) return;
      const chat = getChat(currentProjectId, chatId);
      const name = prompt('Neuer Chat-Name?', chat.name || 'Chat');
      if (name && name.trim()){
        chat.name = name.trim();
        saveState();
        renderChats();
      }
      return;
    }
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    currentChatId = li.dataset.id;
    sessionFiles = [];
    renderChats();
    renderMessages();
  });

  composerEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInputEl.value.trim();
    if (!text) return;
    messageInputEl.value = '';
    appendMessage('user', text);
    saveState();
    scrollToBottom();
    sendBtnEl.disabled = true;
    try {
      const context = await buildContext(text);
      const reply = generateMockAssistantReply(text, context);
      await streamAssistant(reply);
      maybeAutoTitleCurrentChat(text, context);
    } finally {
      sendBtnEl.disabled = false;
    }
  });

  fileInputEl.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (!/\.(txt|md|markdown|csv)$/i.test(file.name)) continue;
      const content = await readFileText(file);
      sessionFiles.push({ name: file.name, size: file.size, content });
    }
    infoMessage(`Session-RAG: ${sessionFiles.length} Datei(en) aktiv.`);
  });

  // RAG helpers (simple keyword retrieval)
  async function buildContext(query) {
    const words = query.toLowerCase().split(/[^a-z0-9äöüß]+/i).filter(Boolean);
    const scored = [];
    for (const file of sessionFiles) {
      const lines = file.content.split(/\r?\n/);
      lines.forEach((line, idx) => {
        const lw = line.toLowerCase();
        const score = words.reduce((s, w) => s + (lw.includes(w) ? 1 : 0), 0);
        if (score > 0) scored.push({ file: file.name, idx, line, score });
      });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5);
    return top;
  }

  function generateMockAssistantReply(userText, contextSnippets) {
    if (!contextSnippets || contextSnippets.length === 0) {
      return `Ich habe keine passenden Stellen in den hochgeladenen Dateien gefunden.\n\n` +
             `Frage: ${userText}`;
    }
    const bullets = contextSnippets.map(s => `• [${s.file} #${s.idx+1}] ${s.line}`);
    return `Hier sind relevante Auszüge aus den Session-Dateien:\n\n${bullets.join('\n')}\n\n` +
           `Basierend darauf lässt sich deine Frage so einordnen: "${userText}".`;
  }

  async function streamAssistant(fullText) {
    const messageEl = createMessageEl('assistant', '');
    chatWindowEl.appendChild(messageEl);
    scrollToBottom();
    
    try {
      // Try real API first
      const response = await callChatAPI(fullText);
      if (response) {
        // Stream the real response
        const chunks = chunkString(response, 40);
        for (const chunk of chunks) {
          await delay(30);
          messageEl.querySelector('.bubble').textContent += chunk;
          scrollToBottom();
        }
      } else {
        // Fallback to mock response
        const chunks = chunkString(fullText, 40);
        for (const chunk of chunks) {
          await delay(30);
          messageEl.querySelector('.bubble').textContent += chunk;
          scrollToBottom();
        }
      }
    } catch (error) {
      // Error fallback
      messageEl.querySelector('.bubble').textContent = 'Entschuldigung, es gab einen Fehler bei der API-Verbindung. Bitte versuchen Sie es erneut.';
    }
    
    appendMeta(messageEl, ragMeta());
    saveState();
  }

  async function callChatAPI(userMessage) {
    // Get API key from secure storage
    const apiKey = getApiKey();
    if (!apiKey) {
      console.log('Kein OpenAI API Key gefunden. Verwende Mock-Antworten.');
      return null;
    }

    try {
      const messages = buildConversationHistory();
      messages.push({ role: 'user', content: userMessage });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: messages,
          max_tokens: 500,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('API Fehler:', error);
      return null;
    }
  }

  function buildConversationHistory() {
    const chat = getChat(currentProjectId, currentChatId);
    const messages = [];
    
    // Add dynamic system prompt based on settings
    messages.push({
      role: 'system',
      content: buildSystemPrompt()
    });

    // Add recent conversation history (last 10 messages)
    const recentMessages = chat.messages.slice(-10);
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    return messages;
  }

  function ragMeta(){
    if (sessionFiles.length === 0) return '';
    return `${sessionFiles.length} Datei(en) aktiv`;
  }

  // UI helpers
  function renderProjects(){
    projectListEl.innerHTML='';
    projects.forEach(p => {
      const li = document.createElement('li');
      li.dataset.id = p.id;
      li.className = p.id === currentProjectId ? 'active' : '';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'item-label';
      nameSpan.textContent = p.name;
      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const addBtn = document.createElement('button');
      addBtn.className = 'icon-btn add-chat';
      addBtn.title = 'Neuen Chat in diesem Projekt erstellen';
      addBtn.textContent = '+';
      const renameBtn = document.createElement('button');
      renameBtn.className = 'icon-btn rename-project';
      renameBtn.title = 'Projekt umbenennen';
      renameBtn.textContent = '✎';
      actions.appendChild(addBtn);
      actions.appendChild(renameBtn);
      li.appendChild(nameSpan);
      li.appendChild(actions);
      projectListEl.appendChild(li);
    });
    currentProjectNameEl.textContent = getProject(currentProjectId)?.name || 'Projekt';
  }

  function renderChats(){
    chatListEl.innerHTML='';
    const proj = getProject(currentProjectId);
    proj.chats.forEach(c => {
      const li = document.createElement('li');
      li.dataset.id = c.id;
      li.className = c.id === currentChatId ? 'active' : '';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'item-label';
      nameSpan.textContent = c.name;
      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const renameBtn = document.createElement('button');
      renameBtn.className = 'icon-btn rename-chat';
      renameBtn.title = 'Chat umbenennen';
      renameBtn.textContent = '✎';
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'icon-btn delete-chat danger';
      deleteBtn.title = 'Chat löschen';
      deleteBtn.textContent = '🗑';
      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);
      li.appendChild(nameSpan);
      li.appendChild(actions);
      chatListEl.appendChild(li);
    });
    currentChatNameEl.textContent = getChat(currentProjectId, currentChatId)?.name || 'Chat';
  }

  function renderMessages(){
    chatWindowEl.innerHTML='';
    const chat = getChat(currentProjectId, currentChatId);
    chat.messages.forEach(m => {
      const el = createMessageEl(m.role, m.content, m.meta);
      chatWindowEl.appendChild(el);
    });
    scrollToBottom();
  }

  function appendMessage(role, content, meta=''){
    const chat = getChat(currentProjectId, currentChatId);
    chat.messages.push({ role, content, meta, ts: Date.now() });
    const el = createMessageEl(role, content, meta);
    chatWindowEl.appendChild(el);
  }

  function createMessageEl(role, content, meta=''){
    const tpl = document.getElementById('message-template');
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.classList.add(role);
    node.querySelector('.bubble').textContent = content;
    if (meta){
      const pill = document.createElement('div');
      pill.className = 'rag-pill meta';
      pill.textContent = meta;
      node.appendChild(pill);
    }
    return node;
  }

  function appendMeta(messageEl, meta){
    if (!meta) return;
    const pill = document.createElement('div');
    pill.className = 'rag-pill meta';
    pill.textContent = meta;
    messageEl.appendChild(pill);
  }

  function scrollToBottom(){
    chatWindowEl.scrollTop = chatWindowEl.scrollHeight;
  }

  function readFileText(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsText(file);
    });
  }

  function chunkString(str, size){
    const chunks = [];
    for (let i=0; i<str.length; i+=size){
      chunks.push(str.slice(i, i+size));
    }
    return chunks;
  }

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  function infoMessage(text){
    const el = createMessageEl('assistant', text);
    chatWindowEl.appendChild(el);
    scrollToBottom();
  }

  // Persistence
  function readProjects(){
    try{
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    }catch{ return [] }
  }

  function saveState(){
    localStorage.setItem(storageKey, JSON.stringify(projects));
  }

  function getProject(id){
    return projects.find(p => p.id === id);
  }

  function getChat(projectId, chatId){
    const proj = getProject(projectId);
    return proj.chats.find(c => c.id === chatId);
  }

  function createProject(name){
    const id = crypto.randomUUID();
    const project = { id, name, chats: [] };
    projects.push(project);
    saveState();
    return id;
  }

  function createChat(projectId, name, autoTitlePending=false){
    const id = crypto.randomUUID();
    const chat = { id, name, messages: [], autoTitlePending };
    const proj = getProject(projectId);
    proj.chats.push(chat);
    saveState();
    return id;
  }

  function deleteChat(projectId, chatId){
    const proj = getProject(projectId);
    proj.chats = proj.chats.filter(c => c.id !== chatId);
    saveState();
  }

  function maybeAutoTitleCurrentChat(firstUserMessage, contextSnippets){
    const chat = getChat(currentProjectId, currentChatId);
    if (!chat) return;
    if (!chat.autoTitlePending) return;
    const proposed = generateChatTitle(firstUserMessage, contextSnippets);
    if (proposed && proposed.trim()){
      chat.name = proposed.trim();
      chat.autoTitlePending = false;
      saveState();
      renderChats();
    }
  }

  function generateChatTitle(text, contextSnippets){
    // Build a concise title: topic + intent, max ~40 chars
    const cleaned = text.replace(/\s+/g,' ').trim();
    // Prefer the first sentence or up to punctuation
    let base = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
    // Remove leading verbs like "bitte", "kannst", "wie"
    base = base.replace(/^((bitte|kannst|kann|können|wie|was|warum|wieso)\s+)/i,'');
    // Trim to length
    if (base.length > 48){
      base = base.slice(0, 45).trimEnd() + '…';
    }
    // Add a lightweight topic hint from context file names if present
    const topic = (contextSnippets && contextSnippets[0]?.file) ?
      contextSnippets[0].file.replace(/\.[^.]+$/,'') : '';
    if (topic && !base.toLowerCase().includes(topic.toLowerCase())){
      const combined = `${base} — ${topic}`;
      return combined.length <= 56 ? combined : base;
    }
    return base || 'Neuer Chat';
  }

  // Bot Settings Management
  function loadBotSettings(){
    try{
      const saved = localStorage.getItem('chatbot.bot-settings.v1');
      if (!saved) return getDefaultBotSettings();
      return { ...getDefaultBotSettings(), ...JSON.parse(saved) };
    }catch{
      return getDefaultBotSettings();
    }
  }

  function getDefaultBotSettings(){
    return {
      personality: 'assistant',
      responseLength: 'medium',
      formality: 'casual',
      explanationDepth: 'intermediate',
      codeFocus: false,
      examplesFocus: false,
      stepByStep: false,
      askClarifications: false
    };
  }

  function saveBotSettings(){
    localStorage.setItem('chatbot.bot-settings.v1', JSON.stringify(botSettings));
  }

  function initBotSettings(){
    // API Key settings
    apiKeySettingsBtnEl.addEventListener('click', showApiKeyManagementModal);
    
    // Modal controls
    botSettingsBtnEl.addEventListener('click', openBotSettingsModal);
    botSettingsModalEl.querySelector('.modal-close').addEventListener('click', closeBotSettingsModal);
    botSettingsModalEl.addEventListener('click', (e) => {
      if (e.target === botSettingsModalEl) closeBotSettingsModal();
    });

    // Settings controls
    document.getElementById('save-settings').addEventListener('click', saveBotSettingsFromModal);
    document.getElementById('reset-settings').addEventListener('click', resetBotSettings);

    // Personality cards
    document.querySelectorAll('.personality-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.personality-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    loadBotSettingsToModal();
  }

  function openBotSettingsModal(){
    botSettingsModalEl.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeBotSettingsModal(){
    botSettingsModalEl.classList.remove('open');
    document.body.style.overflow = '';
  }

  function loadBotSettingsToModal(){
    // Set personality
    document.querySelectorAll('.personality-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.personality === botSettings.personality);
    });

    // Set dropdowns
    document.getElementById('response-length').value = botSettings.responseLength;
    document.getElementById('formality').value = botSettings.formality;
    document.getElementById('explanation-depth').value = botSettings.explanationDepth;

    // Set checkboxes
    document.getElementById('code-focus').checked = botSettings.codeFocus;
    document.getElementById('examples-focus').checked = botSettings.examplesFocus;
    document.getElementById('step-by-step').checked = botSettings.stepByStep;
    document.getElementById('ask-clarifications').checked = botSettings.askClarifications;
  }

  function saveBotSettingsFromModal(){
    // Get personality
    const selectedPersonality = document.querySelector('.personality-card.selected');
    if (selectedPersonality) {
      botSettings.personality = selectedPersonality.dataset.personality;
    }

    // Get dropdowns
    botSettings.responseLength = document.getElementById('response-length').value;
    botSettings.formality = document.getElementById('formality').value;
    botSettings.explanationDepth = document.getElementById('explanation-depth').value;

    // Get checkboxes
    botSettings.codeFocus = document.getElementById('code-focus').checked;
    botSettings.examplesFocus = document.getElementById('examples-focus').checked;
    botSettings.stepByStep = document.getElementById('step-by-step').checked;
    botSettings.askClarifications = document.getElementById('ask-clarifications').checked;

    saveBotSettings();
    closeBotSettingsModal();
    
    // Show confirmation
    infoMessage('✅ Bot-Einstellungen wurden gespeichert und werden für neue Nachrichten verwendet.');
  }

  function resetBotSettings(){
    if (confirm('Alle Bot-Einstellungen auf Standard zurücksetzen?')){
      botSettings = getDefaultBotSettings();
      loadBotSettingsToModal();
      saveBotSettings();
    }
  }

  function buildSystemPrompt(){
    const personalities = {
      assistant: "Du bist ein hilfreicher AI-Assistent. Sei freundlich, professionell und unterstützend.",
      expert: "Du bist ein Experte in deinem Fachgebiet. Antworte detailliert, technisch präzise und mit fundierten Informationen.",
      creative: "Du bist ein kreativer AI-Assistent. Sei inspirierend, innovativ und bringe fantasievolle Ideen ein.",
      casual: "Du bist ein entspannter AI-Assistent. Sei locker, humorvoll und nahbar in deinen Antworten.",
      analytical: "Du bist ein analytischer AI-Assistent. Sei logisch, strukturiert und datenorientiert in deinen Antworten.",
      mentor: "Du bist ein Mentor-AI. Sei lehrend, geduldig und fördernd. Hilf beim Lernen und der Entwicklung."
    };

    let systemPrompt = personalities[botSettings.personality] || personalities.assistant;

    // Add response length guidance
    const lengthGuidance = {
      short: " Halte deine Antworten kurz und prägnant.",
      medium: " Gib ausgewogene, mittellange Antworten.",
      long: " Antworte ausführlich und detailliert."
    };
    systemPrompt += lengthGuidance[botSettings.responseLength] || lengthGuidance.medium;

    // Add formality guidance
    const formalityGuidance = {
      formal: " Verwende eine formelle Anrede (Sie) und professionelle Sprache.",
      casual: " Verwende eine lockere Anrede (Du) und entspannte Sprache.",
      mixed: " Passe die Formalität an den Kontext der Frage an."
    };
    systemPrompt += formalityGuidance[botSettings.formality] || formalityGuidance.casual;

    // Add explanation depth
    const depthGuidance = {
      basic: " Erkläre Konzepte auf einem grundlegenden Niveau für Einsteiger.",
      intermediate: " Erkläre Konzepte auf einem mittleren Niveau mit angemessenen Details.",
      advanced: " Erkläre Konzepte auf einem fortgeschrittenen Niveau mit technischen Details."
    };
    systemPrompt += depthGuidance[botSettings.explanationDepth] || depthGuidance.intermediate;

    // Add special behaviors
    if (botSettings.codeFocus) {
      systemPrompt += " Bevorzuge technische Lösungen und Code-Beispiele wo angebracht.";
    }
    if (botSettings.examplesFocus) {
      systemPrompt += " Gib viele praktische Beispiele zur Veranschaulichung.";
    }
    if (botSettings.stepByStep) {
      systemPrompt += " Teile komplexe Prozesse in klare Schritte auf.";
    }
    if (botSettings.askClarifications) {
      systemPrompt += " Frage bei unklaren oder mehrdeutigen Anfragen nach Präzisierungen.";
    }

    systemPrompt += " Antworte auf Deutsch.";
    return systemPrompt;
  }

  // API Key Management
  function getApiKey(){
    return localStorage.getItem('chatbot.api-key');
  }

  function setApiKey(key){
    if (key && key.trim()) {
      localStorage.setItem('chatbot.api-key', key.trim());
      return true;
    }
    return false;
  }

  function clearApiKey(){
    localStorage.removeItem('chatbot.api-key');
  }

  function checkApiKey(){
    const apiKey = getApiKey();
    if (!apiKey) {
      showApiKeyModal();
    }
  }

  function showApiKeyModal(){
    const modal = createApiKeyModal();
    document.body.appendChild(modal);
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function createApiKeyModal(){
    const modal = document.createElement('div');
    modal.className = 'modal api-key-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>🔑 OpenAI API Key erforderlich</h2>
        </div>
        <div class="modal-body">
          <p>Um den Chatbot zu verwenden, benötigen Sie einen OpenAI API Key.</p>
          <div class="api-key-info">
            <h4>Wie erhalte ich einen API Key?</h4>
            <ol>
              <li>Besuchen Sie <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a></li>
              <li>Melden Sie sich an oder erstellen Sie ein Konto</li>
              <li>Klicken Sie auf "Create new secret key"</li>
              <li>Kopieren Sie den generierten Key</li>
            </ol>
          </div>
          <div class="setting-group">
            <label for="api-key-input">OpenAI API Key:</label>
            <input type="password" id="api-key-input" placeholder="sk-..." />
            <small>Ihr Key wird nur lokal in Ihrem Browser gespeichert.</small>
          </div>
          <div class="demo-option">
            <button id="demo-mode-btn" class="btn-secondary">Demo-Modus (ohne API)</button>
            <small>Verwendet Mock-Antworten für Testzwecke</small>
          </div>
        </div>
        <div class="modal-footer">
          <button id="save-api-key" class="btn-primary">Key speichern</button>
        </div>
      </div>
    `;

    // Event listeners for the modal
    const saveBtn = modal.querySelector('#save-api-key');
    const demoBtn = modal.querySelector('#demo-mode-btn');
    const input = modal.querySelector('#api-key-input');

    saveBtn.addEventListener('click', () => {
      const key = input.value.trim();
      if (key && key.startsWith('sk-')) {
        setApiKey(key);
        closeApiKeyModal(modal);
        infoMessage('✅ API Key wurde gespeichert. Sie können jetzt chatten!');
      } else {
        alert('Bitte geben Sie einen gültigen OpenAI API Key ein (beginnt mit "sk-").');
      }
    });

    demoBtn.addEventListener('click', () => {
      closeApiKeyModal(modal);
      infoMessage('🎭 Demo-Modus aktiviert. Der Bot verwendet Mock-Antworten.');
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click();
      }
    });

    return modal;
  }

  function closeApiKeyModal(modal){
    modal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
      document.body.removeChild(modal);
    }, 300);
  }

  function showApiKeyManagementModal(){
    const modal = createApiKeyManagementModal();
    document.body.appendChild(modal);
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function createApiKeyManagementModal(){
    const currentKey = getApiKey();
    const hasKey = !!currentKey;
    const keyPreview = hasKey ? `${currentKey.substring(0, 7)}...${currentKey.slice(-4)}` : 'Kein Key gespeichert';

    const modal = document.createElement('div');
    modal.className = 'modal api-key-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>🔑 API Key verwalten</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="current-key-status">
            <h4>Aktueller Status:</h4>
            <div class="key-status ${hasKey ? 'has-key' : 'no-key'}">
              <span class="status-icon">${hasKey ? '✅' : '❌'}</span>
              <span class="key-preview">${keyPreview}</span>
            </div>
          </div>
          
          <div class="setting-group">
            <label for="new-api-key-input">Neuen API Key eingeben:</label>
            <input type="password" id="new-api-key-input" placeholder="sk-..." />
            <small>Überschreibt den aktuellen Key</small>
          </div>
          
          <div class="api-key-info">
            <h4>API Key erhalten:</h4>
            <p>Besuchen Sie <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a> um einen neuen Key zu erstellen.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button id="clear-api-key" class="btn-secondary danger-btn" ${!hasKey ? 'disabled' : ''}>Key löschen</button>
          <button id="update-api-key" class="btn-primary">Key aktualisieren</button>
        </div>
      </div>
    `;

    // Event listeners
    const closeBtn = modal.querySelector('.modal-close');
    const clearBtn = modal.querySelector('#clear-api-key');
    const updateBtn = modal.querySelector('#update-api-key');
    const input = modal.querySelector('#new-api-key-input');

    closeBtn.addEventListener('click', () => closeApiKeyModal(modal));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeApiKeyModal(modal);
    });

    clearBtn.addEventListener('click', () => {
      if (confirm('API Key wirklich löschen? Sie müssen dann einen neuen eingeben.')) {
        clearApiKey();
        closeApiKeyModal(modal);
        infoMessage('🗑️ API Key wurde gelöscht.');
      }
    });

    updateBtn.addEventListener('click', () => {
      const newKey = input.value.trim();
      if (newKey && newKey.startsWith('sk-')) {
        setApiKey(newKey);
        closeApiKeyModal(modal);
        infoMessage('✅ API Key wurde aktualisiert!');
      } else if (newKey) {
        alert('Bitte geben Sie einen gültigen OpenAI API Key ein (beginnt mit "sk-").');
      } else {
        alert('Bitte geben Sie einen API Key ein.');
      }
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        updateBtn.click();
      }
    });

    return modal;
  }
})();


