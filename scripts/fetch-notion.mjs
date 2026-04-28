import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const NOTION_VERSION = process.env.NOTION_VERSION || "2026-03-11";
const OUTPUT_PATH = process.env.OUTPUT_PATH || "data/milestones.json";

const CONFIG = {
  token: requiredEnv("NOTION_TOKEN"),
  milestonesDatabaseId: process.env.NOTION_MILESTONES_DATABASE_ID,
  milestonesDataSourceId: process.env.NOTION_MILESTONES_DATA_SOURCE_ID,
  titleProperty: process.env.NOTION_MILESTONE_TITLE_PROPERTY || "Name",
  projectProperty: process.env.NOTION_MILESTONE_PROJECT_PROPERTY || "Project",
  dateProperty: process.env.NOTION_MILESTONE_DATE_PROPERTY || "Dates",
  startProperty: process.env.NOTION_MILESTONE_START_PROPERTY || "Start",
  endProperty: process.env.NOTION_MILESTONE_END_PROPERTY || "End",
};

if (!CONFIG.milestonesDatabaseId && !CONFIG.milestonesDataSourceId) {
  throw new Error(
    "Set NOTION_MILESTONES_DATA_SOURCE_ID, or set NOTION_MILESTONES_DATABASE_ID so the script can use its first data source.",
  );
}

const dataSourceId =
  CONFIG.milestonesDataSourceId || (await getFirstDataSourceId(CONFIG.milestonesDatabaseId));
const milestones = await getAllDataSourcePages(dataSourceId);
const rows = [];

for (const milestone of milestones) {
  const properties = milestone.properties || {};
  const dates = getMilestoneDates(properties);
  const timelineProgress = getTimelineProgress(dates.start, dates.end);

  rows.push({
    id: milestone.id,
    name: getTitle(properties[CONFIG.titleProperty]) || "Untitled",
    project: propertyToText(properties[CONFIG.projectProperty]) || "No project",
    icon: pageIconToWidgetIcon(milestone.icon),
    url: milestone.url,
    start: dates.start,
    end: dates.end,
    timelineProgress,
  });
}

rows.sort((a, b) => {
  if (!a.end && !b.end) return a.name.localeCompare(b.name);
  if (!a.end) return 1;
  if (!b.end) return -1;
  return a.end.localeCompare(b.end);
});

const output = {
  updatedAt: new Date().toISOString(),
  milestones: rows,
};

await mkdir(dirname(resolve(OUTPUT_PATH)), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${rows.length} milestones to ${OUTPUT_PATH}`);

async function getFirstDataSourceId(databaseId) {
  const database = await notion(`/v1/databases/${databaseId}`);
  const first = database.data_sources?.[0]?.id;
  if (!first) {
    throw new Error(
      "No data source found in that database. Set NOTION_MILESTONES_DATA_SOURCE_ID directly.",
    );
  }
  return first;
}

async function getAllDataSourcePages(dataSourceId) {
  const pages = [];
  let startCursor;

  do {
    const response = await notion(`/v1/data_sources/${dataSourceId}/query`, {
      method: "POST",
      body: {
        page_size: 100,
        start_cursor: startCursor,
      },
    });
    pages.push(...response.results);
    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);

  return pages;
}

async function notion(path, options = {}) {
  const response = await fetch(`https://api.notion.com${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${CONFIG.token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion request failed ${response.status}: ${text}`);
  }

  return response.json();
}

function getMilestoneDates(properties) {
  const dateRange = properties[CONFIG.dateProperty]?.date;
  if (dateRange?.start || dateRange?.end) {
    return {
      start: toDateOnly(dateRange.start),
      end: toDateOnly(dateRange.end || dateRange.start),
    };
  }

  return {
    start: propertyToDate(properties[CONFIG.startProperty]),
    end: propertyToDate(properties[CONFIG.endProperty]),
  };
}

function propertyToDate(property) {
  if (!property) return null;
  if (property.type === "date") return toDateOnly(property.date?.start);
  if (property.type === "formula") return formulaToDate(property.formula);
  if (property.type === "rollup") return rollupToDate(property.rollup);
  return null;
}

function formulaToDate(formula) {
  if (!formula) return null;
  if (formula.type === "date") return toDateOnly(formula.date?.start);
  if (formula.type === "string") return toDateOnly(formula.string);
  return null;
}

function rollupToDate(rollup) {
  if (!rollup) return null;
  if (rollup.type === "date") return toDateOnly(rollup.date?.start);
  if (rollup.type === "array") {
    const first = rollup.array.find((item) => propertyToDate(item));
    return propertyToDate(first);
  }
  return null;
}

function getTimelineProgress(start, end) {
  if (!start || !end) return 0;

  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T23:59:59Z`).getTime();
  const nowMs = Date.now();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return nowMs >= endMs ? 100 : 0;
  }

  return clamp(((nowMs - startMs) / (endMs - startMs)) * 100, 0, 100);
}

function getTitle(property) {
  if (!property) return "";
  if (property.type === "title") return richTextToPlain(property.title);
  if (property.type === "rich_text") return richTextToPlain(property.rich_text);
  if (property.type === "formula") {
    if (property.formula.type === "string") return property.formula.string || "";
    if (property.formula.type === "number") return String(property.formula.number ?? "");
  }
  return "";
}

function propertyToText(property) {
  if (!property) return "";

  if (property.type === "title") return richTextToPlain(property.title);
  if (property.type === "rich_text") return richTextToPlain(property.rich_text);
  if (property.type === "select") return property.select?.name || "";
  if (property.type === "status") return property.status?.name || "";
  if (property.type === "multi_select") {
    return property.multi_select.map((item) => item.name).join(", ");
  }
  if (property.type === "formula") {
    if (property.formula.type === "string") return property.formula.string || "";
    if (property.formula.type === "number") return String(property.formula.number ?? "");
  }
  if (property.type === "rollup") {
    if (property.rollup.type === "array") {
      return property.rollup.array.map(propertyToText).filter(Boolean).join(", ");
    }
    if (property.rollup.type === "number") return String(property.rollup.number ?? "");
  }

  return "";
}

function pageIconToWidgetIcon(icon) {
  if (!icon) return null;

  if (icon.type === "emoji") {
    return {
      type: "emoji",
      value: icon.emoji,
    };
  }

  if (icon.type === "external" && icon.external?.url) {
    return {
      type: "image",
      url: icon.external.url,
    };
  }

  if (icon.type === "file" && icon.file?.url) {
    return {
      type: "image",
      url: icon.file.url,
    };
  }

  if (icon.type === "custom_emoji" && icon.custom_emoji?.url) {
    return {
      type: "image",
      url: icon.custom_emoji.url,
    };
  }

  return null;
}

function richTextToPlain(items = []) {
  return items.map((item) => item.plain_text || "").join("");
}

function toDateOnly(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}
