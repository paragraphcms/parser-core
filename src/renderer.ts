import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { twMerge } from "tailwind-merge";
import {
  defaultParagraphClassNames,
  defaultParagraphMarkedOptions,
  defaultParagraphSanitizeOptions,
} from "./defaults.js";
import type {
  ParagraphClassNames,
  ParagraphComponentSlot,
  ParagraphContentFormat,
  ParagraphContentInput,
  ParagraphHtmlRenderInput,
  ParagraphPageContent,
  ParagraphRenderOptions,
  ParagraphTiptapMark,
  ParagraphTiptapNode,
} from "./types.js";

type ResolvedRenderOptions = {
  classNames: ParagraphClassNames;
  markedOptions: NonNullable<ParagraphRenderOptions["markedOptions"]>;
  sanitizeOptions: sanitizeHtml.IOptions;
  unstyled: boolean;
};

const SLOT_TAG_NAMES = new Set<ParagraphComponentSlot>([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "strong",
  "em",
  "u",
  "s",
  "blockquote",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "hr",
  "br",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);

const HTML_ESCAPE_TABLE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function resolveRenderOptions(
  options: ParagraphRenderOptions = {},
): ResolvedRenderOptions {
  return {
    classNames: options.classNames ?? {},
    markedOptions: {
      ...defaultParagraphMarkedOptions,
      ...(options.markedOptions ?? {}),
      async: false,
    },
    sanitizeOptions: {
      ...defaultParagraphSanitizeOptions,
      ...(options.sanitizeOptions ?? {}),
      allowedAttributes: {
        ...defaultParagraphSanitizeOptions.allowedAttributes,
        ...(options.sanitizeOptions?.allowedAttributes ?? {}),
      },
    },
    unstyled: Boolean(options.unstyled),
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPE_TABLE[character] ?? character,
  );
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function clampHeadingLevel(value: unknown) {
  const level = toNumber(value) ?? 2;
  return Math.max(1, Math.min(6, level));
}

function normalizeTagName(tagName: string | undefined) {
  return typeof tagName === "string" &&
    /^[a-z][a-z0-9:-]*$/i.test(tagName)
    ? tagName
    : "article";
}

export function resolveParagraphContentInput<
  TFields = Record<string, unknown>,
>(input: ParagraphContentInput<TFields>) {
  const content =
    input.page?.content !== undefined ? input.page.content : input.content;
  const contentFormat =
    input.page?.content_format ?? input.contentFormat ?? null;

  return {
    content: content ?? null,
    contentFormat,
  };
}

export function inferParagraphContentFormat(
  content: ParagraphPageContent,
  explicitFormat: ParagraphContentFormat | null = null,
): ParagraphContentFormat {
  if (explicitFormat) {
    return explicitFormat;
  }

  if (Array.isArray(content)) {
    return "tiptap";
  }

  return /<([a-z][\w:-]*)(?:\s[^>]*)?>/i.test(content)
    ? "html"
    : "markdown";
}

export function resolveParagraphSlotClassName(
  slot: ParagraphComponentSlot,
  className: string | undefined,
  options: ParagraphRenderOptions = {},
) {
  const resolvedOptions = resolveRenderOptions(options);

  return twMerge(
    resolvedOptions.unstyled ? undefined : defaultParagraphClassNames[slot],
    resolvedOptions.classNames[slot],
    className,
  );
}

export function resolveParagraphRootClassName(
  className: string | undefined,
  options: ParagraphRenderOptions = {},
) {
  return resolveParagraphSlotClassName("root", className, options);
}

function renderAttributes(
  attributes: Record<string, string | number | boolean | undefined>,
) {
  const parts: string[] = [];

  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) {
      continue;
    }

    if (value === true) {
      parts.push(` ${name}`);
      continue;
    }

    parts.push(` ${name}="${escapeAttribute(String(value))}"`);
  }

  return parts.join("");
}

function wrapTag(
  tagName: string,
  attributes: Record<string, string | number | boolean | undefined>,
  content: string,
) {
  return `<${tagName}${renderAttributes(attributes)}>${content}</${tagName}>`;
}

function selfClosingTag(
  tagName: string,
  attributes: Record<string, string | number | boolean | undefined>,
) {
  return `<${tagName}${renderAttributes(attributes)} />`;
}

function renderTextNode(node: ParagraphTiptapNode) {
  return escapeHtml(typeof node.text === "string" ? node.text : "");
}

