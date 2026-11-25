import { toCanvas } from 'html-to-image'

/*
  PDF do cupom e do orçamento iguais ao impresso: o documento já montado na tela é "fotografado" em alta resolução
  (depois de as imagens carregarem, para a logo não sair cortada nem em branco) e vira páginas de PDF.
  - Cupom: papel de 58 mm de largura; a altura acompanha o texto (no mínimo 80 mm), numa página só.
  - Orçamento: folhas A4 (210 × 297 mm, 10 mm de margem). Se não couber numa folha, quebra entre as linhas da
    tabela (nunca no meio de uma linha, da logo ou de um bloco).
*/

/** Papel do cupom: largura fixa e altura mínima (a altura cresce com o texto). */
export const CUPOM_LARGURA_MM = 58
export const CUPOM_ALTURA_MINIMA_MM = 80

const A4 = { largura: 210, altura: 297, margem: 10 }

/** Pontos onde a folha do orçamento pode ser quebrada (o fim de cada bloco e de cada linha da tabela). */
const CORTES_ORCAMENTO = '.of-topo, .of-data, .of-cliente tr, .of-titulo, .of-itens thead, .of-itens tbody tr, .of-total'

/** Resolução da foto do documento (3 pixels por pixel da tela: texto nítido na impressora). */
const NITIDEZ = 3

export type PdfCupom = { arquivo: Blob; base64: string }

/** Espera as imagens do documento (ex.: a logo) carregarem: sem isso, saem cortadas ou em branco. */
export async function esperarImagens(elemento: ParentNode) {
  // decode() espera a imagem carregar e ficar pronta para desenhar (imagem quebrada: segue sem ela)
  await Promise.all([...elemento.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)))
}

/** O documento a fotografar: o próprio cupom (.ct) ou a folha (.of), mesmo se vier o papel em volta. */
const documentoDe = (elemento: HTMLElement, seletor: string) => elemento.querySelector<HTMLElement>(seletor) ?? elemento

async function fotografar(elemento: HTMLElement) {
  await esperarImagens(elemento)
  // skipFonts: o cupom e o orçamento usam fontes do computador (Arial, Calibri); não precisa baixar as do site
  return toCanvas(elemento, { pixelRatio: NITIDEZ, backgroundColor: '#ffffff', skipFonts: true })
}

/** PDF do cupom: 58 mm de largura, altura do tamanho do texto (mínimo 80 mm), uma página só. */
export async function gerarPdfCupom(elemento: HTMLElement): Promise<PdfCupom> {
  const canvas = await fotografar(documentoDe(elemento, '.ct'))
  const larguraPt = mmParaPt(CUPOM_LARGURA_MM)
  const alturaPt = (larguraPt * canvas.height) / canvas.width
  const pagina: Pagina = {
    largura: larguraPt,
    altura: Math.max(alturaPt, mmParaPt(CUPOM_ALTURA_MINIMA_MM)),
    imagem: jpeg(canvas),
    x: 0,
    largImagem: larguraPt,
    altImagem: alturaPt,
  }
  return montar([pagina])
}

/** PDF do orçamento em folhas A4, quebrando só entre os blocos e as linhas da tabela. */
export async function gerarPdfOrcamento(elemento: HTMLElement): Promise<PdfCupom> {
  const folha = documentoDe(elemento, '.of')
  const canvas = await fotografar(folha)

  // Escala: pixels da foto por pixel da tela e por milímetro do papel
  const topo = folha.getBoundingClientRect().top
  const porPixel = canvas.height / folha.getBoundingClientRect().height
  const larguraUtil = A4.largura - 2 * A4.margem
  const porMm = canvas.width / larguraUtil
  const alturaUtil = Math.floor((A4.altura - 2 * A4.margem) * porMm)

  const cortes = [...folha.querySelectorAll(CORTES_ORCAMENTO)]
    .map((el) => Math.round((el.getBoundingClientRect().bottom - topo) * porPixel))
    .filter((y) => y > 0 && y < canvas.height)
    .sort((a, b) => a - b)

  const paginas: Pagina[] = []
  for (let inicio = 0; inicio < canvas.height; ) {
    const limite = inicio + alturaUtil
    // Cabe o resto numa folha; senão, quebra no último ponto seguro que cabe (sem nenhum: corta na altura da folha)
    const fim = limite >= canvas.height ? canvas.height : (cortes.filter((y) => y > inicio && y <= limite).pop() ?? limite)
    const pedaco = recortar(canvas, inicio, fim - inicio)
    const largImagem = mmParaPt(larguraUtil)
    paginas.push({
      largura: mmParaPt(A4.largura),
      altura: mmParaPt(A4.altura),
      imagem: jpeg(pedaco),
      x: mmParaPt(A4.margem),
      largImagem,
      altImagem: (largImagem * pedaco.height) / pedaco.width,
      topo: mmParaPt(A4.margem),
    })
    inicio = fim
  }
  return montar(paginas)
}

