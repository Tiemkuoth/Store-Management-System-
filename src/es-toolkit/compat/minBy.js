export default function minBy(array, iteratee) {
  if (!Array.isArray(array) || array.length === 0) return undefined;
  const fn = typeof iteratee === 'function' ? iteratee : item => item?.[iteratee];
  let minItem = array[0];
  let minValue = fn(array[0]);
  for (let i = 1; i < array.length; i++) {
    const val = fn(array[i]);
    if (val < minValue || (minValue == null && val != null)) {
      minValue = val;
      minItem = array[i];
    }
  }
  return minItem;
}
