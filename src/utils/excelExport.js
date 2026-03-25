import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getDaysInMonth, startOfMonth, getDay, format, subMonths, addMonths } from 'date-fns';

/**
 * Generates a text-based mini calendar for Excel cells.
 */
const generateMiniText = (date) => {
  const dim = getDaysInMonth(date);
  const start = getDay(startOfMonth(date));
  
  const title = format(date, 'MMM yyyy');
  const pad = Math.floor((19 - title.length) / 2);
  let str = `${title.padStart(title.length + pad, ' ')}\nS  M  T  W  T  F  S\n`;
  
  let currentLine = "";
  for (let i = 0; i < start; i++) currentLine += "   "; // 3 spaces
  for (let i = 1; i <= dim; i++) {
    currentLine += i.toString().padEnd(2, ' ') + " ";
    if ((start + i) % 7 === 0) {
      str += currentLine.trimEnd() + "\n";
      currentLine = "";
    }
  }
  if (currentLine) str += currentLine.trimEnd();
  return str;
};

export const exportToExcel = async (events, currentDate, options = {}) => {
  const { 
    calendarTitle = 'Office Calendar', 
    headerImage = null, 
    themeColors = { primary: '#333333', secondary: '#666666', border: '#cccccc' }, 
    blankBlockColor = '#f9fafb',
    dayBlockColor = '#ffffff',
    orientation = 'landscape',
    globalFontSize = 10
  } = options;

  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();
  const monthName = format(currentDate, 'MMMM');

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(monthName, {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: orientation }
  });

  sheet.columns = Array(7).fill({ width: orientation === 'portrait' ? 18 : 25 });

  let currentRow = 1;

  // Header Image handling FIRST so it gets its own dedicated row
  if (headerImage && headerImage.includes(';base64,')) {
    try {
      const base64Data = headerImage.split(';base64,')[1];
      let extension = headerImage.substring("data:image/".length, headerImage.indexOf(";base64,"));
      if (extension === 'jpeg') extension = 'jpg';
      const imageId = workbook.addImage({
        base64: base64Data,
        extension: extension,
      });
      
      const imgRow = sheet.addRow([]);
      sheet.mergeCells(`A${currentRow}:G${currentRow}`);
      imgRow.height = 100;
      
      sheet.addImage(imageId, {
        tl: { col: 0, row: currentRow - 1 }, // 0-based for image anchors
        br: { col: 7, row: currentRow },
        editAs: 'absolute'
      });
      
      currentRow++;
    } catch(err) {
      console.warn("Failed to embed image in Excel", err);
    }
  }

  // Month/Year Row NEXT so it doesn't get buried under the image
  const monthYearRow = sheet.addRow([`${monthName} ${year}`]);
  const monthNum = monthYearRow.number;
  sheet.mergeCells(`A${monthNum}:G${monthNum}`);
  monthYearRow.height = 45;
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
    const cell = sheet.getCell(`${col}${monthNum}`);
    cell.font = { name: 'Segoe UI', size: 26, bold: true, color: { argb: `FF${(themeColors.text || themeColors.primary || '#000000').replace('#', '')}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  
  // Custom Calendar Title Row
  if (calendarTitle) {
    const customTitleRow = sheet.addRow([calendarTitle]);
    const titleNum = customTitleRow.number;
    sheet.mergeCells(`A${titleNum}:G${titleNum}`);
    customTitleRow.height = 45;
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
      const cell = sheet.getCell(`${col}${titleNum}`);
      cell.font = { name: 'Segoe UI', size: 26, bold: true, color: { argb: `FF${(themeColors.text || themeColors.primary || '#000000').replace('#', '')}` } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  }
  
  sheet.addRow([]);

  // Headers
  const daysRow = sheet.addRow(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  daysRow.height = 25;
  const hexPrimary = (themeColors.primary || '#2C3E50').replace('#', '').toUpperCase();
  daysRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hexPrimary}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: {style:'medium', color:{argb:`FF${hexPrimary}`}} };
  });

  // Grid Construction
  const dim = getDaysInMonth(currentDate);
  const start = getDay(startOfMonth(currentDate));
  const hasSpace = start >= 2;
  const cells = [];
  const prevDim = getDaysInMonth(subMonths(currentDate, 1));
  
  for (let i = 0; i < start; i++) cells.push({ type: 'empty', text: '', index: i });
  for (let i = 1; i <= dim; i++) cells.push({ type: 'active', text: i.toString() });
  const target = cells.length > 35 ? 42 : 35;
  for (let i = 0; i < (target - cells.length); i++) cells.push({ type: 'empty', text: '', index: i });

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  weeks.forEach(week => {
    const row = sheet.addRow([]);
    row.height = orientation === 'portrait' ? 145 : 110;

    week.forEach((cData, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      
      if (cData.type === 'empty') {
        const hexBg = (blankBlockColor || '#f9fafb').replace('#', '').toUpperCase();
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hexBg}` } };
        let mini = "";
        if (hasSpace && cells.indexOf(cData) === 0) mini = `${generateMiniText(subMonths(currentDate, 1))}`;
        if (hasSpace && cells.indexOf(cData) === 1) mini = `${generateMiniText(addMonths(currentDate, 1))}`;
        if (!hasSpace && cData.index === (target - cells.length - 2)) mini = `${generateMiniText(subMonths(currentDate, 1))}`;
        if (!hasSpace && cData.index === (target - cells.length - 1)) mini = `${generateMiniText(addMonths(currentDate, 1))}`;

        cell.value = mini;
        cell.font = { name: 'Consolas', size: orientation === 'portrait' ? 7.5 : 9, color: { argb: 'FF9CA3AF' } };
        // Empty cells have no border to match "no lines" request.
        // Excel strictly ignores trailing spaces when centering, which previously destroyed partial-week monospace alignments.
        // Forcing left-alignment combined with an indent natively retains perfect grid structure.
        cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left', indent: orientation === 'portrait' ? 0.5 : 3 };
      } else {
        const dStr = format(new Date(year, monthIndex, parseInt(cData.text)), 'yyyy-MM-dd');
        const dEvs = events.filter(e => e.date === dStr);

        const hexActiveBg = (dayBlockColor || '#ffffff').replace('#', '').toUpperCase();
        const rich = [{ font: { name: 'Segoe UI', size: 12, bold: true }, text: `${cData.text}\n\n` }];
        
        dEvs.forEach((ev, idx) => {
          const isH = !!ev.bgColor;
          let hexTextColor = (ev.textColor || '#000000').replace('#', '').toUpperCase();
          
          // If the web text is white but the excel cell background is white, the text will be invisible.
          // Since Excel can't paint background squares behind the text, we force the text back to black for readability.
          if (isH && hexTextColor === 'FFFFFF' && hexActiveBg === 'FFFFFF') {
            hexTextColor = '000000';
          }
          
          // Excel richText structures DO NOT support inline character background colors!
          // To visually represent the user's Background Highlights or Box Borders natively, 
          // we inject a colored square icon before the text exactly mapping their chosen properties.
          if (isH && ev.bgColor) {
             const hexBg = ev.bgColor.replace('#', '').toUpperCase();
             rich.push({ font: { name: 'Segoe UI', size: ev.fontSize || globalFontSize, color: { argb: `FF${hexBg}` } }, text: '█ ' });
          } else if (ev.borderColor) {
             const hexBorder = ev.borderColor.replace('#', '').toUpperCase();
             rich.push({ font: { name: 'Segoe UI', size: ev.fontSize || globalFontSize, color: { argb: `FF${hexBorder}` } }, text: '☐ ' });
          }
          
          rich.push({ 
            font: { 
              name: 'Segoe UI', 
              size: ev.fontSize || globalFontSize, 
              bold: isH || !!ev.borderColor, 
              color: { argb: `FF${hexTextColor}` } 
            },
            text: `${ev.title}${idx < dEvs.length - 1 ? '\n' : ''}` 
          });
        });

        cell.value = { richText: rich };
        cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left', indent: 1 };
        
        // Active Box background color
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hexActiveBg}` } };
        
        // Active Box border
        const hexBorder = (themeColors.border || '#cccccc').replace('#', '').toUpperCase();
        cell.border = { 
          top: {style:'thin', color:{argb:`FF${hexBorder}`}}, 
          left: {style:'thin', color:{argb:`FF${hexBorder}`}}, 
          bottom: {style:'thin', color:{argb:`FF${hexBorder}`}}, 
          right: {style:'thin', color:{argb:`FF${hexBorder}`}} 
        };
      }
    });
  });

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Calendar_${monthName}_${year}.xlsx`);
};
