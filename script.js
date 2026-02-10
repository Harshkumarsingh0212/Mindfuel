// ---------- GLOBAL STATE ----------
let focusValue = null;
let energyValue = null;
let moodValue = null;

// ---------- SCALE BUTTONS ----------
function createScale(id, setter) {
  const container = document.getElementById(id);

  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerText = i;

    btn.addEventListener("click", () => {
      [...container.children].forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      setter(i);
    });

    container.appendChild(btn);
  }
}

createScale("focus", v => focusValue = v);
createScale("energy", v => energyValue = v);

// ---------- MOOD BUTTONS ----------
document.querySelectorAll(".moods button").forEach(btn => {
  btn.type = "button";

  btn.addEventListener("click", () => {
    document.querySelectorAll(".moods button")
      .forEach(b => b.classList.remove("selected"));

    btn.classList.add("selected");
    moodValue = btn.innerText;
  });
});

// ---------- SAVE BUTTON ----------
document.getElementById("saveBtn").addEventListener("click", () => {
  const reflection = document.getElementById("reflection").value.trim();

  if (focusValue === null || energyValue === null || moodValue === null || !reflection) {
    alert("Please fill all fields before saving 🙂");
    return;
  }

  const entry = {
    date: new Date().toDateString(),
    focus: focusValue,
    energy: energyValue,
    mood: moodValue,
    reflection
  };

  const data = JSON.parse(localStorage.getItem("mindfuel")) || [];
  data.push(entry);
  localStorage.setItem("mindfuel", JSON.stringify(data));

  document.getElementById("status").innerText = "Saved for today ✔";

  renderReactInsights();
});

// ---------- REACT (LIGHT USE) ----------
// Avoid JSX in the browser (no transpiler). Use React.createElement instead.

function InsightCard(props) {
  const entries = props.entries || [];

  if (entries.length < 2) {
    return React.createElement(
      "div",
      { className: "card" },
      "Keep checking in — patterns will appear 🌱"
    );
  }

  const avgFocus =
    entries.reduce((sum, e) => sum + e.focus, 0) / entries.length;

  const message =
    avgFocus < 3
      ? "Your focus has been low recently. Try lighter goals."
      : "You are maintaining good focus. Keep it up!";

  return React.createElement(
    "div",
    { className: "card" },
    React.createElement("h3", null, "Weekly Insight"),
    React.createElement("p", null, message)
  );
}

function App() {
  const entries = JSON.parse(localStorage.getItem("mindfuel")) || [];
  return React.createElement(InsightCard, { entries });
}

function renderReactInsights() {
  const root = ReactDOM.createRoot(document.getElementById("react-root"));
  root.render(React.createElement(App));
}

// initial render
renderReactInsights();
