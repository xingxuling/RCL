const ASCII_JAVA_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;
const ENCODED_PREFIX = '$rcl$';

export function androidJavaIdentifier(value) {
  const name = String(value);
  if (ASCII_JAVA_IDENTIFIER.test(name) && !name.startsWith(ENCODED_PREFIX)) return name;
  // Reserve a distinct namespace for encoded names. Encoding the original
  // UTF-16 units also keeps two different source names from sharing an alias.
  return ENCODED_PREFIX + Buffer.from(name, 'utf16le').toString('hex');
}

export function androidJavaNumber(value) {
  if (Object.is(value, -0)) return '-0.0d';
  return Number.isSafeInteger(value) ? `${value}L` : `${value}d`;
}

export const ANDROID_JAVA_EQUAL_HELPER = `  private static boolean rclEqual(Object left, Object right) {
    if (left instanceof Number && right instanceof Number) {
      return ((Number) left).doubleValue() == ((Number) right).doubleValue();
    }
    return java.util.Objects.equals(left, right);
  }`;

export const ANDROID_JAVA_TEXT_HELPER = `  private static String rclText(Object value) {
    if (!(value instanceof Number)) return String.valueOf(value);
    double number = ((Number) value).doubleValue();
    if (!Double.isFinite(number)) return Double.toString(number);
    if (number == 0d) return "0";
    double magnitude = Math.abs(number);
    if (magnitude <= 9007199254740991d && Math.rint(number) == number) return Long.toString((long) number);

    java.math.BigDecimal exact = new java.math.BigDecimal(magnitude);
    int order = exact.precision() - exact.scale() - 1;
    for (int precision = 1; precision <= 17; precision++) {
      java.math.BigDecimal candidate = exact.round(new java.math.MathContext(precision, java.math.RoundingMode.HALF_EVEN));
      if (candidate.doubleValue() != magnitude) {
        // The binary rounding interval can be asymmetric. Try the adjacent decimal on the other side.
        java.math.BigDecimal step = java.math.BigDecimal.ONE.scaleByPowerOfTen(order - precision + 1);
        candidate = candidate.compareTo(exact) < 0 ? candidate.add(step) : candidate.subtract(step);
      }
      if (candidate.doubleValue() != magnitude) continue;

      candidate = candidate.stripTrailingZeros();
      int exponent = candidate.precision() - candidate.scale() - 1;
      String prefix = number < 0 ? "-" : "";
      if (exponent >= -6 && exponent < 21) return prefix + candidate.toPlainString();
      String digits = candidate.unscaledValue().toString();
      String significand = digits.length() == 1 ? digits : digits.charAt(0) + "." + digits.substring(1);
      return prefix + significand + "e" + (exponent >= 0 ? "+" : "") + exponent;
    }
    throw new AssertionError("No round-tripping decimal for " + number);
  }`;
