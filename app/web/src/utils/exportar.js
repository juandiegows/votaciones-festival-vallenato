// Exportación de resultados en el modo demostración (sin API): Excel (.xlsx real, generado en el navegador), CSV,
// JSON, SQL y PDF (reporte imprimible que el navegador guarda como PDF). Con la API, los archivos los genera el servidor.

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

// ---------- Reporte genérico ----------
// reporte = { titulo, contexto: [[etiqueta, valor]], secciones: [{ edicion, categoria, votacion, estado, total,
//            filas: [{ nombre, cantidad, porcentaje }] }], nombreBase }

const COLUMNAS = ['Edición', 'Categoría', 'Votación', 'Estado', 'Posición', 'Opción', 'Votos', 'Porcentaje'];
const INICIO_FORMULA = /^[=+\-@\t\r]/;

const filasPlanas = (reporte) =>
  reporte.secciones.flatMap((s) => s.filas.map((f, i) => [s.edicion, s.categoria, s.votacion, s.estado, i + 1, f.nombre, f.cantidad, Number(f.porcentaje.toFixed(2))]));

function aExcel(reporte) {
  const letras = 'ABCDEFGH';
  let fila = 0;
  const xmlFilas = [];
  const celda = (i, valor, estilo = 0) => {
    const ref = `${letras[i]}${fila}`;
    const s = estilo ? ` s="${estilo}"` : '';
    if (typeof valor === 'number') return `<c r="${ref}"${s}><v>${valor}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
  };
  const agregar = (celdas) => {
    fila += 1;
    xmlFilas.push(`<row r="${fila}">${celdas.join('')}</row>`);
  };
  agregar([celda(0, reporte.titulo, 1)]);
  fila += 1;
  reporte.contexto.forEach(([e, v]) => agregar([celda(0, e, 2), celda(1, v)]));
  fila += 1;
  agregar(COLUMNAS.map((t, i) => celda(i, t, 3)));
  filasPlanas(reporte).forEach((valores) => agregar(valores.map((v, i) => (i === 7 ? celda(i, v / 100, 4) : celda(i, v)))));
  const anchos = [30, 22, 36, 12, 10, 44, 10, 12].map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const hoja = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${anchos}</cols><sheetData>${xmlFilas.join('')}</sheetData></worksheet>`;
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.00%"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FFDD3333"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF000000"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf/><xf fontId="1" applyFont="1"/><xf fontId="2" applyFont="1"/><xf fontId="3" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return crearZip([
    { nombre: '[Content_Types].xml', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { nombre: '_rels/.rels', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { nombre: 'xl/workbook.xml', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Resultados" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { nombre: 'xl/_rels/workbook.xml.rels', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { nombre: 'xl/worksheets/sheet1.xml', contenido: hoja },
    { nombre: 'xl/styles.xml', contenido: estilos },
  ]);
}

function aCsv(reporte) {
  const escapar = (v) => {
    const texto = typeof v === 'string' && INICIO_FORMULA.test(v) ? `'${v}` : String(v ?? '');
    return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const lineas = [COLUMNAS, ...filasPlanas(reporte)].map((f) => f.map(escapar).join(','));
  return new Blob([`﻿${lineas.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
}

function aJson(reporte) {
  const datos = {
    titulo: reporte.titulo,
    contexto: Object.fromEntries(reporte.contexto),
    votaciones: reporte.secciones.map((s) => ({
      edicion: s.edicion, categoria: s.categoria, votacion: s.votacion, estado: s.estado, total_votos: s.total,
      resultados: s.filas.map((f, i) => ({ posicion: i + 1, opcion: f.nombre, votos: f.cantidad, porcentaje: Number(f.porcentaje.toFixed(2)) })),
    })),
  };
  return new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
}

function aSql(reporte) {
  const valor = (v) => (typeof v === 'number' ? String(v) : `'${String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "''")}'`);
  const generado = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const lineas = [
    `-- ${reporte.titulo} · Votaciones del Festival de la Leyenda Vallenata`,
    `-- Generado: ${generado}. Solo conteos por opción (voto secreto).`,
    'SET NAMES utf8mb4;',
    'CREATE TABLE IF NOT EXISTS resultado_exportado (',
    '  id INT AUTO_INCREMENT PRIMARY KEY,',
    '  edicion VARCHAR(150) NOT NULL,',
    '  categoria VARCHAR(120) NOT NULL,',
    '  votacion VARCHAR(150) NOT NULL,',
    '  estado VARCHAR(15) NOT NULL,',
    '  posicion INT NOT NULL,',
    '  opcion VARCHAR(150) NOT NULL,',
    '  votos INT NOT NULL,',
    '  porcentaje DECIMAL(5,2) NOT NULL,',
    '  generado_en DATETIME NOT NULL',
    ') DEFAULT CHARSET=utf8mb4;',
  ];
  const filas = filasPlanas(reporte);
  if (filas.length) {
    lineas.push('INSERT INTO resultado_exportado (edicion, categoria, votacion, estado, posicion, opcion, votos, porcentaje, generado_en) VALUES');
    lineas.push(`${filas.map((f) => `  (${f.map(valor).join(', ')}, '${generado}')`).join(',\n')};`);
  }
  return new Blob([`${lineas.join('\n')}\n`], { type: 'application/sql' });
}

/** Reporte imprimible en una ventana nueva («Guardar como PDF»). Devuelve false si el navegador bloqueó la ventana. */
function imprimirPdf(reporte) {
  const ventana = window.open('', '_blank');
  if (!ventana) return false;
  const pct = (n) => `${n.toFixed(2).replace('.', ',')} %`;
  const secciones = reporte.secciones.map((s) => {
    const maximo = s.filas[0]?.cantidad || 0;
    const filas = s.filas.map((f, i) => `<tr${s.total && f.cantidad === maximo ? ' class="lider"' : ''}><td>${i + 1}</td><td>${escaparXml(f.nombre)}</td><td class="n">${f.cantidad}</td><td class="n">${pct(f.porcentaje)}</td></tr>`).join('');
    return `<section><h2>${escaparXml(reporte.secciones.length > 1 ? `${s.categoria} · ${s.votacion}` : s.votacion)}</h2><p class="estado">Estado: ${escaparXml(s.estado)}</p>
<table><thead><tr><th>Posición</th><th>Opción</th><th class="n">Votos</th><th class="n">Porcentaje</th></tr></thead><tbody>${filas}</tbody>
<tfoot><tr><td></td><td>Total</td><td class="n">${s.total}</td><td class="n">${pct(s.total ? 100 : 0)}</td></tr></tfoot></table></section>`;
  }).join('');
  ventana.document.write(`<!doctype html><html lang="es-CO"><head><meta charset="utf-8"><title>${escaparXml(reporte.titulo)}</title>
<style>
  body { font-family: Poppins, system-ui, sans-serif; color: #222; margin: 2cm; }
  h1 { color: #DD3333; font-family: Raleway, Poppins, sans-serif; font-size: 1.6rem; margin: 0 0 1rem; }
  h2 { font-size: 1.05rem; margin: 1.4rem 0 .2rem; }
  .estado { color: #555; font-size: .8rem; margin: 0 0 .4rem; }
  section { break-inside: avoid; }
  dl { display: grid; grid-template-columns: 9rem 1fr; gap: .2rem .8rem; margin: 0 0 1rem; font-size: .9rem; }
  dt { font-weight: 700; }
  dd { margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  th { background: #000; color: #D7AC70; text-align: left; padding: .45rem .6rem; }
  td { padding: .4rem .6rem; border-bottom: 1px solid #e9e9e9; }
  td.n, th.n { text-align: right; }
  tr.lider td { background: #FCE6CC; }
  tfoot td { font-weight: 700; border-top: 2px solid #000; border-bottom: 0; }
  .nota { color: #555; font-size: .75rem; margin-top: 1.5rem; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>
<h1>${escaparXml(reporte.titulo)}</h1>
<dl>${reporte.contexto.map(([e, v]) => `<dt>${escaparXml(e)}</dt><dd>${escaparXml(v)}</dd>`).join('')}</dl>
${secciones || '<p>No hay votaciones para mostrar.</p>'}
<p class="nota">El voto es secreto: este reporte solo contiene conteos por opción, nunca quién votó por cuál.</p>
</body></html>`);
  ventana.document.close();
  ventana.focus();
  setTimeout(() => ventana.print(), 300);
  return true;
}

const GENERADORES = { excel: ['xlsx', aExcel], csv: ['csv', aCsv], json: ['json', aJson], sql: ['sql', aSql] };

/** Descarga el reporte en pdf | excel | csv | json | sql. */
export function descargarReporte(reporte, formato) {
  if (formato === 'pdf') {
    if (!imprimirPdf(reporte)) return { ok: false, error: 'El navegador bloqueó la ventana del reporte: permite las ventanas emergentes e inténtalo de nuevo.' };
    return { ok: true, nombre: `${reporte.nombreBase}.pdf`, impreso: true };
  }
  const generador = GENERADORES[formato];
  if (!generador) return { ok: false, error: 'Formato no válido.' };
  const nombre = `${reporte.nombreBase}.${generador[0]}`;
  descargarBlob(nombre, generador[1](reporte));
  return { ok: true, nombre };
}
