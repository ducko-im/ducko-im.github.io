// The tab bar's classes in view/chat.ts must match: px-3 insets, gap-1 spacing, min-w-[90px] tabs. CONTROL_WIDTH is the
// footprint Ducko reserves for the overflow menu (`ChatTabBarView.controlWidth`), wider than its 22 px button.
export const TAB_BAR_INSET = 12;
const MIN_TAB_WIDTH = 90;
const TAB_SPACING = 4;
const CONTROL_WIDTH = 30;

/** How many tabs fit before the rest spill into the overflow menu, as in Ducko's `ChatTabBarView.visibleCount`. */
export function visibleTabCount(available: number, count: number): number {
  if (available <= 0) return count;
  if ((available - TAB_SPACING * (count - 1)) / count >= MIN_TAB_WIDTH) return count;
  const usable = Math.max(MIN_TAB_WIDTH, available - CONTROL_WIDTH);
  return Math.min(count, Math.max(1, Math.floor((usable + TAB_SPACING) / (MIN_TAB_WIDTH + TAB_SPACING))));
}

/** Splits tabs into the visible run and the overflow, swapping the active tab into the last visible slot when it would overflow. */
export function partitionTabs(tabs: string[], visibleCount: number, activeId: string | null): { visible: string[]; overflow: string[] } {
  if (visibleCount >= tabs.length) return { visible: tabs, overflow: [] };
  const visible = tabs.slice(0, visibleCount);
  const overflow = tabs.slice(visibleCount);
  const activeIndex = activeId === null ? -1 : overflow.indexOf(activeId);
  if (activeIndex !== -1 && visible.length > 0) {
    const displaced = visible.pop()!;
    overflow.splice(activeIndex, 1);
    visible.push(activeId!);
    overflow.unshift(displaced);
  }
  return { visible, overflow };
}
