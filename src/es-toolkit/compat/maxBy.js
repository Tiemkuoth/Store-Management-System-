export default function maxBy(array, iteratee) {
  if (!Array.isArray(array) || array.length === 0) return undefined;
  const fn = typeof iteratee === 'function' ? iteratee : item => item?.[iteratee];
  let maxItem = array[0];
  let maxValue = fn(array[0]);
  for (let i = 1; i < array.length; i++) {
    const val = fn(array[i]);
    if (val > maxValue || (maxValue == null && val != null)) {
      maxValue = val;
      maxItem = array[i];
    }
  }
  return maxItem;
}
