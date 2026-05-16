const LETTERS = ["A", "B", "C", "D", "E", "F"];
const state = { section: "lecture", search: "", source: "all", page: 1, pageSize: 20, revealed: new Set() };
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
    const hay = [q.text, q.explanation, q.options.join(" "), q.source, q.lecture, q.bloom].join(" ").toLowerCase();
    return hay.includes(s);
  });
}

function render() {
  el.secLecture.classList.toggle("active", state.section === "lecture");
  el.secExam.classList.toggle("active", state.section === "exam");

  const data = filteredData();
  const totalPages = Math.max(1, Math.ceil(data.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;

  const start = (state.page - 1) * state.pageSize;
  const rows = data.slice(start, start + state.pageSize);

  el.countInfo.textContent = String(data.length) + " question(s)";
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
      const shown = state.revealed.has(q.id);
      const optionsHtml = (q.options || [])
        .map((opt, oi) => {
          const isCorrect = shown && q.answer === oi;
          return (
            '<div class="opt ' +
            (isCorrect ? "correct" : "") +
            '"><strong>' +
            (LETTERS[oi] || oi + 1) +
            ".</strong> " +
            escapeHtml(opt) +
            "</div>"
          );
        })
        .join("");

      const sourceCount = q.sources && q.sources.length > 1 ? " · merged from " + q.sources.length + " files" : "";
      const answerNote = shown
        ? q.answer == null
          ? '<span class="note">Answer key not available.</span>'
          : '<span class="note">Correct answer: ' + (LETTERS[q.answer] || q.answer + 1) + "</span>"
        : "";
      const expHtml = shown && q.explanation ? '<div class="exp"><strong>Explanation:</strong> ' + escapeHtml(q.explanation) + "</div>" : "";

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
        '</div><div class="actions"><button class="btn" type="button" onclick="toggleReveal(' +
        q.id +
        ')">' +
        (shown ? "Hide answer" : "Show answer") +
        "</button>" +
        answerNote +
        "</div>" +
        expHtml +
        "</article>"
      );
    })
    .join("");
}

function resetToFirstPage() {
  state.page = 1;
  render();
}

function toggleReveal(id) {
  if (state.revealed.has(id)) state.revealed.delete(id);
  else state.revealed.add(id);
  render();
}

window.toggleReveal = toggleReveal;

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
