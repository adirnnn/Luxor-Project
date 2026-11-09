import type { List, ListItem, Nodes, Paragraph, PhrasingContent, Root, RootContent, Table } from "mdast";

// El modelo a veces responde con una tabla (producto | marca | precio | descripción). En la burbuja
// del chat, que es angosta, las columnas no caben y las palabras se parten letra por letra. Este
// complemento de remark cambia cada tabla por una tarjeta por fila: la primera columna como título
// y las demás como "Encabezado: valor". Funciona con cualquier tabla, sin depender del prompt.

const textOf = (node: Nodes): string => {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node) return (node.children as Nodes[]).map(textOf).join("");
  return "";
};

const hasText = (cell: PhrasingContent[]) => cell.some((node) => textOf(node).trim() !== "");

function tableToNodes(table: Table): RootContent[] {
  const [headerRow, ...rows] = table.children;
  if (!headerRow) return [];
  const headers = headerRow.children.map((cell) => textOf(cell).trim());

  // sin filas de datos (solo encabezados): se muestran los encabezados como una lista
  if (rows.length === 0) {
    const items: ListItem[] = headerRow.children
      .filter((cell) => hasText(cell.children))
      .map((cell) => ({ type: "listItem", spread: false, children: [{ type: "paragraph", children: cell.children }] }));
    return items.length ? [{ type: "list", ordered: false, spread: false, children: items }] : [];
  }

  const nodes: RootContent[] = [];
  for (const row of rows) {
    const [first, ...rest] = row.children;
    if (first && hasText(first.children)) {
      const title: Paragraph = { type: "paragraph", children: [{ type: "strong", children: first.children }] };
      nodes.push(title);
    }

    const items: ListItem[] = rest
      .map((cell, index) => ({ cell, header: headers[index + 1] ?? "" }))
      .filter(({ cell }) => hasText(cell.children))
      .map(({ cell, header }) => ({
        type: "listItem",
        spread: false,
        children: [
          {
            type: "paragraph",
            children: header ? [{ type: "strong", children: [{ type: "text", value: `${header}:` }] }, { type: "text", value: " " }, ...cell.children] : cell.children,
          },
        ],
      }));
    if (items.length) {
      const list: List = { type: "list", ordered: false, spread: false, children: items };
      nodes.push(list);
    }
  }
  return nodes;
}

function transform(node: Nodes) {
  if (!("children" in node)) return;
  const children = node.children as Nodes[];
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (child.type === "table") {
      const replacement = tableToNodes(child);
      children.splice(i, 1, ...(replacement as Nodes[]));
      i += replacement.length - 1;
    } else {
      transform(child);
    }
  }
}

export function remarkTablesToLists() {
  return (tree: Root) => {
    transform(tree);
  };
}