function renderMark(mark: ParagraphTiptapMark, children: string) {
  const attrs = mark.attrs ?? {};

  switch (mark.type) {
    case "bold":
      return wrapTag("strong", {}, children);
    case "italic":
      return wrapTag("em", {}, children);
    case "underline":
      return wrapTag("u", {}, children);
    case "strike":
      return wrapTag("s", {}, children);
    case "code":
      return wrapTag("code", {}, children);
    case "link": {
      const target = toStringValue(attrs.target);
      const rel = toStringValue(attrs.rel);

      return wrapTag(
        "a",
        {
          href: toStringValue(attrs.href),
          target,
          rel:
            target === "_blank" && !rel
              ? "noopener noreferrer"
              : rel,
          title: toStringValue(attrs.title),
        },
        children,
      );
    }
    default:
      return children;
  }
}

function renderImageMeta(slug: string | undefined, alt: string | undefined) {
  if (!slug && !alt) {
    return "";
  }

  return wrapTag(
    "div",
    {
      "data-type": "editor-image-meta",
    },
    [
      slug
        ? wrapTag(
            "div",
            {
              "data-type": "editor-image-slug",
            },
            escapeHtml(slug),
          )
        : "",
      alt
        ? wrapTag(
            "div",
            {
              "data-type": "editor-image-alt",
            },
            escapeHtml(alt),
          )
        : "",
    ].join(""),
  );
}

function renderImageNode(attrs: Record<string, unknown> | undefined) {
  const src = toStringValue(attrs?.src);

  if (!src) {
    return "";
  }

  const alt = toStringValue(attrs?.alt) ?? "";
  const imageHtml = selfClosingTag("img", {
    src,
    alt,
    title: toStringValue(attrs?.title),
    width: toNumber(attrs?.width),
    height: toNumber(attrs?.height),
    loading: "lazy",
  });
  const imageMeta = renderImageMeta(
    toStringValue(attrs?.slug),
    alt || undefined,
  );

  if (!imageMeta) {
    return imageHtml;
  }

  return wrapTag(
    "div",
    {
      "data-type": "editor-image",
    },
    `${imageHtml}${imageMeta}`,
  );
}

function renderTiptapNodes(nodes: ParagraphTiptapNode[] | undefined): string {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return "";
  }

  return nodes.map((node) => renderTiptapNode(node)).join("");
}

function renderTiptapNode(node: ParagraphTiptapNode): string {
  if (typeof node !== "object" || node === null) {
    return "";
  }

  if (typeof node.text === "string") {
    let output = renderTextNode(node);

    for (const mark of node.marks ?? []) {
      output = renderMark(mark, output);
    }

    return output;
  }

  const children = renderTiptapNodes(node.content);
  const attrs = node.attrs ?? {};
  const type = node.type ?? "unknown";

  switch (type) {
    case "doc":
      return children;
    case "paragraph":
      return wrapTag("p", {}, children);
    case "heading": {
      const level = clampHeadingLevel(attrs.level);
      return wrapTag(`h${level}`, {}, children);
    }
    case "blockquote":
      return wrapTag("blockquote", {}, children);
    case "bulletList":
      return wrapTag("ul", {}, children);
    case "orderedList":
      return wrapTag(
        "ol",
        {
          start: toNumber(attrs.start),
        },
        children,
      );
    case "listItem":
      return wrapTag("li", {}, children);
    case "hardBreak":
      return "<br />";
    case "horizontalRule":
      return "<hr />";
    case "codeBlock":
      return wrapTag(
        "pre",
        {},
        wrapTag(
          "code",
          {
            "data-language": toStringValue(attrs.language),
          },
          children,
        ),
      );
    case "image":
      return renderImageNode(attrs);
    case "table":
      return wrapTag("table", {}, children);
    case "tableRow":
      return wrapTag("tr", {}, children);
    case "tableHeader":
      return wrapTag(
        "th",
        {
          colspan: toNumber(attrs.colspan),
          rowspan: toNumber(attrs.rowspan),
        },
        children,
      );
    case "tableCell":
      return wrapTag(
        "td",
        {
          colspan: toNumber(attrs.colspan),
          rowspan: toNumber(attrs.rowspan),
        },
        children,
      );
    case "taskList":
      return wrapTag(
        "ul",
        {
          "data-type": "taskList",
        },
        children,
      );
    case "taskItem": {
      const checked = Boolean(attrs.checked);

      return wrapTag(
        "li",
        {
          "data-checked": checked ? "true" : "false",
        },
        [
          selfClosingTag("input", {
            type: "checkbox",
            checked,
            disabled: true,
            readonly: true,
          }),
          wrapTag("div", {}, children),
        ].join(""),
      );
    }
    case "faq":
      return wrapTag(
        "section",
        {
          "data-type": "faq",
        },
        children,
      );
    case "collapsible": {
      const summary =
        toStringValue(attrs.summary) ??
        (attrs.variant === "faq" ? "Question" : "Toggle");

      return wrapTag(
        "details",
        {
          open: Boolean(attrs.open),
          "data-type": "collapsible",
          "data-variant": toStringValue(attrs.variant),
        },
        [
          wrapTag("summary", {}, escapeHtml(summary)),
          wrapTag(
            "div",
            {
              "data-type": "paragraph-collapsible-content",
            },
            children,
          ),
        ].join(""),
      );
    }
    default:
      return children;
  }
}

