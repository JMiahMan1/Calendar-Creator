import React, { useState } from 'react';
import CalendarGrid from './components/CalendarGrid';
import { parseICSFile, fetchICSFeed } from './utils/icsHandler';
import { exportToExcel } from './utils/excelExport';
import './App.css';

function App() {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1)); // Default: January 2026
  const [feedUrl, setFeedUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState([]);

  /**
   * Smart Merge: Adds new events or updates existing ones.
   * Preserves your custom colors and font sizes for existing events.
   */
  const mergeEvents = (currentEvents, importedEvents) => {
    const eventMap = new Map(currentEvents.map(ev => [ev.id, ev]));
    
    importedEvents.forEach(newEv => {
      if (eventMap.has(newEv.id)) {
        const existing = eventMap.get(newEv.id);
        eventMap.set(newEv.id, {
          ...newEv,
          fontSize: existing.fontSize,
          bgColor: existing.bgColor,
          textColor: existing.textColor
        });
      } else {
        eventMap.set(newEv.id, newEv);
      }
    });
    return Array.from(eventMap.values());
  };

  /**
   * Bulk Update: Applies changes to all selected events at once.
   */
  const handleUpdateBulk = (field, value) => {
    setEvents(events.map(ev => 
      selectedEventIds.includes(ev.id) ? { ...ev, [field]: value } : ev
    ));
  };

  /**
   * iCal Sync Logic
   */
  const handleFeedSubmit = async () => {
    if (!feedUrl) return;
    setIsLoading(true);
    try {
      const feedEvents = await fetchICSFeed(feedUrl);
      setEvents(prev => mergeEvents(prev, feedEvents));
      setFeedUrl('');
      alert("Feed synchronized successfully!");
    } catch (error) {
      alert(`Sync Failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Project Management: Save/Load local backups
   */
  const handleSaveProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `calendar_backup_${new Date().toISOString().split('T')[0]}.json`);
    downloadAnchor.click();
  };

  const handleLoadProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loadedEvents = JSON.parse(event.target.result);
        setEvents(loadedEvents);
      } catch (err) {
        alert("Invalid project file.");
      }
    };
    reader.readAsText(file);
    e.target.value = null; // Reset input
  };

  const firstSelected = events.find(e => e.id === selectedEventIds[0]);

  return (
    <div className="app-layout">
      <aside className="sidebar no-print">
        <h2>Calendar Tools</h2>
        
        {/* BULK EDITOR SECTION */}
        <div className="tool-group" style={{ borderColor: selectedEventIds.length > 0 ? '#3b82f6' : 'transparent', borderWidth: '1px', borderStyle: 'solid' }}>
          <h3>Bulk Edit ({selectedEventIds.length})</h3>
          {selectedEventIds.length > 0 ? (
            <div>
              {/* Only show text editor if exactly one event is selected */}
              {selectedEventIds.length === 1 && (
                <textarea 
                  placeholder="Event title..."
                  value={firstSelected?.title || ''} 
                  onChange={(e) => handleUpdateBulk('title', e.target.value)}
                />
              )}
              <div className="control-row">
                <label>Text Size</label>
                <input 
                  type="range" min="6" max="24" step="0.5" 
                  value={firstSelected?.fontSize || 10} 
                  onChange={(e) => handleUpdateBulk('fontSize', parseFloat(e.target.value))} 
                />
              </div>
              <div className="control-row-split">
                <div>
                  <label>Highlight</label>
                  <input 
                    type="color" 
                    value={firstSelected?.bgColor || '#ffffff'} 
                    onChange={(e) => handleUpdateBulk('bgColor', e.target.value === '#ffffff' ? null : e.target.value)} 
                  />
                </div>
                <div>
                  <label>Text Color</label>
                  <input 
                    type="color" 
                    value={firstSelected?.textColor || '#000000'} 
                    onChange={(e) => handleUpdateBulk('textColor', e.target.value)} 
                  />
                </div>
              </div>
              <button className="btn secondary" onClick={() => setSelectedEventIds([])}>Deselect All</button>
              <button className="btn danger" onClick={() => {
                if(window.confirm(`Delete ${selectedEventIds.length} selected events?`)) {
                  setEvents(events.filter(ev => !selectedEventIds.includes(ev.id)));
                  setSelectedEventIds([]);
                }
              }}>Delete Selection</button>
            </div>
          ) : (
            <p className="hint">Ctrl + Click (or Cmd + Click) multiple events in the calendar to edit them at once.</p>
          )}
        </div>

        {/* NAVIGATION SECTION */}
        <div className="tool-group">
          <h3>Date Navigation</h3>
          <div className="nav-btns">
            <button className="btn" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>Prev</button>
            <button className="btn" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>Next</button>
          </div>
          <select 
            value={currentDate.getMonth()} 
            onChange={(e) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value), 1))}
          >
            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <input 
            type="number" 
            value={currentDate.getFullYear()} 
            onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth(), 1))} 
          />
        </div>

        {/* DATA IMPORT / EXPORT SECTION */}
        <div className="tool-group">
          <h3>Import & Sync</h3>
          <input 
            type="text" 
            placeholder="iCal URL (Planning Center)..." 
            value={feedUrl} 
            onChange={(e) => setFeedUrl(e.target.value)} 
          />
          <button className="btn" onClick={handleFeedSubmit} disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Sync iCal Feed'}
          </button>
          
          <label className="btn secondary" style={{marginTop: '5px'}}>
            Upload .ICS File
            <input type="file" accept=".ics" onChange={async (e) => {
              const file = e.target.files[0];
              if (file) {
                const parsed = await parseICSFile(file);
                setEvents(prev => mergeEvents(prev, parsed));
                e.target.value = null;
              }
            }} hidden />
          </label>
          
          <hr style={{ border: '0', borderTop: '1px solid #43485e', margin: '15px 0' }} />
          <h3>Output</h3>
          <button className="btn success" onClick={() => exportToExcel(events, currentDate)}>Export to Excel</button>
          <button className="btn" onClick={() => window.print()}>Print / Save PDF</button>
        </div>

        {/* PROJECT WORKSPACE */}
        <div className="tool-group">
          <h3>Workspace</h3>
          <button className="btn secondary" onClick={handleSaveProject}>Backup to JSON</button>
          <label className="btn secondary">
            Restore JSON
            <input type="file" accept=".json" onChange={handleLoadProject} hidden />
          </label>
          <button className="btn danger" onClick={() => {
            if(window.confirm("This will erase all current events. Continue?")) setEvents([]);
          }}>Reset All</button>
        </div>
      </aside>

      <main className="calendar-workspace">
        <CalendarGrid 
          currentDate={currentDate} 
          events={events} 
          selectedEventIds={selectedEventIds} 
          onEventClick={(id, isMulti) => {
            if (isMulti) {
              setSelectedEventIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
            } else {
              setSelectedEventIds([id]);
            }
          }} 
        />
      </main>
    </div>
  );
}

export default App;
