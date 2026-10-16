// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { morph } from './morph';

function container(html: string): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = html;
  return element;
}

describe('morph', () => {
  it('keeps unchanged nodes in place while it updates attributes and appends a keyed row', () => {
    const target = container('<p>Day</p><div data-key="a" class="first">Hello</div>');
    const day = target.firstChild;
    const hello = target.querySelector('[data-key="a"]')!.firstChild;
    morph(target, '<p>Day</p><div data-key="a" class="last">Hello</div><div data-key="b">Hi</div>', 'data-key');
    expect(target.innerHTML).toBe('<p>Day</p><div data-key="a" class="last">Hello</div><div data-key="b">Hi</div>');
    expect(target.firstChild).toBe(day);
    expect(target.querySelector('[data-key="a"]')!.firstChild).toBe(hello);
  });

  it('replaces rows whose key no longer lines up and drops the rest', () => {
    const target = container('<div data-key="a">A</div><div data-key="b">B</div><p>end</p>');
    const a = target.firstChild;
    morph(target, '<div data-key="a">A</div><div data-key="c">C</div><span>end</span>', 'data-key');
    expect(target.innerHTML).toBe('<div data-key="a">A</div><div data-key="c">C</div><span>end</span>');
    expect(target.firstChild).toBe(a);
  });
});
