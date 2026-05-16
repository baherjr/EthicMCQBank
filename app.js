const LETTERS = ["A", "B", "C", "D", "E", "F"];
const state = { section: "lecture", search: "", lectureFilter: "all", page: 1, pageSize: 20, selected: new Map() };
const el = {
  secLecture: document.getElementById("secLecture"),
  secExam: document.getElementById("secExam"),
  search: document.getElementById("search"),
  lectureFilter: document.getElementById("lectureFilter"),
  clearFilters: document.getElementById("clearFilters"),
  resetAnswers: document.getElementById("resetAnswers"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  pageInfo: document.getElementById("pageInfo"),
  countInfo: document.getElementById("countInfo"),
  progressInfo: document.getElementById("progressInfo"),
  progressFill: document.getElementById("progressFill"),
  cards: document.getElementById("cards"),
  empty: document.getElementById("empty"),
  toTop: document.getElementById("toTop"),
};

let QUESTIONS = [];

function isCtQuestion(q) {
  return /(^|\s)ct(\s|$)|critical\s*thinking/i.test(String((q && q.lecture) || ""));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateSectionButtons() {
  const lectureCount = QUESTIONS.filter((q) => q.section === "lecture" && !isCtQuestion(q)).length;
  const examCount = QUESTIONS.filter((q) => q.section === "exam" && !isCtQuestion(q)).length;
  el.secLecture.textContent = "Lectures (" + lectureCount + ")";
  el.secExam.textContent = "Exams (" + examCount + ")";
}

function getSectionData() {
  return QUESTIONS.filter((q) => q.section === state.section && !isCtQuestion(q));
}

function getLectureNumber(q) {
  const text = String((q && q.lecture) || "");
  const match = text.match(/(?:lecture\s*)?l?\s*([1-9])\b/i);
  return match ? match[1] : "";
}

function lectureLabel(value) {
  return value === "all" ? "All lectures" : "Lecture " + value;
}

function buildLectureFilter() {
  const options = state.section === "lecture" ? ["all", "1", "2", "3", "4", "5", "6", "7", "8", "9"] : ["all"];
  el.lectureFilter.innerHTML = options
    .map((s) => '<option value="' + escapeHtml(s) + '">' + escapeHtml(lectureLabel(s)) + "</option>")
    .join("");
  if (!options.includes(state.lectureFilter)) state.lectureFilter = "all";
  el.lectureFilter.value = state.lectureFilter;
  el.lectureFilter.disabled = state.section !== "lecture";
}

function filteredData() {
  const s = state.search.trim().toLowerCase();
  return getSectionData().filter((q) => {
    if (state.section === "lecture" && state.lectureFilter !== "all" && getLectureNumber(q) !== state.lectureFilter) return false;
    if (!s) return true;
    const hay = [q.text, q.explanation, (q.options || []).join(" "), q.source, lectureLabel(getLectureNumber(q)), q.bloom].join(" ").toLowerCase();
    return hay.includes(s);
  });
}

function answerQuestion(id, optionIndex) {
  if (state.selected.has(id)) return;
  state.selected.set(id, optionIndex);
  render();
}

function resetQuestion(id) {
  state.selected.delete(id);
  render();
}

function isTypingElement(target) {
  const tag = target && target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (target && target.isContentEditable);
}

function getProgress(data) {
  const answered = data.filter((q) => state.selected.has(q.id)).length;
  const correct = data.filter((q) => q.answer != null && state.selected.get(q.id) === q.answer).length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const attempted = data.length ? Math.round((answered / data.length) * 100) : 0;
  return { answered, correct, accuracy, attempted };
}

function previousPage() {
  if (state.page > 1) {
    state.page -= 1;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function nextPage() {
  const total = Math.max(1, Math.ceil(filteredData().length / state.pageSize));
  if (state.page < total) {
    state.page += 1;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function clearActiveFilters() {
  state.search = "";
  state.lectureFilter = "all";
  el.search.value = "";
  buildLectureFilter();
  resetToFirstPage();
}

function resetAllAnswers() {
  state.selected.clear();
  render();
}

function render() {
  el.secLecture.classList.toggle("active", state.section === "lecture");
  el.secExam.classList.toggle("active", state.section === "exam");

  const data = filteredData();
  const totalPages = Math.max(1, Math.ceil(data.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;

  const progress = getProgress(data);

  const start = (state.page - 1) * state.pageSize;
  const rows = data.slice(start, start + state.pageSize);
  const shownStart = data.length ? start + 1 : 0;
  const shownEnd = start + rows.length;

  el.countInfo.textContent =
    "Showing " +
    shownStart +
    "-" +
    shownEnd +
    " of " +
    data.length +
    " | " +
    progress.answered +
    " answered | " +
    progress.correct +
    " correct";
  el.pageInfo.textContent = "Page " + state.page + " / " + totalPages;
  el.prev.disabled = state.page <= 1;
  el.next.disabled = state.page >= totalPages;
  el.progressFill.style.width = progress.attempted + "%";
  el.progressInfo.textContent = progress.answered
    ? progress.correct + "/" + progress.answered + " correct (" + progress.accuracy + "% accuracy) · " + progress.attempted + "% attempted"
    : "No answers yet. Start answering to track progress.";

  if (!rows.length) {
    el.cards.innerHTML = "";
    el.empty.textContent = "No questions match this filter.";
    el.empty.style.display = "block";
    return;
  }

  el.empty.style.display = "none";
  el.cards.innerHTML = rows
    .map((q, idx) => {
      const displayIndex = start + idx + 1;
      const selectedOption = state.selected.get(q.id);
      const hasAnswer = state.selected.has(q.id);
      const sourceCount = q.sources && q.sources.length > 1 ? " - merged from " + q.sources.length + " files" : "";
      const lectureTag = getLectureNumber(q);

      const optionsHtml = (q.options || [])
        .map((opt, oi) => {
          const classes = ["opt-btn"];
          if (hasAnswer) {
            if (q.answer === oi) classes.push("right-answer");
            if (selectedOption === oi && q.answer === oi) classes.push("correct");
            if (selectedOption === oi && q.answer !== oi) classes.push("wrong");
          }
          return (
            '<button class="' +
            classes.join(" ") +
            '" type="button" onclick="answerQuestion(' +
            q.id +
            "," +
            oi +
            ')" ' +
            (hasAnswer ? "disabled" : "") +
            '><span class="opt-letter">' +
            (LETTERS[oi] || oi + 1) +
            ".</span> " +
            escapeHtml(opt) +
            "</button>"
          );
        })
        .join("");

      let feedbackHtml = "";
      if (hasAnswer) {
        if (q.answer == null) {
          feedbackHtml = '<span class="result neutral">No answer key available for this question.</span>';
        } else if (selectedOption === q.answer) {
          feedbackHtml = '<span class="result ok">Correct answer.</span>';
        } else {
          feedbackHtml = '<span class="result bad">Wrong answer. Correct choice: ' + (LETTERS[q.answer] || q.answer + 1) + ".</span>";
        }
      }

      const expHtml = hasAnswer && q.explanation ? '<div class="exp"><strong>Explanation:</strong> ' + escapeHtml(q.explanation) + "</div>" : "";
      const actionsHtml = hasAnswer
        ? '<button class="btn btn-ghost" type="button" onclick="resetQuestion(' + q.id + ')">Try again</button>'
        : '<span class="note">Choose one option to get instant feedback.</span>';

      return (
        '<article class="card"><div class="meta"><span class="badge">#' +
        displayIndex +
        '</span><span class="badge section-' +
        q.section +
        '">' +
        (q.section === "exam" ? "Exam" : "Lecture") +
        "</span>" +
        (lectureTag ? '<span class="badge">' + escapeHtml(lectureLabel(lectureTag)) + "</span>" : "") +
        (q.bloom ? '<span class="badge">' + escapeHtml(q.bloom) + "</span>" : "") +
        '<span class="badge">' +
        escapeHtml(q.source) +
        sourceCount +
        "</span></div><div class=\"q\">" +
        escapeHtml(q.text) +
        '</div><div class="opts">' +
        (optionsHtml || '<div class="note">Options not available in source.</div>') +
        '</div><div class="actions">' +
        actionsHtml +
        feedbackHtml +
        "</div>" +
        expHtml +
        "</article>"
      );
    })
    .join("");
}

window.answerQuestion = answerQuestion;
window.resetQuestion = resetQuestion;

function resetToFirstPage() {
  state.page = 1;
  render();
}

el.secLecture.addEventListener("click", () => {
  if (state.section === "lecture") return;
  state.section = "lecture";
  state.lectureFilter = "all";
  buildLectureFilter();
  resetToFirstPage();
});

el.secExam.addEventListener("click", () => {
  if (state.section === "exam") return;
  state.section = "exam";
  state.lectureFilter = "all";
  buildLectureFilter();
  resetToFirstPage();
});

el.search.addEventListener("input", () => {
  state.search = el.search.value;
  resetToFirstPage();
});

el.lectureFilter.addEventListener("change", () => {
  state.lectureFilter = el.lectureFilter.value;
  resetToFirstPage();
});

el.clearFilters.addEventListener("click", clearActiveFilters);
el.resetAnswers.addEventListener("click", resetAllAnswers);

el.prev.addEventListener("click", previousPage);
el.next.addEventListener("click", nextPage);

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (event.key === "/") {
    event.preventDefault();
    el.search.focus();
    el.search.select();
    return;
  }

  if (event.key === "Escape") {
    if (document.activeElement === el.search && el.search.value) {
      el.search.value = "";
      state.search = "";
      resetToFirstPage();
      return;
    }
  }

  if (isTypingElement(document.activeElement)) return;
  if (event.key === "ArrowLeft") previousPage();
  if (event.key === "ArrowRight") nextPage();
});

window.addEventListener(
  "scroll",
  () => {
    el.toTop.classList.toggle("visible", window.scrollY > 360);
  },
  { passive: true }
);

el.toTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

async function init() {
  try {
    const response = await fetch("./questions.json", { cache: "force-cache" });
    if (!response.ok) throw new Error("Failed to fetch questions.json");
    QUESTIONS = (await response.json()).filter((q) => !isCtQuestion(q));
    updateSectionButtons();
    buildLectureFilter();
    render();
  } catch (error) {
    console.error(error);
    el.cards.innerHTML = "";
    el.empty.textContent = "Failed to load questions. Ensure questions.json is deployed in the same folder.";
    el.empty.style.display = "block";
  }
}

init();
