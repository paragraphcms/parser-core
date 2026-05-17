import type { MarkedOptions } from "marked";
import type sanitizeHtml from "sanitize-html";

export type ParagraphContentFormat = "markdown" | "html" | "tiptap";

export type ParagraphTiptapMark = {
  type?: string;
  attrs?: Record<string, unknown>;
};

export type ParagraphTiptapNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: ParagraphTiptapMark[];
  content?: ParagraphTiptapNode[];
};

export type ParagraphPageContent = string | ParagraphTiptapNode[];

export type ParagraphDataModelField =
  | {
      id: string;
      label: string;
      description?: string;
      type: "text";
      isLongText?: boolean;
      minLength?: number;
    }
  | {
      id: string;
      label: string;
      description?: string;
      type: "number";
      min?: number;
      max?: number;
    }
  | {
      id: string;
      label: string;
      description?: string;
      type: "boolean";
    }
  | {
      id: string;
      label: string;
      description?: string;
      type: "date" | "datetime";
      format?: string;
    }
  | {
      id: string;
      label: string;
      description?: string;
      type: "select" | "multi-select";
      options?: string[];
    }
  | {
      id: string;
      label: string;
      description?: string;
      type: "currency";
      currency?: string;
    }
  | {
      id: string;
      label: string;
      description?: string;
      type: "link";
    };

export type ParagraphMember = {
  id: string;
  user_id: string;
  role: string;
  name: string | null;
  email: string | null;
  image_url: string | null;
  created_at: string | null;
};

export type ParagraphStatus = {
  id: string;
  name: string;
  color: string;
  type: string;
  description: string | null;
  order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type ParagraphLabel = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  order: number;
  created_at: string | null;
  last_applied_at: string | null;
};

export type ParagraphDataModel = {
  id: string;
  name: string;
  description: string | null;
  fields: ParagraphDataModelField[];
  created_at: string | null;
  updated_at: string | null;
};

export type ParagraphCollection = {
  id: string;
  name: string;
  description: string | null;
  default_data_model_id: string | null;
  default_data_model: ParagraphDataModel | null;
  team_ids: string[];
  page_count: number;
  last_modified_at: string | null;
};

export type ParagraphPageTranslation = {
  id: string;
  title: string;
  language: string;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_current: boolean;
};

export type ParagraphRenderablePage<TFields = Record<string, unknown>> = {
  content_format?: ParagraphContentFormat | null;
  content?: ParagraphPageContent;
  fields?: TFields;
};

export type ParagraphPageSummary<TFields = Record<string, unknown>> = {
  id: string;
  title: string;
  slug: string | null;
  language: string;
  content_format?: ParagraphContentFormat | null;
  hero_url: string | null;
  collection_id: string | null;
  collection: ParagraphCollection | null;
  translation_group_id: string;
  data_model_id: string | null;
  data_model: ParagraphDataModel | null;
  status_id: string | null;
  status: ParagraphStatus | null;
  author_id: string | null;
  author: ParagraphMember | null;
  reviewer_id: string | null;
  reviewer: ParagraphMember | null;
  labels: ParagraphLabel[];
  fields: TFields;
  content?: ParagraphPageContent;
  meta_name: string | null;
  meta_description: string | null;
  published_at: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ParagraphPage<TFields = Record<string, unknown>> =
  ParagraphPageSummary<TFields> & {
    content: ParagraphPageContent;
    translations: ParagraphPageTranslation[];
  };

export type ParagraphComponentSlot =
  | "root"
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "a"
  | "strong"
  | "em"
  | "u"
  | "s"
  | "blockquote"
  | "code"
  | "pre"
  | "ul"
  | "ol"
  | "li"
  | "hr"
  | "br"
  | "img"
  | "figure"
  | "figcaption"
  | "imageMeta"
  | "imageSlug"
  | "imageAlt"
  | "table"
  | "thead"
  | "tbody"
  | "tr"
  | "th"
  | "td"
  | "faq"
  | "collapsible"
  | "summary"
  | "collapsibleContent"
  | "taskList"
  | "taskItem"
  | "taskCheckbox";

export type ParagraphClassNames = Partial<
  Record<ParagraphComponentSlot, string>
>;

export type ParagraphRenderOptions = {
  classNames?: ParagraphClassNames;
  markedOptions?: MarkedOptions;
  sanitizeOptions?: sanitizeHtml.IOptions;
  unstyled?: boolean;
};

export type ParagraphContentInput<TFields = Record<string, unknown>> = {
  page?: ParagraphRenderablePage<TFields> | null;
  content?: ParagraphPageContent | null;
  contentFormat?: ParagraphContentFormat | null;
};

export type ParagraphHtmlRenderInput<TFields = Record<string, unknown>> =
  ParagraphContentInput<TFields> & ParagraphRenderOptions;
