"use client";
import {useRef,useState} from "react";
import {Bold,Italic,Heading2,List,ListOrdered,Link2,Quote,Eye,Code2} from "lucide-react";
import type {ReactNode} from "react";

function inline(text:string):ReactNode[]{
  const pattern=/(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|\x60([^\x60]+)\x60)/g;
  const output:ReactNode[]=[]; let cursor=0,match:RegExpExecArray|null;let key=0;
  while((match=pattern.exec(text))!==null){
    if(match.index>cursor)output.push(text.slice(cursor,match.index));
    if(match[2]&&match[3]){
      try{const url=new URL(match[3]);if(["https:","http:"].includes(url.protocol))
        output.push(<a key={key++} href={url.toString()} rel="noopener noreferrer" target="_blank" className="font-medium text-[#0064E0] underline underline-offset-4">{match[2]}</a>);
      else output.push(match[2]);}catch{output.push(match[2]);}
    }else if(match[4])output.push(<strong key={key++} className="font-medium text-slate-900">{match[4]}</strong>);
    else if(match[5])output.push(<em key={key++}>{match[5]}</em>);
    else if(match[6])output.push(<code key={key++} className="rounded bg-slate-100 px-1 py-0.5 text-[.9em]">{match[6]}</code>);
    cursor=match.index+match[0].length;
  }
  if(cursor<text.length)output.push(text.slice(cursor));
  return output;
}
export function MarkdownArticle({body}:{body:string}){
  const lines=body.split(/\r?\n/);const blocks:ReactNode[]=[];let i=0;
  while(i<lines.length){
    const row=lines[i];const key=i;
    if(!row.trim()){i++;continue;}
    const heading=row.match(/^(#{1,3})\s+(.+)$/);
    if(heading){const title=inline(heading[2]);blocks.push(
      heading[1].length===1?<h2 key={key} className="mt-8 text-2xl font-medium tracking-tight text-slate-950">{title}</h2>:
      <h3 key={key} className="mt-7 text-xl font-medium text-slate-950">{title}</h3>);i++;continue;}
    if(/^>\s?/.test(row)){blocks.push(<blockquote key={key} className="my-5 border-l-4 border-blue-200 bg-blue-50/60 px-5 py-4 leading-7 text-slate-700">{inline(row.replace(/^>\s?/,""))}</blockquote>);i++;continue;}
    if(/^[-*]\s+/.test(row)||/^\d+[.]\s+/.test(row)){
      const ordered=/^\d+[.]\s+/.test(row),items:ReactNode[]=[];
      while(i<lines.length&&(ordered?/^\d+[.]\s+/.test(lines[i]):/^[-*]\s+/.test(lines[i]))){
        items.push(<li key={i}>{inline(lines[i].replace(ordered?/^\d+[.]\s+/:/^[-*]\s+/,""))}</li>);i++;
      }
      blocks.push(ordered?<ol key={key} className="my-4 list-decimal space-y-2 pl-6 leading-7">{items}</ol>:
        <ul key={key} className="my-4 list-disc space-y-2 pl-6 leading-7">{items}</ul>);continue;
    }
    const para=[row];i++;while(i<lines.length&&lines[i].trim()&&!/^(#{1,3}\s|>\s?|[-*]\s|\d+[.]\s)/.test(lines[i]))para.push(lines[i++]);
    blocks.push(<p key={key} className="my-4 leading-8 text-slate-700">{inline(para.join(" "))}</p>);
  }
  return <article className="min-w-0 break-words text-[15px] sm:text-base">{blocks}</article>;
}

type Props={value:string;onChange:(next:string)=>void;label?:string};
export function MarkdownEditor({value,onChange,label="Article content"}:Props){
  const ref=useRef<HTMLTextAreaElement>(null),[preview,setPreview]=useState(false);
  function insert(before:string,after="",placeholder="Text"){
    const box=ref.current;if(!box)return;
    const start=box.selectionStart,end=box.selectionEnd;
    const selected=value.slice(start,end)||placeholder;
    onChange(value.slice(0,start)+before+selected+after+value.slice(end));
    requestAnimationFrame(()=>{box.focus();box.setSelectionRange(start+before.length,start+before.length+selected.length);});
  }
  const items=[
    {title:"Bold",icon:Bold,run:()=>insert("**","**")},
    {title:"Italic",icon:Italic,run:()=>insert("*","*")},
    {title:"Heading",icon:Heading2,run:()=>insert("\n## ","\n","Section heading")},
    {title:"Bullet list",icon:List,run:()=>insert("\n- ","\n","List item")},
    {title:"Numbered list",icon:ListOrdered,run:()=>insert("\n1. ","\n","List item")},
    {title:"Quote",icon:Quote,run:()=>insert("\n> ","\n","Helpful note")},
    {title:"Link",icon:Link2,run:()=>insert("[","](https://example.com)","Link title")},
    {title:"Code",icon:Code2,run:()=>insert("\x60","\x60","code")},
  ];
  return <div>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <label htmlFor="knowledge-editor" className="text-sm font-medium text-slate-700">{label}</label>
      <button type="button" onClick={()=>setPreview(v=>!v)} aria-pressed={preview} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-[#0064E0]"><Eye className="h-4 w-4"/>{preview?"Edit":"Preview"}</button>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div role="toolbar" aria-label="Article formatting" className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
        {items.map(({title,icon:Icon,run})=><button key={title} type="button" title={title} aria-label={title} onClick={run} disabled={preview}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-[#0064E0] disabled:opacity-40"><Icon className="h-4 w-4"/></button>)}
      </div>
      {preview?<div className="min-h-72 px-5 py-4"><MarkdownArticle body={value||"Write your article to see a preview."}/></div>:
        <textarea id="knowledge-editor" ref={ref} required maxLength={100000} value={value}
          onChange={e=>onChange(e.target.value)} placeholder="Write a helpful step-by-step guide…"
          className="min-h-80 w-full resize-y border-0 bg-white px-5 py-4 text-sm leading-7 text-slate-900 outline-none"/>}
    </div>
    <p className="mt-2 text-xs text-slate-500">Use headings, bold, italics, bullets, numbered steps and safe links. Changes are saved only when you select Save.</p>
  </div>;
}
