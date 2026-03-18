const WIP_DRAFT_TITLE_RE = /^(\[?(WIP|DRAFT)\]?[\s\-:]+)/i;

export const isTitleDraft = (title: string): boolean =>
  WIP_DRAFT_TITLE_RE.test(title);
