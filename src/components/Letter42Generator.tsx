import { ClaimantInput, AuditResult } from '../types/types';
import { generateLetter42 } from '../engine/letterEngine';
import { useState } from 'react';

interface Props {
  input: ClaimantInput;
  result: AuditResult;
}

export function Letter42Generator({ input, result }: Props) {
  const letterText = generateLetter42(input, result);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(letterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-bold text-[#1E3A5F] mb-1 text-right">טיוטת מכתב 42</h2>
      <p className="text-xs text-gray-500 mb-3 text-right">הודעה לתובע - לבדיקת הפקיד לפני שליחה</p>

      {/* Letter preview */}
      <div className="bg-white border border-gray-300 rounded-md p-5 mb-4 print:border-none print:p-0 shadow-inner"
        dir="rtl" style={{ fontFamily: "'Segoe UI', 'Arial Hebrew', Arial, sans-serif", fontSize: '13px', lineHeight: '1.9', textAlign: 'right' }}>
        {letterText.split('\n').map((line, i) => {
          if (line === '') return <div key={i} className="h-2" />;
          if (line.startsWith('---')) return <hr key={i} className="my-2 border-gray-200" />;
          if (line.startsWith('הנדון:') || line.startsWith('לכבוד')) return <p key={i} className="font-bold">{line}</p>;
          if (line.startsWith('*')) return <p key={i} className="text-orange-700 text-xs">{line}</p>;
          return <p key={i}>{line}</p>;
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-end no-print">
        <button onClick={handlePrint}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors">
          🖨️ הדפס
        </button>
        <button onClick={handleCopy}
          className="px-4 py-2 rounded-md text-sm text-white font-medium transition-all hover:shadow-md"
          style={{ backgroundColor: copied ? '#16a34a' : '#1E3A5F' }}>
          {copied ? '✓ הועתק!' : '📋 העתק ללוח'}
        </button>
      </div>
    </div>
  );
}