/** Baixa o arquivo com o nome dado (ex.: "cupom-000012.pdf"). */
export function baixarArquivo(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ---------- Montagem do PDF ----------

/** Uma página: tamanho (em pontos) e a imagem nela, presa no topo (x, topo) com a largura e a altura dadas. */
type Pagina = {
  largura: number
  altura: number
  imagem: { bytes: Uint8Array; largura: number; altura: number }
  x: number
  largImagem: number
  altImagem: number
  /** Distância do topo da página até a imagem (0: encostada no topo). */
  topo?: number
}

const mmParaPt = (mm: number) => (mm * 72) / 25.4

function recortar(canvas: HTMLCanvasElement, y: number, altura: number) {
  const pedaco = document.createElement('canvas')
  pedaco.width = canvas.width
  pedaco.height = Math.max(1, altura)
  const ctx = pedaco.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, pedaco.width, pedaco.height)
  ctx.drawImage(canvas, 0, y, canvas.width, altura, 0, 0, canvas.width, altura)
  return pedaco
}

function jpeg(canvas: HTMLCanvasElement) {
  const url = canvas.toDataURL('image/jpeg', 0.92)
  return { bytes: base64ParaBytes(url.slice(url.indexOf(',') + 1)), largura: canvas.width, altura: canvas.height }
}

function montar(paginas: Pagina[]): PdfCupom {
  const bytes = pdfComPaginas(paginas)
  return { arquivo: new Blob([bytes], { type: 'application/pdf' }), base64: bytesParaBase64(bytes) }
}

/** PDF simples: cada página com uma imagem JPEG (objetos: 1 catálogo, 2 páginas, depois página/imagem/desenho). */
function pdfComPaginas(paginas: Pagina[]): Uint8Array<ArrayBuffer> {
  const n = (v: number) => v.toFixed(2)
  const partes: Uint8Array[] = []
  const posicoes: number[] = []
  let tamanho = 0
  const codificador = new TextEncoder()
  const escrever = (dado: string | Uint8Array) => {
    const bytes = typeof dado === 'string' ? codificador.encode(dado) : dado
    partes.push(bytes)
    tamanho += bytes.length
  }
  const objeto = (numero: number, conteudo: string) => {
    posicoes[numero] = tamanho
    escrever(`${numero} 0 obj\n${conteudo}\nendobj\n`)
  }

  const numeroPagina = (i: number) => 3 + i * 3
  escrever('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  objeto(1, '<< /Type /Catalog /Pages 2 0 R >>')
  objeto(2, `<< /Type /Pages /Kids [${paginas.map((_, i) => `${numeroPagina(i)} 0 R`).join(' ')}] /Count ${paginas.length} >>`)

  paginas.forEach((p, i) => {
    const pag = numeroPagina(i)
    const img = pag + 1
    const conteudo = pag + 2
    // O PDF conta de baixo para cima: a imagem fica presa no topo da página
    const y = p.altura - (p.topo ?? 0) - p.altImagem
    const desenho = `q ${n(p.largImagem)} 0 0 ${n(p.altImagem)} ${n(p.x)} ${n(y)} cm /Im0 Do Q`
    objeto(
      pag,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(p.largura)} ${n(p.altura)}] ` +
        `/Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${conteudo} 0 R >>`,
    )
    posicoes[img] = tamanho
    escrever(
      `${img} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.imagem.largura} /Height ${p.imagem.altura} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.imagem.bytes.length} >>\nstream\n`,
    )
    escrever(p.imagem.bytes)
    escrever('\nendstream\nendobj\n')
    objeto(conteudo, `<< /Length ${desenho.length} >>\nstream\n${desenho}\nendstream`)
  })

  const total = 3 + paginas.length * 3
  const inicioXref = tamanho
  escrever(`xref\n0 ${total}\n0000000000 65535 f \n`)
  for (let i = 1; i < total; i++) escrever(`${String(posicoes[i]).padStart(10, '0')} 00000 n \n`)
  escrever(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`)

  const pdf = new Uint8Array(tamanho)
  let pos = 0
  for (const parte of partes) {
    pdf.set(parte, pos)
    pos += parte.length
  }
  return pdf
}

function base64ParaBytes(base64: string) {
  const texto = atob(base64)
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i)
  return bytes
}

function bytesParaBase64(bytes: Uint8Array) {
  let texto = ''
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(texto)
}
