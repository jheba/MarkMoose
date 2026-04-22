import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import mermaid from "mermaid";
import "katex/dist/katex.min.css";
import { parseMd, extractHeadings } from "./parser.js";

const APP_VERSION = "1.2.0";

mermaid.initialize({ startOnLoad: false, theme: "default", flowchart: { useMaxWidth: false, padding: 20, nodeSpacing: 50, rankSpacing: 50 } });

/* ── theme colors ────────────────────────────────────────────────── */
const light = {
  bg: "#fafaf8", surface: "#ffffff", surfaceAlt: "#f5f4f0",
  text: "#2c2a25", textSec: "#6b6860", textTer: "#9d998f",
  border: "#e4e2dd", accent: "#c45d35", accentBg: "#fdf0eb",
  link: "#b04d28", linkHover: "#c45d35",
  codeBg: "#1e1e1e", codeText: "#d4d4d4",
  inlineBg: "#f0efeb", inlineText: "#c45d35",
  hr: "#d8d5ce", scrollThumb: "#e4e2dd",
  toolbarBg: "#ffffff", toolbarText: "#2c2a25", toolbarSec: "#6b6860", toolbarTer: "#9d998f",
  toolbarBorder: "#e4e2dd", toolbarBtnBg: "#f5f4f0", toolbarActiveBg: "#ffffff",
  editorToolbarBg: "#f5f4f0", editorToolbarBorder: "#e4e2dd",
  tabBg: "#f5f4f0", tabActiveBg: "#ffffff", tabText: "#9d998f", tabActiveText: "#2c2a25",
  alertNote: { border: "#336FB9", bg: "#ECF2FA", title: "#336FB9" },
  alertTip: { border: "#65AE20", bg: "#ECFAEC", title: "#65AE20" },
  alertImportant: { border: "#7c3aed", bg: "#f3f0ff", title: "#7c3aed" },
  alertWarning: { border: "#F18A00", bg: "#FFF6E2", title: "#F18A00" },
  alertCaution: { border: "#dc2626", bg: "#fef2f2", title: "#dc2626" },
};

const dark = {
  bg: "#1a1f25", surface: "#2A3A4A", surfaceAlt: "#243242",
  text: "#E6E7E8", textSec: "#a0a8b4", textTer: "#6b7a8a",
  border: "#3d5060", accent: "#F18A00", accentBg: "#3d2f1a",
  link: "#5A95CE", linkHover: "#8EDBE0",
  codeBg: "#0d1117", codeText: "#d4d4d4",
  inlineBg: "#2d3a4a", inlineText: "#F18A00",
  hr: "#3d5060", scrollThumb: "#3d5060",
  toolbarBg: "#2A3A4A", toolbarText: "#E6E7E8", toolbarSec: "#a0a8b4", toolbarTer: "#6b7a8a",
  toolbarBorder: "#3d5060", toolbarBtnBg: "rgba(255,255,255,0.08)", toolbarActiveBg: "rgba(255,255,255,0.15)",
  editorToolbarBg: "#243242", editorToolbarBorder: "#3d5060",
  tabBg: "#243242", tabActiveBg: "#1a1f25", tabText: "#6b7a8a", tabActiveText: "#E6E7E8",
  alertNote: { border: "#5A95CE", bg: "#1a2a3a", title: "#5A95CE" },
  alertTip: { border: "#65AE20", bg: "#1a2a1a", title: "#65AE20" },
  alertImportant: { border: "#a78bfa", bg: "#2a1a3a", title: "#a78bfa" },
  alertWarning: { border: "#F18A00", bg: "#2a2010", title: "#F18A00" },
  alertCaution: { border: "#f87171", bg: "#2a1a1a", title: "#f87171" },
};

/* ── sample markdown ──────────────────────────────────────────────── */
const SAMPLE = `---
title: Welcome to MarkMoose
author: Morten Rasmussen
version: 1.2.0
---

# Welcome to MarkMoose Markdown Editor

A desktop tool for **viewing**, **editing**, and **navigating** Markdown files — by Morten Rasmussen.

## Getting Started

Open a \`.md\` file by:
- Double-clicking any \`.md\` file in Explorer (after install)
- Using **File → Open** or **Ctrl+O**
- Dragging a file onto this window

> [!TIP]
> Press **Ctrl+S** to save your work at any time.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl+S | Save file |
| Ctrl+O | Open file |
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+K | Insert link |

## Syntax Highlighting

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

\`\`\`python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
\`\`\`

## Mermaid Diagrams

\`\`\`mermaid
graph LR
    A[Open File] --> B[Edit]
    B --> C[Preview]
    C --> D[Save]
    D --> B
\`\`\`

## GFM Alerts

> [!NOTE]
> This editor supports GitHub-style alerts for callouts.

> [!WARNING]
> Don't forget to save before closing!

> [!CAUTION]
> Unsaved changes will be lost.

## Footnotes

MarkMoose supports footnotes[^1] for adding references[^2] to your documents.

[^1]: Footnotes appear at the bottom of the document.
[^2]: Great for citations and additional context.

## LaTeX Math

Inline math: $E = mc^2$ and $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$

Block math:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

## Task Lists

- [x] Markdown parsing
- [x] Syntax highlighting
- [x] Mermaid diagrams
- [x] Dark mode
- [ ] World domination

---

*Happy writing!*
`;

/* ── default tab ──────────────────────────────────────────────────── */
let nextTabId = 1;
function makeTab(content, name, path) {
  return { id: nextTabId++, md: content || SAMPLE, fileName: name || null, filePath: path || null, dirty: false };
}