function withClassName(
  attributes: sanitizeHtml.Attributes,
  className: string | undefined,
) {
  const nextAttributes: sanitizeHtml.Attributes = { ...attributes };

  if (className) {
    nextAttributes.class = className;
  } else {
    delete nextAttributes.class;
  }

  return nextAttributes;
}

function transformSlot(
  tagName: string,
  attributes: sanitizeHtml.Attributes,
  slot: ParagraphComponentSlot,
  options: ResolvedRenderOptions,
  nextTagName: string = tagName,
) {
  const nextAttributes = withClassName(
    attributes,
    twMerge(
      options.unstyled ? undefined : defaultParagraphClassNames[slot],
      options.classNames[slot],
      attributes.class,
    ),
  );

  if (slot === "a") {
    const target =
      typeof nextAttributes.target === "string"
        ? nextAttributes.target
        : undefined;
    const rel =
      typeof nextAttributes.rel === "string" ? nextAttributes.rel : "";

    if (target === "_blank" && !rel.includes("noopener")) {
      nextAttributes.rel = rel
        ? `${rel} noopener noreferrer`
        : "noopener noreferrer";
    }
  }

  if (slot === "taskCheckbox") {
    nextAttributes.readonly = "readonly";
    nextAttributes.disabled = "disabled";
  }

  return {
    tagName: nextTagName,
    attribs: nextAttributes,
  };
}

function createBaseTransformTags(options: ResolvedRenderOptions) {
  const transformTags: NonNullable<sanitizeHtml.IOptions["transformTags"]> = {
    a: (tagName, attribs) => transformSlot(tagName, attribs, "a", options),
    p: (tagName, attribs) => transformSlot(tagName, attribs, "p", options),
    h1: (tagName, attribs) => transformSlot(tagName, attribs, "h1", options),
    h2: (tagName, attribs) => transformSlot(tagName, attribs, "h2", options),
    h3: (tagName, attribs) => transformSlot(tagName, attribs, "h3", options),
    h4: (tagName, attribs) => transformSlot(tagName, attribs, "h4", options),
    h5: (tagName, attribs) => transformSlot(tagName, attribs, "h5", options),
    h6: (tagName, attribs) => transformSlot(tagName, attribs, "h6", options),
    strong: (tagName, attribs) =>
      transformSlot(tagName, attribs, "strong", options),
    em: (tagName, attribs) => transformSlot(tagName, attribs, "em", options),
    u: (tagName, attribs) => transformSlot(tagName, attribs, "u", options),
    s: (tagName, attribs) => transformSlot(tagName, attribs, "s", options),
    blockquote: (tagName, attribs) =>
      transformSlot(tagName, attribs, "blockquote", options),
    code: (tagName, attribs) => transformSlot(tagName, attribs, "code", options),
    pre: (tagName, attribs) => transformSlot(tagName, attribs, "pre", options),
    ul: (tagName, attribs) =>
      transformSlot(
        tagName,
        attribs,
        attribs["data-type"] === "taskList" ? "taskList" : "ul",
        options,
      ),
    ol: (tagName, attribs) => transformSlot(tagName, attribs, "ol", options),
    li: (tagName, attribs) =>
      transformSlot(
        tagName,
        attribs,
        typeof attribs["data-checked"] === "string" ? "taskItem" : "li",
        options,
      ),
    hr: (tagName, attribs) => transformSlot(tagName, attribs, "hr", options),
    br: (tagName, attribs) => transformSlot(tagName, attribs, "br", options),
    img: (tagName, attribs) => transformSlot(tagName, attribs, "img", options),
    figure: (tagName, attribs) =>
      transformSlot(tagName, attribs, "figure", options),
    figcaption: (tagName, attribs) =>
      transformSlot(tagName, attribs, "figcaption", options),
    section: (tagName, attribs) =>
      attribs["data-type"] === "faq"
        ? transformSlot(tagName, attribs, "faq", options)
        : { tagName, attribs },
    details: (tagName, attribs) =>
      attribs["data-type"] === "collapsible"
        ? transformSlot(tagName, attribs, "collapsible", options)
        : { tagName, attribs },
    summary: (tagName, attribs) =>
      transformSlot(tagName, attribs, "summary", options),
    div: (tagName, attribs) => {
      switch (attribs["data-type"]) {
        case "editor-image":
          return transformSlot(tagName, attribs, "figure", options, "figure");
        case "editor-image-meta":
          return transformSlot(tagName, attribs, "imageMeta", options);
        case "editor-image-slug":
          return transformSlot(tagName, attribs, "imageSlug", options, "span");
        case "editor-image-alt":
          return transformSlot(tagName, attribs, "imageAlt", options, "span");
        case "paragraph-collapsible-content":
          return transformSlot(
            tagName,
            attribs,
            "collapsibleContent",
            options,
          );
        default:
          return { tagName, attribs };
      }
    },
    table: (tagName, attribs) =>
      transformSlot(tagName, attribs, "table", options),
    thead: (tagName, attribs) =>
      transformSlot(tagName, attribs, "thead", options),
    tbody: (tagName, attribs) =>
      transformSlot(tagName, attribs, "tbody", options),
    tr: (tagName, attribs) => transformSlot(tagName, attribs, "tr", options),
    th: (tagName, attribs) => transformSlot(tagName, attribs, "th", options),
    td: (tagName, attribs) => transformSlot(tagName, attribs, "td", options),
    input: (tagName, attribs) =>
      typeof attribs.type === "string" &&
      attribs.type.toLowerCase() === "checkbox"
        ? transformSlot(tagName, attribs, "taskCheckbox", options)
        : { tagName, attribs },
  };

  return transformTags;
}

