import { useState, useRef, useEffect } from 'react';

// CSS imported dynamically below to avoid Vite HMR conflict with React.lazy

const APP_KB = [
  {
    keywords: ['home', 'dashboard', 'main'],
    page: 'Home',
    answer: 'The Home Dashboard shows your child\'s summary — latest progress, today\'s schedule, active notifications, and quick stats like current Hifz status and attendance.'
  },
  {
    keywords: ['progress', 'report', 'result', 'child summary', 'grade'],
    page: 'Child Summary',
    answer: 'The Progress page (Child Summary) displays the weekly Tahfeez Report Card — scores in Murajah, Juz Hali, Takhteet, Jadeed, attendance, rank, and target tracking with Wusool (current position) and Istifadah (target).'
  },
  {
    keywords: ['schedule', 'timetable', 'class', 'jadwal'],
    page: 'Schedule',
    answer: 'The Schedule page shows your child\'s daily class timetable. You can view the weekly Jadwal with subject names, teachers, and timings.'
  },
  {
    keywords: ['teacher', 'muhaffiz', 'muhaffezah', 'contact', 'staff'],
    page: 'Teachers',
    answer: 'The Teacher Contacts page displays your child\'s assigned Muhaffiz/Muhaffezah and other staff like Masool (supervisor) and Musaid (assistant) with their phone numbers and WhatsApp links for direct contact.'
  },
  {
    keywords: ['hub raqam', 'fee', 'payment', 'hub', 'raqam'],
    page: 'Hub Raqam',
    answer: 'The Hub Raqam page provides fee payment guidelines, bank account details for transfers, and the Hub Raqam (reference number) for your child.'
  },
  {
    keywords: ['setting', 'preference', 'dark mode', 'theme', 'notification', 'password', 'security', 'lock'],
    page: 'Settings',
    answer: 'The Settings page lets you customize your experience — toggle dark mode, choose premium themes, manage notifications, control animations, update your password, enable app lock, and submit support tickets.'
  },
  {
    keywords: ['notification', 'inbox', 'alert', 'announcement', 'message'],
    page: 'Inbox',
    answer: 'The Inbox shows all notifications and announcements from the school administration, including progress report alerts, schedule changes, and important notices.'
  },
  {
    keywords: ['profile', 'child info', 'student info', 'hifz', 'status'],
    page: 'Profile',
    answer: 'The Profile page displays your child\'s detailed information — name, group, teacher, current Hifz status (Juz, Surah, Page), and latest progress at a glance.'
  },
  {
    keywords: ['jadwal', 'self jadwal', 'my schedule'],
    page: 'Self Jadwal',
    answer: 'Self Jadwal allows your child to view their personalized schedule. It shows the weekly plan with subjects and timings.'
  },
  {
    keywords: ['marhala', 'post', 'news', 'announce'],
    page: 'Marhala Posts',
    answer: 'Marhala Posts is a feed of school announcements, news, and updates from the administration — similar to a notice board.'
  },
  {
    keywords: ['archive', 'history', 'past result', 'old report'],
    page: 'Results Archive',
    answer: 'The Results Archive stores all past weekly Tahfeez report cards. You can browse historical results to track your child\'s progress over time.'
  },
  {
    keywords: ['leave', 'absent', 'apply leave', 'attendance'],
    page: 'Apply Leave',
    answer: 'The Apply Leave page lets you submit a leave request for your child. Fill in the reason and dates, and it will be sent to the administration.'
  },
  {
    keywords: ['takhteet', 'progress card', 'memorization', 'hifz progress'],
    page: null,
    answer: 'The Takhteet Progress Card tracks your child\'s memorization journey. It shows the target given (Istifadah), current position (Wusool), pages completed, pages remaining, and the next week\'s target — all displayed with a circular progress ring.'
  },
  {
    keywords: ['score', 'murajah', 'juz hali', 'jadeed', 'total', 'rank'],
    page: null,
    answer: 'Scores are recorded weekly: Murajah (out of 30), Juz Hali (out of 30), Takhteet (out of 20), and Jadeed (out of 20). The total score is out of 100, and students are ranked weekly based on their performance.'
  },
  {
    keywords: ['attendance', 'present', 'absent', 'matrookah', 'daeefah', 'zaeefah'],
    page: null,
    answer: 'Attendance is tracked daily. M atrooka h refers to missed lessons, and D aeefah refers to weak lessons. These are displayed on the report card alongside the attendance count.'
  },
  {
    keywords: ['wusool', 'currently on', 'current position', 'istifadah', 'target till', 'next week'],
    page: null,
    answer: 'Wusool (Currently On) shows where your child is now in their memorization. Istifadah (Target Till) is the target set for the week. Next Week Target shows what\'s planned ahead.'
  },
  {
    keywords: ['dark mode', 'theme', 'appearance', 'light mode'],
    page: 'Settings',
    answer: 'You can switch between light and dark mode, and choose from themes like Classic, Playful Learning, Executive Dark, Royal Grace, Ashara Mode, Classic Pro, and Plutonium — all from Settings > Dark mode or App themes.'
  },
  {
    keywords: ['password', 'change password', 'security', 'app lock'],
    page: 'Settings',
    answer: 'You can update your account password and enable App Lock for extra security. Go to Settings > Security to manage these options.'
  },
  {
    keywords: ['help', 'support', 'guide', 'tutorial', 'how to'],
    page: null,
    answer: 'I can help you navigate the app! Just tell me what you\'re looking for — like "How do I see my child\'s progress?" or "Where are the teacher contacts?" — and I\'ll guide you there.'
  },
];

