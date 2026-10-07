/**
 * Structured data for search and answer engines.
 *
 * A plain script tag with JSON in it, which is all schema.org markup is. The
 * one thing that matters is the escaping: the text inside comes from the
 * dashboard, so a title containing `</script>` would otherwise close the tag
 * and let whatever follows run as page script. `<` is written as its unicode
 * escape, which JSON readers treat as the same character and HTML cannot
 * mistake for a tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
