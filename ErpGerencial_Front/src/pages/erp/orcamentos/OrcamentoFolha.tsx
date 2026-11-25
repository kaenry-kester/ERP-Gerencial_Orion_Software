import type { ComponentProps, KeyboardEvent, ReactNode } from 'react'
import type { Empresa } from '../../../services/api'
import { formatarDocumento, formatarMoeda, formatarQuantidade, formatarTelefone, moedaParaNumero } from '../../../utils/validacao'
import { numeroCupom } from '../cupons/numero'
import {
  LINHAS_MINIMAS,
  linhaVazia,
  quantidadeDa,
  totalDaFolha,
  totalDaLinha,
  type CampoFolha,
  type ColunaFolha,
  type DadosFolha,
} from './folha'
import './orcamento-folha.css'

/** Folha na tela, com os campos para digitar. */
export type EdicaoFolha = {
  mudarCampo: (campo: CampoFolha, valor: string) => void
  mudarLinha: (chave: number, coluna: ColunaFolha, valor: string) => void
  /** Enter na última linha: cria mais uma. */
  adicionarLinha: (focar: ColunaFolha) => void
  /** Sugestões do cadastro embaixo do campo Cliente. */
  sugestoesCliente?: ReactNode
}

const dataBr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')

/** Valor em duas partes ("R$" à esquerda e o número à direita), como numa planilha. */
function Valor({ valor }: { valor: number }) {
  return (
    <span className="of-valor">
      <span>R$</span>
      <span>{formatarMoeda(valor).replace(/^R\$\s*/, '')}</span>
    </span>
  )
}

/**
 * Orçamento numa folha A4, no modelo de planilha: logo da loja no centro do topo, dados da loja, data, cliente,
 * a tabela de produtos e serviços, o total e as formas de pagamento e condições.
 * Sem `editar`: só para ler (impressão e PDF). Com `editar`: a mesma folha com os campos para digitar.
 */