/* ── editor formatting toolbar buttons ───────────────────────────── */
const FMT_BUTTONS = [
  { label: "B", title: "Bold (Ctrl+B)", action: "bold", style: { fontWeight: 700 } },
  { label: "I", title: "Italic (Ctrl+I)", action: "italic", style: { fontStyle: "italic" } },
  { label: "S", title: "Strikethrough", action: "strike", style: { textDecoration: "line-through" } },
  { label: "H1", title: "Heading 1", action: "h1", style: { fontSize: 10, fontWeight: 700 } },
  { label: "H2", title: "Heading 2", action: "h2", style: { fontSize: 10, fontWeight: 700 } },
  { label: "H3", title: "Heading 3", action: "h3", style: { fontSize: 10, fontWeight: 700 } },
  { action: "sep" },
  { label: "\u{1F517}", title: "Link (Ctrl+K)", action: "link" },
  { label: "\u{1F5BC}", title: "Image", action: "image" },
  { label: "</>", title: "Inline code", action: "code", style: { fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" } },
  { label: "{}", title: "Code block", action: "codeblock", style: { fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" } },
  { action: "sep" },
  { label: "\u2022", title: "Bullet list", action: "ul" },
  { label: "1.", title: "Numbered list", action: "ol" },
  { label: "\u2611", title: "Task list", action: "task" },
  { action: "sep" },
  { label: "\u275D", title: "Blockquote", action: "quote" },
  { label: "\u2015", title: "Horizontal rule", action: "hr" },
  { label: "\u2261", title: "Table", action: "table" },
];

/* ── main component ───────────────────────────────────────────────── */
export default function MarkdownViewer() {
  const [tabs, setTabs] = useState([makeTab()]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [mode, setMode] = useState("split");
  const [tocOpen, setTocOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("markmoose-dark") === "true");
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const findRef = useRef(null);
  const [appVersion, setAppVersion] = useState(APP_VERSION);
  const [splitPos, setSplitPos] = useState(50); // percentage
  const previewRef = useRef(null);
  const editorRef = useRef(null);
  const draggingRef = useRef(false);
  const mainRef = useRef(null);
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const syncingScroll = useRef(false);

  // keep ref in sync for async callbacks
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);

  const t = isDark ? dark : light;

  // active tab helpers
  const tab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const [md, setMdState] = useState(tab.md);
  const mdTimerRef = useRef(null);
  const suppressDirtyRef = useRef(false);

  // sync editor content to tab state (debounced for md, immediate for dirty)
  const setMd = useCallback((val) => {
    setMdState(val);
    if (!suppressDirtyRef.current) {
      // set dirty immediately so close handler sees it
      setTabs(ts => ts.map(t => t.id === activeTabId ? { ...t, dirty: true } : t));
    }
    if (mdTimerRef.current) clearTimeout(mdTimerRef.current);
    mdTimerRef.current = setTimeout(() => {
      setTabs(ts => ts.map(t => t.id === activeTabId ? { ...t, md: val } : t));
    }, 500);
  }, [activeTabId]);

  // helper to set editor value without triggering dirty flag
  const setEditorValue = useCallback((value) => {
    if (!editorRef.current) return;
    suppressDirtyRef.current = true;
    editorRef.current.value = value;
    suppressDirtyRef.current = false;
  }, []);

  // sync from tabs when switching tabs or opening files
  const prevTabId = useRef(activeTabId);
  useEffect(() => {
    if (activeTabId !== prevTabId.current) {
      prevTabId.current = activeTabId;
      setMdState(tab.md);
      setEditorValue(tab.md);
    }
  }, [activeTabId, tab.md]);

  // also sync when tab content changes externally (file opened)
  const prevTabMd = useRef(tab.md);
  useEffect(() => {
    if (tab.md !== prevTabMd.current && tab.md !== md) {
      prevTabMd.current = tab.md;
      setMdState(tab.md);
      setEditorValue(tab.md);
    }
  }, [tab.md]);

  const setDirty = useCallback((val) => {
    setTabs(ts => ts.map(t => t.id === activeTabId ? { ...t, dirty: val } : t));
  }, [activeTabId]);
  const setFileName = useCallback((val) => {
    setTabs(ts => ts.map(t => t.id === activeTabId ? { ...t, fileName: val } : t));
  }, [activeTabId]);
  const setFilePath = useCallback((val) => {
    setTabs(ts => ts.map(t => t.id === activeTabId ? { ...t, filePath: val } : t));
  }, [activeTabId]);

  const headings = useMemo(() => extractHeadings(md), [md]);
  const baseDir = tab.filePath ? tab.filePath.replace(/\\/g, "/").replace(/\/[^/]*$/, "") : null;
  const rendered = useMemo(() => parseMd(md, baseDir), [md, baseDir]);

  // persist dark mode
  useEffect(() => {
    localStorage.setItem("markmoose-dark", isDark);
    mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default", flowchart: { useMaxWidth: false, padding: 20, nodeSpacing: 50, rankSpacing: 50 } });
  }, [isDark]);

  // get version from Electron
  useEffect(() => {
    if (window.electronAPI?.getVersion) {
      window.electronAPI.getVersion().then(v => { if (v) setAppVersion(v); });
    }
  }, []);

  // listen for files opened via OS file association — open in new tab
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onFileOpened(({ name, content, path }) => {
      const newTab = makeTab(content, name, path);
      setTabs(ts => [...ts, newTab]);
      setActiveTabId(newTab.id);
    });
  }, []);

  // listen for menu events
  useEffect(() => {
    if (!window.electronAPI) return;
    if (window.electronAPI.onMenuNewFile) {
      window.electronAPI.onMenuNewFile(() => addTab());
    }
    window.electronAPI.onMenuSave(() => handleSave());
    if (window.electronAPI.onMenuSaveAs) {
      window.electronAPI.onMenuSaveAs(async () => {
        const result = await window.electronAPI.saveFileDialog(md);
        if (result?.success) {
          setFilePath(result.path);
          setFileName(result.name);
          setDirty(false);
        }
      });
    }
    window.electronAPI.onMenuAbout(() => setShowAbout(true));
    if (window.electronAPI.onMenuHelp) {
      window.electronAPI.onMenuHelp(() => setShowHelp(true));
    }
    if (window.electronAPI.onMenuExportPdf) {
      window.electronAPI.onMenuExportPdf(() => {
        setMode("preview");
        setTimeout(() => window.electronAPI.exportPdf(), 300);
      });
    }
  }, []);

  // handle close prompt — use ref to avoid stale closure
  useEffect(() => {
    if (!window.electronAPI?.onCheckBeforeClose) return;
    window.electronAPI.onCheckBeforeClose(async () => {
      // flush latest editor content to tabs before checking
      const currentTabs = tabsRef.current.map(t => {
        if (t.id === activeTabIdRef.current && editorRef.current) {
          return { ...t, md: editorRef.current.value };
        }
        return t;
      });
      const dirtyTabs = currentTabs.filter(t => t.dirty);
      if (dirtyTabs.length === 0) {
        window.electronAPI.confirmClose();
        return;
      }
      for (const dt of dirtyTabs) {
        const result = await window.electronAPI.showSavePrompt(dt.fileName || "Untitled");
        if (result === 0) { // Save
          if (dt.filePath) {
            await window.electronAPI.saveFile(dt.filePath, dt.md);
          } else {
            await window.electronAPI.saveFileDialog(dt.md);
          }
        } else if (result === 2) { // Cancel — stop closing
          return;
        }
        // result === 1 (Don't Save) — continue to next tab
      }
      window.electronAPI.confirmClose();
    });
  }, []);

  // render mermaid diagrams
  useEffect(() => {
    if (!previewRef.current) return;
    const blocks = previewRef.current.querySelectorAll(".mermaid-block[data-chart]");
    blocks.forEach(async (el, i) => {
      try {
        const chart = decodeURIComponent(el.dataset.chart);
        const id = `mm-${Date.now()}-${i}`;
        const { svg } = await mermaid.render(id, chart);
        el.innerHTML = svg;
        el.removeAttribute("data-chart");
      } catch (err) {
        el.innerHTML = `<div class="mermaid-error">Diagram error: ${err.message || "invalid syntax"}</div>`;
        el.removeAttribute("data-chart");
      }
    });
  }, [rendered, mode, isDark]);

  const scrollTo = useCallback((text) => {
    if (!previewRef.current) return;
    // match the same ID cleaning logic used in makeHeading
    const cleanId = text.replace(/[^\w\s-]/g, "").trim();
    const el = previewRef.current.querySelector(`[id="${CSS.escape(cleanId)}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleOpenFile = useCallback(async () => {
    if (window.electronAPI) window.electronAPI.openFileDialog();
  }, []);

  const handleSave = useCallback(async () => {
    if (!window.electronAPI) return;
    if (tab.filePath) {
      const result = await window.electronAPI.saveFile(tab.filePath, md);
      if (result?.success) setDirty(false);
    } else {
      const result = await window.electronAPI.saveFileDialog(md);
      if (result?.success) {
        setFilePath(result.path);
        setFileName(result.name);
        setDirty(false);
      }
    }
  }, [md, tab.filePath]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const newTab = makeTab(e.target.result, file.name, file.path || null);
      setTabs(ts => [...ts, newTab]);
      setActiveTabId(newTab.id);
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // tab management
  const addTab = useCallback(() => {
    const newTab = makeTab();
    setTabs(ts => [...ts, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const closeTab = useCallback(async (id) => {
    const currentTabs = tabsRef.current;
    const tabToClose = currentTabs.find(t => t.id === id);
    if (tabToClose?.dirty && window.electronAPI?.showSavePrompt) {
      setActiveTabId(id);
      const result = await window.electronAPI.showSavePrompt(tabToClose.fileName || "Untitled");
      if (result === 0) { // Save
        if (tabToClose.filePath) {
          const r = await window.electronAPI.saveFile(tabToClose.filePath, tabToClose.md);
          if (!r?.success) return;
        } else {
          const r = await window.electronAPI.saveFileDialog(tabToClose.md);
          if (!r?.success) return;
        }
      } else if (result === 2) { // Cancel
        return;
      }
    }
    setTabs(ts => {
      const remaining = ts.filter(t => t.id !== id);
      if (remaining.length === 0) {
        const newTab = makeTab();
        setActiveTabId(newTab.id);
        return [newTab];
      }
      if (id === activeTabId) {
        const idx = ts.findIndex(t => t.id === id);
        const newActive = remaining[Math.min(idx, remaining.length - 1)];
        setActiveTabId(newActive.id);
      }
      return remaining;
    });
  }, [activeTabId]);

  // editor formatting
  const wrapSelection = useCallback((before, after) => {
    const ta = editorRef.current;
    if (!ta) return;
    const val = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newText = val.substring(0, start) + before + val.substring(start, end) + after + val.substring(end);
    ta.value = newText;
    setMd(newText);
    setDirty(true);
    ta.focus();
    ta.selectionStart = start + before.length;
    ta.selectionEnd = end + before.length;
  }, []);

  const insertAtLineStart = useCallback((prefix) => {
    const ta = editorRef.current;
    if (!ta) return;
    const val = ta.value;
    const start = ta.selectionStart;
    const lineStart = val.lastIndexOf("\n", start - 1) + 1;
    const newText = val.substring(0, lineStart) + prefix + val.substring(lineStart);
    ta.value = newText;
    setMd(newText);
    setDirty(true);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = start + prefix.length;
  }, []);

  const insertText = useCallback((text) => {
    const ta = editorRef.current;
    if (!ta) return;
    const val = ta.value;
    const start = ta.selectionStart;
    const newText = val.substring(0, start) + text + val.substring(start);
    ta.value = newText;
    setMd(newText);
    setDirty(true);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = start + text.length;
  }, []);

  const insertLink = useCallback(() => {
    const ta = editorRef.current;
    if (!ta) return;
    const val = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = val.substring(start, end) || "text";
    const newText = val.substring(0, start) + `[${selected}](url)` + val.substring(end);
    ta.value = newText;
    setMd(newText);
    setDirty(true);
    const urlStart = start + selected.length + 3;
    ta.focus();
    ta.selectionStart = urlStart;
    ta.selectionEnd = urlStart + 3;
  }, []);

  const handleFmtAction = useCallback((action) => {
    switch (action) {
      case "bold": wrapSelection("**", "**"); break;
      case "italic": wrapSelection("*", "*"); break;
      case "strike": wrapSelection("~~", "~~"); break;
      case "h1": insertAtLineStart("# "); break;
      case "h2": insertAtLineStart("## "); break;
      case "h3": insertAtLineStart("### "); break;
      case "link": insertLink(); break;
      case "image":
        if (window.electronAPI?.openImageDialog) {
          window.electronAPI.openImageDialog().then(path => {
            if (path) {
              const name = path.replace(/\\/g, "/").split("/").pop();
              insertText(`![${name}](${path.replace(/\\/g, "/")})`);
            }
          });
        } else {
          insertText("![alt](url)");
        }
        break;
      case "code": wrapSelection("`", "`"); break;
      case "codeblock": insertText("\n```\n\n```\n"); break;
      case "ul": insertAtLineStart("- "); break;
      case "ol": insertAtLineStart("1. "); break;
      case "task": insertAtLineStart("- [ ] "); break;
      case "quote": insertAtLineStart("> "); break;
      case "hr": insertText("\n---\n"); break;
      case "table": insertText("\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n"); break;
    }
  }, [wrapSelection, insertAtLineStart, insertText, insertLink]);

  // keyboard shortcuts
  const handleEditorKeyDown = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case "s": e.preventDefault(); handleSave(); break;
        case "b": e.preventDefault(); wrapSelection("**", "**"); break;
        case "i": e.preventDefault(); wrapSelection("*", "*"); break;
        case "k": e.preventDefault(); insertLink(); break;
      }
    }
  }, [handleSave, wrapSelection, insertLink]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "t") { e.preventDefault(); addTab(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowFind(prev => {
          if (!prev) setTimeout(() => findRef.current?.focus(), 50);
          return !prev;
        });
      }
      if (e.key === "Escape" && showFind) { setShowFind(false); setFindText(""); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addTab, handleSave, showFind]);

  const handleChange = useCallback((e) => {
    setMd(e.target.value);
  }, [setMd]);

  // find matches
  const findMatches = useMemo(() => {
    if (!findText || findText.length < 2) return [];
    const matches = [];
    const lower = md.toLowerCase();
    const search = findText.toLowerCase();
    let pos = 0;
    while ((pos = lower.indexOf(search, pos)) !== -1) {
      matches.push(pos);
      pos += 1;
    }
    return matches;
  }, [md, findText]);

  const jumpToMatch = useCallback((idx) => {
    if (findMatches.length === 0) return;
    const matchIdx = ((idx % findMatches.length) + findMatches.length) % findMatches.length;
    setFindIndex(matchIdx);
    const pos = findMatches[matchIdx];

    // jump in editor if visible
    const ta = editorRef.current;
    if (ta && (mode === "edit" || mode === "split")) {
      ta.focus();
      ta.selectionStart = pos;
      ta.selectionEnd = pos + findText.length;
      // calculate scroll position based on character position
      const textBefore = md.substring(0, pos);
      const lineNum = textBefore.split("\n").length;
      const lineHeight = 14 * 1.7; // fontSize * lineHeight
      ta.scrollTop = Math.max(0, (lineNum - 5) * lineHeight);
    }

    // highlight in preview if visible
    if (previewRef.current && (mode === "preview" || mode === "split")) {
      // clear previous highlights
      previewRef.current.querySelectorAll(".find-highlight").forEach(el => {
        el.outerHTML = el.textContent;
      });
      // find text nodes in preview and highlight
      const searchLower = findText.toLowerCase();
      const walker = document.createTreeWalker(previewRef.current, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.toLowerCase().includes(searchLower)) {
          textNodes.push(node);
        }
      }
      let matchCount = 0;
      for (const tn of textNodes) {
        const parts = tn.textContent.split(new RegExp(`(${findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi"));
        if (parts.length <= 1) continue;
        const frag = document.createDocumentFragment();
        parts.forEach(part => {
          if (part.toLowerCase() === searchLower) {
            const mark = document.createElement("mark");
            mark.className = "find-highlight";
            mark.style.background = matchCount === matchIdx ? "#F18A00" : "#F7AF0F66";
            mark.style.color = matchCount === matchIdx ? "#fff" : "inherit";
            mark.style.borderRadius = "2px";
            mark.style.padding = "0 1px";
            mark.textContent = part;
            if (matchCount === matchIdx) {
              setTimeout(() => mark.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
            }
            matchCount++;
            frag.appendChild(mark);
          } else {
            frag.appendChild(document.createTextNode(part));
          }
        });
        tn.parentNode.replaceChild(frag, tn);
      }
    }
  }, [findMatches, findText, md, mode]);

  // clear find highlights when closing or changing search
  useEffect(() => {
    if (!showFind && previewRef.current) {
      previewRef.current.querySelectorAll(".find-highlight").forEach(el => {
        el.outerHTML = el.textContent;
      });
    }
  }, [showFind]);

  // synchronized scrolling — only when user actively scrolls the source pane
  const activeScrollSource = useRef(null);

  const onEditorMouseEnter = useCallback(() => { activeScrollSource.current = "editor"; }, []);
  const onPreviewMouseEnter = useCallback(() => { activeScrollSource.current = "preview"; }, []);

  const onEditorScroll = useCallback(() => {
    if (syncingScroll.current || mode !== "split") return;
    if (activeScrollSource.current !== "editor") return;
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;
    syncingScroll.current = true;
    const pct = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    preview.scrollTop = pct * (preview.scrollHeight - preview.clientHeight);
    requestAnimationFrame(() => { syncingScroll.current = false; });
  }, [mode]);

  const onPreviewScroll = useCallback(() => {
    if (syncingScroll.current || mode !== "split") return;
    if (activeScrollSource.current !== "preview") return;
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;
    syncingScroll.current = true;
    const pct = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1);
    editor.scrollTop = pct * (editor.scrollHeight - editor.clientHeight);
    requestAnimationFrame(() => { syncingScroll.current = false; });
  }, [mode]);

  // split pane drag
  const onSplitMouseDown = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!draggingRef.current || !mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const tocWidth = tocOpen && headings.length > 0 ? 220 : 0;
      const available = rect.width - tocWidth;
      const x = e.clientX - rect.left - tocWidth;
      const pct = Math.max(20, Math.min(80, (x / available) * 100));
      setSplitPos(pct);
    };
    const onMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [tocOpen, headings.length]);

  const wordCount = md.trim() ? md.trim().split(/\s+/).length : 0;
  const lineCount = md.split("\n").length;

  const s = getStyles(t);

  return (
    <div
      style={s.root}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <style>{getCssText(t)}</style>

      {dragOver && (
        <div style={s.dropOverlay}>
          <div style={s.dropBox}>
            <span style={{ fontSize: 40 }}>&#128196;</span>
            <span style={{ fontSize: 18, fontWeight: 600 }}>Drop .md file here</span>
          </div>
        </div>
      )}

      {/* about dialog */}
      {showAbout && (
        <div style={s.aboutOverlay} onClick={() => setShowAbout(false)}>
          <div style={s.aboutBox} onClick={e => e.stopPropagation()}>
            <img src="./icon.png" alt="MarkMoose" style={{ width: 80, height: 80, marginBottom: 8, objectFit: "contain" }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: t.text }}>MarkMoose</div>
            <div style={{ fontSize: 13, color: t.textSec, marginBottom: 12 }}>Markdown Editor</div>
            <div style={{ fontSize: 12, color: t.textTer, marginBottom: 4 }}>Version {appVersion}</div>
            <div style={{ fontSize: 12, color: t.textTer, marginBottom: 16 }}>by Morten Rasmussen</div>
            <a
              href="ms-windows-store://review/?productid=9NJPG77756D4"
              style={{ fontSize: 12, color: t.accent, textDecoration: "none", marginBottom: 16, cursor: "pointer" }}
              onClick={(e) => { e.preventDefault(); window.electronAPI?.openExternal("ms-windows-store://review/?productid=9NJPG77756D4"); }}
            >Enjoying MarkMoose? Rate us in the Store</a>
            <button style={s.aboutCloseBtn} onClick={() => setShowAbout(false)}>Close</button>
          </div>
        </div>
      )}

      {/* help dialog */}
      {showHelp && (
        <div style={s.aboutOverlay} onClick={() => setShowHelp(false)}>
          <div style={s.helpBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 16 }}>Features & Shortcuts</div>
            <div style={s.helpSection}>
              <div style={s.helpSectionTitle}>Keyboard Shortcuts</div>
              <div style={s.helpGrid}>
                {[
                  ["Ctrl+T", "New tab"], ["Ctrl+S", "Save file"], ["Ctrl+O", "Open file"], ["Ctrl+N", "New window"],
                  ["Ctrl+B", "Bold selection"], ["Ctrl+I", "Italic selection"], ["Ctrl+K", "Insert link"],
                  ["Ctrl+F", "Find in document"],
                  ["Ctrl+P", "Export to PDF"], ["Ctrl++", "Zoom in"], ["Ctrl+-", "Zoom out"], ["Ctrl+0", "Reset zoom"], ["F11", "Fullscreen"],
                ].map(([key, desc]) => (
                  <div key={key} style={s.helpRow}>
                    <kbd style={s.kbd}>{key}</kbd>
                    <span style={{ color: t.textSec, fontSize: 13 }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={s.helpSection}>
              <div style={s.helpSectionTitle}>Markdown Support</div>
              <div style={{ color: t.textSec, fontSize: 13, lineHeight: 1.8 }}>
                <div>Headings (H1-H6), bold, italic, strikethrough</div>
                <div>Ordered & unordered lists, task lists</div>
                <div>Links, images, tables</div>
                <div>Blockquotes, horizontal rules</div>
                <div>Inline code & fenced code blocks with <strong style={{ color: t.text }}>syntax highlighting</strong></div>
                <div><strong style={{ color: t.text }}>Mermaid diagrams</strong> — flowcharts, sequence, gantt, etc.</div>
                <div><strong style={{ color: t.text }}>GFM Alerts</strong> — NOTE, TIP, IMPORTANT, WARNING, CAUTION</div>
                <div><strong style={{ color: t.text }}>Footnotes</strong> — references with back-links</div>
                <div><strong style={{ color: t.text }}>Frontmatter</strong> — YAML metadata blocks between ---</div>
                <div><strong style={{ color: t.text }}>LaTeX math</strong> — inline $...$ and block $$...$$ via KaTeX</div>
              </div>
            </div>
            <div style={s.helpSection}>
              <div style={s.helpSectionTitle}>Features</div>
              <div style={{ color: t.textSec, fontSize: 13, lineHeight: 1.8 }}>
                <div>Tabs for multiple open documents</div>
                <div>Live split-view editor with draggable divider</div>
                <div>Auto-generated table of contents sidebar</div>
                <div>Editor formatting toolbar</div>
                <div>Dark mode with persistent preference</div>
                <div>Drag & drop .md files to open</div>
                <div>.md / .markdown file association on Windows</div>
                <div>Unsaved changes prompt on close</div>
                <div>Print and Export to PDF</div>
                <div>Word and line count</div>
              </div>
            </div>
            <button style={{ ...s.aboutCloseBtn, marginTop: 16 }} onClick={() => setShowHelp(false)}>Close</button>
          </div>
        </div>
      )}

      {/* toolbar */}
      <div className="no-print" style={s.toolbar}>
        <div style={s.toolbarLeft}>
          <button style={s.tocBtn} onClick={() => setTocOpen(o => !o)} title="Toggle outline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="10" y2="18"/></svg>
          </button>
          <div style={s.titleArea}>
            <span style={s.appTitle}>MarkMoose Markdown Editor</span>
          </div>
        </div>
        <div style={s.toolbarCenter}>
          {["edit", "split", "preview"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              ...s.modeBtn, ...(mode === m ? s.modeBtnActive : {}),
            }}>
              {m === "edit" ? "Edit" : m === "split" ? "Split" : "Preview"}
            </button>
          ))}
        </div>
        <div style={s.toolbarRight}>
          <span style={s.stats}>{wordCount} words · {lineCount} lines</span>
          <button style={s.iconBtn} onClick={() => setIsDark(d => !d)} title={isDark ? "Light mode" : "Dark mode"}>
            {isDark
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
          <button style={s.iconBtn} onClick={() => setShowHelp(true)} title="Help">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
          <button style={s.iconBtn} onClick={() => { if (window.electronAPI?.openExternal) window.electronAPI.openExternal("ms-windows-store://review/?productid=9NJPG77756D4"); }} title="Rate in Store">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#F7AF0F" stroke="#F7AF0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          <button style={s.uploadBtn} onClick={handleOpenFile}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Open</span>
          </button>
          <button style={s.saveBtn} onClick={handleSave} title="Save (Ctrl+S)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* find bar */}
      {showFind && (
        <div className="no-print" style={s.findBar}>
          <input
            ref={findRef}
            type="text"
            value={findText}
            onChange={e => { setFindText(e.target.value); setFindIndex(0); }}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); jumpToMatch(e.shiftKey ? findIndex - 1 : findIndex + 1); }
              if (e.key === "Escape") { setShowFind(false); setFindText(""); }
            }}
            placeholder="Find in document..."
            style={s.findInput}
          />
          <span style={s.findCount}>
            {findText.length >= 2 ? `${findMatches.length > 0 ? findIndex + 1 : 0} / ${findMatches.length}` : ""}
          </span>
          <button style={s.findBtn} onClick={() => jumpToMatch(findIndex - 1)} title="Previous (Shift+Enter)">&#9650;</button>
          <button style={s.findBtn} onClick={() => jumpToMatch(findIndex + 1)} title="Next (Enter)">&#9660;</button>
          <button style={s.findBtn} onClick={() => { setShowFind(false); setFindText(""); }} title="Close (Esc)">&times;</button>
        </div>
      )}

      {/* tab bar */}
      <div className="no-print" style={s.tabBar}>
        {tabs.map(t => (
          <div
            key={t.id}
            style={{ ...s.tab, ...(t.id === activeTabId ? s.tabActive : {}) }}
            onClick={() => setActiveTabId(t.id)}
          >
            <span style={s.tabLabel}>{t.fileName || "Untitled"}{t.dirty ? " *" : ""}</span>
            <button
              style={s.tabClose}
              onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
              title="Close tab"
            >&times;</button>
          </div>
        ))}
        <button style={s.tabAdd} onClick={addTab} title="New tab">+</button>
      </div>

      {/* main area */}
      <div style={s.main} ref={mainRef}>
        {/* TOC sidebar */}
        {tocOpen && headings.length > 0 && (
          <div className="no-print" style={s.toc}>
            <div style={s.tocHeader}>Outline</div>
            <div style={s.tocList}>
              {headings.map((h, i) => (
                <button
                  key={i}
                  onClick={() => { if (mode === "edit") setMode("split"); scrollTo(h.text); }}
                  style={{ ...s.tocItem, paddingLeft: 12 + (h.level - 1) * 14 }}
                  title={h.text}
                >
                  <span style={{ ...s.tocLevel, opacity: h.level <= 2 ? 1 : 0.6 }}>{"H" + h.level}</span>
                  <span style={{ ...s.tocText, fontWeight: h.level <= 2 ? 600 : 400 }}>{h.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* editor */}
        {(mode === "edit" || mode === "split") && (
          <div className="no-print" style={{
            ...s.pane,
            cursor: "text",
            ...(mode === "split" ? { width: `${splitPos}%`, flex: "none" } : {}),
          }}>
            {/* formatting toolbar */}
            <div style={s.fmtBar}>
              {FMT_BUTTONS.map((btn, i) =>
                btn.action === "sep"
                  ? <div key={i} style={s.fmtSep} />
                  : <button
                      key={btn.action}
                      style={{ ...s.fmtBtn, ...(btn.style || {}) }}
                      onClick={() => handleFmtAction(btn.action)}
                      title={btn.title}
                    >{btn.label}</button>
              )}
            </div>
            <textarea
              ref={editorRef}
              defaultValue={md}
              onInput={handleChange}
              onKeyDown={handleEditorKeyDown}
              onScroll={onEditorScroll}
              onMouseEnter={onEditorMouseEnter}
              onWheel={onEditorMouseEnter}
              style={s.editor}
              spellCheck={false}
              placeholder="Type or paste markdown here..."
            />
          </div>
        )}

        {/* split handle */}
        {mode === "split" && (
          <div className="no-print" style={s.splitHandle} onMouseDown={onSplitMouseDown} />
        )}

        {/* preview */}
        {(mode === "preview" || mode === "split") && (
          <div style={{
            overflow: "auto", minWidth: 0, cursor: "default",
            ...(mode === "split" ? { width: `${100 - splitPos}%` } : { flex: 1 }),
          }} className="print-only" ref={previewRef} onScroll={onPreviewScroll} onMouseEnter={onPreviewMouseEnter} onWheel={onPreviewMouseEnter}>
            <div className="md-preview" style={s.preview} dangerouslySetInnerHTML={{ __html: rendered }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── dynamic CSS ──────────────────────────────────────────────────── */
function getCssText(t) {
  return `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .md-preview h1 { font-family: 'Source Serif 4', Georgia, serif; font-size: 2em; font-weight: 700; margin: 28px 0 12px; color: ${t.text}; letter-spacing: -0.02em; line-height: 1.2; }
  .md-preview h2 { font-family: 'Source Serif 4', Georgia, serif; font-size: 1.5em; font-weight: 600; margin: 24px 0 10px; color: ${t.text}; letter-spacing: -0.01em; line-height: 1.3; border-bottom: 1px solid ${t.border}; padding-bottom: 6px; }
  .md-preview h3 { font-family: 'DM Sans', sans-serif; font-size: 1.2em; font-weight: 600; margin: 20px 0 8px; color: ${t.text}; }
  .md-preview h4, .md-preview h5, .md-preview h6 { font-family: 'DM Sans', sans-serif; font-size: 1.05em; font-weight: 600; margin: 16px 0 6px; color: ${t.textSec}; }
  .md-preview p { font-family: 'Source Serif 4', Georgia, serif; font-size: 1.05em; line-height: 1.75; margin: 8px 0; color: ${t.text}; }
  .md-preview strong { font-weight: 700; }
  .md-preview em { font-style: italic; }
  .md-preview del { text-decoration: line-through; opacity: 0.6; }

  .md-preview .md-link { color: ${t.link}; text-decoration: underline; text-underline-offset: 2px; }
  .md-preview .md-link:hover { color: ${t.linkHover}; }

  .md-preview .code-block {
    background: ${t.codeBg}; color: ${t.codeText}; padding: 16px 20px; border-radius: 8px;
    font-family: 'IBM Plex Mono', monospace; font-size: 0.88em; line-height: 1.6;
    overflow-x: auto; margin: 14px 0; position: relative;
  }
  .md-preview .code-block::before {
    content: attr(data-lang); position: absolute; top: 8px; right: 12px;
    font-size: 0.7em; text-transform: uppercase; letter-spacing: 0.08em;
    color: #888; font-family: 'DM Sans', sans-serif;
  }
  .md-preview .inline-code {
    background: ${t.inlineBg}; color: ${t.inlineText}; padding: 2px 6px; border-radius: 4px;
    font-family: 'IBM Plex Mono', monospace; font-size: 0.9em;
  }

  .md-preview .md-quote {
    border-left: 3px solid ${t.accent}; padding: 10px 16px; margin: 12px 0;
    background: ${t.accentBg}; border-radius: 0 6px 6px 0;
    font-family: 'Source Serif 4', Georgia, serif; font-style: italic; color: ${t.textSec};
  }

  .md-preview .md-alert {
    padding: 12px 16px; margin: 12px 0; border-radius: 6px; border-left: 4px solid;
    font-family: 'DM Sans', sans-serif;
  }
  .md-preview .md-alert-title { font-weight: 700; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; display: block; }
  .md-preview .md-alert-body { font-size: 0.95em; margin: 0; font-family: 'Source Serif 4', Georgia, serif; }
  .md-preview .md-alert-note { border-color: ${t.alertNote.border}; background: ${t.alertNote.bg}; }
  .md-preview .md-alert-note .md-alert-title { color: ${t.alertNote.title}; }
  .md-preview .md-alert-note .md-alert-body { color: ${t.text}; }
  .md-preview .md-alert-tip { border-color: ${t.alertTip.border}; background: ${t.alertTip.bg}; }
  .md-preview .md-alert-tip .md-alert-title { color: ${t.alertTip.title}; }
  .md-preview .md-alert-tip .md-alert-body { color: ${t.text}; }
  .md-preview .md-alert-important { border-color: ${t.alertImportant.border}; background: ${t.alertImportant.bg}; }
  .md-preview .md-alert-important .md-alert-title { color: ${t.alertImportant.title}; }
  .md-preview .md-alert-important .md-alert-body { color: ${t.text}; }
  .md-preview .md-alert-warning { border-color: ${t.alertWarning.border}; background: ${t.alertWarning.bg}; }
  .md-preview .md-alert-warning .md-alert-title { color: ${t.alertWarning.title}; }
  .md-preview .md-alert-warning .md-alert-body { color: ${t.text}; }
  .md-preview .md-alert-caution { border-color: ${t.alertCaution.border}; background: ${t.alertCaution.bg}; }
  .md-preview .md-alert-caution .md-alert-title { color: ${t.alertCaution.title}; }
  .md-preview .md-alert-caution .md-alert-body { color: ${t.text}; }

  .md-preview .md-ul, .md-preview .md-ol { padding-left: 24px; margin: 8px 0; }
  .md-preview .md-li, .md-preview .md-oli {
    font-family: 'Source Serif 4', Georgia, serif; font-size: 1.05em;
    line-height: 1.7; margin: 3px 0; color: ${t.text};
  }

  .md-preview .task { font-family: 'DM Sans', sans-serif; font-size: 0.95em; padding: 4px 0; color: ${t.textSec}; }
  .md-preview .task.done { color: ${t.textTer}; text-decoration: line-through; }

  .md-preview .md-table { width: 100%; border-collapse: collapse; margin: 14px 0; font-family: 'DM Sans', sans-serif; font-size: 0.92em; }
  .md-preview .md-table th { background: ${t.surfaceAlt}; padding: 10px 14px; text-align: left; font-weight: 600; border: 1px solid ${t.border}; color: ${t.text}; }
  .md-preview .md-table td { padding: 9px 14px; border: 1px solid ${t.border}; color: ${t.text}; }
  .md-preview .md-table tr:hover td { background: ${t.bg}; }

  .md-preview .md-hr { border: none; border-top: 2px solid ${t.hr}; margin: 24px 0; }

  .md-preview .md-fnref a { color: ${t.accent}; text-decoration: none; font-weight: 700; }
  .md-preview .md-footnotes { font-size: 0.9em; color: ${t.textSec}; }

  .md-preview .md-frontmatter { margin-bottom: 20px; padding: 12px 16px; background: ${t.surfaceAlt}; border-radius: 8px; border: 1px solid ${t.border}; }
  .md-preview .md-frontmatter .md-table { margin: 0; font-size: 0.85em; }
  .md-preview .md-frontmatter .md-table td { border: none; padding: 4px 12px 4px 0; }

  .md-preview .md-math-block { margin: 14px 0; padding: 16px; text-align: center; overflow-x: auto; }
  .md-preview .md-math-inline { display: inline; }
  .md-preview .md-math-error { color: ${t.alertCaution.title}; font-family: 'IBM Plex Mono', monospace; font-size: 0.85em; }

  .md-preview .mermaid-block { margin: 14px 0; padding: 16px 32px; background: ${t.surface}; border-radius: 8px; border: 1px solid ${t.border}; text-align: center; overflow-x: auto; }
  .md-preview .mermaid-block svg { height: auto; padding: 8px 16px; }
  .md-preview .mermaid-block .node foreignObject { overflow: visible; }
  .md-preview .mermaid-block .nodeLabel { overflow: visible; white-space: nowrap; }
  .md-preview .mermaid-error { color: ${t.alertCaution.title}; font-size: 0.85em; padding: 8px; font-family: 'IBM Plex Mono', monospace; }

  .hljs { color: #d4d4d4; }
  .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-section { color: #569cd6; }
  .hljs-string, .hljs-meta-string { color: #ce9178; }
  .hljs-number { color: #b5cea8; }
  .hljs-comment, .hljs-quote { color: #6a9955; font-style: italic; }
  .hljs-function, .hljs-title { color: #dcdcaa; }
  .hljs-params { color: #9cdcfe; }
  .hljs-type, .hljs-built_in, .hljs-class { color: #4ec9b0; }
  .hljs-attr, .hljs-variable, .hljs-template-variable { color: #9cdcfe; }
  .hljs-name, .hljs-tag { color: #569cd6; }
  .hljs-attribute { color: #9cdcfe; }
  .hljs-meta, .hljs-meta-keyword { color: #569cd6; }
  .hljs-symbol, .hljs-bullet { color: #b5cea8; }
  .hljs-regexp { color: #d16969; }
  .hljs-addition { color: #b5cea8; }
  .hljs-deletion { color: #ce9178; }
  .hljs-operator, .hljs-punctuation { color: #d4d4d4; }

  ::-webkit-scrollbar { width: 8px; height: 8px; cursor: default; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 4px; cursor: default; }
  ::-webkit-scrollbar-thumb:hover { background: ${t.textTer}; }

  @media print {
    body, html, #root, #root > div {
      height: auto !important; max-height: none !important;
      overflow: visible !important; display: block !important;
    }
    .no-print { display: none !important; }
    .md-preview {
      padding: 20px !important; max-width: 100% !important;
      color: #000 !important;
    }
    .md-preview h1, .md-preview h2, .md-preview h3,
    .md-preview h4, .md-preview h5, .md-preview h6,
    .md-preview p, .md-preview li, .md-preview td, .md-preview th {
      color: #000 !important;
    }
    .md-preview .code-block { break-inside: avoid; }
    .md-preview .md-table { break-inside: avoid; }
    .md-preview .mermaid-block { break-inside: avoid; }
    .print-only {
      display: block !important; overflow: visible !important;
      height: auto !important; max-height: none !important;
      width: 100% !important; flex: none !important;
      position: static !important;
    }
    .print-only * { overflow: visible !important; max-height: none !important; }
  }
`;
}

/* ── inline styles ────────────────────────────────────────────────── */
function getStyles(t) {
  return {
    root: {
      width: "100%", height: "100vh", display: "flex", flexDirection: "column",
      background: t.bg, color: t.text, fontFamily: "'DM Sans', sans-serif",
      position: "relative", overflow: "hidden", cursor: "default",
    },
    dropOverlay: {
      position: "absolute", inset: 0, zIndex: 999,
      background: `${t.accent}14`, backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    },
    dropBox: {
      background: t.surface, borderRadius: 16, padding: "40px 60px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      border: `2px dashed ${t.accent}`, color: t.accent,
      boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    },
    aboutOverlay: {
      position: "absolute", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    },
    aboutBox: {
      background: t.surface, borderRadius: 16, padding: "36px 48px",
      display: "flex", flexDirection: "column", alignItems: "center",
      boxShadow: "0 16px 48px rgba(0,0,0,0.2)", border: `1px solid ${t.border}`,
      minWidth: 280,
    },
    findBar: {
      display: "flex", alignItems: "center", gap: 6, padding: "4px 16px",
      background: t.surfaceAlt, borderBottom: `1px solid ${t.border}`,
      minHeight: 36,
    },
    findInput: {
      flex: 1, maxWidth: 300, padding: "4px 10px", fontSize: 13,
      border: `1px solid ${t.border}`, borderRadius: 4,
      background: t.bg, color: t.text, outline: "none",
      fontFamily: "'DM Sans', sans-serif",
    },
    findCount: { fontSize: 12, color: t.textTer, minWidth: 50, fontFamily: "'IBM Plex Mono', monospace" },
    findBtn: {
      background: "none", border: "none", cursor: "pointer", padding: "2px 6px",
      fontSize: 14, color: t.textSec, borderRadius: 4, lineHeight: 1,
    },
    aboutCloseBtn: {
      background: t.accent, color: "#fff", border: "none", borderRadius: 8,
      padding: "8px 28px", fontSize: 13, fontWeight: 600, cursor: "pointer",
      fontFamily: "'DM Sans', sans-serif",
    },
    helpBox: {
      background: t.surface, borderRadius: 16, padding: "32px 36px",
      display: "flex", flexDirection: "column", alignItems: "center",
      boxShadow: "0 16px 48px rgba(0,0,0,0.2)", border: `1px solid ${t.border}`,
      minWidth: 420, maxWidth: 520, maxHeight: "80vh", overflowY: "auto",
    },
    helpSection: { width: "100%", marginBottom: 16 },
    helpSectionTitle: {
      fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
      color: t.accent, marginBottom: 8, paddingBottom: 4,
      borderBottom: `1px solid ${t.border}`,
    },
    helpGrid: { display: "flex", flexDirection: "column", gap: 4 },
    helpRow: { display: "flex", alignItems: "center", gap: 12 },
    kbd: {
      display: "inline-block", minWidth: 70, padding: "2px 8px", fontSize: 12,
      fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500,
      background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 4,
      color: t.text, textAlign: "center",
    },
    toolbar: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 16px", height: 48, minHeight: 48,
      background: t.toolbarBg, borderBottom: `1px solid ${t.toolbarBorder}`,
      WebkitAppRegion: "drag", zIndex: 10,
    },
    toolbarLeft: { display: "flex", alignItems: "center", gap: 10, flex: 1, WebkitAppRegion: "no-drag" },
    toolbarCenter: { display: "flex", gap: 2, background: t.toolbarBtnBg, borderRadius: 8, padding: 3, WebkitAppRegion: "no-drag" },
    toolbarRight: { display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end", WebkitAppRegion: "no-drag" },
    tocBtn: {
      background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6,
      color: t.toolbarSec, display: "flex", alignItems: "center",
    },
    titleArea: { display: "flex", alignItems: "baseline", gap: 8 },
    appTitle: { fontWeight: 700, fontSize: 15, color: t.toolbarText, letterSpacing: "-0.02em" },
    modeBtn: {
      background: "transparent", border: "none", cursor: "pointer", padding: "5px 14px",
      borderRadius: 6, fontSize: 13, fontWeight: 500, color: t.toolbarSec,
      fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
    },
    modeBtnActive: {
      background: t.toolbarActiveBg, color: t.toolbarText, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    },
    stats: { fontSize: 12, color: t.toolbarTer, fontFamily: "'IBM Plex Mono', monospace" },
    iconBtn: {
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6,
      color: t.toolbarSec,
    },
    uploadBtn: {
      display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${t.toolbarBorder}`,
      borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 500,
      color: t.toolbarSec, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    },
    saveBtn: {
      display: "flex", alignItems: "center", gap: 5, background: t.accent, border: "none",
      borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600,
      color: "#ffffff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    },
    // tab bar
    tabBar: {
      display: "flex", alignItems: "flex-end", gap: 0, padding: "0 8px",
      background: t.tabBg, borderBottom: `1px solid ${t.border}`,
      minHeight: 32, overflowX: "auto", overflowY: "hidden",
    },
    tab: {
      display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
      fontSize: 12, color: t.tabText, cursor: "pointer",
      borderRadius: "6px 6px 0 0", background: "transparent",
      fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
      borderBottom: "2px solid transparent", transition: "all 0.1s",
    },
    tabActive: {
      background: t.tabActiveBg, color: t.tabActiveText,
      borderBottom: `2px solid ${t.accent}`,
    },
    tabLabel: { maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" },
    tabClose: {
      background: "none", border: "none", cursor: "pointer", fontSize: 14,
      color: t.textTer, padding: "0 2px", lineHeight: 1, fontWeight: 400,
    },
    tabAdd: {
      background: "none", border: "none", cursor: "pointer", fontSize: 16,
      color: t.textTer, padding: "4px 10px", fontWeight: 400, lineHeight: 1,
    },
    // main
    main: { display: "flex", flex: 1, overflow: "hidden" },
    toc: {
      width: 220, minWidth: 220, background: t.surfaceAlt, borderRight: `1px solid ${t.border}`,
      display: "flex", flexDirection: "column", overflow: "hidden",
    },
    tocHeader: {
      padding: "14px 16px 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.08em", color: t.textTer,
    },
    tocList: { flex: 1, overflow: "auto", paddingBottom: 16 },
    tocItem: {
      display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none",
      cursor: "pointer", padding: "5px 12px", textAlign: "left",
      fontSize: 13, color: t.textSec, fontFamily: "'DM Sans', sans-serif",
      borderRadius: 0, transition: "background 0.1s",
    },
    tocLevel: {
      fontSize: 9, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
      color: t.accent, minWidth: 18,
    },
    tocText: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    pane: { flex: 1, overflow: "hidden", minWidth: 0, display: "flex", flexDirection: "column" },
    // formatting bar
    fmtBar: {
      display: "flex", alignItems: "center", gap: 2, padding: "4px 8px",
      background: t.editorToolbarBg, borderBottom: `1px solid ${t.editorToolbarBorder}`,
      minHeight: 32, flexWrap: "wrap",
    },
    fmtBtn: {
      background: "none", border: "none", cursor: "pointer", padding: "4px 6px",
      color: t.textSec, borderRadius: 4,
      display: "flex", alignItems: "center", justifyContent: "center",
      minWidth: 28, height: 26,
    },
    fmtSep: {
      width: 1, height: 16, background: t.border, margin: "0 4px",
    },
    editor: {
      flex: 1, width: "100%", resize: "none", border: "none", outline: "none",
      padding: "16px 28px", fontSize: 14, lineHeight: 1.7,
      fontFamily: "'IBM Plex Mono', monospace", color: t.text,
      background: t.bg, cursor: "text",
      minHeight: 0, overflow: "auto",
    },
    splitHandle: {
      width: 6, cursor: "col-resize", background: t.border,
      flexShrink: 0, position: "relative", zIndex: 5,
    },
    preview: { padding: "24px 36px" },
  };
}
