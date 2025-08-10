// Timezone conversion helper for Brain system
// Converts UTC timestamps to Chicago time for better temporal understanding

export function formatTimestampChicago(utcTimestamp) {
  try {
    // Parse the UTC timestamp
    const date = new Date(utcTimestamp);
    
    // Convert to Chicago timezone
    const chicagoTime = date.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    // Also add day of week for clarity
    const dayOfWeek = date.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'short'
    });
    
    return `${dayOfWeek}, ${chicagoTime} CST/CDT`;
  } catch (error) {
    // If conversion fails, return original
    return utcTimestamp;
  }
}

// Test function
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Testing timezone conversion:");
  console.log("UTC: 2025-08-06T00:25:15.945Z");
  console.log("Chicago:", formatTimestampChicago("2025-08-06T00:25:15.945Z"));
  console.log("\nUTC: 2025-08-06T00:20:06.423Z");
  console.log("Chicago:", formatTimestampChicago("2025-08-06T00:20:06.423Z"));
}
