export function floor(input: number, precision: number) {
  const magnifier = Math.pow(10, precision);
  return Math.floor(input * magnifier) / magnifier;
}

export function round(input: number, precision: number) {
  const magnifier = Math.pow(10, precision);
  return Math.round(input * magnifier) / magnifier;
}

export function ceil(input: number, precision: number) {
  const magnifier = Math.pow(10, precision);
  return Math.ceil(input * magnifier) / magnifier;
}