export function OrcamentoFolha({
  dados,
  empresa,
  logoUrl,
  editar,
}: {
  dados: DadosFolha
  empresa: Empresa | null
  logoUrl?: string | null
  editar?: EdicaoFolha
}) {
  const cidadeUf = [empresa?.cidade, empresa?.uf].filter(Boolean).join('/')
  const endereco = [empresa?.endereco, cidadeUf].filter(Boolean).join(' - ')
  const contato = [
    empresa?.telefone && `Tel.: ${formatarTelefone(empresa.telefone)}`,
    empresa?.email,
    empresa?.documento && `${empresa.documento.length === 11 ? 'CPF' : 'CNPJ'}: ${formatarDocumento(empresa.documento)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  // No papel, as linhas preenchidas primeiro e as em branco completam a folha
  const linhas = editar ? dados.linhas : dados.linhas.filter((l) => !linhaVazia(l))
  const vazias = editar ? 0 : Math.max(0, LINHAS_MINIMAS - linhas.length)
  const total = totalDaFolha(dados.linhas)

  /** Campo do topo: texto no papel, caixa de digitar na tela. */
  const campo = (c: Exclude<CampoFolha, 'condicoes' | 'data'>, rotulo: string, extra?: ComponentProps<'input'>) =>
    editar ? (
      <input
        id={`of-${c}`}
        aria-label={rotulo}
        value={dados[c]}
        autoComplete="off"
        onChange={(e) => editar.mudarCampo(c, e.target.value)}
        {...extra}
      />
    ) : (
      dados[c]
    )

  // Enter: vai para a mesma coluna na linha de baixo (na última, cria uma linha nova)
  const tecla = (e: KeyboardEvent<HTMLInputElement>, indice: number, coluna: ColunaFolha) => {
    if (e.key !== 'Enter' || !editar) return
    e.preventDefault()
    const abaixo = linhas[indice + 1]
    if (abaixo) document.getElementById(`of-${abaixo.chave}-${coluna}`)?.focus()
    else editar.adicionarLinha(coluna)
  }

  return (
    <div className={editar ? 'of of-editavel' : 'of'}>
      <header className="of-topo">
        <p className="of-numero">{dados.numero ? `Orçamento Nº ${numeroCupom(dados.numero)}` : 'Orçamento novo'}</p>
        {logoUrl && <img src={logoUrl} alt="" className="of-logo" />}
        <div className="of-empresa">
          <p className="of-empresa-nome">{empresa?.nome ?? ''}</p>
          {endereco && <p>{endereco}</p>}
          {contato && <p>{contato}</p>}
        </div>
      </header>

      <table className="of-data">
        <tbody>
          <tr>
            <th scope="row">Data:</th>
            <td>
              {editar ? (
                <input
                  id="of-data"
                  type="date"
                  aria-label="Data do orçamento"
                  value={dados.data}
                  onChange={(e) => editar.mudarCampo('data', e.target.value)}
                />
              ) : (
                dataBr(dados.data)
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="of-cliente">
        <tbody>
          <tr>
            <th scope="row">Cliente:</th>
            <td className="of-cliente-nome">
              {/* Nome e, na frente, o CPF/CNPJ */}
              <div className="of-cliente-linha">
                <span className="of-cliente-nome-campo">
                  {campo('clienteNome', 'Cliente', { maxLength: 200, placeholder: 'Nome do cliente (busca no cadastro)' })}
                </span>
                {(editar || dados.clienteDocumento) && (
                  <span className="of-cliente-documento">
                    <span className="of-cliente-documento-rotulo">CPF/CNPJ:</span>
                    {campo('clienteDocumento', 'CPF ou CNPJ do cliente', {
                      maxLength: 18,
                      placeholder: '000.000.000-00',
                    })}
                  </span>
                )}
              </div>
              {editar?.sugestoesCliente}
            </td>
          </tr>
          <tr>
            <th scope="row">Endereço:</th>
            <td>{campo('clienteEndereco', 'Endereço do cliente', { maxLength: 300, placeholder: 'Endereço do cliente' })}</td>
          </tr>
          <tr>
            <th scope="row">Telefone:</th>
            <td>
              {campo('clienteTelefone', 'Telefone do cliente', {
                maxLength: 30,
                inputMode: 'numeric',
                placeholder: 'Telefone do cliente',
              })}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 className="of-titulo">Orçamento de Produtos e Serviços</h2>

      <table className="of-itens">
        <thead>
          <tr>
            <th scope="col" className="of-qtd">Quantidade</th>
            <th scope="col">Descrição</th>
            <th scope="col" className="of-preco">Valor</th>
            <th scope="col" className="of-preco">Valor Total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, indice) => {
            const preenchida = !linhaVazia(l)
            const detalhe = [l.observacao, l.data && `Data: ${dataBr(l.data)}`].filter(Boolean).join(' · ')
            return (
              <tr key={l.chave}>
                <td className="of-qtd">
                  {editar ? (
                    <input
                      id={`of-${l.chave}-quantidade`}
                      aria-label={`Quantidade da linha ${indice + 1}`}
                      inputMode="decimal"
                      value={l.quantidade}
                      placeholder={l.descricao.trim() ? '1' : undefined}
                      onChange={(e) => editar.mudarLinha(l.chave, 'quantidade', e.target.value)}
                      onKeyDown={(e) => tecla(e, indice, 'quantidade')}
                    />
                  ) : (
                    preenchida && formatarQuantidade(quantidadeDa(l))
                  )}
                </td>
                <td>
                  {editar ? (
                    <input
                      id={`of-${l.chave}-descricao`}
                      aria-label={`Descrição da linha ${indice + 1}`}
                      value={l.descricao}
                      maxLength={200}
                      onChange={(e) => editar.mudarLinha(l.chave, 'descricao', e.target.value)}
                      onKeyDown={(e) => tecla(e, indice, 'descricao')}
                    />
                  ) : (
                    <>
                      {l.descricao}
                      {detalhe && <span className="of-detalhe"> — {detalhe}</span>}
                    </>
                  )}
                </td>
                <td>
                  {editar ? (
                    <input
                      id={`of-${l.chave}-valor`}
                      aria-label={`Valor da linha ${indice + 1}`}
                      className="of-numero-campo"
                      inputMode="numeric"
                      value={l.valor}
                      onChange={(e) => editar.mudarLinha(l.chave, 'valor', e.target.value)}
                      onKeyDown={(e) => tecla(e, indice, 'valor')}
                    />
                  ) : (
                    preenchida && <Valor valor={moedaParaNumero(l.valor) ?? 0} />
                  )}
                </td>
                <td>{preenchida && moedaParaNumero(l.valor) !== null && <Valor valor={totalDaLinha(l)} />}</td>
              </tr>
            )
          })}
          {Array.from({ length: vazias }, (_, i) => (
            <tr key={`vazia-${i}`} className="of-vazia">
              <td />
              <td />
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      <table className="of-total">
        <tbody>
          <tr>
            <th scope="row">Total</th>
            <td>
              <Valor valor={total} />
            </td>
          </tr>
        </tbody>
      </table>

      <section className="of-condicoes">
        <h3>Formas de Pagamento e Condições</h3>
        <div className="of-condicoes-texto">
          {editar ? (
            <textarea
              id="of-condicoes"
              aria-label="Formas de pagamento e condições"
              className="of-condicoes-frase"
              rows={2}
              maxLength={1000}
              value={dados.condicoes}
              onChange={(e) => editar.mudarCampo('condicoes', e.target.value)}
            />
          ) : (
            <p className="of-condicoes-frase">{dados.condicoes}</p>
          )}
        </div>
      </section>
    </div>
  )
}
