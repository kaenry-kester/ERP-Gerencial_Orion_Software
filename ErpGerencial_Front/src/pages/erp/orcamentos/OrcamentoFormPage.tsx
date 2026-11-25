import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { avisarSalvo } from '../../../components/aviso-salvo/avisarSalvo'
import CampoTexto from '../../../components/formulario/CampoTexto'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeCheck, IconeLixeira } from '../../../components/icones/Icones'
import { IlustracaoOrcamento } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import {
  criarOrcamento,
  editarOrcamento,
  enviarOrcamentoWhatsapp,
  excluirOrcamento,
  finalizarOrcamento,
  FORMAS_PAGAMENTO,
  listarClientes,
  mensagemDe,
  obterCliente,
  obterEmpresa,
  obterOrcamento,
  type Cliente,
  type DadosOrcamento,
  type Empresa,
  type FormaPagamento,
  type Orcamento,
} from '../../../services/api'
import {
  erroDocumento,
  formatarDocumento,
  formatarMoeda,
  formatarTelefone,
  normalizarCnpj,
  mascaraMoeda,
  mascaraQuantidade,
  moedaParaNumero,
  telefoneValido,
} from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import FaixaPagina from '../FaixaPagina'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar, tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import { numeroCupom } from '../cupons/numero'
import { baixarArquivo, gerarPdfOrcamento } from '../cupons/pdfCupom'
import { useImpressao } from '../cupons/useImpressao'
import { LOGO_HORIZONTAL } from '../logoLoja'
import {
  folhaDoOrcamento,
  folhaNova,
  linhaVazia,
  novaLinha,
  quantidadeDa,
  totalDaFolha,
  type CampoFolha,
  type ColunaFolha,
  type DadosFolha,
} from './folha'
import { OrcamentoFolha } from './OrcamentoFolha'
import '../cupons/cupons.css'
import './orcamento.css'

const MODULO = MODULOS.find((m) => m.id === 'orcamento')!

/** "Rua X, 10 - Centro - Cidade/UF" com o que o cadastro do cliente tiver. */
const enderecoDo = (c: Cliente) => {
  const rua = [c.logradouro, c.numeroEndereco, c.complemento].filter(Boolean).join(', ')
  const cidade = [c.cidade, c.uf].filter(Boolean).join('/')
  return [rua, c.bairro, cidade].filter(Boolean).join(' - ')
}

/**
 * Orçamento (/app/orcamento/novo ou /app/orcamento/:id), em duas metades: à esquerda imprimir, baixar PDF,
 * encaminhar pelo WhatsApp, salvar e finalizar; à direita a própria folha do orçamento (o mesmo desenho do papel),
 * onde se digita cada campo. "Finalizar e gerar cupom" cria o cupom com as linhas (e o orçamento não muda mais).
 */
