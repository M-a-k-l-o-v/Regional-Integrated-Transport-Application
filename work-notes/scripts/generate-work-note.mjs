import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const NOTES_DIR = join(ROOT, "work-notes");
const PREVIOUS_NOTES_DIR = join(NOTES_DIR, "previousNotes");
const NOTE_FILE_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.md$/;

function run(cmd) {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function fmtDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return { readable: `${yyyy}-${mm}-${dd} ${hh}:${mi}`, file: `${yyyy}-${mm}-${dd}_${hh}-${mi}` };
}

function toBullets(lines) {
  if (!lines.length) return "- None in this window";
  return lines.map((line) => `- ${line}`).join("\n");
}

function unique(values) {
  return [...new Set(values)];
}

function walkDir(dir, out = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "dist"].includes(entry.name)) continue;
      walkDir(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function readText(filePath) {
  try {
    if (!existsSync(filePath)) return "";
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function sectionLines(markdown, heading) {
  const lines = markdown.split("\n");
  const target = `## ${heading}`.toLowerCase();
  const start = lines.findIndex((line) => line.trim().toLowerCase() === target);
  if (start < 0) return [];

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("## ")) {
      end = i;
      break;
    }
  }

  return lines.slice(start + 1, end);
}

function summarizeProjectReadme() {
  const readmePath = join(ROOT, "README.md");
  const md = readText(readmePath);
  if (!md) return ["README.md not found"];

  const lines = md.split("\n");
  const title = lines.find((line) => line.startsWith("# "))?.replace(/^#\s+/, "").trim();
  const summary = lines.find((line) => {
    const t = line.trim();
    return t && !t.startsWith("#") && !t.startsWith("-");
  });

  const implemented = sectionLines(md, "What is implemented")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").trim())
    .slice(0, 3);

  const architecture = sectionLines(md, "Current architecture")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").trim())
    .slice(0, 2);

  const out = [];
  if (title) out.push(`Project: ${title}`);
  if (summary) out.push(`Purpose: ${summary.trim()}`);
  out.push(...implemented.map((item) => `Implemented: ${item}`));
  out.push(...architecture.map((item) => `Architecture: ${item}`));
  return out.length ? out : ["README has no extractable summary"];
}

function summarizeProjectContext() {
  const contextPath = join(ROOT, "work-notes", "project-context.md");
  const md = readText(contextPath);
  if (!md) {
    return [
      "No project-context.md content yet",
      "Add key goals/constraints in work-notes/project-context.md",
    ];
  }

  const items = md
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.replace(/^- /, ""))
    .slice(0, 8);

  return items.length
    ? items
    : ["project-context.md is present but empty"];
}

function extractAreas(files) {
  const mapped = files.map((file) => {
    if (file.startsWith("src/parsers/rail/")) return "rail parser";
    if (file.startsWith("src/services/")) return "ingestion services";
    if (file.startsWith("src/infrastructure/")) return "infrastructure (api/repositories/db)";
    if (file.startsWith("src/cronJobs/")) return "cron scheduling";
    if (file.startsWith("prisma/")) return "database schema/migrations";
    if (file.startsWith("README")) return "docs";
    if (file.startsWith("package")) return "dependencies/scripts";
    return "general backend";
  });
  return unique(mapped);
}

function describePath(file) {
  if (file.startsWith("src/services/")) return "Updated ingestion/service workflow logic";
  if (file.startsWith("src/parsers/rail/")) return "Progressed rail timetable parsing and record handling";
  if (file.startsWith("src/infrastructure/apiClients/")) return "Adjusted external API client integration";
  if (file.startsWith("src/infrastructure/repositories/")) return "Refined database repository persistence behavior";
  if (file.startsWith("src/cronJobs/")) return "Changed cron scheduling/orchestration behavior";
  if (file.startsWith("prisma/schema.prisma")) return "Modified Prisma domain schema";
  if (file.startsWith("prisma/migrations/")) return "Added/updated database migration changes";
  if (file.startsWith("src/scripts/")) return "Worked on backend task/ingestion scripts";
  if (file === "README.md") return "Updated project-level documentation";
  if (file.startsWith("work-notes/project-context.md")) return "Updated persistent project context notes";
  if (file.startsWith("work-notes/scripts/")) return "Improved automated work-notes tooling";
  if (file.startsWith("package.json")) return "Adjusted npm scripts/dependency configuration";
  return "Made general backend refinements";
}

function uniqueDescriptions(files) {
  return unique(files.map(describePath));
}

function recentFileChanges(windowMinutes) {
  const cutoff = Date.now() - windowMinutes * 60 * 1000;
  const files = walkDir(ROOT)
    .map((fullPath) => {
      const rel = relative(ROOT, fullPath).replace(/\\/g, "/");
      return { fullPath, rel };
    })
    .filter(({ rel }) => !rel.startsWith("work-notes/"))
    .filter(({ rel }) => rel !== "work-notes/README.md" && rel !== "work-notes/project-context.md");

  return files
    .filter(({ fullPath }) => {
      try {
        return statSync(fullPath).mtimeMs >= cutoff;
      } catch {
        return false;
      }
    })
    .map(({ rel }) => rel)
    .slice(0, 20);
}

function listCurrentNoteFiles() {
  if (!existsSync(NOTES_DIR)) return [];
  return readdirSync(NOTES_DIR)
    .filter((name) => NOTE_FILE_RE.test(name))
    .map((name) => join(NOTES_DIR, name));
}

function archiveCurrentNotes() {
  mkdirSync(PREVIOUS_NOTES_DIR, { recursive: true });

  for (const currentPath of listCurrentNoteFiles()) {
    const fileName = currentPath.split("/").pop();
    if (!fileName) continue;

    let targetPath = join(PREVIOUS_NOTES_DIR, fileName);
    let index = 1;
    while (existsSync(targetPath)) {
      const nextName = fileName.replace(/\.md$/, `-${index}.md`);
      targetPath = join(PREVIOUS_NOTES_DIR, nextName);
      index++;
    }

    renameSync(currentPath, targetPath);
  }
}

export function generateWorkNote(windowMinutes = 30) {
  mkdirSync(NOTES_DIR, { recursive: true });
  mkdirSync(PREVIOUS_NOTES_DIR, { recursive: true });

  const now = new Date();
  const stamp = fmtDate(now);

  const branch = run("git rev-parse --abbrev-ref HEAD") || "unknown";
  const lastCommit = run("git log -1 --pretty=format:'%h %s (%ci)'") || "No commits yet";

  const recentCommitsRaw =
    run(`git log --since='${windowMinutes} minutes ago' --pretty=format:'%s'`) || "";
  const recentCommits = recentCommitsRaw ? recentCommitsRaw.split("\n").filter(Boolean) : [];
  const recentFiles = recentFileChanges(windowMinutes);

  const statusRaw = run("git status --short");
  const changedFiles = statusRaw
    ? statusRaw
        .split("\n")
        .filter(Boolean)
        .map((line) => line.replace(/^[ MARCUD?!]{1,2}\s+/, ""))
    : [];
  const recentWorkScope = unique([
    ...recentFiles,
    ...changedFiles.filter((f) => !f.startsWith("work-notes/")),
  ]);
  const recentActivity = unique([
    ...recentCommits.slice(0, 3).map((subject) => `Committed: ${subject}`),
    ...uniqueDescriptions(recentWorkScope).slice(0, 8),
  ]).slice(0, 10);
  if (!recentActivity.length) recentActivity.push("No major backend changes detected in this window");
  const areas = extractAreas(changedFiles);
  const readmeContext = summarizeProjectReadme();
  const projectContext = summarizeProjectContext();

  const nextFocus = [];
  if (changedFiles.some((f) => f.startsWith("src/parsers/rail/"))) {
    nextFocus.push("Validate parser coverage for additional rail record types.");
  }
  if (changedFiles.some((f) => f.startsWith("src/services/"))) {
    nextFocus.push("Run an ingestion dry-run and confirm job-run status/error handling.");
  }
  if (changedFiles.some((f) => f.startsWith("prisma/"))) {
    nextFocus.push("Check migrations against local DB before the next push.");
  }
  if (!nextFocus.length) {
    nextFocus.push("Review current modified files and choose the highest-impact next task.");
  }

  const body = `# Work Notes - ${stamp.readable}

## Snapshot
- Branch: \`${branch}\`
- Last commit: ${lastCommit}
- Note window: last ${windowMinutes} minutes

## Project README Context
${toBullets(readmeContext)}

## Project Context
${toBullets(projectContext)}

## What Changed Recently
${toBullets(recentActivity)}

## Working Tree (Uncommitted)
${toBullets(changedFiles)}

## Main Areas Worked On
${toBullets(areas)}

## Resume Plan (Next Session)
${toBullets(nextFocus)}
`;

  archiveCurrentNotes();
  const filePath = join(NOTES_DIR, `${stamp.file}.md`);
  writeFileSync(filePath, body, "utf8");
  return filePath;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const arg = process.argv.find((item) => item.startsWith("--window="));
  const windowMinutes = arg ? Number(arg.split("=")[1]) : 30;
  const filePath = generateWorkNote(Number.isFinite(windowMinutes) ? windowMinutes : 30);
  console.log(`Created work note: ${filePath}`);
}
