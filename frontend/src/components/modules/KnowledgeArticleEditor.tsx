"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { getKnowledgeBaseArticle } from "@/lib/knowledge-base";
import { RichTextEditor } from "./RichTextEditor";

type ArticleStatus = "Draft" | "Published" | "Unpublished";

export function KnowledgeArticleEditor({ id }: { id: string }) {
  const router = useRouter();
  const article = useMemo(() => getKnowledgeBaseArticle(id), [id]);
  const [status, setStatus] = useState<ArticleStatus>(
    article.status === "Published" ? "Published" : "Draft"
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  function handleDelete() {
    const ok = window.confirm(
      "Delete this article? This is a frontend preview action until backend delete is connected."
    );

    if (ok) {
      router.push("/admin/knowledge-base");
    }
  }

  function togglePublishStatus() {
    setStatus((current) => (current === "Published" ? "Unpublished" : "Published"));
  }

  return (
    <main className="page-container">
      <PageHeader
        title={`Edit: ${article.title}`}
        description="Edit article content, publish status, category, visibility and support metadata."
        actions={
          <>
            <Button href="/admin/knowledge-base" variant="secondary">
              <ArrowLeft size={16} />
              Back
            </Button>

            <button
              type="button"
              className="button secondary"
              onClick={() => setPreviewOpen((current) => !current)}
            >
              <Eye size={16} />
              Preview
            </button>

            <button
              type="button"
              className="button secondary"
              onClick={togglePublishStatus}
            >
              {status === "Published" ? <EyeOff size={16} /> : <Eye size={16} />}
              {status === "Published" ? "Unpublish" : "Publish"}
            </button>

            <button type="button" className="button danger" onClick={handleDelete}>
              <Trash2 size={16} />
              Delete
            </button>

            <button type="button" className="button">
              Save Article
            </button>
          </>
        }
      />

      {previewOpen ? (
        <Card padded>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Preview</p>
              <h2>{article.title}</h2>
              <p>{article.excerpt}</p>
            </div>
          </div>

          <article
            className="kb-article-body"
            dangerouslySetInnerHTML={{ __html: article.htmlContent }}
          />
        </Card>
      ) : null}

      <div className="grid cols-2">
        <Card padded>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Article Editor</p>
              <h2>Content</h2>
            </div>
          </div>

          <div className="form-grid">
            <FormField label="Title" value={article.title} />
            <FormField label="Category" value={article.category} />
            <FormField
              label="Status"
              as="select"
              options={["Draft", "Published", "Unpublished"]}
              value={status}
            />
            <FormField
              label="Visibility"
              as="select"
              options={["Client", "Staff", "Public", "Internal"]}
              value={article.visibility}
            />
            <FormField label="Excerpt" as="textarea" value={article.excerpt} />
          </div>

          <div style={{ marginTop: 18 }}>
            <RichTextEditor label="Article Content" initialValue={article.htmlContent} />
          </div>
        </Card>

        <Card padded>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Performance</p>
              <h2>Article Stats</h2>
              <p>These values will later sync from the Django knowledge base API.</p>
            </div>
          </div>

          <div className="info-grid">
            <div>
              <span>Views</span>
              <strong>{article.views}</strong>
            </div>
            <div>
              <span>Likes</span>
              <strong>{article.likes}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{status}</strong>
            </div>
            <div>
              <span>Category</span>
              <strong>{article.category}</strong>
            </div>
          </div>

          <div className="notice" style={{ marginTop: 18 }}>
            Backend endpoints needed: GET/PATCH/DELETE /api/v1/admin/knowledge-base/{"{id}"}/ and PATCH publish/unpublish actions.
          </div>
        </Card>
      </div>
    </main>
  );
}
