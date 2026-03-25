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

  // Theming & Customization State
  const [calendarTitle, setCalendarTitle] = useState('Office Calendar');
  const [headerImage, setHeaderImage] = useState(null);
  const [themeColors, setThemeColors] = useState({ primary: '#000000', text: '#000000', secondary: '#666666', border: '#cccccc' });
  const [blankBlockColor, setBlankBlockColor] = useState('#fafafa');
  const [dayBlockColor, setDayBlockColor] = useState('#ffffff');
  const [orientation, setOrientation] = useState('landscape');
  const [globalFontSize, setGlobalFontSize] = useState(10);

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
    const backupData = {
      events,
      calendarTitle,
      headerImage,
      themeColors,
      blankBlockColor,
      dayBlockColor,
      orientation
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
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
        const loadedData = JSON.parse(event.target.result);
        if (Array.isArray(loadedData)) {
          setEvents(loadedData);
        } else {
          setEvents(loadedData.events || []);
          if (loadedData.calendarTitle) setCalendarTitle(loadedData.calendarTitle);
          if (loadedData.headerImage) setHeaderImage(loadedData.headerImage);
          if (loadedData.themeColors) setThemeColors(loadedData.themeColors);
          if (loadedData.blankBlockColor) setBlankBlockColor(loadedData.blankBlockColor);
          if (loadedData.dayBlockColor) setDayBlockColor(loadedData.dayBlockColor);
          if (loadedData.orientation) setOrientation(loadedData.orientation);
        }
      } catch (err) {
        alert("Invalid project file.");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleHeaderImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setHeaderImage(dataUrl);

        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width || 100;
            canvas.height = img.height || 100;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let r = 0, g = 0, b = 0, count = 0;
            // Sample every 40th sub-pixel (10th pixel) for performance
            for (let i = 0; i < data.length; i += 40) {
              r += data[i];
              g += data[i+1];
              b += data[i+2];
              count++;
            }
            const avgR = Math.round(r/count);
            const avgG = Math.round(g/count);
            const avgB = Math.round(b/count);
            
            const rgbToHex = (r2, g2, b2) => '#' + [r2, g2, b2].map(x => {
              const hex = x.toString(16);
              return hex.length === 1 ? '0' + hex : hex;
            }).join('');

            const primaryHex = rgbToHex(avgR, avgG, avgB);
            
            setThemeColors({
              primary: primaryHex,
              text: primaryHex,
              secondary: '#666666',
              border: '#cccccc'
            });
          } catch(e) {
             console.error("Native color extraction failed.", e);
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
      e.target.value = null;
    }
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
                  type="range" min="4" max="24" step="0.5" 
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
              
              <div className="control-row-split" style={{marginTop: '10px'}}>
                <div>
                  <label>Box Border Color</label>
                  <div style={{display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px'}}>
                    <input 
                      type="color" 
                      value={firstSelected?.borderColor || '#000000'} 
                      onChange={(e) => handleUpdateBulk('borderColor', e.target.value)} 
                    />
                    <button 
                      className={`btn ${firstSelected?.borderColor ? 'danger' : 'success'}`}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => handleUpdateBulk('borderColor', firstSelected?.borderColor ? null : (firstSelected?.borderColor || '#000000'))}
                    >
                      {firstSelected?.borderColor ? 'Remove Box' : 'Draw Box'}
                    </button>
                  </div>
                </div>
              </div>
              
              {firstSelected?.borderColor && (
                <div style={{marginTop: '10px'}}>
                  <label style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span>Border Size</span>
                    <span>{firstSelected?.borderWidth || 2}px</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" max="10" 
                    value={firstSelected?.borderWidth || 2} 
                    onChange={(e) => handleUpdateBulk('borderWidth', parseInt(e.target.value))} 
                    style={{width: '100%', marginTop: '5px'}}
                  />
                </div>
              )}

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
          
          <hr style={{ border: '0', borderTop: '1px solid #43485e', margin: '15px 0' }} />
          <button className="btn success" style={{width: '100%'}} onClick={() => {
            const title = window.prompt("Enter new event title:");
            if (!title) return;
            const dateStr = window.prompt("Enter date (YYYY-MM-DD):", currentDate.toISOString().split('T')[0]);
            if (!dateStr) return;
            
            const newEv = {
              id: `manual-${Date.now()}`,
              title,
              date: dateStr,
              isManual: true,
              fontSize: globalFontSize,
              bgColor: null,
              textColor: '#000000',
              borderColor: null
            };
            setEvents([...events, newEv]);
          }}>+ Add Custom Event</button>
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

        {/* APPEARANCE SECTION */}
        <div className="tool-group">
          <h3>Appearance</h3>
          <label className="hint">Title</label>
          <input type="text" value={calendarTitle} onChange={(e) => setCalendarTitle(e.target.value)} />
          
          <label className="btn secondary" style={{marginTop:'5px'}}>
            Upload Header Image
            <input type="file" accept="image/*" onChange={handleHeaderImageUpload} hidden />
          </label>
          {headerImage && <button className="btn danger" onClick={() => { setHeaderImage(null); setThemeColors({ primary: '#000000', secondary: '#666666', border: '#cccccc' }); }}>Remove Image</button>}

          <div className="control-row-split" style={{marginTop: '10px'}}>
            <div>
              <label>Header Paint Color</label>
              <input type="color" value={themeColors.primary} onChange={(e) => setThemeColors({...themeColors, primary: e.target.value})} />
            </div>
            <div>
              <label>Grid Text Color</label>
              <input type="color" value={themeColors.text || '#000000'} onChange={(e) => setThemeColors({...themeColors, text: e.target.value})} />
            </div>
          </div>
          
          <div className="control-row-split" style={{marginTop: '10px'}}>
            <div>
              <label>Blank Box Color</label>
              <input type="color" value={blankBlockColor} onChange={(e) => setBlankBlockColor(e.target.value)} />
            </div>
            <div>
              <label>Active Box Color</label>
              <input type="color" value={dayBlockColor} onChange={(e) => setDayBlockColor(e.target.value)} />
            </div>
          </div>
          
          <label className="hint" style={{marginTop: '10px', display: 'block'}}>Orientation</label>
          <select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
          
          <div className="control-row" style={{marginTop: '15px'}}>
            <label style={{display: 'flex', justifyContent: 'space-between'}}>
              <span>Global Text Size</span>
              <span>{globalFontSize}pt</span>
            </label>
            <input 
              type="range" 
              min="4" max="24" 
              value={globalFontSize} 
              onChange={(e) => setGlobalFontSize(parseInt(e.target.value))}
              style={{width: '100%', marginTop: '5px'}}
            />
          </div>
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
          <button className="btn success" onClick={() => exportToExcel(events, currentDate, { calendarTitle, headerImage, themeColors, blankBlockColor, dayBlockColor, orientation, globalFontSize })}>Export to Excel</button>
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
          calendarTitle={calendarTitle}
          headerImage={headerImage}
          themeColors={themeColors}
          blankBlockColor={blankBlockColor}
          dayBlockColor={dayBlockColor}
          orientation={orientation}
          globalFontSize={globalFontSize}
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
