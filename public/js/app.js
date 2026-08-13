/**
 * Tableau AI Chatbot Extension - App Logic
 * Connects to Tableau Dashboard DataSources and handles conversational Q&A.
 */

// Application State
const state = {
  dashboard: null,
  chatHistory: [],
  isTableauEnvironment: false,
  isSending: false
};

// DOM Elements
const elements = {
  chatScrollWrapper: document.getElementById('chatScrollWrapper'),
  chatMessages: document.getElementById('chatMessages'),
  typingIndicator: document.getElementById('typingIndicator'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  sendBtn: document.getElementById('sendBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  suggestionsWrapper: document.getElementById('suggestionsWrapper')
};

// Initialize application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initTableauExtension();
  attachUIEventListeners();
});

/**
 * 1. Initialize Tableau Extensions SDK
 */
function initTableauExtension() {
  if (typeof tableau !== 'undefined' && tableau.extensions && tableau.extensions.initializeAsync) {
    tableau.extensions.initializeAsync().then(() => {
      state.isTableauEnvironment = true;
      state.dashboard = tableau.extensions.dashboardContent.dashboard;
      console.log('Chatbot connected to Tableau Dashboard:', state.dashboard.name);
    }).catch((err) => {
      console.error('Tableau initializeAsync error:', err);
      setupBrowserPreviewMode();
    });
  } else {
    setupBrowserPreviewMode();
  }
}

/**
 * Fallback Browser Preview Mode
 */
function setupBrowserPreviewMode() {
  state.isTableauEnvironment = false;
  console.log('Running in browser sandbox preview mode.');
  appendSystemMessage('Sistem berjalan dalam mode Preview Browser. Anda dapat melakukan simulasi chat menggunakan data demo.');
}

/**
 * 2. Attach DOM Event Listeners
 */
function attachUIEventListeners() {
  // Input form submission
  elements.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleUserMessageSubmit();
  });

  // Suggestion chips click handler
  elements.suggestionsWrapper.addEventListener('click', (e) => {
    const chip = e.target.closest('.suggest-chip');
    if (chip && !state.isSending) {
      const query = chip.getAttribute('data-query');
      if (query) {
        elements.chatInput.value = query;
        handleUserMessageSubmit();
      }
    }
  });

  // Clear chat history
  elements.clearChatBtn.addEventListener('click', () => {
    if (confirm('Apakah Anda ingin menghapus seluruh riwayat percakapan saat ini?')) {
      resetChatHistory();
    }
  });
}

/**
 * 3. Handle Message Send
 */
