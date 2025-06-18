"use client";
import { useState, useEffect, useRef } from "react";

interface CalendarProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function Calendar({ 
  value, 
  onChange, 
  placeholder = "Select date", 
  className = "",
  disabled = false 
}: CalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get today's date for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get current month's first day and last day
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

  // Generate calendar days
  const generateCalendarDays = () => {
    const days = [];
    const currentDate = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const isCurrentMonth = currentDate.getMonth() === currentMonth.getMonth();
      const isToday = currentDate.toDateString() === today.toDateString();
      const isSelected = value && currentDate.toISOString().split('T')[0] === value;
      const isPast = currentDate < today;

      days.push({
        date: new Date(currentDate),
        isCurrentMonth,
        isToday,
        isSelected,
        isPast
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  };

  const handleDateSelect = (date: Date) => {
    if (date < today) return; // Prevent selecting past dates
    
    const dateString = date.toISOString().split('T')[0];
    onChange(dateString);
    setIsOpen(false);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const todayString = today.toISOString().split('T')[0];
    onChange(todayString);
    setCurrentMonth(new Date());
    setIsOpen(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return placeholder;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const days = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className={`relative ${className}`} ref={calendarRef}>
      {/* Date Input */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          border border-gray-300 rounded-md px-3 py-2 cursor-pointer
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-blue-500'}
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-200' : ''}
          flex items-center justify-between
        `}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {formatDate(value)}
        </span>
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Calendar Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[280px]">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-3 border-b">
            <button
              onClick={goToPreviousMonth}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
            </div>
            
            <button
              onClick={goToNextMonth}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Today Button */}
          <div className="p-2 border-b">
            <button
              onClick={goToToday}
              className="w-full px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
            >
              Today
            </button>
          </div>

          {/* Week Days Header */}
          <div className="grid grid-cols-7 gap-1 p-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1 p-2">
            {days.map((day, index) => (
              <button
                key={index}
                onClick={() => handleDateSelect(day.date)}
                disabled={day.isPast}
                className={`
                  w-8 h-8 text-sm rounded-full flex items-center justify-center
                  ${day.isPast 
                    ? 'text-gray-300 cursor-not-allowed' 
                    : 'hover:bg-gray-100 cursor-pointer'
                  }
                  ${!day.isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}
                  ${day.isToday ? 'bg-blue-100 text-blue-700 font-semibold' : ''}
                  ${day.isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                  ${day.isPast && day.isCurrentMonth ? 'line-through' : ''}
                `}
              >
                {day.date.getDate()}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="p-2 border-t bg-gray-50 rounded-b-lg">
            <div className="text-xs text-gray-500 text-center">
              Past dates are disabled
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 