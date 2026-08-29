/**
 * Helper utilities for Academic / Business Year handling.
 * Academic year runs from June 1 to May 31.
 * e.g., "2026-27" = 01-Jun-2026 to 31-May-2027
 */

export interface AcademicYearRange {
  academicYear: string; // e.g. "2026-27"
  startDate: Date;      // 01-Jun-2026 00:00:00
  endDate: Date;        // 31-May-2027 23:59:59
}

/**
 * Returns the academic year string for a given date.
 * If date is Jan-May (months 0-4), it belongs to academic year starting June of previous year.
 * If date is Jun-Dec (months 5-11), it belongs to academic year starting June of current year.
 */
export function getAcademicYearFromDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed (0 = Jan, 5 = Jun)
  const startYear = month < 5 ? year - 1 : year;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

/**
 * Converts an academic year string (e.g. "2026-27") to its start and end Date objects.
 */
export function getAcademicYearRange(academicYear: string): AcademicYearRange {
  const [startYearStr] = academicYear.split("-");
  const startYear = parseInt(startYearStr, 10);
  
  if (isNaN(startYear)) {
    // Fallback to current year if invalid
    return getAcademicYearRange(getAcademicYearFromDate());
  }

  const startDate = new Date(startYear, 5, 1, 0, 0, 0, 0); // 1 June 00:00:00
  const endDate = new Date(startYear + 1, 4, 31, 23, 59, 59, 999); // 31 May 23:59:59

  return {
    academicYear: `${startYear}-${String(startYear + 1).slice(2)}`,
    startDate,
    endDate,
  };
}

/**
 * Generates an array of academic year strings for dropdown options.
 * Generates centered around current academic year (e.g. 3 years back, 2 years forward).
 */
export function getAcademicYearOptions(centerDate: Date = new Date()): string[] {
  const currentAY = getAcademicYearFromDate(centerDate);
  const startYear = parseInt(currentAY.split("-")[0], 10);

  const years: string[] = [];
  // 3 years prior to 2 years future
  for (let y = startYear - 3; y <= startYear + 2; y++) {
    years.push(`${y}-${String(y + 1).slice(2)}`);
  }

  return years;
}
