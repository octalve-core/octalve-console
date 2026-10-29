"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eye,
  Heading1,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Underline
} from "lucide-react";

type RichTextEditorProps = {
  label?: string;
  initialValue?: string;
};

type FormatAction =
  | "bold"
  | "italic"
  | "underline"
  | "h1"
  | "bullet"
  | "numbered"
  | "quote"
  | "link"
  | "left"
  | "center"
  | "right";

function applyFormat(action: FormatAction, selected: string) {
  const value = selected || "Text";

  switch (action) {
    case "bold":
      return `<strong>${value}</strong>`;
    case "italic":
      return `<em>${value}</em>`;
    case "underline":
      return `<u>${value}</u>`;
    case "h1":
      return `<h2>${value}</h2>`;
    case "bullet":
      return `<ul><li>${value}</li></ul>`;
    case "numbered":
      return `<ol><li>${value}</li></ol>`;
    case "quote":
      return `<blockquote>${value}</blockquote>`;
    case "link":
      return `<a href="https://example.com">${value}</a>`;
    case "center":
      return `<p style="text-align:center;">${value}</p>`;
    case "right":
      return `<p style="text-align:right;">${value}</p>`;
    case "left":
    default:
      return `<p style="text-align:left;">${value}</p>`;
  }
}

export function RichTextEditor({
  label = "Article Content",
  initialValue = ""
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState(initialValue);
  const [preview, setPreview] = useState(false);

  const toolbar = useMemo(
    () => [
      { action: "bold" as const, label: "Bold", icon: Bold },
      { action: "italic" as const, label: "Italic", icon: Italic },
      { action: "underline" as const, label: "Underline", icon: Underline },
      { action: "h1" as const, label: "Heading", icon: Heading1 },
      { action: "bullet" as const, label: "Bullet list", icon: List },
      { action: "numbered" as const, label: "Numbered list", icon: ListOrdered },
      { action: "quote" as const, label: "Quote", icon: Quote },
      { action: "link" as const, label: "Link", icon: LinkIcon },
      { action: "left" as const, label: "Align left", icon: AlignLeft },
      { action: "center" as const, label: "Align center", icon: AlignCenter },
      { action: "right" as const, label: "Align right", icon: AlignRight }
    ],
    []
  );

  function insert(action: FormatAction) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const replacement = applyFormat(action, selected);
    const next = value.slice(0, start) + replacement + value.slice(end);

    setValue(next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    });
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-console-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-console-line px-3 py-2">
        <span className="text-[13px] font-medium text-console-ink">{label}</span>
        <button
          type="button"
          className={preview ? "inline-flex h-9 items-center gap-1 rounded-lg bg-blue-50 px-3 text-[13px] font-medium text-console-primary" : "inline-flex h-9 items-center gap-1 rounded-lg border border-console-line px-3 text-[13px] font-medium text-console-muted hover:bg-slate-50"}
          onClick={() => setPreview((current) => !current)}
        >
          <Eye size={15} />
          Preview
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-console-line px-3 py-2">
        {toolbar.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.action}
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-console-muted hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-console-primary"
              onClick={() => insert(item.action)}
              title={item.label}
            >
              <Icon size={15} />
            </button>
          );
        })}
      </div>

      {preview ? (
        <div
          className="min-h-40 break-words p-4 text-[13px] leading-6 text-console-ink [&_p]:mb-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: value || "<p>Nothing to preview yet.</p>" }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          className="min-h-48 w-full resize-y border-0 bg-white p-4 text-[13px] leading-6 text-console-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-console-primary"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Write article content. Use the toolbar for bold, italic, underline, lists, links, quotes and alignment."
        />
      )}
    </div>
  );
}
