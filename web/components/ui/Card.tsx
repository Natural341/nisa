import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  gradient?: boolean; 
  action?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, title, subtitle, className = '', action }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        relative overflow-hidden
        rounded-xl
        border border-slate-200
        bg-white
        shadow-sm
        ${className}
      `}
    >
      {/* Content */}
      <div className="p-6 h-full flex flex-col">
        {(title || action) && (
          <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
            <div>
                {title && <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>}
                {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            {action && <div>{action}</div>}
          </div>
        )}
        <div className="flex-1">
            {children}
        </div>
      </div>
    </motion.div>
  );
};

export default Card;