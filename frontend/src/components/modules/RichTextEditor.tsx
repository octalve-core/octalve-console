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
    <div className="rich-editor">
      <div className="rich-editor-top">
        <span className="form-label">{label}</span>
        <button
          type="button"
          className={preview ? "rich-tool active" : "rich-tool"}
          onClick={() => setPreview((current) => !current)}
        >
          <Eye size={15} />
          Preview
        </button>
      </div>

      <div className="rich-toolbar">
        {toolbar.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.action}
              type="button"
              className="rich-tool"
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
          className="rich-preview"
          dangerouslySetInnerHTML={{ __html: value || "<p>Nothing to preview yet.</p>" }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          className="textarea rich-textarea"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Write article content. Use the toolbar for bold, italic, underline, lists, links, quotes and alignment."
        />
      )}
    </div>
  );
}
