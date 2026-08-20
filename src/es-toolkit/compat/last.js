export default function last(array) {
  return Array.isArray(array) && array.length > 0 ? array[array.length - 1] : undefined;
}
