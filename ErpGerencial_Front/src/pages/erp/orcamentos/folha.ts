import type { Orcamento } from '../../../services/api'
import { formatarMoeda, formatarQuantidade, formatarTelefone, mascaraQuantidade, moedaParaNumero, quantidadeParaNumero } from '../../../utils/validacao'

/*
  Dados da folha do orçamento (os campos que a pessoa digita) e as contas da tabela.
  A folha em si (tela, impressão e PDF) é o OrcamentoFolha.
*/

/** Frase que já vem em "Formas de pagamento e condições" num orçamento novo (dá para trocar). */
export const CONDICOES_PADRAO = 'À vista ou até 3 vezes sem juros no cartão - Orçamento válido por 10 dias'

/** Linhas da tabela: as preenchidas e, abaixo, linhas em branco até completar a folha. */
export const LINHAS_MINIMAS = 10

/** Uma linha da tabela, com os valores como estão nos campos (texto). */
export type LinhaFolha = {
  chave: number
  quantidade: string
  descricao: string
  valor: string
  /** Detalhe e data de orçamentos antigos (só aparecem no papel, ao lado da descrição). */
  observacao: string | null
  data: string | null
}

/** Tudo o que vai na folha (os campos que a pessoa digita). */
export type DadosFolha = {
  numero: number | null
  /** "2026-10-31" */
  data: string
  clienteNome: string
  clienteEndereco: string
  clienteTelefone: string
  linhas: LinhaFolha[]
  condicoes: string
}

export type CampoFolha = 'data' | 'clienteNome' | 'clienteEndereco' | 'clienteTelefone' | 'condicoes'
export type ColunaFolha = 'quantidade' | 'descricao' | 'valor'

/** Linha sem nada digitado (fica de fora ao salvar). */
export const linhaVazia = (l: LinhaFolha) => !l.descricao.trim() && !l.valor.trim() && !l.quantidade.trim()

/** Quantidade da linha: vazia com descrição conta como 1. */
export const quantidadeDa = (l: LinhaFolha) => quantidadeParaNumero(l.quantidade) ?? (l.descricao.trim() ? 1 : 0)

export const totalDaLinha = (l: LinhaFolha) =>
  Math.round(quantidadeDa(l) * (moedaParaNumero(l.valor) ?? 0) * 100) / 100

export const totalDaFolha = (linhas: LinhaFolha[]) =>
  Math.round(linhas.reduce((soma, l) => soma + totalDaLinha(l), 0) * 100) / 100

const hojeIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

let proximaChave = 1
export const novaLinha = (): LinhaFolha => ({
  chave: proximaChave++,
  quantidade: '',
  descricao: '',
  valor: '',
  observacao: null,
  data: null,
})

/** Folha de um orçamento novo: data de hoje, condições padrão e as linhas em branco. */
export const folhaNova = (): DadosFolha => ({
  numero: null,
  data: hojeIso(),
  clienteNome: '',
  clienteEndereco: '',
  clienteTelefone: '',
  linhas: Array.from({ length: LINHAS_MINIMAS }, novaLinha),
  condicoes: CONDICOES_PADRAO,
})

/** Orçamento salvo → folha (as linhas em branco completam a tabela). */
export const folhaDoOrcamento = (o: Orcamento): DadosFolha => {
  const linhas = o.itens.map((i) => ({
    chave: proximaChave++,
    quantidade: mascaraQuantidade(formatarQuantidade(i.quantidade)),
    descricao: i.servico,
    valor: formatarMoeda(i.preco),
    observacao: i.observacao,
    data: i.data,
  }))
  return {
    numero: o.numero,
    data: o.data ?? o.criadoEm.slice(0, 10),
    clienteNome: o.clienteNome ?? '',
    clienteEndereco: o.clienteEndereco ?? '',
    clienteTelefone: o.clienteTelefone ? formatarTelefone(o.clienteTelefone) : '',
    linhas: [...linhas, ...Array.from({ length: Math.max(1, LINHAS_MINIMAS - linhas.length) }, novaLinha)],
    // Orçamentos antigos: a observação geral fazia o papel das condições
    condicoes: o.condicoes ?? o.observacao ?? CONDICOES_PADRAO,
  }
}
