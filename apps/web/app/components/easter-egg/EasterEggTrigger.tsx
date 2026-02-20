'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DOG_BREEDS } from './breeds';

interface Question {
  correct: string;
  options: string[];
}

function generateQuestions(count: number = 10): Question[] {
  const shuffled = [...DOG_BREEDS].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);
  
  return selected.map(correct => {
    const others = DOG_BREEDS.filter(b => b !== correct).sort(() => Math.random() - 0.5).slice(0, 2);
    const options = [...others, correct].sort(() => Math.random() - 0.5);
    return { correct, options };
  });
}

export function EasterEggTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [locked, setLocked] = useState(false);
  const [phase, setPhase] = useState<'quiz' | 'result'>('quiz');

  const startQuiz = () => {
    setQuestions(generateQuestions(10));
    setCurrentIndex(0);
    setScore(0);
    setSelectedOption(null);
    setIsCorrect(null);
    setLocked(false);
    setPhase('quiz');
    setIsOpen(true);
  };

  const handleAnswer = (index: number) => {
    if (locked) return;
    
    setSelectedOption(index);
    setLocked(true);
    const correct = questions[currentIndex].correct === questions[currentIndex].options[index];
    setIsCorrect(correct);
    if (correct) setScore(s => s + 1);
  };

  const nextQuestion = () => {
    if (currentIndex < 9) {
      setCurrentIndex(i => i + 1);
      setSelectedOption(null);
      setIsCorrect(null);
      setLocked(false);
    } else {
      setPhase('result');
    }
  };

  const currentQuestion = questions[currentIndex];

  return (
    <>
      <button
        onClick={startQuiz}
        className="w-2 h-2 opacity-10 hover:opacity-30 transition-opacity"
        title="?"
        aria-label="Easter egg"
      />
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-none bg-gradient-to-b from-[#05010a] via-[#0b0220] to-[#02010a] text-white">
          {phase === 'quiz' && currentQuestion && (
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-[#00E5FF] drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]">
                  Uhodni plemeno!
                </h2>
                <span className="text-sm text-[#39FF14] drop-shadow-[0_0_6px_rgba(57,255,20,0.6)]">
                  Skóre: {score}
                </span>
              </div>
              
              {/* Progress */}
              <div className="text-center text-sm text-[#FFE600]">
                Otázka {currentIndex + 1}/10
              </div>
              
              {/* Question */}
              <div className="text-center mb-4">
                <p className="text-lg">Jaké je to plemeno?</p>
              </div>
              
              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => {
                  let btnClass = "w-full p-4 text-center border-2 border-[#2a2a38] bg-[#0b0b12] text-white rounded-lg transition-all ";
                  
                  if (selectedOption === idx) {
                    if (isCorrect) {
                      btnClass += "bg-[#071a0a] border-[#39FF14] text-[#caffc0] shadow-[0_0_22px_rgba(57,255,20,0.55)]";
                    } else {
                      btnClass += "bg-[#1a0707] border-[#FF3131] text-[#ffd0d0] shadow-[0_0_22px_rgba(255,49,49,0.55)]";
                    }
                  } else if (locked && !isCorrect && option === currentQuestion.correct) {
                    btnClass += "bg-[#071a0a] border-[#39FF14] text-[#caffc0] shadow-[0_0_22px_rgba(57,255,20,0.55)]";
                  } else {
                    btnClass += "hover:shadow-[0_0_18px_rgba(0,229,255,0.35)] hover:border-[#00E5FF]";
                  }
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(idx)}
                      disabled={locked}
                      className={btnClass}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              
              {/* Next button */}
              {locked && (
                <button
                  onClick={nextQuestion}
                  className="w-full py-3 bg-[#00E5FF] text-black font-bold rounded-lg hover:bg-[#00c4e0] transition-colors"
                >
                  Další
                </button>
              )}
            </div>
          )}
          
          {phase === 'result' && (
            <div className="p-8 text-center space-y-6">
              <h2 className="text-3xl font-bold text-[#FFE600] drop-shadow-[0_0_12px_rgba(255,230,0,0.8)]">
                Výsledek!
              </h2>
              <p className="text-5xl font-bold text-[#39FF14] drop-shadow-[0_0_20px_rgba(57,255,20,0.8)]">
                {score}/10
              </p>
              <p className="text-[#00E5FF]">
                {score >= 8 ? 'Skvělé!' : score >= 5 ? 'Dobrý výkon!' : 'Zkus to znovu!'}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={startQuiz}
                  className="px-6 py-2 bg-[#FF00E5] text-white font-bold rounded-lg hover:bg-[#e000d4] transition-colors"
                >
                  Hrát znovu
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-2 border-2 border-[#2a2a38] text-white rounded-lg hover:border-[#00E5FF]"
                >
                  Zavřít
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
