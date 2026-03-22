/**
 * Dashboard widget grid layout engine — frontend copy.
 * 12-column grid with collision detection, auto-placement, and normalization.
 * Pure logic — no framework dependencies.
 */

export const GRID_COLUMNS = 12;
export const MIN_ROW_SPAN = 2;
export const MAX_ROW_SPAN = 8;
export const GRID_ROW_HEIGHT_PX = 120;
export const GRID_GAP_PX = 12;

export interface DashboardGridItem {
  id: string;
  columnStart: number;
  columnSpan: number;
  rowStart: number;
  rowSpan: number;
  sortOrder: number;
  createdAt: string;
}

function compareGridItems(left: DashboardGridItem, right: DashboardGridItem): number {
  if (left.rowStart !== right.rowStart) return left.rowStart - right.rowStart;
  if (left.columnStart !== right.columnStart) return left.columnStart - right.columnStart;
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  if (left.createdAt !== right.createdAt) return left.createdAt.localeCompare(right.createdAt);
  return left.id.localeCompare(right.id);
}

function getColumnEnd(item: DashboardGridItem): number {
  return item.columnStart + item.columnSpan - 1;
}

function getRowEnd(item: DashboardGridItem): number {
  return item.rowStart + item.rowSpan - 1;
}

function itemsOverlap(left: DashboardGridItem, right: DashboardGridItem): boolean {
  return !(
    getColumnEnd(left) < right.columnStart ||
    getColumnEnd(right) < left.columnStart ||
    getRowEnd(left) < right.rowStart ||
    getRowEnd(right) < left.rowStart
  );
}

export function normalizeColumnSpan(value: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 6;
  return Math.max(1, Math.min(GRID_COLUMNS, Math.round(numeric)));
}

export function normalizeRowSpan(value: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MIN_ROW_SPAN;
  return Math.max(MIN_ROW_SPAN, Math.min(MAX_ROW_SPAN, Math.round(numeric)));
}

export function normalizeGridItem(item: DashboardGridItem): DashboardGridItem {
  const columnSpan = normalizeColumnSpan(item.columnSpan);
  let columnStart = Math.max(1, Math.min(GRID_COLUMNS, Math.round(item.columnStart || 1)));
  if (columnStart + columnSpan - 1 > GRID_COLUMNS) {
    columnStart = GRID_COLUMNS - columnSpan + 1;
  }

  const rowSpan = normalizeRowSpan(item.rowSpan);
  const rowStart = Math.max(1, Math.round(item.rowStart || 1));

  return { ...item, columnStart, columnSpan, rowStart, rowSpan };
}

export function resolveGridLayout(items: DashboardGridItem[]): DashboardGridItem[] {
  const sorted = [...items].sort(compareGridItems);
  const placed: DashboardGridItem[] = [];

  for (const raw of sorted) {
    let item = normalizeGridItem(raw);
    let attempts = 0;

    while (attempts < 200) {
      const overlapping = placed.some((p) => itemsOverlap(item, p));
      if (!overlapping) break;
      item = { ...item, rowStart: item.rowStart + 1 };
      attempts++;
    }

    placed.push(item);
  }

  return placed;
}

export function findGridPlacement(
  existingItems: DashboardGridItem[],
  columnSpan: number = 6,
  rowSpan: number = MIN_ROW_SPAN,
): { columnStart: number; rowStart: number } {
  const span = normalizeColumnSpan(columnSpan);
  const rSpan = normalizeRowSpan(rowSpan);
  const placed = resolveGridLayout(existingItems);

  for (let row = 1; row <= 200; row++) {
    for (let col = 1; col <= GRID_COLUMNS - span + 1; col++) {
      const candidate: DashboardGridItem = {
        id: '__candidate__',
        columnStart: col,
        columnSpan: span,
        rowStart: row,
        rowSpan: rSpan,
        sortOrder: 0,
        createdAt: '',
      };

      const overlapping = placed.some((p) => itemsOverlap(candidate, p));
      if (!overlapping) {
        return { columnStart: col, rowStart: row };
      }
    }
  }

  const maxRow = placed.reduce((max, item) => Math.max(max, getRowEnd(item)), 0);
  return { columnStart: 1, rowStart: maxRow + 1 };
}

export function sortGridItems<T extends DashboardGridItem>(items: T[]): T[] {
  return [...items].sort(compareGridItems);
}

export function getGridHeight(items: DashboardGridItem[]): number {
  if (items.length === 0) return 0;
  const maxRowEnd = items.reduce((max, item) => Math.max(max, getRowEnd(item)), 0);
  return maxRowEnd * GRID_ROW_HEIGHT_PX + (maxRowEnd - 1) * GRID_GAP_PX;
}
