// Font for this locale.
//
// Either a bundled font file in this locale folder ("font.woff2", "font.woff",
// "font.ttf", ...), optionally with a custom font-family name:
//   window.LOCALE_FONT = { file: "font.woff2", family: "Arad" };
//
// Or a system font family name without a file:
//   window.LOCALE_FONT = "Vazirmatn";
//
// When only a file is given, the @font-face is registered under an internal
// family name; providing `family` names it (and the UI) with a custom family.
window.LOCALE_FONT = { file: "font.woff2", family: "Arad" };
