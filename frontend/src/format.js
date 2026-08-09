export function formatFeetInches(totalInches) {
  const rounded = Math.round(totalInches * 10) / 10;
  const feet = Math.floor(rounded / 12);
  const inches = Math.round((rounded - feet * 12) * 10) / 10;
  const inchStr = Number.isInteger(inches) ? `${inches}` : inches.toFixed(1);
  return inches === 0 ? `${feet}'` : `${feet}'${inchStr}"`;
}

export function formatDims(widthIn, heightIn) {
  return `${formatFeetInches(widthIn)} × ${formatFeetInches(heightIn)}`;
}
