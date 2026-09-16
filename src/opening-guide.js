// A deliberate player choice, separate from inferred play speed and paid tools.
export const openingChoicePending = s => s.narrative?.openingChoice === 'pending';
export function chooseOpening(s, choice) {
  if (!openingChoicePending(s) || !['first', 'returning'].includes(choice)) return false;
  const n=s.narrative;
  n.openingChoice=choice;n.current=null;n.silence=90;n.gap=0;
  if (choice==='returning') { n.intro='skipped';n.companionsShown=true; }
  return true;
}
export function narrationAllowed(s, row) {
  if (openingChoicePending(s)) return false;
  if (s.narrative?.openingChoice!=='returning') return true;
  return !['guide','explain'].includes(row.kind) && !['rescue','rescued','companions','friend','goals','rescue-price','browse','grind'].includes(row.id);
}
export function needsManualReminder(s) {
  const n=s.narrative;
  return n?.openingChoice==='first' && !!s.guidance.info && !!s.counts.V2 && !n.manualVisited;
}
export const manualCuePending = s => needsManualReminder(s) && s.narrative.manualPrompted;
export function visitManual(s) {
  if (s.narrative.manualVisited) return false;
  s.narrative.manualVisited=true;
  return true;
}
