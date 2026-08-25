import React, { useState, useEffect, useRef } from 'react';
import './CustomSelect.css';

const CustomSelect = ({ 
  options = [], 
  value = '', 
  onChange, 
  placeholder = 'Select option...', 
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Normalize options array to { value, label } format
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return { value: opt.value, label: opt.label || opt.value };
    }
    return { value: opt, label: opt };
  });

  const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  // Toggle dropdown menu
  const handleToggle = () => {
    setIsOpen(prev => !prev);
  };

  // Select an option
  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`custom-select-container ${isOpen ? 'is-open' : ''} ${className}`} ref={containerRef}>
      <button 
        type="button" 
        className="custom-select-trigger" 
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={`custom-select-label ${!value ? 'is-placeholder' : ''}`}>
          {displayLabel}
        </span>
        <svg 
          className={`custom-select-chevron ${isOpen ? 'rotated' : ''}`} 
          width="14" 
          height="8" 
          viewBox="0 0 14 8" 
          fill="none"
        >
          <path 
            d="M1 1.5L7 6.5L13 1.5" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <ul className="custom-select-menu" role="listbox">
          {normalizedOptions.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <li 
                key={String(opt.value)}
                className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
                role="option"
                aria-selected={isSelected}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <svg className="option-check-icon" width="14" height="10" viewBox="0 0 14 10" fill="none">
                    <path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CustomSelect;
