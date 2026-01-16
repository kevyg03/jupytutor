import { Root } from 'remark-parse/lib';
import { visit } from 'unist-util-visit';

type Pos = {
  start?: { line: number; column: number; offset?: number };
  end?: { line: number; column: number; offset?: number };
};

type LinkLike = {
  kind: 'link' | 'image';
  url?: string; // for direct links/images
  title?: string | null; // for direct links/images
  altOrText?: string; // alt for image, visible text for link
  refId?: string; // for reference-style
  pos?: Pos;
};

function nodeText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  if (Array.isArray(node.children)) return node.children.map(nodeText).join('');
  return '';
}

export function extractLinksAndImages(tree: Root): LinkLike[] {
  const out: LinkLike[] = [];

  visit(tree, (node: any) => {
    if (node.type === 'link') {
      out.push({
        kind: 'link',
        url: node.url,
        title: node.title ?? null,
        altOrText: nodeText(node),
        pos: node.position
      });
      return;
    }

    if (node.type === 'image') {
      out.push({
        kind: 'image',
        url: node.url,
        title: node.title ?? null,
        altOrText: node.alt ?? '',
        pos: node.position
      });
      return;
    }

    // Reference-style links/images
    // - linkReference: [text][id] or [id]
    // - imageReference: ![alt][id]
    if (node.type === 'linkReference') {
      out.push({
        kind: 'link',
        refId: node.identifier, // normalized id
        altOrText: nodeText(node),
        pos: node.position
      });
      return;
    }

    if (node.type === 'imageReference') {
      out.push({
        kind: 'image',
        refId: node.identifier,
        altOrText: node.alt ?? '',
        pos: node.position
      });
      return;
    }
  });

  return out;
}
