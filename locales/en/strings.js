window.GUIDE_EXAMPLE = [
  { g: "tiger", t: "grade" },
  { g: "grade", t: "grade" },
];
const direction = "ltr";
// Locale used for dates in the copied result (see persianDate in script.js).
window.DATE_LOCALE = "en-US";
window.STRINGS = {
  appName: "Delta Wordle",
  home: {
    enter: "Enter Game",
    help: "Game Guide",
    theme: "Toggle theme",
    playersToday: "Players Today",
    noPlayers: "No one has played today yet",
    attempts: "Guesses",
    surrendered: "Surrendered",
  },
  help: {
    title: "Game Guide",
    intro:
      "Find a five-letter word in 5 guesses. After each guess, tile colors guide you.",
    green: "Green: Letter is in the correct position.",
    yellow: "Yellow: Letter is in the word but elsewhere.",
    gray: "Gray: Letter is not in the word.",
    exampleTitle: "Example",
    close: "Close",
  },
  game: {
    surrender: "Surrender",
    surrenderConfirm:
      "Are you sure? You will see today's word but cannot play anymore.",
    submit: "Submit",
    backspace: "Delete",
    invalidLength: "Word must be 5 letters",
    notInList: "This word is not in the list",
    alreadyDone: "You have played today",
    wordsEmpty: "The words is empty!",
    seWordConfirm:
      "If you view today's word, a surrender will be recorded for you.\nAre you sure you want to see it?",
  },
  end: {
    win: "Congratulations! You guessed correctly.",
    lose: "Today's word:",
    surrendered: "You surrendered. Today's word:",
    copy: "Copy Result",
    copied: "Copied to clipboard",
    back: "Back",
  },
  player: {
    title: "Guesses of",
    you: "You",
    close: "Close",
  },
};
