import React from 'react';
import { getDaysInMonth, startOfMonth, getDay, format, subMonths, addMonths } from 'date-fns';

/**
 * Renders a tiny 1-month calendar table for the empty corner slots.
 */
const MiniCalendar = ({ date, rowCount }) => {
  const dim = getDaysInMonth(date);
  const start = getDay(startOfMonth(date));
  const days = Array.from({ length: 42 }, (_, i) => {
    const n = i - start + 1; 
    return n > 0 && n <= dim ? n : '';
  });
  
  const rows = [];
  for (let i = 0; i < 42; i += 7) { 
    rows.push(days.slice(i, i + 7)); 
  }

  return (
    <div className={`mini-cal-wrapper rows-${rowCount}`}>
      <div className="mini-calendar-title">{format(date, 'MMM yyyy')}</div>
      <table className="mini-calendar">
        <thead>
          <tr>{['S','M','T','W','T','F','S'].map((d,i)=><th key={i}>{d}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>{row.map((day, j) => <td key={j}>{day}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * The Main Grid Component
 */
const CalendarGrid = ({ currentDate, events, selectedEventIds, onEventClick, calendarTitle, headerImage, themeColors, blankBlockColor, dayBlockColor, orientation, globalFontSize }) => {
  const dim = getDaysInMonth(currentDate);
  const start = getDay(startOfMonth(currentDate)); 
  const prevMonthDate = subMonths(currentDate, 1);
  const nextMonthDate = addMonths(currentDate, 1);
  const prevDim = getDaysInMonth(prevMonthDate);
  
  // 1. Empty slots before the first day
  const blanks = Array.from({ length: start }, (_, i) => ({ 
    type: 'empty', 
    dayNum: prevDim - start + i + 1, 
    isPrev: start >= 2 && i === 0, 
    isNext: start >= 2 && i === 1 
  }));

  // 2. The actual days of the selected month
  const activeDays = Array.from({ length: dim }, (_, i) => ({ 
    type: 'active', 
    dayNum: i + 1, 
    isPrev: false, 
    isNext: false 
  }));
  
  // 3. Determine if we need 5 rows (35 cells) or 6 rows (42 cells)
  const totalCellsNeeded = start + dim;
  const targetTotal = totalCellsNeeded > 35 ? 42 : 35;
  const rowCount = targetTotal / 7;

  // 4. Padding days at the end of the month
  const endCount = targetTotal - totalCellsNeeded;
  const endBlanks = Array.from({ length: endCount }, (_, i) => ({ 
    type: 'empty', 
    dayNum: i + 1, 
    isPrev: start < 2 && i === (endCount - 2), 
    isNext: start < 2 && i === (endCount - 1) 
  }));

  const allSlots = [...blanks, ...activeDays, ...endBlanks];

  const printContainerStyle = {
    '--theme-primary': themeColors?.primary || '#000000',
    '--theme-text': themeColors?.text || themeColors?.primary || '#000000',
    '--theme-secondary': themeColors?.secondary || '#666666',
    '--theme-border': themeColors?.border || '#cccccc',
    '--blank-bg': blankBlockColor || '#fafafa',
    '--active-bg': dayBlockColor || '#ffffff'
  };

  return (
    <div className={`print-container ${orientation}`} style={printContainerStyle}>
      <style>{`@media print { @page { size: ${orientation}; margin: 0; } }`}</style>
      
      {headerImage && (
        <div className="header-image-container">
          <img src={headerImage} alt="Header" />
        </div>
      )}
      <div className="main-header">
        <h1>{format(currentDate, 'MMMM yyyy')}</h1>
        <h2>{calendarTitle || 'Office Calendar'}</h2>
      </div>

      {/* Class 'rows-5' or 'rows-6' forces the CSS grid to be perfectly uniform */}
      <div className={`calendar-grid rows-${rowCount}`}>
        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
          <div key={day} className="day-label">{day}</div>
        ))}

        {allSlots.map((slot, index) => {
          const isE = slot.type === 'empty';
          
          // Determine if we need to draw borders between this cell and its neighbors
          const nextSlot = allSlots[index + 1];
          const hasRightBorder = !isE || (nextSlot && nextSlot.type !== 'empty') || ((index + 1) % 7 === 0);
          
          const belowSlot = allSlots[index + 7];
          const hasBottomBorder = !isE || (belowSlot && belowSlot.type !== 'empty');

          const dStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), slot.dayNum), 'yyyy-MM-dd');
          const dEvs = isE ? [] : events.filter(e => e.date === dStr);

          return (
            <div 
              key={index} 
              className={`calendar-day ${isE ? 'empty-day' : ''}`}
              style={{
                borderRightColor: hasRightBorder ? undefined : 'transparent',
                borderBottomColor: hasBottomBorder ? undefined : 'transparent'
              }}
            >
              <span className="day-number">{slot.dayNum}</span>
              
              {!isE && (
                <div className="events-container">
                  {dEvs.map(ev => (
                    <div 
                      key={ev.id} 
                      className={`event ${selectedEventIds.includes(ev.id) ? 'is-selected' : ''} ${ev.bgColor ? 'has-highlight' : ''}`}
                      style={{ 
                        fontSize: `${ev.fontSize || globalFontSize || 10}pt`, 
                        backgroundColor: ev.bgColor || 'transparent', 
                        color: ev.textColor || '#000000',
                        border: ev.borderColor ? `${ev.borderWidth || 2}px solid ${ev.borderColor}` : '1.5px solid transparent'
                      }} 
                      onClick={(e) => onEventClick(ev.id, e.ctrlKey || e.metaKey)}
                    >
                      {ev.title}
                    </div>
                  ))}
                </div>
              )}

              {/* Mini-calendars for empty space filling */}
              {isE && slot.isPrev && <MiniCalendar date={prevMonthDate} rowCount={rowCount} />}
              {isE && slot.isNext && <MiniCalendar date={nextMonthDate} rowCount={rowCount} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarGrid;
