/** Marks a class string so Prettier's Tailwind plugin sorts it. */
export function tw(strings: TemplateStringsArray, ...values: unknown[]): string {
  return String.raw({ raw: strings }, ...values);
}
