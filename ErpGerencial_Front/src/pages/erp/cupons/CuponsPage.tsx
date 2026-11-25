import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { avisarSalvo } from '../../../components/aviso-salvo/avisarSalvo'
import { IconeBusca, IconeLixeira, IconeMais } from '../../../components/icones/Icones'
import { IlustracaoCupomFiscal } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { excluirCupom, listarCupons, mensagemDe, rotuloPagamento, type ListaCupons } from '../../../services/api'
import { formatarMoeda } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import CabecalhoModulo from '../CabecalhoModulo'
import FaixaPagina from '../FaixaPagina'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar } from '../modulos'
import SemAcesso from '../SemAcesso'
import { useSelecao } from '../useSelecao'
import { numeroCupom } from './numero'
import './cupons.css'

const MODULO = MODULOS.find((m) => m.id === 'cupom-fiscal')!

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Cupons e recibos emitidos, mais novos primeiro, com busca. Clicar abre o cupom (impressão e cancelamento);
// as caixinhas da 1ª coluna marcam cupons para excluir da lista.
export default function CuponsPage() {
  const { sessao } = useErp()
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada()
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [pagina, setPagina] = useState(1)
  const [lista, setLista] = useState<ListaCupons | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [excluindo, setExcluindo] = useState(false)
  // Muda depois de excluir: a lista é carregada de novo
  const [recarregar, setRecarregar] = useState(0)
  const { marcados, alternar, todos, limpar } = useSelecao()
  const podeVer = podeAcessar(sessao.usuario, MODULO)

  // Busca enquanto digita, esperando a pessoa parar por um instante
  useEffect(() => {
    const id = window.setTimeout(() => {
      setBuscaAplicada(busca)
      setPagina(1)
    }, 350)
    return () => window.clearTimeout(id)
  }, [busca])

  useEffect(() => {
    if (!podeVer) return
    let ativo = true
    listarCupons(sessao.token, buscaAplicada, pagina)
      .then((l) => ativo && setLista(l))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token, buscaAplicada, pagina, podeVer, recarregar])

  // Outra busca ou outra página: as marcações de antes não valem mais
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => limpar(), [buscaAplicada, pagina])

  if (!podeVer) {
    return (
      <div className="erp-pagina">
        <CabecalhoModulo modulo={MODULO} />
        <SemAcesso />
      </div>
    )
  }

  const total = lista?.total ?? 0
  const inicio = lista && total > 0 ? (lista.pagina - 1) * lista.tamanhoPagina + 1 : 0
  const fim = lista ? inicio + lista.itens.length - 1 : 0
  const paginas = lista ? Math.max(1, Math.ceil(total / lista.tamanhoPagina)) : 1
  const idsDaPagina = lista?.itens.map((item) => item.id) ?? []
  const todosMarcados = idsDaPagina.length > 0 && idsDaPagina.every((i) => marcados.has(i))

  const excluirMarcados = async () => {
    const quantos = marcados.size
    const texto = quantos === 1 ? 'este cupom' : `estes ${quantos} cupons`
    if (!window.confirm(`Excluir ${texto}? Eles saem da lista e do Financeiro, e os produtos dos que não estavam cancelados voltam ao estoque. Não dá para desfazer.`)) return
    setExcluindo(true)
    setAviso(null)
    try {
      for (const id of marcados) await excluirCupom(sessao.token, id)
      avisarSalvo('Item excluído da sua lista', quantos === 1 ? '1 cupom excluído' : `${quantos} cupons excluídos`)
    } catch (e) {
      if (!sessaoExpirada(e)) setAviso({ tipo: 'erro', texto: mensagemDe(e) })
    } finally {
      limpar()
      setExcluindo(false)
      setRecarregar((n) => n + 1)
    }
  }

  return (
    <div className="pagina tema-cupom">
      <FaixaPagina
        Ilustracao={IlustracaoCupomFiscal}
        titulo={MODULO.rotulo}
        subtitulo={MODULO.descricao}
        acoes={
          <Link to="/app/cupom-fiscal/novo" className="pagina-botao marinho">
            <IconeMais tamanho={20} />
            Emitir cupom
          </Link>
        }
      />

      <div className="lista-ferramentas">
        <div className="lista-busca">
          <label htmlFor="cupons-busca" className="sr-only">
            Buscar cupom
          </label>
          <IconeBusca tamanho={20} />
          <input
            id="cupons-busca"
            type="search"
            placeholder="Nº do cupom, cliente, CPF/CNPJ ou referente a"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {marcados.size > 0 && (
          <button type="button" className="pagina-botao perigo" onClick={excluirMarcados} disabled={excluindo}>
            <IconeLixeira tamanho={20} />
            {excluindo ? 'Excluindo...' : `Excluir marcados (${marcados.size})`}
          </button>
        )}
        {lista && (
          <p className="lista-contagem" role="status">
            <strong>{total}</strong> {total === 1 ? 'cupom' : 'cupons'}
          </p>
        )}
      </div>

      <div className="lista-corpo">
        {aviso && <AvisoPagina aviso={aviso} />}
        {!lista && !aviso && <p className="erp-carregando">Carregando...</p>}

        {lista && lista.itens.length === 0 && (
          <div className="lista-vazio">
            <IlustracaoCupomFiscal tamanho={96} />
            <div>
              <p className="lista-vazio-titulo">{buscaAplicada ? 'Nada encontrado' : 'Nenhum cupom ainda'}</p>
              <p className="lista-vazio-texto">
                {buscaAplicada ? 'Tente outro termo de busca.' : 'Clique em "Emitir cupom" para fazer o primeiro.'}
              </p>
            </div>
          </div>
        )}

        {lista && lista.itens.length > 0 && (
          <>
            <div className="lista-tabela-area">
              <table className="lista-tabela">
                <thead>
                  <tr>
                    <th scope="col" className="lista-marcar">
                      <input
                        type="checkbox"
                        aria-label="Marcar todos os cupons desta página para excluir"
                        checked={todosMarcados}
                        onChange={(e) => todos(idsDaPagina, e.target.checked)}
                      />
                    </th>
                    <th scope="col" className="lista-id">Nº</th>
                    <th scope="col">Data</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Itens</th>
                    <th scope="col">Pagamento</th>
                    <th scope="col" className="numero">Total</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.itens.map((c) => (
                    // A linha inteira abre o cupom; o link no Nº é o acesso pelo teclado.
                    <tr key={c.id} onClick={() => navigate(`/app/cupom-fiscal/${c.id}`)}>
                      {/* A caixinha marca para excluir (sem abrir o cupom) */}
                      <td className="lista-marcar" data-rotulo="Excluir" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Marcar o cupom Nº ${numeroCupom(c.numero)} para excluir`}
                          checked={marcados.has(c.id)}
                          onChange={() => alternar(c.id)}
                        />
                      </td>
                      <td className="lista-id" data-rotulo="Nº">
                        <Link to={`/app/cupom-fiscal/${c.id}`} className="lista-nome">
                          {numeroCupom(c.numero)}
                        </Link>
                      </td>
                      <td data-rotulo="Data">{dataHora(c.emitidoEm)}</td>
                      <td className="lista-principal quebra" data-rotulo="Cliente">
                        {c.clienteNome ?? 'Consumidor'}
                      </td>
                      <td className="quebra" data-rotulo="Itens">
                        {c.itens.length > 0
                          ? `${c.itens.length} ${c.itens.length === 1 ? 'item' : 'itens'}`
                          : (c.referente ?? 'Recibo')}
                      </td>
                      <td data-rotulo="Pagamento">{rotuloPagamento(c.formaPagamento)}</td>
                      <td className="numero lista-destaque" data-rotulo="Total">{formatarMoeda(c.total)}</td>
                      <td data-rotulo="Situação">
                        <span className={c.canceladoEm ? 'lista-etiqueta alerta' : 'lista-etiqueta'}>
                          {c.canceladoEm ? 'Cancelado' : 'Emitido'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {paginas > 1 && (
              <nav className="lista-paginas" aria-label="Páginas">
                <span>
                  {inicio}–{fim} de {total}
                </span>
                <button
                  type="button"
                  className="pagina-botao neutro"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((n) => n - 1)}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="pagina-botao neutro"
                  disabled={pagina >= paginas}
                  onClick={() => setPagina((n) => n + 1)}
                >
                  Próxima
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  )
}