const WELCOME_MSG = `Salam! I'm your AI assistant for Mauze Tahfeez Parent Portal. I know everything about the app and can guide you instantly.

You can ask me things like:
• "Show me my child's progress"
• "Where are teacher contacts?"
• "How to check attendance?"
• "Take me to Settings"

Or just describe what you need help with!`;

function findBestMatch(query) {
  const q = query.toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0;

  for (const item of APP_KB) {
    let score = 0;
    for (const kw of item.keywords) {
      if (q.includes(kw)) {
        score += kw.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

const SupportBot = ({ onNavigate, onClose, pageMode }) => {
  // Dynamic CSS import to avoid Vite HMR conflict with React.lazy
  useEffect(() => {
    import('./SupportBot.css');
  }, []);

  const [messages, setMessages] = useState([
    { role: 'bot', text: WELCOME_MSG }
  ]);
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!pageMode) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [pageMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role, text) => {
    setMessages(prev => [...prev, { role, text }]);
  };

  const handleSend = (text) => {
    const query = text || input;
    if (!query.trim()) return;
    setShowSuggestions(false);
    addMessage('user', query.trim());
    setInput('');

    setTimeout(() => {
      const match = findBestMatch(query);
      if (match) {
        let reply = match.answer;
        if (match.page) {
          reply += `\n\nWould you like me to take you to the **${match.page}** page?`;
          setTimeout(() => {
            setMessages(prev => [...prev, {
              role: 'options',
              page: match.page,
              text: reply
            }]);
          }, 100);
          return;
        }
        addMessage('bot', reply);
      } else {
        addMessage('bot', `I'm not sure I understand. Could you try rephrasing? Here are some things I can help with:

• View progress reports
• Find teacher contacts
• Check schedule
• Manage settings
• Navigate to any page`);
      }
    }, 600);
  };

  const handleNavigate = (page) => {
    addMessage('bot', `Taking you to **${page}** now...`);
    setTimeout(() => {
      if (onNavigate) onNavigate(page);
      if (!pageMode && onClose) onClose();
    }, 800);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    'Show me my child\'s progress',
    'Where are teacher contacts?',
    'How to check attendance?',
    'Take me to Settings',
    'What are the scores?',
  ];

  return (
    <div className={pageMode ? "support-bot-page" : "support-bot-overlay"} onClick={pageMode ? null : onClose}>
      <div className={pageMode ? "support-bot-card page-mode" : "support-bot-card"} onClick={e => e.stopPropagation()}>
        <div className="support-bot-header">
          <div className="support-bot-header-left">
            <div className="support-bot-avatar">
              <span>AI</span>
            </div>
            <div>
              <h3>Technical Support</h3>
              <p className="support-bot-status">Online — AI Assistant</p>
            </div>
          </div>
          {!pageMode && (
            <button className="support-bot-close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        <div className="chat-body">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === 'bot' && (
                <div className="msg-row received">
                  <div className="msg-bubble bot-msg">
                    {msg.text.split('\n').map((line, j) => (
                      <p key={j} style={{ margin: '4px 0' }}>{line}</p>
                    ))}
                  </div>
                </div>
              )}
              {msg.role === 'user' && (
                <div className="msg-row sent">
                  <div className="msg-bubble user-msg">
                    <p style={{ margin: 0 }}>{msg.text}</p>
                  </div>
                </div>
              )}
              {msg.role === 'options' && (
                <div className="msg-row received">
                  <div className="msg-bubble bot-msg">
                    <p style={{ margin: '0 0 8px' }}>{msg.text}</p>
                    <div className="bot-options">
                      <button onClick={() => handleNavigate(msg.page)}>
                        Yes, take me to {msg.page}
                      </button>
                      <button onClick={() => addMessage('bot', 'Alright! Let me know if you need anything else.')}>
                        No, I have another question
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {showSuggestions && messages.length === 1 && (
            <div className="bot-intro">
              <div className="bot-suggestions">
                {suggestions.map((s, i) => (
                  <button key={i} className="suggestion-chip" onClick={() => handleSend(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="support-bot-input-bar">
          <input
            type="text"
            className="support-bot-input"
            placeholder="Ask me anything..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="support-bot-send" onClick={() => handleSend()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupportBot;
