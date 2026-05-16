const LETTERS = ["A", "B", "C", "D", "E", "F"];
const state = { section: "lecture", search: "", source: "all", page: 1, pageSize: 20, selected: new Map() };
const el = {
  secLecture: document.getElementById("secLecture"),
  secExam: document.getElementById("secExam"),
  search: document.getElementById("search"),
  source: document.getElementById("source"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  pageInfo: document.getElementById("pageInfo"),
  countInfo: document.getElementById("countInfo"),
  cards: document.getElementById("cards"),
  empty: document.getElementById("empty"),
};

let QUESTIONS = [];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateSectionButtons() {
  const lectureCount = QUESTIONS.filter((q) => q.section === "lecture").length;
  const examCount = QUESTIONS.filter((q) => q.section === "exam").length;
  el.secLecture.textContent = "Lectures (" + lectureCount + ")";
  el.secExam.textContent = "Exams (" + examCount + ")";
}

function getSectionData() {
  return QUESTIONS.filter((q) => q.section === state.section);
}

function buildSourceFilter() {
  const sectionData = getSectionData();
  const set = new Set(sectionData.map((q) => q.source));
  const sources = ["all"].concat(Array.from(set).sort());
  el.source.innerHTML = sources
    .map((s) => '<option value="' + escapeHtml(s) + '">' + (s === "all" ? "All sources" : escapeHtml(s)) + "</option>")
    .join("");
  if (!sources.includes(state.source)) state.source = "all";
  el.source.value = state.source;
}

function filteredData() {
  const s = state.search.trim().toLowerCase();
  return getSectionData().filter((q) => {
    if (state.source !== "all" && q.source !== state.source) return false;
    if (!s) return true;
    const hay = [q.text, q.explanation, (q.options || []).join(" "), q.source, q.lecture, q.bloom].join(" ").toLowerCase();
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

function render() {
  el.secLecture.classList.toggle("active", state.section === "lecture");
  el.secExam.classList.toggle("active", state.section === "exam");

  const data = filteredData();
  const totalPages = Math.max(1, Math.ceil(data.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;

  const answeredCount = data.filter((q) => state.selected.has(q.id)).length;
  const correctCount = data.filter((q) => q.answer != null && state.selected.get(q.id) === q.answer).length;

  const start = (state.page - 1) * state.pageSize;
  const rows = data.slice(start, start + state.pageSize);

  el.countInfo.textContent = String(data.length) + " question(s) | " + answeredCount + " answered | " + correctCount + " correct";
  el.pageInfo.textContent = "Page " + state.page + " / " + totalPages;
  el.prev.disabled = state.page <= 1;
  el.next.disabled = state.page >= totalPages;

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
        (q.lecture ? '<span class="badge">' + escapeHtml(q.lecture) + "</span>" : "") +
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
  state.source = "all";
  buildSourceFilter();
  resetToFirstPage();
});

el.secExam.addEventListener("click", () => {
  if (state.section === "exam") return;
  state.section = "exam";
  state.source = "all";
  buildSourceFilter();
  resetToFirstPage();
});

el.search.addEventListener("input", () => {
  state.search = el.search.value;
  resetToFirstPage();
});

el.source.addEventListener("change", () => {
  state.source = el.source.value;
  resetToFirstPage();
});

el.prev.addEventListener("click", () => {
  if (state.page > 1) {
    state.page -= 1;
    render();
  }
});

el.next.addEventListener("click", () => {
  const total = Math.max(1, Math.ceil(filteredData().length / state.pageSize));
  if (state.page < total) {
    state.page += 1;
    render();
  }
});

async function init() {
  try {
    const response = await fetch("./questions.json", { cache: "force-cache" });
    if (!response.ok) throw new Error("Failed to fetch questions.json");
    QUESTIONS = await response.json();
    updateSectionButtons();
    buildSourceFilter();
    render();
  } catch (error) {
    console.error(error);
    el.cards.innerHTML = "";
    el.empty.textContent = "Failed to load questions. Ensure questions.json is deployed in the same folder.";
    el.empty.style.display = "block";
  }
}

init();
