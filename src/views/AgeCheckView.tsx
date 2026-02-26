import { useState } from 'react';
import { motion } from 'motion/react';
import { ViewState } from '../App';

interface Props {
  onNavigate: (view: ViewState) => void;
}

export function AgeCheckView({ onNavigate }: Props) {
  const [rejected, setRejected] = useState(false);

  if (rejected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-red-100"
        >
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">访问受限</h2>
          <p className="text-gray-600 leading-relaxed">
            好的，未分化的成员，请去审核群：<span className="font-bold text-gray-900">740196067</span>，获取您的身份。
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center"
      >
        <h2 className="text-2xl font-serif text-gray-800 mb-8">您是否成年（年满16周岁）？</h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => onNavigate('EXTRACTOR')}
            className="flex-1 py-3 px-6 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            是，我已成年
          </button>
          <button
            onClick={() => setRejected(true)}
            className="flex-1 py-3 px-6 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            否，我未成年
          </button>
        </div>
      </motion.div>
    </div>
  );
}
