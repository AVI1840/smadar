import { useState } from 'react';
import { ClaimantInput, AuditResult } from './types/types';
import { runAudit } from './engine/auditEngine';
import { ClaimantInputPanel } from './components/ClaimantInputPanel';
import { ResultCalendar } from './components/ResultCalendar';
import { Letter42Generator } from './components/Letter42Generator';
import { FeedbackModal } from './components/FeedbackModal';
import { MessageCircle } from 'lucide-react';

function App() {
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [claimantInput, setClaimantInput] = useState<ClaimantInput | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  function handleRunAudit(input: ClaimantInput) {
    const result = runAudit(input);
    setClaimantInput(input);
    setAuditResult(result);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir="rtl">
      {/* Header */}
      <header className="bg-gradient-to-l from-[#1E3A5F] to-[#2D5080] text-white py-4 px-6 no-print shadow-md">
        <div className="max-w-[1500px] mx-auto flex items-center justify-between">
          <div className="text-right">
            <h1 className="text-xl font-bold">סמדר - מערכת ביקורת נסיעות לחו"ל</h1>
            <p className="text-sm text-blue-200">אגף גמלאות אזרח ותיק, שאירים וקשרי חוץ | הבטחת הכנסה | קצבאות זקנה</p>
          </div>
          <div className="text-xs text-blue-200 text-left hidden md:block">
            <p>גרסה 2.0</p>
            <p>כל סוגי הגמלאות</p>
          </div>
        </div>
      </header>

      {/* Main 3-panel layout */}
      <main className="p-4 no-print">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1500px] mx-auto" style={{ minHeight: 'calc(100vh - 120px)' }}>
          {/* Panel Right - Input (4 cols) */}
          <div className="lg:col-span-4">
            <ClaimantInputPanel onRunAudit={handleRunAudit} />
          </div>

          {/* Panel Center - Calendar (4 cols) */}
          <div className="lg:col-span-4">
            {auditResult ? (
              <ResultCalendar result={auditResult} />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-4xl mb-3">📊</p>
                  <p className="text-gray-400 text-sm">הזן נתוני תובע ולחץ "בצע ביקורת"</p>
                  <p className="text-gray-300 text-xs mt-1">התוצאות יוצגו כאן</p>
                </div>
              </div>
            )}
          </div>

          {/* Panel Left - Letter (4 cols) */}
          <div className="lg:col-span-4">
            {auditResult && claimantInput ? (
              <Letter42Generator input={claimantInput} result={auditResult} />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-4xl mb-3">📄</p>
                  <p className="text-gray-400 text-sm">מכתב 42 יוצג לאחר ביצוע הביקורת</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Print area */}
      {auditResult && claimantInput && (
        <div className="hidden print:block p-8">
          <Letter42Generator input={claimantInput} result={auditResult} />
        </div>
      )}

      {/* Feedback FAB */}
      <button
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg text-white text-sm font-medium transition-transform hover:scale-105 active:scale-95 no-print"
        style={{ backgroundColor: '#1B3A5C' }}
        aria-label="משוב פיילוט"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">משוב פיילוט</span>
      </button>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}

export default App;
