export default function get(object, path, defaultValue) {
  if (object == null) return defaultValue;
  const keys = Array.isArray(path)
    ? path
    : String(path).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let result = object;
  for (const key of keys) {
    if (result == null) return defaultValue;
    result = result[key];
  }
  return result === undefined ? defaultValue : result;
}
