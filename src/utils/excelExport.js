import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getDaysInMonth, startOfMonth, getDay, format, subMonths, addMonths } from 'date-fns';

/**
 * Generates a text-based mini calendar for Excel cells.
 */
const generateMiniText = (date) => {
  const monthName = format(date, 'MMM yyyy');
  const daysInMonth = getDaysInMonth(date);
  const startDay = getDay(startOfMonth(date));
  
  let calStr = `   ${monthName}\nS  M  T  W  T  F  S\n`;
  let line = "   ".repeat(startDay);
  
  for (let i = 1; i <= daysInMonth; i++) {
    line += i.toString().padEnd(3, ' ');
    if ((i + startDay) % 7 === 0 || i === daysInMonth) {
      calStr += line.trimEnd() + '\n';
      line = "";
    }
  }
  return calStr;
};

export const exportToExcel = async (events, currentDate) => {
  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();
  const monthName = format(currentDate, 'MMMM');

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(monthName, {
    views: [{ showGridLines: false }]
  });

  sheet.columns = Array(7).fill({ width: 25 });

  // Title
  const titleRow = sheet.addRow([`${monthName} ${year}`]);
  sheet.mergeCells('A1:G1');
  titleRow.height = 45;
  titleRow.getCell(1).font = { name: 'Segoe UI', size: 26, bold: true };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.addRow([]);

  // Headers
  const daysRow = sheet.addRow(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  daysRow.height = 25;
  daysRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
  });

  // Grid Construction
  const dim = getDaysInMonth(currentDate);
  const start = getDay(startOfMonth(currentDate));
  const hasSpace = start >= 2;
  const cells = [];
  const prevDim = getDaysInMonth(subMonths(currentDate, 1));
  
  for (let i = 0; i < start; i++) cells.push({ type: 'empty', text: (prevDim - start + i + 1).toString(), index: i });
  for (let i = 1; i <= dim; i++) cells.push({ type: 'active', text: i.toString() });
  const target = cells.length > 35 ? 42 : 35;
  for (let i = 0; i < (target - cells.length); i++) cells.push({ type: 'empty', text: (i + 1).toString(), index: i });

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  weeks.forEach(week => {
    const row = sheet.addRow([]);
    row.height = 110;

    week.forEach((cData, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      
      if (cData.type === 'empty') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        let mini = "";
        if (hasSpace && cells.indexOf(cData) === 0) mini = `\n\n${generateMiniText(subMonths(currentDate, 1))}`;
        if (hasSpace && cells.indexOf(cData) === 1) mini = `\n\n${generateMiniText(addMonths(currentDate, 1))}`;
        if (!hasSpace && cData.index === (target - cells.length - 2)) mini = `\n\n${generateMiniText(subMonths(currentDate, 1))}`;
        if (!hasSpace && cData.index === (target - cells.length - 1)) mini = `\n\n${generateMiniText(addMonths(currentDate, 1))}`;

        cell.value = cData.text + mini;
        cell.font = { name: 'Consolas', size: 9, color: { argb: 'FF9CA3AF' } };
        cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'right' };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      } else {
        const dStr = format(new Date(year, monthIndex, parseInt(cData.text)), 'yyyy-MM-dd');
        const dEvs = events.filter(e => e.date === dStr);

        const rich = [{ font: { name: 'Segoe UI', size: 12, bold: true }, text: `${cData.text}\n\n` }];
        
        dEvs.forEach((ev, idx) => {
          const isH = !!ev.bgColor;
          const hexColor = (ev.textColor || '#000000').replace('#', '');
          
          rich.push({ 
            font: { 
              name: 'Segoe UI', 
              size: ev.fontSize || 10, 
              bold: isH, 
              color: { argb: `FF${hexColor}` } 
            },
            // REMOVED BULLET POINTS: Pure title text only
            text: `${ev.title}${idx < dEvs.length - 1 ? '\n' : ''}` 
          });
        });

        cell.value = { richText: rich };
        cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left', indent: 1 };
        cell.border = { 
          top: {style:'medium', color:{argb:'FF888888'}}, 
          left: {style:'medium', color:{argb:'FF888888'}}, 
          bottom: {style:'medium', color:{argb:'FF888888'}}, 
          right: {style:'medium', color:{argb:'FF888888'}} 
        };
      }
    });
  });

  const buf = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `Calendar_${monthName}_${year}.xlsx`);
};
