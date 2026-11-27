/**
 * Feriados nacionais do Brasil, calculados aqui mesmo (sem internet): os de data fixa e os que dependem da Páscoa.
 * Chave "2026-12-25" → nome do feriado.
 */

const dois = (n: number) => String(n).padStart(2, '0')
const chave = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`

const FIXOS: [mes: number, dia: number, nome: string][] = [
  [1, 1, 'Confraternização Universal'],
  [4, 21, 'Tiradentes'],
  [5, 1, 'Dia do Trabalho'],
  [9, 7, 'Independência do Brasil'],
  [10, 12, 'Nossa Senhora Aparecida'],
  [11, 2, 'Finados'],
  [11, 15, 'Proclamação da República'],
  [11, 20, 'Dia da Consciência Negra'],
  [12, 25, 'Natal'],
]

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function pascoa(ano: number) {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}

const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const cache = new Map<number, Map<string, string>>()

/** Feriados de um ano (guardados depois do primeiro cálculo). */
export function feriadosDoAno(ano: number): Map<string, string> {
  const pronto = cache.get(ano)
  if (pronto) return pronto

  const lista = new Map<string, string>()
  for (const [mes, dia, nome] of FIXOS) lista.set(`${ano}-${dois(mes)}-${dois(dia)}`, nome)

  const p = pascoa(ano)
  lista.set(chave(somarDias(p, -48)), 'Carnaval')
  lista.set(chave(somarDias(p, -47)), 'Carnaval')
  lista.set(chave(somarDias(p, -2)), 'Sexta-feira Santa')
  lista.set(chave(somarDias(p, 60)), 'Corpus Christi')

  cache.set(ano, lista)
  return lista
}

/** Nome do feriado no dia ("2026-12-25"), ou undefined. */
export function feriado(dia: string): string | undefined {
  return feriadosDoAno(Number(dia.slice(0, 4))).get(dia)
}
