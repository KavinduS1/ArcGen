// Replace with your actual API key
const API_KEY = 'AIzaSyBvJ9byptKNsVMMj7F1uil5Y2TfN_6m78Q';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-002:generateContent';
const MAX_OUTPUT_TOKENS = 8192; // Maximum tokens for Gemini Pro

let progressInterval;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

let selectedModel = 'gemini-1.5-pro-002'; // Changed default model

function saveToHistory(topic, article) {
    const history = JSON.parse(localStorage.getItem('articleHistory') || '[]');
    const newEntry = {
        id: Date.now(),
        topic,
        article,
        timestamp: new Date().toISOString()
    };
    
    history.unshift(newEntry); // Add new entry at the beginning
    
    // Keep only the last 10 entries
    if (history.length > 10) {
        history.pop();
    }
    
    localStorage.setItem('articleHistory', JSON.stringify(history));
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const historyList = document.getElementById('historyList');
    const history = JSON.parse(localStorage.getItem('articleHistory') || '[]');
    
    historyList.innerHTML = history.map(entry => `
        <div class="history-item" onclick="loadHistoryItem(${entry.id})">
            <h3>${entry.topic}</h3>
            <div class="timestamp">${formatDate(entry.timestamp)}</div>
        </div>
    `).join('');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function loadHistoryItem(id) {
    const history = JSON.parse(localStorage.getItem('articleHistory') || '[]');
    const entry = history.find(item => item.id === id);
    
    if (entry) {
        document.getElementById('topicInput').value = entry.topic;
        document.getElementById('articleOutput').innerHTML = entry.article;
        document.getElementById('copyButtonContainer').style.display = 'block';
    }
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeAPIRequest(prompt, retryCount = 0) {
    try {
        console.log('Using model:', selectedModel);
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                }
            })
        });

        if (response.status === 429 && retryCount < MAX_RETRIES) {
            console.log(`Rate limited. Retrying in ${RETRY_DELAY/1000} seconds... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await delay(RETRY_DELAY);
            return makeAPIRequest(prompt, retryCount + 1);
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Request failed. Retrying... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await delay(RETRY_DELAY);
            return makeAPIRequest(prompt, retryCount + 1);
        }
        throw error;
    }
}

async function generateArticle() {
    console.log('Starting article generation with model:', selectedModel);
    const topicInput = document.getElementById('topicInput');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const outputDiv = document.getElementById('articleOutput');
    const loadingDiv = document.getElementById('loading');
    
    if (!topicInput.value.trim()) {
        console.warn('Empty topic input detected');
        alert('Please enter a topic');
        return;
    }

    // Reset and show progress bar
    progressContainer.style.display = 'block';
    outputDiv.innerHTML = '';
    
    // Update loading text to show selected model
    loadingDiv.textContent = `Generating article using ${selectedModel}...`;
    
    // Start progress animation
    startProgress();

    const prompt = `Write a comprehensive, well-structured article about "${topicInput.value}".
    Please follow this structure:

    Title
    - Create a concise, engaging title (6-10 words) that reflects the main topic

    Introduction
    - Start with a compelling hook to capture interest
    - Provide brief context about why this topic matters
    - Include a clear thesis statement outlining the article's purpose

    Main Body (6-10 sections)
    - Each section should have:
      • A clear subheading
      • Thorough explanation of the main point
      • Supporting evidence, examples, or data
      • Short, focused paragraphs
      • Smooth transition to the next section

    Conclusion
    - Summarize key points without direct repetition
    - Share final insights or implications
    - Include a call-to-action or thought-provoking closing statement

    References (if applicable)
    - List any key sources or suggested further reading

    Writing Guidelines:
    - Use max tokens
    - Use clear, engaging language
    - Keep paragraphs concise and focused
    - Include relevant real-world examples
    - Maintain a professional but accessible tone
    - Use bullet points or lists where appropriate
    
    Format the article with proper headings, subheadings, and paragraph breaks for readability.`;

    try {
        console.time('API Request Duration');
        
        loadingDiv.textContent = 'Generating article...';
        const data = await makeAPIRequest(prompt);
        
        console.timeEnd('API Request Duration');
        console.log('API Response:', data);
        
        if (data.candidates && data.candidates[0].content) {
            const articleText = data.candidates[0].content.parts[0].text;
            console.log('Raw article text:', articleText);
            
            loadingDiv.textContent = 'Formatting article...';
            console.time('Markdown Conversion');
            const formattedArticle = convertMarkdownToHTML(articleText);
            console.timeEnd('Markdown Conversion');
            
            console.log('Formatted HTML:', formattedArticle);
            outputDiv.innerHTML = formattedArticle;
            
            // Save to history
            saveToHistory(topicInput.value, formattedArticle);
            
            // Show copy button after article is generated
            document.getElementById('copyButtonContainer').style.display = 'block';
        } else {
            throw new Error('Invalid response structure from API');
        }
    } catch (error) {
        console.error('Error during article generation:', error);
        outputDiv.innerHTML = `<p class="error">Error generating article: ${error.message}</p>`;
        document.getElementById('copyButtonContainer').style.display = 'none';
    } finally {
        stopProgress();
        progressContainer.style.display = 'none';
        console.log('Article generation process completed');
    }
}

function convertMarkdownToHTML(markdown) {
    console.log('Starting markdown conversion');
    // Basic markdown to HTML conversion
    const html = markdown
        .replace(/#{3} (.*?)\n/g, '<h3>$1</h3>') // h3 tags
        .replace(/#{2} (.*?)\n/g, '<h2>$1</h2>') // h2 tags
        .replace(/#{1} (.*?)\n/g, '<h1>$1</h1>') // h1 tags
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // italic
        .split('\n\n').map(paragraph => `<p>${paragraph}</p>`).join(''); // paragraphs
    
    console.log('Markdown conversion completed');
    return html;
}

function startProgress() {
    const progressBar = document.getElementById('progressBar');
    let width = 0;
    
    // Clear any existing interval
    if (progressInterval) {
        clearInterval(progressInterval);
    }
    
    // Reset progress bar
    progressBar.style.width = '0%';
    
    // Simulate progress
    progressInterval = setInterval(() => {
        if (width >= 90) {
            clearInterval(progressInterval);
        } else {
            width += Math.random() * 15;
            if (width > 90) width = 90;
            progressBar.style.width = width + '%';
        }
    }, 500);
}

function stopProgress() {
    const progressBar = document.getElementById('progressBar');
    
    // Clear the interval
    if (progressInterval) {
        clearInterval(progressInterval);
    }
    
    // Complete the progress bar
    progressBar.style.width = '100%';
    
    // Add a small delay before hiding
    setTimeout(() => {
        progressBar.style.width = '0%';
    }, 300);
}

async function copyToClipboard() {
    const articleContent = document.getElementById('articleOutput');
    
    try {
        // Get text content without HTML tags
        const textContent = articleContent.innerText;
        await navigator.clipboard.writeText(textContent);
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'copy-success';
        successMessage.textContent = 'Article copied to clipboard!';
        document.body.appendChild(successMessage);
        
        // Remove success message after 2 seconds
        setTimeout(() => {
            successMessage.remove();
        }, 2000);
        
        console.log('Article copied to clipboard');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy text. Please try again.');
    }
}

// Add this line at the end of the file to load history when the page loads
document.addEventListener('DOMContentLoaded', updateHistoryDisplay);

// Sidebar toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const closeSidebar = document.getElementById('closeSidebar');
    const sidebar = document.getElementById('historySidebar');
    const mainContent = document.querySelector('.main-content');
    
    // Load sidebar state from localStorage
    const sidebarActive = localStorage.getItem('sidebarActive') === 'true';
    if (sidebarActive) {
        sidebar.classList.add('active');
        mainContent.classList.add('sidebar-active');
        sidebarToggle.classList.add('hidden');
    }
    
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        mainContent.classList.toggle('sidebar-active');
        sidebarToggle.classList.toggle('hidden');
        
        // Save sidebar state to localStorage
        localStorage.setItem('sidebarActive', sidebar.classList.contains('active'));
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && 
                !sidebarToggle.contains(e.target) && 
                sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                mainContent.classList.remove('sidebar-active');
                sidebarToggle.classList.remove('hidden');
                localStorage.setItem('sidebarActive', 'false');
            }
        }
    });
    
    // Add close button functionality
    closeSidebar.addEventListener('click', () => {
        sidebar.classList.remove('active');
        mainContent.classList.remove('sidebar-active');
        sidebarToggle.classList.remove('hidden');
        localStorage.setItem('sidebarActive', 'false');
    });

    const modelSelect = document.getElementById('modelSelect');
    
    // Update selected model when changed
    modelSelect.addEventListener('change', function() {
        selectedModel = this.value;
    });
});