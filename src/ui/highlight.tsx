import type { ReactNode } from "react";

/**
 * Code in colour, like an editor (owner, 2026-10-21). Covers what AMNT shows:
 * shell (curl, npm, claude mcp), JSON, JS/TS, and SVG/HTML. Plain regexes,
 * no dependency, works on the server. Colours: `.tok-*` in ui.css, GitHub's
 * own light and dark editor palette.
 *
 * ponytail: a tokenizer, not a parser - a regex inside a template string can
 * colour wrong. Add a real grammar (shiki) only if a page shows code that
 * this gets visibly wrong.
 */
export type CodeLang = "shell" | "json" | "js" | "markup" | "text";

type Rule = [kind: string | ((m: RegExpExecArray) => string | null), pattern: string];

const KEYWORDS = "const|let|var|function|return|if|else|for|while|import|from|export|default|await|async|new|class|extends|typeof|of|in|try|catch|throw|type|interface";

const RULES: Record<Exclude<CodeLang, "text">, Rule[]> = {
    shell: [
        ["com", String.raw`(?<=^|\s)#.*$`],
        ["str", String.raw`"(?:\\.|[^"\\])*"|'[^']*'`],
        ["key", String.raw`(?<=^|\s)--?[A-Za-z][\w-]*`],
        ["num", String.raw`\$\{?\w+\}?`],
        ["fn", String.raw`(?<=^\s*)[\w./@-]+`],
        ["prop", String.raw`https?:\/\/[^\s'"\\]+`],
    ],
    json: [
        [(m) => (/^\s*:/.test(m.input.slice(m.index + m[0].length)) ? "prop" : "str"), String.raw`"(?:\\.|[^"\\])*"`],
        ["num", String.raw`\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b`],
    ],
    js: [
        ["com", String.raw`\/\/.*$|\/\*[\s\S]*?\*\/`],
        ["str", String.raw`"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\x60(?:\\.|[^\x60\\])*\x60`],
        ["key", String.raw`\b(?:${KEYWORDS})\b`],
        ["num", String.raw`\b(?:true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b`],
        ["fn", String.raw`[A-Za-z_$][\w$]*(?=\s*\()`],
        ["prop", String.raw`[A-Za-z_$][\w$]*(?=\s*:)`],
    ],
    markup: [
        ["com", String.raw`<!--[\s\S]*?-->`],
        ["tag", String.raw`(?<=<\/?)[\w:-]+`],
        ["str", String.raw`"[^"]*"|'[^']*'`],
        ["prop", String.raw`[\w:-]+(?==)`],
        ["com", String.raw`<\/?|\/?>`],
    ],
};

/** Best guess from the text itself, so most call sites never pass `lang`. */
export function guessLang(code: string): CodeLang {
    const t = code.trimStart();
    if (t.startsWith("<")) return "markup";
    if (/^[[{]/.test(t)) {
        try { JSON.parse(t); return "json"; } catch { /* not JSON: fall through */ }
    }
    if (/^(?:\$ |curl |npm |npx |pnpm |yarn |claude |pip |git |export |cd |brew |#!)/.test(t)) return "shell";
    if (/\b(?:const|let|function|import|export|await)\b|=>/.test(t)) return "js";
    if (/^[[{]/.test(t)) return "js";
    return "text";
}

export function highlight(code: string, lang: CodeLang = guessLang(code)): ReactNode {
    if (lang === "text") return code;
    const rules = RULES[lang];
    const re = new RegExp(rules.map(([, p]) => `(${p})`).join("|"), "gm");
    const out: ReactNode[] = [];
    let last = 0;
    for (let m = re.exec(code); m; m = re.exec(code)) {
        if (m[0] === "") { re.lastIndex++; continue; }
        const i = m.slice(1).findIndex((g) => g !== undefined);
        const kind = rules[i][0];
        const cls = typeof kind === "function" ? kind(m) : kind;
        if (m.index > last) out.push(code.slice(last, m.index));
        out.push(cls ? <span key={m.index} className={`tok-${cls}`}>{m[0]}</span> : m[0]);
        last = m.index + m[0].length;
    }
    if (last < code.length) out.push(code.slice(last));
    return out;
}