function sanitizeMarkup(html: string, options: ResolvedRenderOptions) {
  const customTransformTags = options.sanitizeOptions.transformTags ?? {};

  return sanitizeHtml(html, {
    ...options.sanitizeOptions,
    transformTags: {
      ...createBaseTransformTags(options),
      ...customTransformTags,
    },
  });
}

function renderHtml(html: string, options: ResolvedRenderOptions) {
  return sanitizeMarkup(html, options);
}

function renderMarkdown(markdown: string, options: ResolvedRenderOptions) {
  const html = marked.parse(markdown, options.markedOptions);
  return renderHtml(typeof html === "string" ? html : "", options);
}

export function renderResolvedParagraphContentHtml(
  input: {
    content: ParagraphPageContent;
    contentFormat?: ParagraphContentFormat | null;
  } & ParagraphRenderOptions,
) {
  const options = resolveRenderOptions(input);
  const contentFormat = inferParagraphContentFormat(
    input.content,
    input.contentFormat ?? null,
  );

  switch (contentFormat) {
    case "markdown":
      return renderMarkdown(
        typeof input.content === "string" ? input.content : "",
        options,
      );
    case "html":
      return renderHtml(
        typeof input.content === "string" ? input.content : "",
        options,
      );
    case "tiptap":
      return renderHtml(
        renderTiptapNodes(Array.isArray(input.content) ? input.content : []),
        options,
      );
    default:
      return "";
  }
}

export function renderParagraphContentHtml<
  TFields = Record<string, unknown>,
>(input: ParagraphHtmlRenderInput<TFields>) {
  const resolvedInput = resolveParagraphContentInput(input);

  if (resolvedInput.content === null) {
    return null;
  }

  return renderResolvedParagraphContentHtml({
    content: resolvedInput.content,
    contentFormat: resolvedInput.contentFormat,
    classNames: input.classNames,
    markedOptions: input.markedOptions,
    sanitizeOptions: input.sanitizeOptions,
    unstyled: input.unstyled,
  });
}

export function renderParagraphDocumentHtml<
  TFields = Record<string, unknown>,
>(
  input: ParagraphHtmlRenderInput<TFields> & {
    as?: string;
    className?: string;
  },
) {
  const contentHtml = renderParagraphContentHtml(input);

  if (contentHtml === null) {
    return null;
  }

  const className = resolveParagraphRootClassName(input.className, input);

  return wrapTag(
    normalizeTagName(input.as),
    {
      class: className,
    },
    contentHtml,
  );
}

export function isParagraphComponentSlot(value: string): value is ParagraphComponentSlot {
  return SLOT_TAG_NAMES.has(value as ParagraphComponentSlot);
}
