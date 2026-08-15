// یکسان‌سازی حروف فارسی/عربی و حذف اعراب.
window.normalizeFa = function normalizeFa(s) {
  if (!s) return "";
  return s
    .replace(/\u064A/g, "\u06CC") // ي -> ی
    .replace(/\u0643/g, "\u06A9") // ك -> ک
    .replace(/\u0623|\u0625|\u0622/g, "\u0627") // أ إ آ -> ا
    .replace(/\u0629/g, "\u0647") // ة -> ه
    .replace(/\u0624/g, "\u0648") // ؤ -> و
    .replace(/\u0626/g, "\u06CC") // ئ -> ی
    .replace(/[\u064B-\u0652\u0670]/g, "") // حذف اعراب
    .replace(/\s+/g, "")
    .trim();
};

// شمارش «حروف» به معنای کاراکترهای نمایشی (نه بایت).
window.faLen = function faLen(s) {
  return Array.from(s).length;
};