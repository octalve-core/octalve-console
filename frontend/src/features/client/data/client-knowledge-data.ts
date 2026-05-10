export type ClientKnowledgeArticle = {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  content: string;
  actionHref: string;
};

export const clientKnowledgeArticles: ClientKnowledgeArticle[] = [];