async function handleUserMessageSubmit() {
  const messageText = elements.chatInput.value.trim();
  if (!messageText || state.isSending) return;

  state.isSending = true;
  elements.chatInput.value = '';
  elements.chatInput.disabled = true;
  elements.sendBtn.disabled = true;

  // Append user bubble
  appendMessage('user', messageText);
  scrollToBottom();

  // Show typing indicator
  showTypingIndicator(true);

  try {
    // Extract dashboard data at the time of the question (unfiltered logical tables)
    const dashboardData = await extractDashboardData();

    // Prepare payload
    const payload = {
      dashboardName: dashboardData.dashboardName,
      sheetsData: dashboardData.sheetsData,
      message: messageText,
      chatHistory: state.chatHistory
    };

    // Send request to Serverless API
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    showTypingIndicator(false);

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Server error: ${response.status}`);
    }

    // Append AI bubble
    appendMessage('model', result.reply);
    
    // Save to conversation history
    state.chatHistory.push({ role: 'user', content: messageText });
    state.chatHistory.push({ role: 'model', content: result.reply });

  } catch (err) {
    console.error('Chat error:', err);
    showTypingIndicator(false);
    appendSystemMessage(`Gagal mengirim pesan: ${err.message}`);
  } finally {
    state.isSending = false;
    elements.chatInput.disabled = false;
    elements.sendBtn.disabled = false;
    elements.chatInput.focus();
    scrollToBottom();
  }
}

/**
 * 4. Extract Unfiltered DataSources Data (Option B)
 */
async function extractDashboardData() {
  if (!state.isTableauEnvironment || !state.dashboard) {
    return getDemoPayload();
  }

  const worksheets = state.dashboard.worksheets || [];
  if (worksheets.length === 0) {
    throw new Error('Tidak ada worksheet yang tersedia di dashboard ini.');
  }

  const combinedSheetsData = [];
  const processedSources = new Set();

  // Attempt to query Underlying logical tables directly from Datasources
  for (const ws of worksheets) {
    try {
      const datasources = await ws.getDataSourcesAsync();
      for (const ds of datasources) {
        if (processedSources.has(ds.name)) continue;
        processedSources.add(ds.name);

        const logicalTables = await ds.getLogicalTablesAsync();
        for (const lt of logicalTables) {
          try {
            // Retrieve underlying logical table data (unfiltered)
            const dataTable = await ds.getLogicalTableDataAsync(lt.id);
            
            const columns = dataTable.columns.map(c => c.fieldName);
            const rows = dataTable.data.map(row => {
              return row.map(cell => (cell.formattedValue !== undefined && cell.formattedValue !== null) ? cell.formattedValue : cell.value);
            });

            combinedSheetsData.push({
              worksheetName: `${ds.name} - ${lt.caption || lt.id}`,
              columns: columns,
              rows: rows
            });
          } catch (tableErr) {
            console.warn(`Gagal membaca data dari tabel logis ${lt.id} di datasource ${ds.name}:`, tableErr);
          }
        }
      }
    } catch (dsErr) {
      console.warn(`Gagal membaca datasource dari worksheet ${ws.name}:`, dsErr);
    }
  }

  // Fallback: If no datasource logical tables could be loaded, read summary data from worksheets instead
  if (combinedSheetsData.length === 0) {
    console.log('Fallback ke summary data worksheets...');
    for (const ws of worksheets) {
      try {
        const summaryData = await ws.getSummaryDataAsync({ maxRows: 100 });
        const columns = summaryData.columns.map(c => c.fieldName);
        const rows = summaryData.data.map(row => {
          return row.map(cell => (cell.formattedValue !== undefined && cell.formattedValue !== null) ? cell.formattedValue : cell.value);
        });
        
        combinedSheetsData.push({
          worksheetName: ws.name,
          columns: columns,
          rows: rows
        });
      } catch (sumErr) {
        console.warn(`Gagal membaca summary data dari worksheet ${ws.name}:`, sumErr);
      }
    }
  }

  if (combinedSheetsData.length === 0) {
    throw new Error('Gagal mengambil data dari dashboard Tableau. Pastikan extension memiliki izin full data.');
  }

  return {
    dashboardName: state.dashboard.name || 'Dashboard Tableau',
    sheetsData: combinedSheetsData
  };
}

/**
 * 5. UI Helpers
 */
function appendMessage(role, text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role === 'user' ? 'user-message' : 'bot-message'}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  if (role === 'model' && typeof marked !== 'undefined' && marked.parse) {
    contentDiv.innerHTML = marked.parse(text);
  } else {
    // Raw plain text escape & format lines
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    contentDiv.innerHTML = `<p>${escaped}</p>`;
  }

  const timeSpan = document.createElement('span');
  timeSpan.className = 'message-time';
  const now = new Date();
  timeSpan.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  messageDiv.appendChild(contentDiv);
  messageDiv.appendChild(timeSpan);
  elements.chatMessages.appendChild(messageDiv);
}

function appendSystemMessage(text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message bot-message';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.style.backgroundColor = '#fef2f2';
  contentDiv.style.borderColor = '#fee2e2';
  contentDiv.style.color = '#991b1b';
  contentDiv.style.fontSize = '12px';
  contentDiv.style.fontStyle = 'italic';
  contentDiv.innerHTML = `<p>⚠️ ${text}</p>`;

  messageDiv.appendChild(contentDiv);
  elements.chatMessages.appendChild(messageDiv);
}

function showTypingIndicator(show) {
  if (show) {
    elements.typingIndicator.classList.remove('hidden');
  } else {
    elements.typingIndicator.classList.add('hidden');
  }
  scrollToBottom();
}

function scrollToBottom() {
  setTimeout(() => {
    elements.chatScrollWrapper.scrollTop = elements.chatScrollWrapper.scrollHeight;
  }, 50);
}

function resetChatHistory() {
  state.chatHistory = [];
  elements.chatMessages.innerHTML = `
    <div class="chat-message bot-message">
      <div class="message-content">
        <p>Halo! Saya adalah <strong>Po'tata</strong> khusus untuk dashboard ini. Tanyakan apa saja mengenai data yang ada pada dashboard ini, saya akan membantu menganalisisnya.</p>
      </div>
      <span class="message-time">Sistem</span>
    </div>
  `;
  scrollToBottom();
}

/**
 * Demo Mock Payload for Testing outside Tableau
 */
function getDemoPayload() {
  return {
    dashboardName: 'Demo Jumlah Penumpang Angkutan Umum',
    sheetsData: [
      {
        worksheetName: 'Data Penumpang Mentah',
        columns: ['Tahun', 'Bulan', 'Kategori', 'Total Penumpang', 'Growth'],
        rows: [
          ['2024', 'Januari', 'Bus Kota', '125000', '+5.2%'],
          ['2024', 'Januari', 'KRL Jabodetabek', '450000', '+12.4%'],
          ['2024', 'Februari', 'Bus Kota', '132000', '+5.6%'],
          ['2024', 'Februari', 'KRL Jabodetabek', '468000', '+4.0%'],
          ['2025', 'Januari', 'Bus Kota', '140000', '+12.0%'],
          ['2025', 'Januari', 'KRL Jabodetabek', '510000', '+13.3%'],
          ['2025', 'Februari', 'Bus Kota', '145000', '+9.8%'],
          ['2025', 'Februari', 'KRL Jabodetabek', '525000', '+12.1%'],
          ['2026', 'Januari', 'Bus Kota', '162000', '+15.7%'],
          ['2026', 'Januari', 'KRL Jabodetabek', '590000', '+15.6%'],
          ['2026', 'Februari', 'Bus Kota', '168000', '+15.8%'],
          ['2026', 'Februari', 'KRL Jabodetabek', '610000', '+16.1%']
        ]
      }
    ]
  };
}
