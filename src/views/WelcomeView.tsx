import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ViewState } from '../App';

interface Props {
  onNavigate: (view: ViewState) => void;
}

export function WelcomeView({ onNavigate }: Props) {
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');

  const handleCodeSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (code === '260225') {
        onNavigate('ADMIN');
      } else {
        setShowCodeInput(false);
        setCode('');
      }
    }
  };

  return (
    <div 
      className="relative flex items-center justify-center min-h-screen bg-white overflow-hidden cursor-pointer"
      onClick={() => !showCodeInput && onNavigate('LOGIN')}
    >
      {/* Background lines and flowers animation */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
        <motion.path
          d="M 0,50 Q 25,20 50,50 T 100,50"
          fill="none"
          stroke="#000"
          strokeWidth="0.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 5, ease: "easeInOut" }}
        />
        <motion.circle
          cx="50" cy="50" r="2"
          fill="none"
          stroke="#000"
          strokeWidth="0.5"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 2, duration: 2 }}
        />
      </svg>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 2, delay: 1 }}
        className="z-10 text-center"
      >
        <h1 className="text-4xl md:text-6xl font-serif text-gray-800 tracking-widest font-light">
          欢迎来到哨向世界
        </h1>
      </motion.div>

      {/* Secret Flower UI */}
      <div 
        className="absolute bottom-8 right-8 z-20"
        onClick={(e) => {
          e.stopPropagation();
          setShowCodeInput(true);
        }}
      >
        {!showCodeInput ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            whileHover={{ opacity: 1, scale: 1.1 }}
            className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
            </svg>
          </motion.div>
        ) : (
          <motion.input
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 120, opacity: 1 }}
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleCodeSubmit}
            placeholder="Code"
            className="px-3 py-1 text-sm border-b border-gray-300 bg-transparent outline-none focus:border-gray-500 text-gray-600"
            autoFocus
            onBlur={() => setShowCodeInput(false)}
          />
        )}
      </div>
    </div>
  );
}
