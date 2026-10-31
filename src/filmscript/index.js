import { parse } from './parse.js';
import { compile } from './compile.js';

/** One call: FilmScript text + assets -> { film, errors, warnings }. Errors/warnings: {line,col,message,severity}. */
export function compileSource(source, assets, opts) {
  const { ast, errors: parseErrors } = parse(source);
  if (parseErrors.length) {
    // still try to compile what parsed, so the editor can show semantic errors too
    const r = compile(ast, assets, opts);
    return { film: null, errors: [...parseErrors, ...r.errors].sort((a, b) => a.line - b.line), warnings: r.warnings };
  }
  const r = compile(ast, assets, opts);
  r.errors.sort((a, b) => a.line - b.line);
  return r;
}

export { parse, compile };
