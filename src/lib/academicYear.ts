/**
 * Helper utilities for Business Year & Academic Year handling.
 * 
 * 1. May–April Business Year (Used for Annual Stock & Inventory Management):
 *    Business year runs from May 1 to April 30.
 *    e.g., "2025-26" = 01-May-2025 to 30-Apr-2026
 *          "2026-27" = 01-May-2026 to 30-Apr-2027
 * 
 * 2. June–May Academic Year (Legacy / General reference)
 */

export interface BusinessYearRange {
  businessYear: string; // e.g. "2026-27"
  startDate: Date;      // 01-May-2026 00:00:00
  endDate: Date;        // 30-Apr-2027 23:59:59
}

/**
 * Returns May–April Business Year string for a given date.
 * If date is Jan–Apr (months 0–3), it belongs to business year starting May of previous year.
 * If date is May–Dec (months 4–11), it belongs to business year starting May of current year.
 */
export function getMayAprilBusinessYear(date: Date = new Date()): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan, 4 = May
  const startYear = month < 4 ? year - 1 : year;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

/**
 * Converts a May–April Business Year string (e.g. "2026-27") to start and end Date objects.
 */
export function getMayAprilBusinessYearRange(businessYear: string): BusinessYearRange {
  const [startYearStr] = (businessYear || "").split("-");
  const startYear = parseInt(startYearStr, 10);

  if (isNaN(startYear)) {
    return getMayAprilBusinessYearRange(getMayAprilBusinessYear());
  }

  const startDate = new Date(startYear, 4, 1, 0, 0, 0, 0); // 1 May 00:00:00
  const endDate = new Date(startYear + 1, 3, 30, 23, 59, 59, 999); // 30 April 23:59:59

  return {
    businessYear: `${startYear}-${String(startYear + 1).slice(2)}`,
    startDate,
    endDate,
  };
}

/**
 * Returns an array of May–April Business Year options for dropdowns.
 */
export function getMayAprilBusinessYearOptions(centerDate: Date = new Date()): string[] {
  const currentBY = getMayAprilBusinessYear(centerDate);
  const startYear = parseInt(currentBY.split("-")[0], 10);

  const years: string[] = [];
  // 5 years back to 2 years forward
  for (let y = startYear - 4; y <= startYear + 2; y++) {
    years.push(`${y}-${String(y + 1).slice(2)}`);
  }

  return years;
}

// ----------------------------------------------------
// Legacy June–May Academic Year Functions (backward compat)
// ----------------------------------------------------

export interface AcademicYearRange {
  academicYear: string; // e.g. "2026-27"
  startDate: Date;      // 01-Jun-2026 00:00:00
  endDate: Date;        // 31-May-2027 23:59:59
}

export function getAcademicYearFromDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month < 5 ? year - 1 : year;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

export function getAcademicYearRange(academicYear: string): AcademicYearRange {
  const [startYearStr] = academicYear.split("-");
  const startYear = parseInt(startYearStr, 10);
  
  if (isNaN(startYear)) {
    return getAcademicYearRange(getAcademicYearFromDate());
  }

  const startDate = new Date(startYear, 5, 1, 0, 0, 0, 0);
  const endDate = new Date(startYear + 1, 4, 31, 23, 59, 59, 999);

  return {
    academicYear: `${startYear}-${String(startYear + 1).slice(2)}`,
    startDate,
    endDate,
  };
}

export function getAcademicYearOptions(centerDate: Date = new Date()): string[] {
  const currentAY = getAcademicYearFromDate(centerDate);
  const startYear = parseInt(currentAY.split("-")[0], 10);

  const years: string[] = [];
  for (let y = startYear - 3; y <= startYear + 2; y++) {
    years.push(`${y}-${String(y + 1).slice(2)}`);
  }

  return years;
}