export default function OrcamentoFormPage() {
  const { id } = useParams()
  const novo = !id
  const navigate = useNavigate()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const podeVer = podeAcessar(sessao.usuario, MODULO)
  const podeVerClientes = tem(sessao.usuario, 'clientes')

  const [original, setOriginal] = useState<Orcamento | null>(null)
  const [folha, setFolha] = useState<DadosFolha>(folhaNova)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [sugestoes, setSugestoes] = useState<Cliente[]>([])
  const [forma, setForma] = useState<FormaPagamento>('dinheiro')
  const [aviso, setAviso] = useState<Aviso>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  // Imprimir, baixar PDF e encaminhar pelo WhatsApp: o papel sai do orçamento salvo (igual à folha da tela)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const papelPdf = useRef<HTMLDivElement>(null)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [whatsappAberto, setWhatsappAberto] = useState(false)
  const [numeroWhatsapp, setNumeroWhatsapp] = useState('')
  const [erroWhatsapp, setErroWhatsapp] = useState<string>()
  const [falhaEnvio, setFalhaEnvio] = useState<string>()
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false)
  const papel = original && (
    <OrcamentoFolha dados={{ ...folha, numero: original.numero }} empresa={empresa} logoUrl={LOGO_HORIZONTAL} />
  )
  const { imprimir, imprimindo, elemento } = useImpressao(papel, 'a4')

  // Dados da loja para o topo da folha
  useEffect(() => {
    if (!podeVer) return
    let ativo = true
    obterEmpresa(sessao.token)
      .then((e) => ativo && setEmpresa(e))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [sessao.token, podeVer])

  // Edição: carrega o orçamento salvo
  useEffect(() => {
    if (novo || !podeVer) return
    let ativo = true
    obterOrcamento(sessao.token, id!)
      .then((o) => {
        if (!ativo) return
        setOriginal(o)
        setFolha(folhaDoOrcamento(o))
      })
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessao.token, podeVer])

  // Sugestões de clientes do cadastro enquanto digita o nome
  const nomeDigitado = folha.clienteNome
  useEffect(() => {
    const termo = nomeDigitado.trim()
    const jaEscolhido = cliente || (original?.clienteId && termo === original.clienteNome)
    if (jaEscolhido || termo.length < 2 || !podeVerClientes) {
      setSugestoes([])
      return
    }
    let ativo = true
    const espera = window.setTimeout(() => {
      listarClientes(sessao.token, termo, 1)
        .then((l) => ativo && setSugestoes(l.itens.slice(0, 6)))
        .catch((e) => ativo && sessaoExpirada(e))
    }, 300)
    return () => {
      ativo = false
      window.clearTimeout(espera)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomeDigitado, cliente, sessao.token])

  if (!podeVer) return <div className="erp-pagina"><SemAcesso /></div>

  if (!novo && !original) {
    return (
      <div className="pagina tema-orcamento">
        <FaixaPagina Ilustracao={IlustracaoOrcamento} titulo="Orçamento" voltar={{ para: '/app/orcamento', rotulo: MODULO.rotulo }} />
        <div className="pagina-corpo">
          {aviso ? <AvisoPagina aviso={aviso} /> : <p className="erp-carregando">Carregando...</p>}
        </div>
      </div>
    )
  }

  const finalizado = original?.situacao === 'finalizado'
  const total = totalDaFolha(folha.linhas)
  /** Cliente do cadastro: o escolhido agora ou o que já estava salvo (se o nome não mudou). */
  const clienteIdAtual =
    cliente?.id ?? (original?.clienteId && folha.clienteNome.trim() === original.clienteNome ? original.clienteId : null)
  /** O cupom sai com o CNPJ e o endereço da loja: sem eles, não finaliza. */
  const faltaNaEmpresa = !empresa
    ? null
    : [!empresa.documento && 'o CNPJ', !empresa.endereco?.trim() && 'o endereço'].filter(Boolean).join(' e ') || null

  // ---------- Digitação na folha ----------

  const mudarCampo = (campo: CampoFolha, valor: string) => {
    if (campo === 'clienteNome' && cliente) setCliente(null)
    const mascara = campo === 'clienteTelefone' ? formatarTelefone : campo === 'clienteDocumento' ? formatarDocumento : null
    setFolha((f) => ({ ...f, [campo]: mascara ? mascara(valor) : valor }))
    setAviso(null)
  }

  const mudarLinha = (chave: number, coluna: ColunaFolha, valor: string) => {
    const mascara = coluna === 'valor' ? mascaraMoeda : coluna === 'quantidade' ? mascaraQuantidade : (v: string) => v
    setFolha((f) => {
      const linhas = f.linhas.map((l) => (l.chave === chave ? { ...l, [coluna]: mascara(valor) } : l))
      // Escreveu na última linha: aparece mais uma em branco embaixo
      const ultima = linhas[linhas.length - 1]
      return { ...f, linhas: ultima.chave === chave && !linhaVazia(ultima) ? [...linhas, novaLinha()] : linhas }
    })
    setAviso(null)
  }

  const adicionarLinha = (focar: ColunaFolha) => {
    const nova = novaLinha()
    setFolha((f) => ({ ...f, linhas: [...f.linhas, nova] }))
    window.setTimeout(() => document.getElementById(`of-${nova.chave}-${focar}`)?.focus(), 0)
  }

  const escolherCliente = (c: Cliente) => {
    setCliente(c)
    setFolha((f) => ({
      ...f,
      clienteNome: c.nome,
      clienteDocumento: c.documento ? formatarDocumento(c.documento) : f.clienteDocumento,
      clienteEndereco: enderecoDo(c) || f.clienteEndereco,
      clienteTelefone: formatarTelefone(c.celular) || f.clienteTelefone,
    }))
    setSugestoes([])
  }

  // ---------- Salvar ----------

  const conferir = (): string | null => {
    const preenchidas = folha.linhas.filter((l) => !linhaVazia(l))
    if (preenchidas.length === 0) return 'Preencha pelo menos uma linha da tabela.'
    const documento = erroDocumento(folha.clienteDocumento)
    if (documento) return `CPF/CNPJ do cliente: ${documento}.`
    for (const [i, l] of folha.linhas.entries()) {
      if (linhaVazia(l)) continue
      if (!l.descricao.trim()) return `Linha ${i + 1}: digite a descrição.`
      if (!(quantidadeDa(l) > 0)) return `Linha ${i + 1}: digite a quantidade.`
    }
    return null
  }

  const dados = (): DadosOrcamento => ({
    clienteId: clienteIdAtual,
    clienteNome: folha.clienteNome.trim() || null,
    // A observação de orçamentos antigos continua (ela vai para o cupom ao finalizar)
    observacao: original?.observacao ?? null,
    clienteEndereco: folha.clienteEndereco.trim() || null,
    clienteTelefone: folha.clienteTelefone.trim() || null,
    clienteDocumento: normalizarCnpj(folha.clienteDocumento) || null,
    data: folha.data || null,
    condicoes: folha.condicoes.trim() || null,
    itens: folha.linhas
      .filter((l) => !linhaVazia(l))
      .map((l) => ({
        servico: l.descricao.trim(),
        observacao: l.observacao,
        preco: moedaParaNumero(l.valor) ?? 0,
        quantidade: quantidadeDa(l),
        data: l.data,
      })),
  })

  /** Salva (cria ou altera) e devolve o orçamento salvo. */
  const gravar = async () => {
    const problema = conferir()
    if (problema) {
      setAviso({ tipo: 'erro', texto: problema })
      return null
    }
    return novo && !original
      ? criarOrcamento(sessao.token, dados())
      : editarOrcamento(sessao.token, original!.id, dados())
  }

  const salvar = async () => {
    if (salvando) return
    setSalvando(true)
    setAviso(null)
    try {
      const salvo = await gravar()
      if (!salvo) return
      setOriginal(salvo)
      avisarSalvo('Orçamento salvo com sucesso', `Nº ${numeroCupom(salvo.numero)}`)
      // Orçamento novo salvo: a lista dos orçamentos, já com o novo
      if (novo) navigate('/app/orcamento', { replace: true })
    } catch (e) {
      if (!sessaoExpirada(e)) setAviso({ tipo: 'erro', texto: mensagemDe(e) })
    } finally {
      setSalvando(false)
    }
  }

  const finalizar = async () => {
    if (salvando) return
    if (faltaNaEmpresa) {
      setAviso({ tipo: 'erro', texto: `Cadastre ${faltaNaEmpresa} da loja em Empresa: eles saem no cupom.` })
      return
    }
    setSalvando(true)
    setAviso(null)
    try {
      const salvo = await gravar()
      if (!salvo) return
      setOriginal(salvo)
      const pronto = await finalizarOrcamento(sessao.token, salvo.id, forma)
      avisarSalvo('Cupom gerado com sucesso', `Orçamento Nº ${numeroCupom(pronto.numero)} finalizado`)
      // Cupom gerado: a lista dos cupons emitidos, já com o novo
      navigate('/app/cupom-fiscal')
    } catch (e) {
      if (!sessaoExpirada(e)) setAviso({ tipo: 'erro', texto: mensagemDe(e) })
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    setSalvando(true)
    try {
      await excluirOrcamento(sessao.token, original!.id)
      avisarSalvo('Orçamento excluído', `Nº ${numeroCupom(original!.numero)}`)
      navigate('/app/orcamento', { replace: true })
    } catch (e) {
      if (!sessaoExpirada(e)) setAviso({ tipo: 'erro', texto: mensagemDe(e) })
      setSalvando(false)
    }
  }

  // ---------- Imprimir, PDF e WhatsApp ----------

  /**
   * Antes de imprimir ou gerar o PDF: o orçamento em aberto é salvo (o papel sai com o Nº e com o que está na folha).
   * Devolve o orçamento salvo (já montado no papel escondido) ou null se não deu para salvar.
   */
  const preparar = async (): Promise<Orcamento | null> => {
    if (finalizado) return original
    setAviso(null)
    try {
      const salvo = await gravar()
      if (!salvo) return null
      // Monta o papel com o orçamento salvo antes de fotografar/imprimir
      flushSync(() => setOriginal(salvo))
      return salvo
    } catch (e) {
      if (!sessaoExpirada(e)) setAviso({ tipo: 'erro', texto: mensagemDe(e) })
      return null
    }
  }

  /** Orçamento novo salvo agora: o endereço passa a ser o dele. */
  const irParaSalvo = (salvo: Orcamento) => {
    if (novo) navigate(`/app/orcamento/${salvo.id}`, { replace: true })
  }

  const imprimirOrcamento = async () => {
    const salvo = await preparar()
    if (!salvo) return
    imprimir()
    irParaSalvo(salvo)
  }

  const montarPdf = async () => {
    if (!papelPdf.current) throw new Error('sem orçamento')
    // Folhas A4 (190 mm do orçamento + 10 mm de margem); se não couber numa, quebra entre as linhas da tabela
    return gerarPdfOrcamento(papelPdf.current)
  }

  const baixarPdf = async () => {
    setGerandoPdf(true)
    try {
      const salvo = await preparar()
      if (!salvo) return
      const { arquivo } = await montarPdf()
      baixarArquivo(arquivo, `orcamento-${numeroCupom(salvo.numero)}.pdf`)
      irParaSalvo(salvo)
    } catch {
      setAviso({ tipo: 'erro', texto: 'Não foi possível gerar o PDF. Tente de novo.' })
    } finally {
      setGerandoPdf(false)
    }
  }

  /** Abre o campo do número já com o telefone da folha (ou o celular do cliente do cadastro). */
  const abrirWhatsapp = (clienteId: string | null) => {
    setWhatsappAberto(true)
    setErroWhatsapp(undefined)
    setFalhaEnvio(undefined)
    if (!numeroWhatsapp && telefoneValido(folha.clienteTelefone)) setNumeroWhatsapp(folha.clienteTelefone)
    else if (clienteId && !numeroWhatsapp)
      obterCliente(sessao.token, clienteId)
        .then((c) => setNumeroWhatsapp((atual) => atual || formatarTelefone(c.celular)))
        .catch(() => {})
  }

  /** Sem número: a API manda para o celular do cliente do orçamento. Se der errado, abre o campo com o aviso. */
  const enviarPdf = async (numero: string | null) => {
    setEnviandoWhatsapp(true)
    setErroWhatsapp(undefined)
    setFalhaEnvio(undefined)
    try {
      const salvo = await preparar()
      if (!salvo) return
      try {
        const { base64 } = await montarPdf()
        const enviado = await enviarOrcamentoWhatsapp(sessao.token, salvo.id, base64, numero)
        setWhatsappAberto(false)
        avisarSalvo('Orçamento enviado pelo WhatsApp', `PDF enviado para ${formatarTelefone(enviado.numero)}`)
      } catch (erro) {
        if (sessaoExpirada(erro)) return
        if (!numero) abrirWhatsapp(salvo.clienteId)
        setFalhaEnvio(erro instanceof Error && !('status' in erro) ? 'Não foi possível gerar o PDF.' : mensagemDe(erro))
      }
      irParaSalvo(salvo)
    } finally {
      setEnviandoWhatsapp(false)
    }
  }

  /** Telefone da folha ou cliente do cadastro: um clique já envia. Sem nenhum dos dois: pede o número. */
  const encaminharWhatsapp = () => {
    if (whatsappAberto) setWhatsappAberto(false)
    else if (telefoneValido(folha.clienteTelefone)) void enviarPdf(folha.clienteTelefone)
    else if (clienteIdAtual) void enviarPdf(null)
    else abrirWhatsapp(null)
  }

  const enviarWhatsapp = () => {
    if (!telefoneValido(numeroWhatsapp)) {
      setErroWhatsapp(numeroWhatsapp ? 'Número incompleto' : 'Digite o WhatsApp do cliente')
      document.getElementById('orc-whatsapp')?.focus()
      return
    }
    void enviarPdf(numeroWhatsapp)
  }

  const acoes =
    original && !finalizado ? (
      !confirmandoExclusao ? (
        <button type="button" className="pagina-botao escuro" onClick={() => setConfirmandoExclusao(true)}>
          <IconeLixeira tamanho={20} />
          Excluir
        </button>
      ) : (
        <>
          <button type="button" className="pagina-botao perigo" onClick={() => void excluir()} disabled={salvando}>
            <IconeLixeira tamanho={20} />
            Confirmar exclusão
          </button>
          <button type="button" className="pagina-botao escuro" onClick={() => setConfirmandoExclusao(false)}>
            Cancelar
          </button>
        </>
      )
    ) : undefined

  const sugestoesCliente =
    sugestoes.length > 0 ? (
      <ul className="orc-sugestoes" aria-label="Clientes encontrados">
        {sugestoes.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => escolherCliente(c)}>
              <strong>{c.nome}</strong>
              <span>{formatarTelefone(c.celular)}</span>
            </button>
          </li>
        ))}
      </ul>
    ) : undefined

  return (
    <div className="pagina tema-orcamento">
      <FaixaPagina
        Ilustracao={IlustracaoOrcamento}
        titulo={original ? `Orçamento Nº ${numeroCupom(original.numero)}` : 'Novo orçamento'}
        subtitulo={
          original
            ? `Feito por ${original.criadoPor} em ${new Date(original.criadoEm).toLocaleDateString('pt-BR')}`
            : 'Digite direto na folha: cliente, linhas da tabela e condições.'
        }
        voltar={{ para: '/app/orcamento', rotulo: MODULO.rotulo }}
        acoes={acoes}
      />

      <div className="orc-dividido">
        {/* ---------- Esquerda: imprimir, PDF, WhatsApp, salvar e finalizar ---------- */}
        <aside className="orc-lado" aria-label="Ações do orçamento">
          {finalizado && (
            <p className="orc-finalizado" role="status">
              <span aria-hidden="true">✅</span>
              Finalizado em{' '}
              {new Date(original!.finalizadoEm!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.
              {original!.cupomId && (
                <Link to={`/app/cupom-fiscal/${original!.cupomId}`} className="orc-link-cupom">
                  Ver cupom Nº {numeroCupom(original!.cupomNumero ?? 0)}
                </Link>
              )}
            </p>
          )}

          <section className="orc-bloco" aria-label="Imprimir e enviar">
            <h2 className="orc-bloco-titulo">Imprimir e enviar</h2>
            <button
              type="button"
              className="pagina-botao cupom-botao-imprimir"
              onClick={() => void imprimirOrcamento()}
              disabled={imprimindo || salvando}
            >
              <span aria-hidden="true">🖨️</span>
              Imprimir orçamento
            </button>
            <button
              type="button"
              className="pagina-botao neutro"
              onClick={() => void baixarPdf()}
              disabled={gerandoPdf || salvando}
            >
              <span aria-hidden="true">📄</span>
              {gerandoPdf ? 'Gerando PDF...' : 'Baixar PDF'}
            </button>
            <button
              type="button"
              className="pagina-botao cupom-botao-whatsapp"
              onClick={encaminharWhatsapp}
              disabled={enviandoWhatsapp || salvando}
              aria-expanded={whatsappAberto}
            >
              <img src="/imgs/whatsapp.png" alt="" aria-hidden="true" />
              {enviandoWhatsapp && !whatsappAberto ? 'Enviando...' : 'Encaminhar para o WhatsApp'}
            </button>
            {whatsappAberto && (
              <div className="cupom-whatsapp">
                <CampoTexto
                  id="orc-whatsapp"
                  rotulo="WhatsApp do cliente"
                  type="tel"
                  inputMode="numeric"
                  placeholder="(16) 99999-9999"
                  valor={numeroWhatsapp}
                  onChange={(v) => {
                    setNumeroWhatsapp(formatarTelefone(v))
                    setErroWhatsapp(undefined)
                  }}
                  erro={erroWhatsapp}
                />
                {falhaEnvio && (
                  <p className="cupom-whatsapp-erro" role="alert">
                    {falhaEnvio}
                  </p>
                )}
                <div className="cupom-cancelamento-botoes">
                  <button
                    type="button"
                    className="pagina-botao cupom-botao-whatsapp"
                    onClick={enviarWhatsapp}
                    disabled={enviandoWhatsapp}
                  >
                    <img src="/imgs/whatsapp.png" alt="" aria-hidden="true" />
                    {enviandoWhatsapp ? 'Enviando...' : 'Enviar PDF'}
                  </button>
                  <button type="button" className="pagina-botao neutro" onClick={() => setWhatsappAberto(false)}>
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </section>

          {!finalizado && (
            <section className="orc-bloco" aria-label="Salvar e finalizar">
              <h2 className="orc-bloco-titulo">Salvar e finalizar</h2>
              <button type="button" className="pagina-botao" onClick={() => void salvar()} disabled={salvando}>
                <IconeCheck tamanho={20} />
                {salvando ? 'Salvando...' : 'Salvar orçamento'}
              </button>
              {/* Finalizar: com a forma de pagamento, gera o cupom com todas as linhas */}
              <div className="orc-finalizar">
                <label htmlFor="orc-forma">Pagamento</label>
                <select id="orc-forma" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f.valor} value={f.valor}>
                      {f.rotulo}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="pagina-botao marinho" onClick={() => void finalizar()} disabled={salvando}>
                <span aria-hidden="true">🧾</span>
                Finalizar e gerar cupom
              </button>
              <Link to="/app/orcamento" className="pagina-botao neutro">
                Cancelar
              </Link>
            </section>
          )}

          <p className="orc-total-lado">
            <span>Total do orçamento</span>
            <strong>{formatarMoeda(finalizado ? original!.total : total)}</strong>
          </p>

          {aviso && <AvisoPagina aviso={aviso} />}
        </aside>

        {/* ---------- Direita: a folha do orçamento, igual ao papel ---------- */}
        <div className="orc-folha-area">
          <div className="orc-papel">
            <OrcamentoFolha
              dados={original ? { ...folha, numero: original.numero } : folha}
              empresa={empresa}
              logoUrl={LOGO_HORIZONTAL}
              editar={finalizado ? undefined : { mudarCampo, mudarLinha, adicionarLinha, sugestoesCliente }}
            />
          </div>
        </div>
      </div>

      {elemento}

      {/* Orçamento para o PDF (folha A4): fora da tela, com margem branca em volta */}
      {papel && (
        <div className="impressao" aria-hidden="true">
          <div ref={papelPdf} className="of-pdf-papel">
            {papel}
          </div>
        </div>
      )}
    </div>
  )
}
