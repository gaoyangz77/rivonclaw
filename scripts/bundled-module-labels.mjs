import ts from "typescript";

// esbuild's CommonJS wrapper uses a source path as a method name. The method
// body is bundled code, not a runtime read of that path.
export function bundledModuleLabelRanges(content) {
  const source = ts.createSourceFile(
    "bundle.js",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const ranges = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "__commonJS" &&
      node.arguments.length === 1 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const property of node.arguments[0].properties) {
        if (ts.isMethodDeclaration(property) && ts.isStringLiteral(property.name)) {
          ranges.push({ start: property.name.getStart(source), end: property.name.getEnd() });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return ranges;
}
