// Exportación de resultados en el modo demostración (sin API): Excel (.xlsx real, generado en el navegador)
// y PDF (reporte imprimible que el navegador guarda como PDF). Con la API, los archivos los genera el servidor.

const escaparXml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- ZIP sin compresión (método «store»), suficiente para un .xlsx pequeño ----------
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function crearZip(archivos) {
  const codificador = new TextEncoder();
  const partes = [];
  const central = [];
  let desplazamiento = 0;
  archivos.forEach(({ nombre, contenido }) => {
    const nombreBytes = codificador.encode(nombre);
    const datos = codificador.encode(contenido);
    const crc = crc32(datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint32(14, crc, true);
    local.setUint32(18, datos.length, true);
    local.setUint32(22, datos.length, true);
    local.setUint16(26, nombreBytes.length, true);
    partes.push(new Uint8Array(local.buffer), nombreBytes, datos);

    const cabecera = new DataView(new ArrayBuffer(46));
    cabecera.setUint32(0, 0x02014b50, true);
    cabecera.setUint16(4, 20, true);
    cabecera.setUint16(6, 20, true);
    cabecera.setUint16(8, 0x0800, true);
    cabecera.setUint32(16, crc, true);
    cabecera.setUint32(20, datos.length, true);
    cabecera.setUint32(24, datos.length, true);
    cabecera.setUint16(28, nombreBytes.length, true);
    cabecera.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(cabecera.buffer), nombreBytes);
    desplazamiento += 30 + nombreBytes.length + datos.length;
  });
  const tamanoCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamanoCentral, true);
  fin.setUint32(16, desplazamiento, true);
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function descargarBlob(nombre, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Hoja de Excel con el encabezado (pares etiqueta/valor) y la tabla de resultados. Los textos nunca son fórmulas. */
export function descargarExcel(nombre, { encabezado, filas, total }) {
  const columna = (i) => 'ABCD'[i];
  let fila = 0;
  const xmlFilas = [];
  const celda = (i, valor, estilo = 0) => {
    const ref = `${columna(i)}${fila}`;
    const s = estilo ? ` s="${estilo}"` : '';
    if (typeof valor === 'number') return `<c r="${ref}"${s}><v>${valor}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
  };
  const agregar = (celdas) => {
    fila += 1;
    xmlFilas.push(`<row r="${fila}">${celdas.join('')}</row>`);
  };
  agregar([celda(0, 'Resultados de la votación', 1)]);
  fila += 1;
  encabezado.forEach(([e, v]) => agregar([celda(0, e, 2), celda(1, v)]));
  fila += 1;
  agregar(['Posición', 'Opción', 'Votos', 'Porcentaje'].map((t, i) => celda(i, t, 3)));
  filas.forEach((f, i) => agregar([celda(0, i + 1), celda(1, f.nombre), celda(2, f.cantidad), celda(3, f.porcentaje / 100, 4)]));
  agregar([celda(1, 'Total', 2), celda(2, total, 2), celda(3, total ? 1 : 0, 5)]);

  const hoja = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="2" width="48" customWidth="1"/><col min="3" max="3" width="12" customWidth="1"/><col min="4" max="4" width="14" customWidth="1"/></cols><sheetData>${xmlFilas.join('')}</sheetData></worksheet>`;
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.00%"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FFDD3333"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF000000"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="6"><xf/><xf fontId="1" applyFont="1"/><xf fontId="2" applyFont="1"/><xf fontId="3" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="164" fontId="2" applyNumberFormat="1" applyFont="1"/></cellXfs></styleSheet>`;
  const archivos = [
    { nombre: '[Content_Types].xml', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { nombre: '_rels/.rels', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { nombre: 'xl/workbook.xml', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Resultados" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { nombre: 'xl/_rels/workbook.xml.rels', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { nombre: 'xl/worksheets/sheet1.xml', contenido: hoja },
    { nombre: 'xl/styles.xml', contenido: estilos },
  ];
  descargarBlob(nombre, crearZip(archivos));
}

/**
 * Reporte imprimible en una ventana nueva: el diálogo de impresión permite «Guardar como PDF».
 * Devuelve false si el navegador bloqueó la ventana emergente.
 */
export function imprimirPdf(titulo, { encabezado, filas, total }) {
  const ventana = window.open('', '_blank');
  if (!ventana) return false;
  const pct = (n) => `${n.toFixed(2).replace('.', ',')} %`;
  const maximo = filas[0]?.cantidad || 0;
  ventana.document.write(`<!doctype html><html lang="es-CO"><head><meta charset="utf-8"><title>${escaparXml(titulo)}</title>
<style>
  body { font-family: Poppins, system-ui, sans-serif; color: #222; margin: 2cm; }
  h1 { color: #DD3333; font-family: Raleway, Poppins, sans-serif; font-size: 1.6rem; margin: 0 0 1rem; }
  dl { display: grid; grid-template-columns: 9rem 1fr; gap: .2rem .8rem; margin: 0 0 1.5rem; font-size: .9rem; }
  dt { font-weight: 700; }
  dd { margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  th { background: #000; color: #D7AC70; text-align: left; padding: .45rem .6rem; }
  td { padding: .45rem .6rem; border-bottom: 1px solid #e9e9e9; }
  td.n, th.n { text-align: right; }
  tr.lider td { background: #FCE6CC; }
  tfoot td { font-weight: 700; border-top: 2px solid #000; border-bottom: 0; }
  .nota { color: #555; font-size: .75rem; margin-top: 1.5rem; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>
<h1>Resultados de la votación</h1>
<dl>${encabezado.map(([e, v]) => `<dt>${escaparXml(e)}</dt><dd>${escaparXml(v)}</dd>`).join('')}</dl>
<table><thead><tr><th>Posición</th><th>Opción</th><th class="n">Votos</th><th class="n">Porcentaje</th></tr></thead><tbody>
${filas.map((f, i) => `<tr${total && f.cantidad === maximo ? ' class="lider"' : ''}><td>${i + 1}</td><td>${escaparXml(f.nombre)}</td><td class="n">${f.cantidad}</td><td class="n">${pct(f.porcentaje)}</td></tr>`).join('')}
</tbody><tfoot><tr><td></td><td>Total</td><td class="n">${total}</td><td class="n">${pct(total ? 100 : 0)}</td></tr></tfoot></table>
<p class="nota">El voto es secreto: este reporte solo contiene conteos por opción, nunca quién votó por cuál.</p>
</body></html>`);
  ventana.document.close();
  ventana.focus();
  setTimeout(() => ventana.print(), 300);
  return true;
}
