import ICAL from 'ical.js';

/**
 * Converts raw ICS text into a structured array of event objects.
 * Uses a combination of UID and Title+Date to ensure IDs are consistent
 * across multiple syncs to prevent duplicates.
 */
const parseICSText = (text) => {
  try {
    const jcalData = ICAL.parse(text);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    return vevents.map(vevent => {
      const event = new ICAL.Event(vevent);
      
      const title = event.summary || 'Untitled Event';
      // Format date as YYYY-MM-DD
      const dateString = event.startDate ? event.startDate.toJSDate().toISOString().split('T')[0] : null;
      
      // Create a deterministic fallback ID if the UID is missing
      const fallbackId = `evt-${title}-${dateString}`.replace(/[^a-z0-9]/gi, '').toLowerCase();

      return {
        id: event.uid || fallbackId,
        title: title,
        date: dateString,
        description: event.description || ''
      };
    }).filter(e => e.date !== null); // Only keep events with valid dates
  } catch (error) {
    console.error("ICS Parsing Error:", error);
    throw new Error("The calendar data format is invalid or corrupted.");
  }
};

/**
 * Reads a local .ics file uploaded by the user.
 */
export const parseICSFile = async (file) => {
  const text = await file.text();
  return parseICSText(text);
};

/**
 * Fetches an iCal feed from a URL.
 * Routes through a local proxy for Planning Center or a public proxy for others.
 */
export const fetchICSFeed = async (url) => {
  let cleanUrl = url.trim();
  
  // Clean up webcal protocol
  if (cleanUrl.toLowerCase().startsWith('webcal://')) {
    cleanUrl = 'https://' + cleanUrl.substring(9);
  } else if (!cleanUrl.toLowerCase().startsWith('http')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  // Determine which proxy to use
  let fetchUrl;
  if (cleanUrl.includes('calendar.planningcenteronline.com')) {
    // Legacy support for PCO proxy if needed
    const urlPath = cleanUrl.split('calendar.planningcenteronline.com')[1];
    fetchUrl = '/pco-proxy' + urlPath;
  } else {
    // Unconditionally route all web feeds through our dedicated Node Express backend proxy
    fetchUrl = `/api/proxy/ical?url=${encodeURIComponent(cleanUrl)}`;
  }
  
  try {
    const response = await fetch(fetchUrl);
    
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    
    const text = await response.text();
    
    // Check if we accidentally received a login page or HTML error
    if (text.trim().startsWith('<') || text.toLowerCase().includes('<!doctype html>')) {
      throw new Error("Received a webpage instead of calendar data. The URL might be private or incorrect.");
    }

    return parseICSText(text);

  } catch (error) {
    console.error("Network Fetch Error:", error);
    throw new Error(`Failed to fetch feed: ${error.message}`);
  }
};
