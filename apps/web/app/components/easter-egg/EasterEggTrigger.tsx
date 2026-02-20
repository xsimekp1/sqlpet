'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ApiClient from '@/app/lib/api';

interface BreedImage {
  color: string;
  image_url: string;
}

interface Breed {
  id: string;
  name: string;
  display_name: string;
}

interface Question {
  breed: Breed;
  image?: BreedImage;
  options: string[];
}

export function EasterEggTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [locked, setLocked] = useState(false);
  const [phase, setPhase] = useState<'quiz' | 'result'>('quiz');
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState<BreedImage | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  // Load breeds once when dialog opens
  useEffect(() => {
    async function loadBreeds() {
      setLoading(true);
      try {
        const breedList = await ApiClient.getBreeds('dog');
        setBreeds(breedList);
      } catch (error) {
        console.error('Failed to load breeds:', error);
      } finally {
        setLoading(false);
      }
    }
    if (isOpen && breeds.length === 0) {
      loadBreeds();
    }
  }, [isOpen]);

  // Load image for current question
  useEffect(() => {
    async function loadQuestionImage() {
      if (!currentQuestion || phase !== 'quiz') return;
      
      setLoadingImage(true);
      try {
        const colorImages = await ApiClient.getBreedColorImages(currentQuestion.breed.id);
        if (colorImages.length > 0) {
          const randomImage = colorImages[Math.floor(Math.random() * colorImages.length)];
          setCurrentImage(randomImage);
        } else {
          setCurrentImage(null);
        }
      } catch (error) {
        console.error('Failed to load image:', error);
        setCurrentImage(null);
      } finally {
        setLoadingImage(false);
      }
    }
    
    if (currentQuestion) {
      setCurrentImage(null); // Clear previous image
      loadQuestionImage();
    }
  }, [currentQuestion?.breed.id, phase]);

  const generateQuestions = (count: number = 10): Question[] => {
    const shuffled = [...breeds].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);
    
    return selected.map(breed => {
      const otherBreeds = breeds.filter(b => b.id !== breed.id).sort(() => Math.random() - 0.5).slice(0, 2);
      const options = [...otherBreeds.map(b => b.display_name), breed.display_name].sort(() => Math.random() - 0.5);
      
      return {
        breed,
        options,
      };
    });
  };

  const startQuiz = async () => {
    setLoading(true);
    if (questions.length === 0) {
      const newQuestions = generateQuestions(10);
      setQuestions(newQuestions);
    }
    setCurrentIndex(0);
    setScore(0);
    setSelectedOption(null);
    setIsCorrect(null);
    setLocked(false);
    setPhase('quiz');
    setIsOpen(true);
    setLoading(false);
  };

  const handleAnswer = (index: number) => {
    if (locked) return;
    
    setSelectedOption(index);
    setLocked(true);
    const correct = questions[currentIndex].breed.display_name === questions[currentIndex].options[index];
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
          <DialogHeader>
            <DialogTitle className="sr-only">Uhodni plemeno</DialogTitle>
          </DialogHeader>
          {loading && (
            <div className="p-8 text-center">
              <p className="text-[#00E5FF]">Načítám plemena...</p>
            </div>
          )}
          
          {!loading && !currentQuestion && (
            <div className="p-8 text-center">
              <p className="text-white">Načítám...</p>
            </div>
          )}
          
          {!loading && phase === 'quiz' && currentQuestion && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-[#00E5FF] drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]">
                  Uhodni plemeno!
                </h2>
                <span className="text-sm text-[#39FF14] drop-shadow-[0_0_6px_rgba(57,255,20,0.6)]">
                  Skóre: {score}
                </span>
              </div>
              
              <div className="text-center text-sm text-[#FFE600]">
                Otázka {currentIndex + 1}/10
              </div>
              
              {loadingImage ? (
                <div className="flex justify-center p-4">
                  <p className="text-[#00E5FF]">Načítám obrázek...</p>
                </div>
              ) : currentImage && (
                <div className="flex justify-center">
                  <img 
                    src={currentImage.image_url} 
                    alt="Breed"
                    className="max-h-48 rounded-lg border-2 border-[#2a2a38]"
                  />
                </div>
              )}
              
              <div className="text-center mb-4">
                <p className="text-lg">Jaké je to plemeno?</p>
              </div>
              
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => {
                  let btnClass = "w-full p-4 text-center border-2 border-[#2a2a38] bg-[#0b0b12] text-white rounded-lg transition-all ";
                  
                  if (selectedOption === idx) {
                    if (isCorrect) {
                      btnClass += "bg-[#071a0a] border-[#39FF14] text-[#caffc0] shadow-[0_0_22px_rgba(57,255,20,0.55)]";
                    } else {
                      btnClass += "bg-[#1a0707] border-[#FF3131] text-[#ffd0d0] shadow-[0_0_22px_rgba(255,49,49,0.55)]";
                    }
                  } else if (locked && !isCorrect && option === currentQuestion.breed.display_name) {
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
          
          {!loading && phase === 'result' && (
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
                  onClick={() => {
                    setQuestions(generateQuestions(10));
                    setCurrentIndex(0);
                    setScore(0);
                    setSelectedOption(null);
                    setIsCorrect(null);
                    setLocked(false);
                    setPhase('quiz');
                  }}
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
