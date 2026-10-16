/**
 * Updates `target`'s children in place to match `html`. A node that lines up with one of the same kind, and for an
 * element the same `keyAttribute` value, is kept and patched; anything else is replaced. Returns whether any node or text
 * changed, as opposed to attributes alone.
 */
export function morph(target: Element, html: string, keyAttribute: string): boolean {
  const template = document.createElement('template');
  template.innerHTML = html;
  return syncChildren(target, template.content, keyAttribute);
}

function keyOf(node: Node, keyAttribute: string): string | null {
  return node instanceof Element ? node.getAttribute(keyAttribute) : null;
}

function matches(existing: ChildNode | null, next: Node, keyAttribute: string): existing is ChildNode {
  if (!existing || existing.nodeType !== next.nodeType || existing.nodeName !== next.nodeName) return false;
  return keyOf(existing, keyAttribute) === keyOf(next, keyAttribute);
}

function syncChildren(from: Node, to: Node, keyAttribute: string): boolean {
  let changed = false;
  let cursor = from.firstChild;
  for (const next of [...to.childNodes]) {
    if (matches(cursor, next, keyAttribute)) {
      const existing = cursor;
      cursor = cursor.nextSibling;
      changed = patch(existing, next, keyAttribute) || changed;
    } else {
      from.insertBefore(next, cursor);
      changed = true;
    }
  }
  while (cursor) {
    const stale = cursor;
    cursor = cursor.nextSibling;
    stale.remove();
    changed = true;
  }
  return changed;
}

function patch(from: ChildNode, to: ChildNode, keyAttribute: string): boolean {
  if (!(from instanceof Element) || !(to instanceof Element)) {
    if (from.nodeValue === to.nodeValue) return false;
    from.nodeValue = to.nodeValue;
    return true;
  }
  for (const { name } of [...from.attributes]) {
    if (!to.hasAttribute(name)) from.removeAttribute(name);
  }
  for (const { name, value } of to.attributes) {
    if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  }
  return syncChildren(from, to, keyAttribute);
}
