/**
 * Every `<img>` in a document as an attribute map, in source order.
 * @param html - A rendered page
 * @returns One object per `<img>`, attribute name to value
 */
export function imgTags(html: string): Record<string, string>[] {
    return html
        .matchAll(/<img\b([^>]*)>/g)
        .map(([, attributes = ""]) =>
            Object.fromEntries(
                attributes
                    .matchAll(/([\w:-]+)="([^"]*)"/g)
                    .map(([, key = "", value = ""]): [string, string] => [
                        key,
                        value
                    ])
            )
        )
        .toArray();
}
