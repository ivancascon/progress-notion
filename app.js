const milestonesEl = document.querySelector("#milestones");
const updatedAtEl = document.querySelector("#updatedAt");
const emptyStateEl = document.querySelector("#emptyState");
const errorStateEl = document.querySelector("#errorState");

const percent = (value) => `${Math.round(clamp(value, 0, 100))}%`;

function clamp(value, min, max) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

function formatDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatUpdatedAt(value) {
  if (!value) return "Not synced yet";
  return `Synced ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))}`;
}

function milestoneTemplate(milestone) {
  const timelineProgress = clamp(milestone.timelineProgress, 0, 100);
  const project = milestone.project || "No project";
  const icon = pageIconTemplate(milestone.icon) || fallbackIconTemplate(project);

  return `
    <article class="milestone-row">
      <div class="project-cell">
        ${icon}
        <div class="project-copy">
          <h2>${escapeHtml(milestone.name || "Untitled")}</h2>
          <p>${escapeHtml(project)}</p>
        </div>
      </div>
      <div class="progress-cell">
        <div class="progress-track" aria-label="Timeline progress: ${percent(timelineProgress)}">
          <span style="--value: ${percent(timelineProgress)}"></span>
        </div>
        <p>${getDeadlineLabel(milestone.end)}</p>
      </div>
      <div class="date-cell">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="16" rx="2"></rect>
          <path d="M16 3v4M8 3v4M3 10h18"></path>
        </svg>
        <p>${formatDate(milestone.end)}</p>
      </div>
    </article>
  `;
}

function getDeadlineLabel(end) {
  if (!end) return "No deadline";

  const today = startOfLocalDay(new Date());
  const deadline = startOfLocalDay(new Date(`${end}T00:00:00`));
  const days = Math.round((deadline - today) / 86400000);

  if (days < 0) return `${Math.abs(days)} ${pluralize("day", Math.abs(days))} overdue`;
  if (days === 0) return "Due today";
  return `${days} ${pluralize("day", days)} left`;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}

function pageIconTemplate(icon) {
  if (!icon) return "";

  if (icon.type === "emoji" && icon.value) {
    return `<span class="page-icon emoji-icon" aria-hidden="true">${escapeHtml(icon.value)}</span>`;
  }

  if (icon.type === "image" && icon.url) {
    return `<img class="page-icon image-icon" alt="" src="${escapeHtml(icon.url)}" loading="lazy" referrerpolicy="no-referrer" />`;
  }

  return "";
}

function fallbackIconTemplate(project) {
  const key = String(project || "").toLowerCase();
  const path = key.includes("data") || key.includes("analytics")
    ? '<ellipse cx="12" cy="6" rx="7" ry="3"></ellipse><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"></path><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"></path>'
    : key.includes("product") || key.includes("mobile")
      ? '<rect x="7" y="2.8" width="10" height="18.4" rx="2"></rect><path d="M11 18h2"></path>'
      : key.includes("engineering") || key.includes("platform")
        ? '<path d="M12 2.8 20 7.2v9.6l-8 4.4-8-4.4V7.2Z"></path><path d="m4.5 7.5 7.5 4.2 7.5-4.2M12 21.2v-9.5"></path>'
        : key.includes("ops") || key.includes("operation") || key.includes("internal")
          ? '<circle cx="9" cy="8" r="3.2"></circle><path d="M3.5 20c.5-4 2.4-6 5.5-6s5 2 5.5 6"></path><circle cx="16.5" cy="9" r="2.5"></circle><path d="M15.5 14.2c2.7.3 4.3 2.2 4.8 5.8"></path>'
          : key.includes("security") || key.includes("it")
            ? '<path d="M12 3 20 6.5v5.7c0 4.3-2.8 7.4-8 8.8-5.2-1.4-8-4.5-8-8.8V6.5Z"></path><path d="m9.5 12.2 1.8 1.8 3.6-4"></path>'
            : key.includes("market")
              ? '<path d="M4 13h3l9-5v10l-9-5H4Z"></path><path d="M7 13v4a2 2 0 0 0 2 2h1"></path><path d="M20 9.5a4.4 4.4 0 0 1 0 7"></path>'
              : '<rect x="3.5" y="5" width="17" height="11" rx="2"></rect><path d="M8 20h8M10 16v4M14 16v4"></path>';

  return `<svg class="page-icon fallback-icon" aria-hidden="true" viewBox="0 0 24 24">${path}</svg>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render(data) {
  const milestones = Array.isArray(data.milestones) ? data.milestones : [];
  updatedAtEl.textContent = formatUpdatedAt(data.updatedAt);
  errorStateEl.hidden = true;
  emptyStateEl.hidden = milestones.length > 0;

  if (milestones.length === 0) {
    milestonesEl.innerHTML = "";
    return;
  }

  milestonesEl.innerHTML = milestones.map(milestoneTemplate).join("");
}

async function init() {
  try {
    const response = await fetch("./data/milestones.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    render(await response.json());
  } catch (error) {
    console.error(error);
    updatedAtEl.textContent = "Not synced";
    milestonesEl.innerHTML = "";
    emptyStateEl.hidden = true;
    errorStateEl.hidden = false;
  }
}

init();
